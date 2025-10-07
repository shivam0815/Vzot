// src/services/productService.ts
import api from '../config/api';
import { Product } from '../types';
import { resolveImageUrl } from '../utils/imageUtils';

/* ── Types ───────────────────────────────────────────────────────── */
export interface ProductsResponse {
  products: Product[];
  totalPages: number;
  currentPage: number;
  total: number;
  pagination: { page: number; limit: number; total: number; pages: number; hasMore: boolean };
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  search?: string;     // FE uses "search"; alias "q" also supported
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'createdAt' | 'price' | 'rating' | 'trending';
  sortOrder?: 'asc' | 'desc';
  excludeId?: string;
}

/* ── Constants ───────────────────────────────────────────────────── */
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const MC_TTL = 15_000;

/* ── Utils ───────────────────────────────────────────────────────── */
const coerceNumber = (v: any) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const extractUrlLike = (x: any): string => {
  if (!x) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'object') {
    return x.secure_url || x.url || x.path || x.location || x.Location || x.key || '';
  }
  return '';
};

function normalizeImages(p: any): { imageUrl?: string; images: string[] } {
  const arr: any[] =
    (Array.isArray(p?.images) && p.images) ||
    (Array.isArray(p?.gallery) && p.gallery) ||
    (Array.isArray(p?.photos) && p.photos) ||
    (Array.isArray(p?.pictures) && p.pictures) ||
    [];

  const resolved = arr.map(extractUrlLike).map(resolveImageUrl).filter(Boolean) as string[];

  const primary = [
    p?.imageUrl, p?.imageURL, p?.image, p?.thumbnail, p?.cover, p?.mainImage, p?.s3Url, p?.s3Key, resolved[0],
  ];

  const imageUrl =
    primary.map(extractUrlLike).map(resolveImageUrl).find(Boolean) || undefined;

  const images = imageUrl && resolved.length ? [imageUrl, ...resolved.filter(u => u !== imageUrl)] : resolved;
  return { imageUrl, images };
}

