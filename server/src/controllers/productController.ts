// src/controllers/productController.ts - COMPLETE VERSION (with fixed caching for home sorts)
import { Request, Response } from 'express';
import Papa from 'papaparse';
import crypto from 'crypto';
import type { Redis } from 'ioredis';
import Product from '../models/Product';
import type { AuthRequest } from '../types';

/* ───────────────────────────── Helpers ───────────────────────────── */

const normArray = (v: any): string[] => {
  if (Array.isArray(v)) return v.filter(Boolean).map((s) => String(s).trim());
  if (v == null || v === '') return [];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map((s) => String(s).trim());
    } catch {}
    return String(v)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const normNumber = (v: any, def = 0): number =>
  v === '' || v == null || Number.isNaN(Number(v)) ? def : Number(v);

const normSpecs = (value: any): Record<string, any> => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value as Map<string, any>);
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

// escape for regex
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


const makeLooseNameRx = (raw: string) => {
  const parts = raw.trim().split(/[\s\-_]+/).filter(Boolean).map(esc);
  if (!parts.length) return undefined;
  const core = parts.join('[\\s\\-_]+');
  return new RegExp(`^${core}s?$`, 'i');
};


async function fetchByHomeSort(
  sort: 'new' | 'popular' | 'trending',
  limit: number,
  status: 'active' | 'inactive' | 'draft' = 'active'
) {
  const anyProduct: any = Product as any;

  if (typeof anyProduct.getSortedFor === 'function') {
    return anyProduct.getSortedFor({ sort, limit, status });
  }

  // Fallback implementation if model static doesn't exist (won't error)
  const q: any = { isActive: true, status };
  let cursor = Product.find(q);
  if (sort === 'new') {
    cursor = cursor.sort({ createdAt: -1 });
  } else if (sort === 'popular') {
    cursor = cursor.sort({ isPopular: -1 as any, salesCount7d: -1 as any, rating: -1, createdAt: -1 });
  } else if (sort === 'trending') {
    cursor = cursor.sort({ isTrending: -1 as any, salesCount7d: -1 as any, views7d: -1 as any, rating: -1, createdAt: -1 });
  }
  return cursor.limit(Number(limit)).lean();
}

/** Redis cache key builder (versioned namespace + hashed query) */
const makeKey = (ver: string | number, query: any) =>
  'products:' + ver + ':' + crypto.createHash('sha1').update(JSON.stringify(query)).digest('hex');

/* ─────────────────────────── Controllers ─────────────────────────── */

// ✅ Create Product (Admin)
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body || {};

    const productData = {
      name: String(body.name || '').trim(),
      description: String(body.description || '').trim(),
      price: normNumber(body.price),
      originalPrice: body.originalPrice != null ? normNumber(body.originalPrice) : undefined,
      category: body.category,
      subcategory: body.subcategory,
      brand: body.brand || 'Nakoda',

      stockQuantity: normNumber(body.stockQuantity, 0),

      // Normalize inputs
      features: normArray(body.features),
      tags: normArray(body.tags),
      specifications: normSpecs(body.specifications),

      // images
      images: normArray(body.images),
      imageUrl: body.imageUrl || undefined,

      // legacy counters
      rating: 0,
      reviews: 0,

      // visibility
      isActive: true,
      inStock: normNumber(body.stockQuantity, 0) > 0,
      status: 'active' as const,

      // aggregates used by cards
      averageRating: 0,
      ratingsCount: 0,

      // Optional signals (safe defaults if your model has them)
      isTrending: Boolean(body.isTrending),
      isPopular: Boolean(body.isPopular),
      salesCount7d: normNumber(body.salesCount7d, 0),
      views7d: normNumber(body.views7d, 0),

      // misc optional
      sku: body.sku?.trim(),
      color: body.color?.trim(),
      ports: body.ports != null ? normNumber(body.ports) : undefined,
      warrantyPeriodMonths:
        body.warrantyPeriodMonths != null ? normNumber(body.warrantyPeriodMonths) : undefined,
      warrantyType: body.warrantyType,
      manufacturingDetails:
        typeof body.manufacturingDetails === 'object' ? body.manufacturingDetails : {},

      // NEW: only these two SEO fields (clamped)
      metaTitle: typeof body.metaTitle === 'string' ? body.metaTitle.trim().slice(0, 60) : undefined,
      metaDescription:
        typeof body.metaDescription === 'string' ? body.metaDescription.trim().slice(0, 160) : undefined,
    };

    const product = new Product(productData);
    const savedProduct = await product.save();

    // 🔄 Bust product-list caches by bumping namespace version
    try {
      const redis = req.app.get('redis') as Redis | undefined;
      const nsKey = (req.app.get('products_cache_ns_key') as string) ?? 'products:ver';
      if (redis) await redis.incr(nsKey);
    } catch {}

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: savedProduct,
    });
  } catch (error: any) {
    console.error('❌ Create product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create product',
    });
  }
};

