// src/services/productService.ts
import api from '../config/api';
import { Product } from '../types';
import { resolveImageUrl } from '../utils/imageUtils';

/* ───────────────────────────── Types ───────────────────────────── */
export interface ProductsResponse {
  products: Product[];
  totalPages: number;
  currentPage: number;
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  search?: string;      // FE uses "search"; we also accept "q" and normalize
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'createdAt' | 'price' | 'rating' | 'trending';
  sortOrder?: 'asc' | 'desc';
  excludeId?: string;
}

/* ─────────────────────────── Constants ─────────────────────────── */
const DEFAULT_LIMIT = 24;   // pagination default
const MAX_LIMIT = 100;      // safety cap
const MC_TTL = 15_000;      // in-memory TTL

/* ─────────────────────────── Utilities ─────────────────────────── */
const coerceNumber = (v: any): number | undefined => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// Accept URLs, S3 keys, or objects {url|secure_url}, return string URL or ''.
const extractUrlLike = (x: any): string => {
  if (!x) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'object') {
    return (
      x.secure_url ||
      x.url ||
      x.path ||
      x.location || // some S3 libs
      x.Location || // AWS SDK v2 putObject response
      x.key ||      // if a raw key leaks through
      ''
    );
  }
  return '';
};

// Normalize imageUrl + images (handles S3 keys and Cloudinary URLs)
function normalizeImages(p: any): { imageUrl?: string; images: string[] } {
  const arrayCandidates: any[] =
    (Array.isArray(p?.images) && p.images) ||
    (Array.isArray(p?.gallery) && p.gallery) ||
    (Array.isArray(p?.photos) && p.photos) ||
    (Array.isArray(p?.pictures) && p.pictures) ||
    [];

  const imagesResolved = arrayCandidates
    .map(extractUrlLike)
    .map((s) => resolveImageUrl(s))
    .filter(Boolean) as string[];

  const primaryCandidates = [
    p?.imageUrl,
    p?.imageURL,
    p?.image,
    p?.thumbnail,
    p?.cover,
    p?.mainImage,
    p?.s3Url,
    p?.s3Key,
    imagesResolved[0],
  ];

  const imageUrl = (primaryCandidates
    .map(extractUrlLike)
    .map((s) => resolveImageUrl(s))
    .find(Boolean) || undefined) as string | undefined;

  const images =
    imageUrl && imagesResolved.length
      ? [imageUrl, ...imagesResolved.filter((u) => u !== imageUrl)]
      : imagesResolved;

  return { imageUrl, images };
}

function normalizeSpecifications(input: any): Record<string, any> {
  if (input == null) return {};
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof Map !== 'undefined' && input instanceof Map) {
    return Object.fromEntries(input as Map<string, any>);
  }
  if (typeof input === 'object' && !Array.isArray(input)) return input;
  return {};
}

function normalizeProduct(p: any): Product {
  const avg =
    coerceNumber(p?.averageRating) ??
    coerceNumber(p?.ratingAvg) ??
    coerceNumber(p?.ratingAverage) ??
    coerceNumber(p?.rating) ??
    0;

  const count =
    coerceNumber(p?.ratingsCount) ??
    coerceNumber(p?.reviewCount) ??
    coerceNumber(p?.reviewsCount) ??
    coerceNumber(p?.numReviews) ??
    (Array.isArray(p?.reviews) ? p.reviews.length : undefined) ??
    0;

  const { imageUrl, images } = normalizeImages(p);

  return {
    ...p,
    averageRating: avg,
    rating: avg,
    ratingsCount: count,
    reviewCount: count,
    reviewsCount: count,
    imageUrl,
    images,
    specifications: normalizeSpecifications(p?.specifications),
  } as Product;
}

function normalizeProductsResponse(data: any): ProductsResponse {
  // Accept common shapes
  const rawArray =
    (Array.isArray(data?.products) && data.products) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data) ||
    [];

  const products: Product[] = rawArray.map(normalizeProduct);

  const pag = data?.pagination ?? {};
  const pages =
    Number(pag.pages ?? data?.pages ?? data?.totalPages ?? 1) || 1;
  const page =
    Number(pag.page ?? data?.page ?? data?.currentPage ?? 1) || 1;
  const total =
    Number(pag.total ?? data?.total ?? products.length) || products.length;
  const limit =
    Number(pag.limit ?? data?.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
  const hasMore =
    typeof pag.hasMore === 'boolean'
      ? pag.hasMore
      : page * limit < total;

  return {
    products,
    totalPages: pages,
    currentPage: page,
    total,
    pagination: { page, limit, total, pages, hasMore },
  };
}