function normalizeSpecifications(input: any): Record<string, any> {
  if (input == null) return {};
  if (typeof input === 'string') {
    try { const o = JSON.parse(input); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
    catch { return {}; }
  }
  if (typeof Map !== 'undefined' && input instanceof Map) return Object.fromEntries(input as Map<string, any>);
  if (typeof input === 'object' && !Array.isArray(input)) return input;
  return {};
}

function normalizeProduct(p: any): Product {
  const avg =
    coerceNumber(p?.averageRating) ??
    coerceNumber(p?.ratingAvg) ??
    coerceNumber(p?.ratingAverage) ??
    coerceNumber(p?.rating) ?? 0;

  const count =
    coerceNumber(p?.ratingsCount) ??
    coerceNumber(p?.reviewCount) ??
    coerceNumber(p?.reviewsCount) ??
    coerceNumber(p?.numReviews) ??
    (Array.isArray(p?.reviews) ? p.reviews.length : undefined) ?? 0;

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
  const raw =
    (Array.isArray(data?.products) && data.products) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data) || [];

  const products: Product[] = raw.map(normalizeProduct);

  const pag = data?.pagination ?? {};
  const pages = Number(pag.pages ?? data?.pages ?? data?.totalPages ?? 1) || 1;
  const page  = Number(pag.page  ?? data?.page  ?? data?.currentPage ?? 1) || 1;
  const total = Number(pag.total ?? data?.total ?? products.length) || products.length;
  const limit = Number(pag.limit ?? data?.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
  const hasMore = typeof pag.hasMore === 'boolean' ? pag.hasMore : page * limit < total;

  return { products, totalPages: pages, currentPage: page, total, pagination: { page, limit, total, pages, hasMore } };
}

const slugify = (s: string) =>
  (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
const unslug = (s?: string) => (s ? s.replace(/-/g, ' ').trim() : '');

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
  const anyF = f as any;
  if (anyF.q && !out.search) out.search = anyF.q; // support ?q=
  delete (out as any).q;

  if (out.category) {
    const slug = slugify(String(out.category));
    out.category = CATEGORY_ALIAS_TO_NAME[slug] || String(out.category);
  }
  if (out.brand && /-/.test(String(out.brand))) out.brand = unslug(String(out.brand));
  return out;
};

/* in-memory cache */
const memCache = new Map<string, { data: ProductsResponse; ts: number }>();
const keyOf = (path: string, params?: Record<string, any>) =>
  `${path}?` +
  new URLSearchParams(
    Object.entries(params || {}).reduce((a, [k, v]) => { if (v != null) a[k] = String(v); return a; }, {} as Record<string,string>)
  ).toString();

/* ── Service ─────────────────────────────────────────────────────── */
export const productService = {
  // accepts AbortSignal so callers can cancel in-flight fetch
  async getProducts(
    filters: ProductFilters = {},
    forceRefresh = false,
    signal?: AbortSignal
  ): Promise<ProductsResponse> {
    try {
      const nf = normalizeFiltersForApi(filters);
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

      const response = await api.get('/products', { params, signal });
      const normalized = normalizeProductsResponse(response.data);

      memCache.set(urlKey, { data: normalized, ts: Date.now() });
      localStorage.setItem('products-cache', JSON.stringify({ data: normalized, timestamp: Date.now() }));
      return normalized;
    } catch (error) {
      // ignore aborts
      // @ts-ignore
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || error?.message === 'canceled') {
        throw error;
      }
      console.error('❌ Failed to fetch products:', error);
      const cached = this.getCachedProducts();
      if (cached) return cached;
      throw error;
    }
  },

  async list(filters: ProductFilters = {}, limit = filters.limit ?? DEFAULT_LIMIT): Promise<Product[]> {
    const res = await this.getProducts({ ...filters, limit });
    return res.products.filter(p => {
      const pid = (p as any)._id || (p as any).id;
      return !filters.excludeId || pid !== filters.excludeId;
    });
  },

  async getRelatedProducts(id: string, limit = 12): Promise<Product[]> {
    try {
      const r1 = await api.get(`/products/${id}/related`, { params: { limit } });
      const list1 = (Array.isArray(r1?.data?.products) ? r1.data.products : r1?.data) || [];
      if (list1.length) return list1.map(normalizeProduct);
    } catch {}
    try {
      const { product } = await this.getProduct(id);
      const byCat = await this.list({ category: (product as any).category, excludeId: (product as any)._id || (product as any).id }, limit + 5);
      if (byCat.length) return byCat.slice(0, limit);
    } catch {}
    return this.getTrending(limit);
  },

  async getTrending(limit = 12): Promise<Product[]> {
    try {
      const r = await api.get('/products/trending', { params: { limit } });
      const arr = (Array.isArray(r?.data?.products) ? r.data.products : r?.data) || [];
      if (arr.length) return arr.map(normalizeProduct);
    } catch {}
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
      if (!id || id.length !== 24) throw new Error('Invalid product ID format. Must be 24-char ObjectId.');
      const response = await api.get(`/products/${id}`);
      const product = normalizeProduct(response?.data?.product);
      return { success: true, product, message: response?.data?.message };
    } catch (error: any) {
      console.error('❌ Failed to fetch single product:', error);
      if (error.response?.status === 404) throw new Error('Product not found or removed.');
      if (error.response?.status === 400) throw new Error('Invalid product ID.');
      if (error.message?.includes('Cast to ObjectId')) throw new Error('Invalid product ID format.');
      throw new Error(error.response?.data?.message || 'Failed to load product details.');
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
    const s = sessionStorage.getItem('force-refresh-products');
    const g = localStorage.getItem('force-refresh-products');
    if (s || g) {
      sessionStorage.removeItem('force-refresh-products');
      if (g) {
        const t = parseInt(g, 10);
        if (Date.now() - t > 30_000) localStorage.removeItem('force-refresh-products');
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
    } catch (e) { console.error('Cache read error:', e); }
    return null;
  },

  async refreshProducts(filters: ProductFilters = {}): Promise<ProductsResponse> {
    this.clearCache();
    this.setRefreshFlag();
    return this.getProducts(filters, true);
  },
};