// ✅ Get Products (Public - User Facing) — with Redis caching (FIXED for home sorts)
export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,          // may be a slug ("car-charger") or name ("Car Charger")
      brand,             // support brand filter similarly tolerant
      search,            // old param name
      q,                 // alias supported
      sort,              // new|popular|trending (homepage)
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minPrice,
      maxPrice,
      status = 'active',
    } = req.query as any;

    // Wire redis + settings
    const redis = req.app.get('redis') as Redis | undefined;
    const ttl   = (req.app.get('products_cache_ttl') as number) ?? 60;
    const nsKey = (req.app.get('products_cache_ns_key') as string) ?? 'products:ver';

    // Namespace version (increments on writes)
    let ver = '0';
    if (redis) {
      try { ver = (await redis.get(nsKey)) ?? '0'; } catch {}
    }

    // Fast path for homepage sections (no extra filters, first page)
    const effectiveSearch = (q ?? search) || '';
   const isHomeSort = ['new','popular','trending'].includes(String(sort || '').toLowerCase());
const noExtraFilters =
  !effectiveSearch &&
  (!category || category === 'all' || category === '') &&
  !brand && !minPrice && !maxPrice;


    const cachePayloadForKey = {
      page: Number(page),
      limit: Number(limit),
      category,
      brand,
      effectiveSearch,
      sort,
      sortBy,
      sortOrder,
      minPrice,
      maxPrice,
      status,
    };

    // Build cache key for ALL requests (including home sorts)
    const key = makeKey(ver, cachePayloadForKey);

    // Check cache FIRST for all requests
    if (redis) {
      try {
        const hit = await redis.get(key);
        if (hit) {
          const parsed = JSON.parse(hit);
          res.setHeader('X-Cache', 'HIT');
          return res.json(parsed);
        }
      } catch {}
    }

    // === Special homesort route ===
  if (isHomeSort && noExtraFilters) {
  const q: any = { isActive: true, status };
  const sortObj: any =
    String(sort).toLowerCase() === 'new'
      ? { createdAt: -1 }
      : String(sort).toLowerCase() === 'popular'
      ? { isPopular: -1 as any, salesCount7d: -1 as any, rating: -1, createdAt: -1 }
      : { isTrending: -1 as any, salesCount7d: -1 as any, views7d: -1 as any, rating: -1, createdAt: -1 };

  const [products, totalProducts] = await Promise.all([
    Product.find(q)
      .sort(sortObj)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(q),
  ]);
  const totalPages = Math.ceil(totalProducts / Number(limit));

  const payload = {
    success: true,
    products: products || [],
    total: totalProducts,                   // ✅ FE reads this
    pagination: {
      currentPage: Number(page),
      totalPages,
      totalProducts,
      total: totalProducts,                 // ✅ FE also checks this
      hasMore: Number(page) < totalPages,
      limit: Number(limit),
    },
  };

  if (redis) { try { await redis.setex(key, ttl, JSON.stringify(payload)); } catch {} }
  res.setHeader('X-Cache', 'MISS');
  return res.json(payload);
}


    // === Generic listing path (search/category/brand/price/pagination) ===
    const query: any = { isActive: true, status };

    if (category && category !== 'all' && category !== '') {
      const rx = makeLooseNameRx(String(category));
      if (rx) query.category = rx;
    }

    if (brand && brand !== 'all' && brand !== '') {
      const rx = makeLooseNameRx(String(brand));
      if (rx) query.brand = rx;
    }