// slug helpers
const slugify = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const unslug = (s?: string) => (s ? s.replace(/-/g, ' ').trim() : '');

// Canonical map: slug/aliases -> exact DB name
const CATEGORY_ALIAS_TO_NAME: Record<string, string> = {
  tws: 'TWS',
  'bluetooth-neckband': 'Bluetooth Neckbands',
  'bluetooth-neckbands': 'Bluetooth Neckbands',
  'data-cable': 'Data Cables',
  'data-cables': 'Data Cables',
  'mobile-charger': 'Mobile Chargers',
  'mobile-chargers': 'Mobile Chargers',
  'car-charger': 'Car Chargers',
  'car-chargers': 'Car Chargers',
  'bluetooth-speaker': 'Bluetooth Speakers',
  'bluetooth-speakers': 'Bluetooth Speakers',
  'power-bank': 'Power Banks',
  'power-banks': 'Power Banks',
  'integrated-circuits-chips': 'Integrated Circuits & Chips',
  'mobile-repairing-tools': 'Mobile Repairing Tools',
  electronics: 'Electronics',
  accessories: 'Accessories',
  'mobile-ics': 'Mobile ICs',
  'mobile-accessories': 'Mobile Accessories',
  others: 'Others',
  chargers: 'Mobile Chargers',
  neckband: 'Bluetooth Neckbands',
  neckbands: 'Bluetooth Neckbands',
  cables: 'Data Cables',
  speakers: 'Bluetooth Speakers',
  banks: 'Power Banks',
  ics: 'Integrated Circuits & Chips',
};

const normalizeFiltersForApi = (f: ProductFilters = {}): ProductFilters => {
  const out: ProductFilters = { ...f };

  // allow q alias
  const anyF = f as any;
  if (anyF.q && !out.search) out.search = anyF.q;
  delete (out as any).q;

  if (out.category) {
    const slug = slugify(String(out.category));
    out.category = CATEGORY_ALIAS_TO_NAME[slug] || String(out.category);
  }

  if (out.brand) {
    if (/-/.test(String(out.brand))) out.brand = unslug(String(out.brand));
  }

  return out;
};

// tiny in-memory cache
const memCache = new Map<string, { data: ProductsResponse; ts: number }>();

