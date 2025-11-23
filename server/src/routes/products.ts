// src/routes/products.ts - Refactored to use controller for main listing
import express from 'express';
import mongoose, { SortOrder } from 'mongoose';
import Product from '../models/Product';
import type { Redis } from 'ioredis';
import * as productController from '../controllers/productController';

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Utilities (kept for specialized routes)                           */
/* ------------------------------------------------------------------ */
const toNumber = (v: any, d: number) => (v == null || v === '' ? d : Number(v));
const isNonEmpty = (v: any) => typeof v === 'string' && v.trim() !== '';

/** Translate FE sort tokens to Mongo sort objects */
const sortMap: Record<string, Record<string, SortOrder>> = {
  createdAt: { createdAt: -1 },
  price: { price: 1 },
  rating: {
    averageRating: -1,
    rating: -1,
    reviewsCount: -1,
    reviewCount: -1,
    reviews: -1,
  },
  trending: { trendingScore: -1, updatedAt: -1, createdAt: -1 },
};

function getSort(
  sortBy?: string | string[],
  order?: string | string[]
): Record<string, SortOrder> {
  const sb = Array.isArray(sortBy) ? sortBy[0] : sortBy;
  const ord: SortOrder = (Array.isArray(order) ? order[0] : order) === 'asc' ? 1 : -1;

  if (sb && sortMap[sb]) {
    const obj = { ...sortMap[sb] };
    const keys = Object.keys(obj);
    if (keys.length === 1) obj[keys[0]] = ord;
    return obj;
  }
  return { createdAt: -1 };
}

/* Common projection inc. rating aliases + WHOLESALE FIELDS */
const LIST_FIELDS =
  'name description price stockQuantity category brand images ' +
  'rating averageRating reviews reviewsCount ratingsCount reviewCount ' +
  'inStock isActive specifications createdAt updatedAt ' +
  'wholesaleEnabled wholesalePrice wholesaleMinQty';


router.get('/search', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice } = req.query as Record<string, string>;

    if (!isNonEmpty(q)) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const filter: any = {
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ],
    };

    if (isNonEmpty(category) && category !== 'all') filter.category = category;
    if (minPrice) filter.price = { ...(filter.price || {}), $gte: Number(minPrice) };
    if (maxPrice) filter.price = { ...(filter.price || {}), $lte: Number(maxPrice) };

    const products = await Product.find(filter).sort({ createdAt: -1 }).select(LIST_FIELDS).lean();

    res.json({
      success: true,
      message: 'Search completed',
      products,
      query: q,
      count: products.length,
    });
  } catch (error: any) {
    console.error('❌ /products/search error:', error);
    res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
});

/**
 * GET /products/categories  → distinct category names
 */
router.get('/categories', async (_req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json({ success: true, categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
});

/**
 * GET /products/categories/list  → categories with counts
 */
router.get('/categories/list', async (_req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { isActive: true, inStock: { $ne: false } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, message: 'Categories fetched', categories });
  } catch (error: any) {
    console.error('❌ /products/categories/list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
});

/**
 * GET /products/trending?limit=12
 */
router.get('/trending', async (req, res) => {
  try {
    const { limit = '12' } = req.query as Record<string, string>;
    const l = Math.min(1000, Math.max(1, Number(limit) || 12));

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const results = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $addFields: {
          _rating: { $ifNull: ['$averageRating', { $ifNull: ['$rating', 0] }] },
          _reviews: { $ifNull: ['$reviewsCount', { $ifNull: ['$reviews', 0] }] },
          _recent: { $cond: [{ $gte: ['$updatedAt', thirtyDaysAgo] }, 1, 0] },
        },
      },
      {
        $addFields: {
          trendingScore: {
            $add: [{ $multiply: ['$_rating', '$_reviews'] }, { $multiply: ['$_recent', 10] }],
          },
        },
      },
      { $sort: { trendingScore: -1, updatedAt: -1, createdAt: -1 } },
      { $limit: l },
      {
        $project: {
          name: 1,
          description: 1,
          price: 1,
          stockQuantity: 1,
          category: 1,
          brand: 1,
          images: 1,
          rating: 1,
          averageRating: 1,
          reviews: 1,
          reviewsCount: 1,
          reviewCount: 1,
          inStock: 1,
          isActive: 1,
          specifications: 1,
          createdAt: 1,
          updatedAt: 1,
          trendingScore: 1,
          // wholesale fields
          wholesaleEnabled: 1,
          wholesalePrice: 1,
          wholesaleMinQty: 1,
        },
      },
    ]);

    res.json({ success: true, message: 'Trending products', products: results, count: results.length });
  } catch (error: any) {
    console.error('❌ /products/trending error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending products', error: error.message });
  }
});