// search filter: only run when >= 2 chars, and fix tags match
if (typeof effectiveSearch === 'string' && effectiveSearch.trim().length >= 2) {
  const rx = new RegExp(esc(effectiveSearch.trim()), 'i');
  query.$or = [
    { name: rx },
    { description: rx },
    { brand: rx },
    { category: rx },
    { tags: rx }, // array of strings can match regex directly
  ];
}


    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    function mapFrontendSort(token?: string): Record<string, 1 | -1> {
  switch (String(token || '').toLowerCase()) {
    case 'name':       return { name: 1 };
    case 'price-low':  return { price: 1 };
    case 'price-high': return { price: -1 };
    case 'rating':     return { rating: -1, reviews: -1, createdAt: -1 };
    default:           return { createdAt: -1 };
  }
}
const sortOptions = mapFrontendSort(sort);

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-__v')
      .lean();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / Number(limit));

   // after computing totalProducts & totalPages
const payload = {
  success: true,
  products: products || [],
  total: totalProducts,              // <-- add
  pagination: {
    currentPage: Number(page),
    totalPages,
    totalProducts,
    total: totalProducts,            // <-- add
    hasMore: Number(page) < totalPages,
    limit: Number(limit),
  },
};


    // Store in cache
    if (redis) {
      try { await redis.setex(key, ttl, JSON.stringify(payload)); } catch {}
    }

    res.setHeader('X-Cache', 'MISS');
    return res.json(payload);
  } catch (error: any) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products',
      products: [],
    });
  }
};

// ✅ Get All Products (Admin)
export const getAllProducts = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any;

    const query: any = {};

    if (search) {
      const rx = new RegExp(esc(String(search)), 'i');
      query.$or = [
        { name: rx },
        { description: rx },
        { brand: rx },
        { tags: { $elemMatch: rx } },
        { sku: rx },
      ];
    }

    if (category && category !== 'all') {
      const rx = makeLooseNameRx(String(category));
      query.category = rx ?? String(category);
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-__v')
      .lean();

    const totalProducts = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / Number(limit)),
        totalProducts,
        hasMore: Number(page) < Math.ceil(totalProducts / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error('❌ Admin get products error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch products',
    });
  }
};

// ✅ Debug endpoint
export const debugProducts = async (_req: Request, res: Response) => {
  try {
    const recent = await Product.find({})
      .select('name isActive status inStock stockQuantity category brand createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const activeCount = await Product.countDocuments({ isActive: true, status: 'active' });
    const inactiveCount = await Product.countDocuments({
      $or: [{ isActive: false }, { status: { $ne: 'active' } }],
    });

    // quick category/brand distribution (helpful to verify names)
    const byCategory = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    const byBrand = await Product.aggregate([
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    res.json({
      success: true,
      summary: {
        totalPreviewed: recent.length,
        active: activeCount,
        inactive: inactiveCount,
      },
      topCategories: byCategory,
      topBrands: byBrand,
      recentProducts: recent.map((p: any) => ({
        _id: p._id,
        name: p.name,
        isActive: p.isActive,
        status: p.status,
        inStock: p.inStock,
        stockQuantity: p.stockQuantity,
        category: p.category,
        brand: p.brand,
        createdAt: p.createdAt,
        visibleToUsers: Boolean(p.isActive && p.status === 'active'),
      })),
    });
  } catch (error: any) {
    console.error('❌ Debug products error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Get single product
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).select('-__v').lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json({ success: true, product });
  } catch (error: any) {
    console.error('❌ Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch product',
    });
  }
};

// ✅ Update product
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const updateData: any = { ...body };

    if (updateData.stockQuantity !== undefined) {
      updateData.stockQuantity = normNumber(updateData.stockQuantity);
      updateData.inStock = updateData.stockQuantity > 0;
    }
    if (updateData.price !== undefined) updateData.price = normNumber(updateData.price);
    if (updateData.originalPrice !== undefined && updateData.originalPrice !== null) {
      updateData.originalPrice = normNumber(updateData.originalPrice);
    }
    if (updateData.features !== undefined) updateData.features = normArray(updateData.features);
    if (updateData.tags !== undefined) updateData.tags = normArray(updateData.tags);
    if (updateData.specifications !== undefined)
      updateData.specifications = normSpecs(updateData.specifications);
    if (updateData.images !== undefined) updateData.images = normArray(updateData.images);
    if (updateData.imageUrl === '') updateData.imageUrl = undefined; // clear if empty

    // Optional signals normalization
    if (updateData.salesCount7d !== undefined) updateData.salesCount7d = normNumber(updateData.salesCount7d);
    if (updateData.views7d !== undefined) updateData.views7d = normNumber(updateData.views7d);
    if (updateData.isTrending !== undefined) updateData.isTrending = Boolean(updateData.isTrending);
    if (updateData.isPopular !== undefined) updateData.isPopular = Boolean(updateData.isPopular);

    // NEW: clamp if provided
    if (updateData.metaTitle !== undefined && updateData.metaTitle !== null) {
      updateData.metaTitle = String(updateData.metaTitle).trim().slice(0, 60);
    }
    if (updateData.metaDescription !== undefined && updateData.metaDescription !== null) {
      updateData.metaDescription = String(updateData.metaDescription).trim().slice(0, 160);
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // 🔄 Bust product-list caches by bumping namespace version
    try {
      const redis = req.app.get('redis') as Redis | undefined;
      const nsKey = (req.app.get('products_cache_ns_key') as string) ?? 'products:ver';
      if (redis) await redis.incr(nsKey);
    } catch {}

    res.json({ success: true, message: 'Product updated successfully', product });
  } catch (error: any) {
    console.error('❌ Update product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update product',
    });
  }
};

