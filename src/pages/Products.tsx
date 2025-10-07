import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Grid, List, Search } from 'lucide-react';
import ProductCard from '../components/UI/ProductCard';
import api from '../config/api';
import { productService } from '../services/productService';
import type { Product } from '../types';
import SEO from '../components/Layout/SEO';
import useDebounce from '../hooks/useDebounce';

/* helpers */
const getId = (p: any): string | undefined => p?._id || p?.id;

/* slug/aliases -> exact display name */
const CATEGORY_ALIAS_TO_NAME: Record<string, string> = {
  tws: 'TWS',
  neckband: 'Bluetooth Neckbands',
  neckbands: 'Bluetooth Neckbands',
  'bluetooth-neckband': 'Bluetooth Neckbands',
  'bluetooth-neckbands': 'Bluetooth Neckbands',
  chargers: 'Mobile Chargers',
  'mobile-charger': 'Mobile Chargers',
  'mobile-chargers': 'Mobile Chargers',
  'car-charger': 'Car Chargers',
  'car-chargers': 'Car Chargers',
  'data-cable': 'Data Cables',
  'data-cables': 'Data Cables',
  speakers: 'Bluetooth Speakers',
  'bluetooth-speaker': 'Bluetooth Speakers',
  'bluetooth-speakers': 'Bluetooth Speakers',
  banks: 'Power Banks',
  'power-bank': 'Power Banks',
  'power-banks': 'Power Banks',
  ICs: 'Integrated Circuits & Chips',
  ics: 'Integrated Circuits & Chips',
  'Mobile ICs': 'Mobile ICs',
  'mobile-repairing-tools': 'Mobile Repairing Tools',
  'mobile ics': 'Mobile ICs',
  'mobile-ics': 'Mobile ICs',
  electronics: 'Electronics',
  accessories: 'Accessories',
  others: 'Others',
};
/* exact display name -> preferred slug */
const NAME_TO_SLUG: Record<string, string> = {
  TWS: 'tws',
  'Bluetooth Neckbands': 'bluetooth-neckbands',
  'Data Cables': 'data-cables',
  'Mobile Chargers': 'mobile-chargers',
  'Car Chargers': 'car-chargers',
  'Bluetooth Speakers': 'bluetooth-speakers',
  'Power Banks': 'power-banks',
  'Integrated Circuits & Chips': 'ICs',
  'Mobile Repairing Tools': 'mobile-repairing-tools',
  Electronics: 'electronics',
  Accessories: 'accessories',
  'Mobile ICs': 'Mobile ICs',
  'Mobile Accessories': 'Mobile Accessories',
  'mobile ics': 'Mobile ICs',
  'mobile-ics': 'Mobile ICs',
  Others: 'others',
};

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategorySlug = (searchParams.get('category') || '').trim().toLowerCase();
  const normalizedFromUrl = (urlCategorySlug && CATEGORY_ALIAS_TO_NAME[urlCategorySlug]) || '';

  /* UI state */
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [selectedCategory, setSelectedCategory] = useState<string>(normalizedFromUrl);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 20000]);
  const [sortBy, setSortBy] = useState<'name' | 'price-low' | 'price-high' | 'rating'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  /* data state */
  const [products, setProducts] = useState<Product[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);   // only for the very first load
  const [refreshing, setRefreshing] = useState(false);          // small inline spinner
  const [error, setError] = useState('');

  /* pagination */
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const [total, setTotal] = useState(0);

  /* categories */
  const [categories, setCategories] = useState<string[]>([
    'TWS','Bluetooth Neckbands','Data Cables','Mobile Chargers','Integrated Circuits & Chips',
    'Mobile Repairing Tools','Electronics','Accessories','Car Chargers','Bluetooth Speakers',
    'Power Banks','Others','ICs','Mobile ICs','Mobile accessories',
  ]);

  /* cache same queries to avoid repeat calls */
  const cache = useRef<Map<string, { items: Product[]; total: number }>>(new Map());

  /* URL -> dropdown */
  useEffect(() => {
    if (normalizedFromUrl && normalizedFromUrl !== selectedCategory) {
      setSelectedCategory(normalizedFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedFromUrl]);

  /* dropdown -> URL */
  useEffect(() => {
    const currentSlug = (searchParams.get('category') || '').trim().toLowerCase();
    const nextSlug = selectedCategory ? NAME_TO_SLUG[selectedCategory] : '';
    const next = new URLSearchParams(searchParams);
    if (nextSlug) {
      if (currentSlug !== nextSlug) {
        next.set('category', nextSlug);
        setSearchParams(next, { replace: true });
      }
    } else if (currentSlug) {
      next.delete('category');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const normalizedCategoryForApi = selectedCategory || normalizedFromUrl || '';

  /* fetch categories (once) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await productService.getCategories();
        const arr = (Array.isArray((r as any)?.categories) && (r as any).categories) || [];
        if (!cancelled && arr.length) setCategories(arr.filter(Boolean));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  /* server fetch with pagination (supports AbortSignal) */
  const fetchProducts = async (forceRefresh = false, signal?: AbortSignal) => {
    try {
      setError('');
      if (initialLoading) setInitialLoading(true);
      else setRefreshing(true);

      const q = debouncedSearch.trim();
      const serverSearch = q.length >= 2 ? q : ''; // don't query server for 1-letter

      const filters: any = {};
      if (normalizedCategoryForApi) filters.category = normalizedCategoryForApi;
      if (serverSearch) filters.q = serverSearch;
      if (sortBy) filters.sort = sortBy;

      const params = { page, limit, ...filters, _t: forceRefresh ? Date.now() : undefined };
      const cacheKey = JSON.stringify(params);

      if (cache.current.has(cacheKey) && !forceRefresh) {
        const c = cache.current.get(cacheKey)!;
        setProducts(c.items);
        setTotal(c.total);
        return;
      }

      const r = await productService.getProducts(params, forceRefresh, signal);

      const list =
        (Array.isArray((r as any)?.items) && (r as any).items) ||
        (Array.isArray((r as any)?.data?.items) && (r as any).data.items) ||
        (Array.isArray((r as any)?.products) && (r as any).products) ||
        (Array.isArray((r as any)?.data) && (r as any).data) ||
        [];

      const t =
        Number((r as any)?.total) ||
        Number((r as any)?.data?.total) ||
        Number((r as any)?.meta?.total) ||
        Number((r as any)?.count) ||
        Number((r as any)?.pagination?.total) ||
        0;

      cache.current.set(cacheKey, { items: list as Product[], total: t || list.length });
      setProducts(list as Product[]);
      setTotal(t || list.length);

      if (forceRefresh) {
        sessionStorage.removeItem('force-refresh-products');
        localStorage.removeItem('force-refresh-products');
      }
    } catch (err: any) {
      // ignore cancels
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.message === 'canceled') return;

      console.error('❌ Error fetching products:', err);
      setError('Failed to connect to server. Please try again later.');

      // fallback unpaged
      try {
        const fallback = await api.get('/products', { params: { _t: Date.now() }, signal });
        const arr =
          (Array.isArray(fallback?.data?.items) && fallback.data.items) ||
          (Array.isArray(fallback?.data?.products) && fallback.data.products) ||
          (Array.isArray(fallback?.data?.data) && fallback.data.data) ||
          (Array.isArray(fallback?.data) && fallback.data) ||
          [];
        setProducts(arr as Product[]);
        setTotal(Number(fallback?.data?.total) || Number(fallback?.data?.meta?.total) || arr.length);
        setError('');
      } catch {}
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
      localStorage.setItem('last-product-fetch', String(Date.now()));
    }
  };

  /* reset to first page when category/sort change (not on each keystroke) */
// reset to first page when category/sort/search change
useEffect(() => {
  setPage(1);
}, [normalizedCategoryForApi, sortBy, debouncedSearch]);


  /* refetch on page/category/sort/debouncedSearch; cancel stale requests */
  useEffect(() => {
    const ctrl = new AbortController();
    fetchProducts(false, ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, normalizedCategoryForApi, sortBy, debouncedSearch]);

  /* client safety net: search/price/isActive + local sort */
  const filteredProducts = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    const q = (debouncedSearch || '').toLowerCase();

    const filtered = list
      .filter((p) => {
        const name = (p?.name || '').toLowerCase();
        const desc = (p?.description || '').toLowerCase();
        const matchesSearch = !q || name.includes(q) || desc.includes(q);

        const priceVal = typeof p?.price === 'number' ? p.price : Number.NaN;
        const priceOk =
          Number.isFinite(priceVal) &&
          priceVal >= priceRange[0] &&
          priceVal <= priceRange[1];

        const isActive = p?.isActive !== false;
        return matchesSearch && priceOk && isActive;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'price-low':  return (a.price ?? 0) - (b.price ?? 0);
          case 'price-high': return (b.price ?? 0) - (a.price ?? 0);
          case 'rating':     return (b.rating ?? 0) - (a.rating ?? 0);
          case 'name':
          default:           return (a.name || '').localeCompare(b.name || '');
        }
      });

    return filtered;
  }, [products, debouncedSearch, priceRange, sortBy]);

  const handleManualRefresh = () => {
    cache.current.clear();
    const ctrl = new AbortController();
    fetchProducts(true, ctrl.signal);
  };

  /* first-load spinner only */
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-xl text-gray-600">Loading products…</p>
        </div>
      </div>
    );
  }

  /* error with empty data */
  if (error && products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <button
            onClick={() => handleManualRefresh()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* derived pagination info */
  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={normalizedCategoryForApi ? `${normalizedCategoryForApi} — Shop Products` : 'Shop Products'}
        description="Browse TWS, Bluetooth neckbands, data cables, chargers, ICs, and tools,Bluetooth Speakers."
        canonicalPath="/products"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: normalizedCategoryForApi ? `${normalizedCategoryForApi} Products` : 'Products',
          url: 'https://nakodamobile.com/products',
        }}
      />

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {normalizedCategoryForApi || 'Premium Tech Accessories'}
          </h1>
          <p className="text-xl md:text-2xl mb-8">
            {normalizedCategoryForApi
              ? `Discover ${normalizedCategoryForApi} from Nakoda Mobile`
              : 'Discover our curated collection of high-quality products'}
          </p>
          <div className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-200" />
              <input
                type="text"
                placeholder="Search products…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Category */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <label className="text-sm font-medium text-gray-700">Price Range:</label>
            <div className="flex items-center space-x-2">
              <input
                type="range" min={0} max={20000} value={priceRange[1]}
                onChange={(e) =>
                  setPriceRange(([lo]) => [Math.max(0, lo), Math.max(0, parseInt(e.target.value, 10) || 0)])
                }
                className="w-32"
              />
              <span className="text-sm text-gray-600">₹0 - ₹{priceRange[1].toLocaleString()}</span>
            </div>
          </div>

          {/* Sort */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Name</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Rating</option>
            </select>
          </div>

          {/* View + Refresh */}
          <div className="flex items-center space-x-3">
            {refreshing && (
              <span className="inline-block h-5 w-5 rounded-full border-b-2 border-blue-600 animate-spin" title="Refreshing" />
            )}
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              title="Grid view"
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              title="List view"
            >
              <List className="h-5 w-5" />
            </button>
            <button
              onClick={handleManualRefresh}
              className="p-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
              title="Refresh Products"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Results meta */}
        <div className="mb-6">
          <p className="text-gray-600 flex items-center gap-2">
            Showing {filteredProducts.length} of {total || products.length} products
            {normalizedCategoryForApi && ` in ${normalizedCategoryForApi}`}
            {debouncedSearch && ` · matching "${debouncedSearch}"`}
          </p>
        </div>

        {/* Grid/List */}
        {filteredProducts.length > 0 ? (
          <>
            <motion.div
              className={viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
            >
              {filteredProducts.map((product, i) => {
                const key = getId(product) || `${product.name || 'item'}-${i}`;
                return (
                  <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <ProductCard product={product} viewMode={viewMode} />
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Pager */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  disabled={!canPrev}
                  onClick={() => { if (canPrev) setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`px-3 py-2 rounded-md ${canPrev ? 'bg-gray-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                  Prev
                </button>

                {Array.from({ length: totalPages }).map((_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                  .reduce<number[]>((acc, n, i, arr) => { if (i && n - arr[i - 1] > 1) acc.push(-1); acc.push(n); return acc; }, [])
                  .map((n, i) =>
                    n === -1 ? (
                      <span key={`gap-${i}`} className="px-2">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={`px-3 py-2 rounded-md ${n === page ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                      >
                        {n}
                      </button>
                    )
                  )}

                <button
                  disabled={!canNext}
                  onClick={() => { if (canNext) setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`px-3 py-2 rounded-md ${canNext ? 'bg-gray-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-gray-400 text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No products found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search criteria or browse all categories</p>
            <div className="space-x-4">
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory(''); setPriceRange([0, 20000]); }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={handleManualRefresh}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Refresh Products
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;