// GET /products/slug/:slug  -> find by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await Product.findOne({ slug }).lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    return res.json({ success: true, message: 'Product details fetched', product, cached: false });
  } catch (error: any) {
    console.error('❌ /products/slug/:slug error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product details', error: error.message });
  }
});

/**
 * GET /products/brand/:brand
 */
router.get('/brand/:brand', async (req, res) => {
  try {
    const { brand } = req.params;
    const { limit = '12', excludeId } = req.query as Record<string, string>;

    const filter: any = { brand, isActive: true };
    if (excludeId && mongoose.isValidObjectId(excludeId)) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(1000, Math.max(1, Number(limit) || 12)))
      .select(LIST_FIELDS)
      .lean();

    res.json({ success: true, message: `Products in brand ${brand}`, products, count: products.length });
  } catch (error: any) {
    console.error('❌ /products/brand error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch brand products', error: error.message });
  }
});

/**
 * GET /products/category/:category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;

    const products = await Product.find({ category, isActive: true })
      .sort({ createdAt: -1 })
      .select(LIST_FIELDS)
      .lean();

    res.json({
      success: true,
      message: `Products in ${category} category`,
      products,
      category,
      count: products.length,
    });
  } catch (error: any) {
    console.error('❌ /products/category error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category products', error: error.message });
  }
});

/**
 * GET /products/:id/related
 */
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '12' } = req.query as Record<string, string>;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product id format' });
    }

    const base = await Product.findById(id).select('category brand').lean();
    if (!base) return res.status(404).json({ success: false, message: 'Base product not found' });

    const filter: any = {
      _id: { $ne: new mongoose.Types.ObjectId(id) },
      isActive: true,
      $or: [{ category: base.category }, { brand: base.brand }],
    };

    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .limit(Math.min(1000, Math.max(1, Number(limit) || 12)))
      .select(LIST_FIELDS)
      .lean();

    res.json({ success: true, message: 'Related products', products, count: products.length });
  } catch (error: any) {
    console.error('❌ /products/:id/related error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch related products', error: error.message });
  }
});

/**
 * GET /products/:id (single product) — with Redis cache
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const redis = req.app.get('redis') as Redis | undefined;
    const cacheKey = `product:${id}`;

    const findDoc = async () => {
      if (mongoose.isValidObjectId(id)) {
        const byId = await Product.findById(id).select('-__v').lean();
        if (byId) return byId;
      }
      // fallback by slug/sku/productId
      return Product.findOne({
        $or: [{ slug: id }, { sku: id }, { productId: id }],
      })
        .select('-__v')
        .lean();
    };

    if (redis) {
      const hit = await redis.get(cacheKey);
      if (hit) {
        res.setHeader('X-Cache', 'HIT');
        return res.json({ ...JSON.parse(hit), cached: true });
      }
    }

    const product = await findDoc();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const payload = { success: true, message: 'Product details fetched', product, cached: false };
    if (redis) await redis.setex(cacheKey, 120, JSON.stringify(payload));

    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (error: any) {
    console.error('❌ /products/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product details', error: error.message });
  }
});


 
router.get('/', productController.getProducts);

export default router;