// ✅ Delete product
export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // 🔄 Bust product-list caches by bumping namespace version
    try {
      const redis = req.app.get('redis') as Redis | undefined;
      const nsKey = (req.app.get('products_cache_ns_key') as string) ?? 'products:ver';
      if (redis) await redis.incr(nsKey);
    } catch {}

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete product',
    });
  }
};

/* ─────────────────────────── Bulk CSV Upload ─────────────────────────── */

type CsvRow = {
  Name: string;
  Description: string;
  Price: string;
  Category: string;
  Subcategory?: string;
  Brand?: string;
  SKU?: string;
  ImageURL?: string;
  Images?: string;        // comma-separated
  StockQuantity?: string;
  Specifications?: string; // JSON

  // NEW (exactly these two)
  MetaTitle?: string;       // <= 60 chars
  MetaDescription?: string; // <= 160 chars
};

export const bulkUploadProducts = async (req: AuthRequest, res: Response) => {
  try {
    const csvText: string =
      (req as any).file ? (req as any).file.buffer.toString('utf8') : (req.body.csv || '');

    const { data, errors } = Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    if (errors?.length) {
      return res.status(400).json({ success: false, message: 'CSV parse error', errors });
    }

    const toInsert = data.map((r) => {
      const imagesArr = r.Images
        ? r.Images.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      // clamp the two SEO fields if provided (leave undefined if blank)
      const metaTitle =
        typeof r.MetaTitle === 'string' && r.MetaTitle.trim()
          ? r.MetaTitle.trim().slice(0, 60)
          : undefined;

      const metaDescription =
        typeof r.MetaDescription === 'string' && r.MetaDescription.trim()
          ? r.MetaDescription.trim().slice(0, 160)
          : undefined;

      return {
        name: r.Name,
        description: r.Description,
        price: Number(r.Price || 0),
        category: r.Category,
        subcategory: r.Subcategory || undefined,
        brand: r.Brand || 'Nakoda',
        imageUrl: r.ImageURL || undefined,
        images: imagesArr,
        stockQuantity: Number(r.StockQuantity || 0),
        inStock: Number(r.StockQuantity || 0) > 0,

        // SKU unchanged
        sku: r.SKU?.trim() ? r.SKU.trim() : undefined,

        // ONLY these two new fields
        metaTitle,
        metaDescription,

        // keep same defaults
        isActive: true,
        status: 'active' as const,
      };
    });

    // Keep your existing insert behavior
    const inserted = await Product.insertMany(toInsert, { ordered: false });

    // 🔄 Bust cache after bulk insert
    try {
      const redis = req.app.get('redis') as Redis | undefined;
      const nsKey = (req.app.get('products_cache_ns_key') as string) ?? 'products:ver';
      if (redis) await redis.incr(nsKey);
    } catch {}

    return res.json({ success: true, inserted: inserted.length });
  } catch (err: any) {
    if (err?.writeErrors?.length) {
      const dupes = err.writeErrors.filter((e: any) => e.code === 11000);
      return res.status(207).json({
        success: false,
        message: 'Bulk upload partial success',
        duplicates: dupes.map((e: any) => ({ index: e.index, errmsg: e.errmsg })),
      });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};