const keyOf = (path: string, params?: Record<string, any>) =>
  `${path}?` +
  new URLSearchParams(
    Object.entries(params || {}).reduce((acc, [k, v]) => {
      if (v != null) acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>)
  ).toString();

/* ─────────────────────────── Service ─────────────────────────── */
export const productService = {
  /* Core paginated getter */
  async getProducts(filters: ProductFilters = {}, forceRefresh = false): Promise<ProductsResponse> {
    try {
      const nf = normalizeFiltersForApi(filters);

      // Build params; clamp limit after spread
      const params: Record<string, any> = {
        page: nf.page ?? 1,
        ...nf,
        limit: Math.min(MAX_LIMIT, Number(nf.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
        ...(forceRefresh ? { _t: Date.now() } : {}),
      };

      const urlKey = keyOf('/products', params);
      const mustRefresh = forceRefresh || this.shouldRefresh();

      if (!mustRefresh) {
        const hit = memCache.get(urlKey);
        if (hit && Date.now() - hit.ts < MC_TTL) return hit.data;
      }

      const response = await api.get('/products', { params });
      const normalized = normalizeProductsResponse(response.data);

      memCache.set(urlKey, { data: normalized, ts: Date.now() });
      localStorage.setItem('products-cache', JSON.stringify({ data: normalized, timestamp: Date.now() }));

      return normalized;
    } catch (error) {
      console.error('❌ Failed to fetch products:', error);
      const cached = this.getCachedProducts();
      if (cached) return cached;
      throw error;
    }
  },

  /* Convenience list returning only array */
  async list(filters: ProductFilters = {}, limit = filters.limit ?? DEFAULT_LIMIT): Promise<Product[]> {
    const res = await this.getProducts({ ...filters, limit });
    const items = res.products.filter((p) => {
      const pid = (p as any)._id || (p as any).id;
      return !filters.excludeId || pid !== filters.excludeId;
    });
    return items;
  },

  async getRelatedProducts(id: string, limit = 12): Promise<Product[]> {
    try {
      // Primary endpoint
      const r1 = await api.get(`/products/${id}/related`, { params: { limit } });
      const list1 = (Array.isArray(r1?.data?.products) ? r1.data.products : r1?.data) || [];
      if (list1.length) return list1.map(normalizeProduct);
    } catch {}

    // Fallback: by category
    try {
      const { product } = await this.getProduct(id);
      const byCat = await this.list(
        { category: (product as any).category, excludeId: (product as any)._id || (product as any).id },
        limit + 5
      );
      if (byCat.length) return byCat.slice(0, limit);
    } catch {}

    // Last resort: trending
    return this.getTrending(limit);
  },

  async getTrending(limit = 12): Promise<Product[]> {
    try {
      const r = await api.get('/products/trending', { params: { limit } });
      const arr = (Array.isArray(r?.data?.products) ? r.data.products : r?.data) || [];
      if (arr.length) return arr.map(normalizeProduct);
    } catch {}
    // Fallback via generic list with sortBy=trending
    const list = await this.list({ sortBy: 'trending', sortOrder: 'desc' }, limit);
    return list.slice(0, limit);
  },

  async getByBrand(brand: string, limit = 12, excludeId?: string): Promise<Product[]> {
    const items = await this.list({ brand, excludeId }, limit);
    return items.slice(0, limit);
  },

  async search(query: string, filters: Omit<ProductFilters, 'search'> = {}, limit = 20): Promise<Product[]> {
    const items = await this.list({ ...filters, search: query }, limit);
    return items.slice(0, limit);
  },

  async getProduct(id: string): Promise<{ success: boolean; product: Product; message?: string }> {
    try {
      if (!id || id.length !== 24) {
        throw new Error('Invalid product ID format. Product IDs must be 24-character MongoDB ObjectIds.');
      }
      const response = await api.get(`/products/${id}`);
      const product = normalizeProduct(response?.data?.product);
      return { success: true, product, message: response?.data?.message };
    } catch (error: any) {
      console.error('❌ Failed to fetch single product:', error);
      if (error.response?.status === 404) throw new Error('Product not found or has been removed.');
      if (error.response?.status === 400) throw new Error('Invalid product ID. Please check the product link.');
      if (error.message?.includes('Cast to ObjectId')) {
        throw new Error('Invalid product ID format. Product IDs must be 24-character MongoDB ObjectIds.');
      }
      throw new Error(error.response?.data?.message || 'Failed to load product details. Please try again.');
    }
  },

  async createProduct(formData: FormData): Promise<{ message: string; product: Product }> {
    const response = await api.post('/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    this.clearCache(); this.setRefreshFlag();
    const product = normalizeProduct(response?.data?.product);
    return { ...(response.data || {}), product };
  },

  async updateProduct(id: string, formData: FormData): Promise<{ message: string; product: Product }> {
    const response = await api.put(`/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    this.clearCache(); this.setRefreshFlag();
    const product = normalizeProduct(response?.data?.product);
    return { ...(response.data || {}), product };
  },

  async deleteProduct(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/products/${id}`);
    this.clearCache(); this.setRefreshFlag();
    return response.data;
  },

  async getCategories(): Promise<{ categories: string[] }> {
    const response = await api.get('/products/categories');
    return response.data;
  },

  /* Cache + refresh flags */
  setRefreshFlag() {
    sessionStorage.setItem('force-refresh-products', 'true');
    localStorage.setItem('force-refresh-products', Date.now().toString());
  },

  shouldRefresh(): boolean {
    const sessionFlag = sessionStorage.getItem('force-refresh-products');
    const globalFlag = localStorage.getItem('force-refresh-products');
    if (sessionFlag || globalFlag) {
      sessionStorage.removeItem('force-refresh-products');
      if (globalFlag) {
        const flagTime = parseInt(globalFlag, 10);
        if (Date.now() - flagTime > 30_000) localStorage.removeItem('force-refresh-products');
      }
      return true;
    }
    return false;
  },

  clearCache() {
    localStorage.removeItem('products-cache');
    sessionStorage.removeItem('products-cache');
    memCache.clear();
  },

  getCachedProducts(): ProductsResponse | null {
    try {
      const cached = localStorage.getItem('products-cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300_000) return data;
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  },

  async refreshProducts(filters: ProductFilters = {}): Promise<ProductsResponse> {
    this.clearCache();
    this.setRefreshFlag();
    return this.getProducts(filters, true);
  },
};
