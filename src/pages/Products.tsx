import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Grid, List } from 'lucide-react';
import ProductCard from '../components/UI/ProductCard';
import api from '../config/api';
import { productService } from '../services/productService';
import type { Product } from '../types';
import SEO from '../components/Layout/SEO';
import { useBulkReviews } from '../hooks/useBulkReviews';

/* ───────────────── helpers ───────────────── */
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
  ics: 'ICs',
  'mobile-ics': 'Mobile ICs',
  'mobile ics': 'Mobile ICs',
  'mobile-repairing-tools': 'Mobile Repairing Tools',
  electronics: 'Electronics',
  accessories: 'Accessories',
  others: 'Others',
};
const NAME_TO_SLUG: Record<string, string> = {
  TWS: 'tws',
  'Bluetooth Neckbands': 'bluetooth-neckbands',
  'Data Cables': 'data-cables',
  'Mobile Chargers': 'mobile-chargers',
  'Car Chargers': 'car-chargers',
  'Bluetooth Speakers': 'bluetooth-speakers',
  'Power Banks': 'power-banks',
  ICs: 'ics',
  'Mobile ICs': 'mobile-ics',
  'Mobile Repairing Tools': 'mobile-repairing-tools',
  Electronics: 'electronics',
  Accessories: 'accessories',
  Others: 'others',
};

const HEX24 = /^[a-f\d]{24}$/i;
const getId = (p: any): string | undefined => {
  const raw = p?._id ?? p?.id;
  if (!raw) return undefined;
  const s = typeof raw === 'string' ? raw : String(raw);
  return HEX24.test(s) ? s : undefined;
};

const productUrl = (p: any) => {
  const slug = (p?.slug || p?.name || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const id = getId(p);
  const handle = slug || id || 'item';
  return `https://nakodamobile.com/product/${handle}`;
};

const parseCategoriesFromUrl = (sp: URLSearchParams): string[] => {
  // Accept either multiple ?category=… or a single ?categories=a,b,c
  const multi = sp.getAll('category').map((s) => s.trim()).filter(Boolean);
  const csv = (sp.get('categories') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const set = new Set<string>([...multi, ...csv]);
  return [...set];
};

const toHuman = (slugOrName: string): string => {
  const key = slugOrName.trim().toLowerCase();
  return CATEGORY_ALIAS_TO_NAME[key] || slugOrName;
};

const useCanonical = (categoryNames: string[], page: number, hasFilters: boolean) => {
  const { pathname } = useLocation();
  const base = 'https://nakodamobile.com';

  const params = new URLSearchParams();
  if (categoryNames.length === 1) {
    params.set('category', (NAME_TO_SLUG[categoryNames[0]] || categoryNames[0]).toLowerCase());
  } else if (categoryNames.length > 1) {
    const slugs = categoryNames.map((n) => (NAME_TO_SLUG[n] || n).toLowerCase());
    params.set('categories', slugs.join(','));
  }
  if (page > 1) params.set('page', String(page));

  const path = pathname.startsWith('/products') ? '/products' : '/products';
  const canonical = `${base}${path}${params.toString() ? `?${params.toString()}` : ''}`;
  const robots = hasFilters ? 'noindex,follow' : 'index,follow';

  const prevLink =
    page > 1
      ? (() => {
          const p = new URLSearchParams(params);
          p.set('page', String(page - 1));
          return `${base}${path}${p.toString() ? `?${p.toString()}` : ''}`;
        })()
      : null;

  return { canonical, robots, prevLink };
};

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // URL → categories
  const urlSingle = (searchParams.get('category') || '').trim().toLowerCase();
  const urlMulti = parseCategoriesFromUrl(searchParams);
  const urlHumanList = (urlMulti.length ? urlMulti : urlSingle ? [urlSingle] : [])
    .map(toHuman)
    .filter(Boolean);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(urlHumanList[0] || '');
  const [selectedMulti, setSelectedMulti] = useState<string[]>(urlHumanList.length > 1 ? urlHumanList : []);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 20000]);
  const [sortBy, setSortBy] = useState<'name' | 'price-low' | 'price-high' | 'rating'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // data
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const [total, setTotal] = useState(0);

  // keep session return URL
  useEffect(() => {
    const url = `${location.pathname}${location.search}`;
    sessionStorage.setItem('last-products-url', url);
  }, [location.pathname, location.search]);

  // page from URL
  const pageFromUrl = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  useEffect(() => {
    if (page !== pageFromUrl) setPage(pageFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageFromUrl]);

  // categories dropdown list (fallback + fetch)
  const [categories, setCategories] = useState<string[]>([
    'TWS',
    'Bluetooth Neckbands',
    'Data Cables',
    'Mobile Chargers',
    'ICs',
    'Mobile ICs',
    'Mobile Repairing Tools',
    'Electronics',
    'Accessories',
    'Car Chargers',
    'Bluetooth Speakers',
    'Power Banks',
    'Others',
  ]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await productService.getCategories();
        const arr = (Array.isArray((r as any)?.categories) && (r as any).categories) || [];
        if (!cancelled && arr.length) setCategories(arr.filter(Boolean));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // URL → UI sync (single + multi)
  useEffect(() => {
    if (urlHumanList.length > 1) {
      setSelectedMulti(urlHumanList);
      setSelectedCategory('');
    } else if (urlHumanList.length === 1 && urlHumanList[0] !== selectedCategory) {
      setSelectedCategory(urlHumanList[0]);
      setSelectedMulti([]);
    } else if (urlHumanList.length === 0) {
      setSelectedCategory('');
      setSelectedMulti([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Build filters for API
  const normalizedCategoryForApiList = selectedMulti.length
    ? selectedMulti
    : selectedCategory
    ? [selectedCategory]
    : urlHumanList;

  // server fetch
  const fetchProducts = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError('');

      const filters: any = {};
      if (normalizedCategoryForApiList.length > 1) {
        // send categories CSV
        filters.categories = normalizedCategoryForApiList.join(',');
      } else if (normalizedCategoryForApiList.length === 1) {
        // single category
        filters.category = normalizedCategoryForApiList[0];
      }

      if (searchTerm) filters.q = searchTerm;

      const mapSort = (
        ui: typeof sortBy
      ): { sortBy: 'createdAt' | 'price' | 'rating'; sortOrder: 'asc' | 'desc' } => {
        switch (ui) {
          case 'price-low':
            return { sortBy: 'price', sortOrder: 'asc' };
          case 'price-high':
            return { sortBy: 'price', sortOrder: 'desc' };
          case 'rating':
            return { sortBy: 'rating', sortOrder: 'desc' };
          case 'name':
          default:
            return { sortBy: 'createdAt', sortOrder: 'desc' };
        }
      };
      Object.assign(filters, mapSort(sortBy));

      const params = { page, limit, ...filters, _t: forceRefresh ? Date.now() : undefined };

      const r = await productService.getProducts(params, forceRefresh);

      const list =
        (Array.isArray((r as any)?.products) && (r as any).products) ||
        (Array.isArray((r as any)?.data?.items) && (r as any).data.items) ||
        (Array.isArray((r as any)?.data) && (r as any).data) ||
        [];

      const t =
        Number((r as any)?.total) ||
        Number((r as any)?.data?.total) ||
        Number((r as any)?.meta?.total) ||
        Number((r as any)?.count) ||
        Number((r as any)?.pagination?.total) ||
        list.length;

      setProducts(list as Product[]);
      setTotal(t || list.length);

      if (forceRefresh) {
        sessionStorage.removeItem('force-refresh-products');
        localStorage.removeItem('force-refresh-products');
      }
    } catch (err) {
      console.error('❌ Error fetching products via service:', err);
      setError('Failed to connect to server. Please try again later.');
      try {
        const fallback = await api.get('/products', { params: { _t: Date.now() } });
        const arr =
          (Array.isArray(fallback?.data?.items) && fallback.data.items) ||
          (Array.isArray(fallback?.data?.products) && fallback.data.products) ||
          (Array.isArray(fallback?.data?.data) && fallback.data.data) ||
          (Array.isArray(fallback?.data) && fallback.data) ||
          [];
        setProducts(arr as Product[]);
        setTotal(
          Number(fallback?.data?.total) ||
            Number(fallback?.data?.meta?.total) ||
            arr.length
        );
        setError('');
      } catch (fallbackErr) {
        console.error('❌ Fallback also failed:', fallbackErr);
      }
    } finally {
      localStorage.setItem('last-product-fetch', String(Date.now()));
      setLoading(false);
    }
  };

  // fetch on changes
  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedCategory, selectedMulti.join(','), sortBy, searchTerm]);

  // pager
  const goToPage = (n: number) => {
    const nextPage = Math.max(1, n);
    setPage(nextPage);
    const params = new URLSearchParams(searchParams);

    if (nextPage > 1) params.set('page', String(nextPage));
    else params.delete('page');

    setSearchParams(params, { replace: false });
    const url = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    sessionStorage.setItem('last-products-url', url);
  };

  // Bulk review summaries
  const filteredProducts = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    const q = (searchTerm || '').toLowerCase();

    const filtered = list
      .filter((p) => {
        const name = (p?.name || '').toLowerCase();
        const desc = (p?.description || '').toLowerCase();
        const matchesSearch = !q || name.includes(q) || desc.includes(q);

        const priceVal = typeof p?.price === 'number' ? p.price : Number.NaN;
        const priceOk = Number.isFinite(priceVal) && priceVal >= 0 && priceVal <= priceRange[1];

        const isActive = p?.isActive !== false;

        return matchesSearch && priceOk && isActive;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'price-low':
            return (a.price ?? 0) - (b.price ?? 0);
          case 'price-high':
            return (b.price ?? 0) - (a.price ?? 0);
          case 'rating':
            return (b.rating ?? 0) - (a.rating ?? 0);
          case 'name':
          default:
            return (a.name || '').localeCompare(b.name || '');
        }
      });

    return filtered;
  }, [products, searchTerm, priceRange, sortBy]);

  const productIds = useMemo(
    () => filteredProducts.map((p) => getId(p)).filter(Boolean) as string[],
    [filteredProducts]
  );
  const { data: reviewsMap = {} } = useBulkReviews(productIds);

  const handleManualRefresh = () => fetchProducts(true);

  // SEO/canonical
  const hasSearch = !!searchTerm.trim();
  const hasPriceFilter = !(priceRange[0] === 0 && priceRange[1] === 20000);
  const hasFilters = hasSearch || hasPriceFilter;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / limit)),
    [total, limit]
  );
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const activeCats = normalizedCategoryForApiList;
  const { canonical, robots, prevLink } = useCanonical(activeCats, page, hasFilters);
  const nextLink =
    canNext
      ? (() => {
          const u = new URL(canonical);
          const p = u.searchParams;
          p.set('page', String(page + 1));
          u.search = p.toString();
          return u.toString();
        })()
      : null;

  const itemListJsonLd =
    !hasFilters && activeCats.length <= 1
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListOrder: 'http://schema.org/ItemListOrderAscending',
          numberOfItems: filteredProducts.length,
          url: canonical,
          itemListElement: filteredProducts.map((p, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: productUrl(p),
            name: p?.name || undefined,
            image:
              (Array.isArray((p as any)?.images) && (p as any).images[0]) ||
              (p as any)?.image ||
              undefined,
            sku: (p as any)?.sku || undefined,
            brand: (p as any)?.brand ? { '@type': 'Brand', name: (p as any).brand } : undefined,
          })),
        }
      : undefined;

  const breadcrumbJsonLd =
    activeCats.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nakodamobile.com/' },
            { '@type': 'ListItem', position: 2, name: 'Products', item: 'https://nakodamobile.com/products' },
            {
              '@type': 'ListItem',
              position: 3,
              name: activeCats.length === 1 ? activeCats[0] : 'Multiple Categories',
              item: canonical,
            },
          ],
        }
      : undefined;

  const pageTitle =
    activeCats.length === 1
      ? `${activeCats[0]} — Shop Products`
      : activeCats.length > 1
      ? `${activeCats.join(', ')} — Shop Products`
      : 'Shop Products';

  const pageDesc =
    activeCats.length === 1
      ? `Buy ${activeCats[0]} online at Nakoda Mobile. Fast shipping. GST invoice.`
      : 'Browse tech accessories at Nakoda Mobile. Fast shipping. GST invoice.';

  /* loading */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-xl text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  /* error */
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

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={pageTitle}
        description={pageDesc}
        canonicalPath={canonical.replace('https://nakodamobile.com','')}
        robots={robots}
        prevHref={prevLink || null}
        nextHref={nextLink || null}
        jsonLd={[breadcrumbJsonLd, itemListJsonLd].filter(Boolean) as object[]}
      />

      <>
        <link rel="canonical" href={canonical} />
        {prevLink && <link rel="prev" href={prevLink} />}
        {nextLink && <link rel="next" href={nextLink} />}
        <meta name="robots" content={robots} />
        {itemListJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
          />
        )}
        {breadcrumbJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
          />
        )}
      </>

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {activeCats.length ? activeCats.join(', ') : 'Premium Tech Accessories'}
          </h1>
          <p className="text-xl md:text-2xl mb-8">
            {activeCats.length
              ? `Discover ${activeCats.join(', ')} from Nakoda Mobile`
              : 'Discover our curated collection of high-quality products'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Category (single selector for now) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                const nextHuman = e.target.value;
                setSelectedCategory(nextHuman);
                setSelectedMulti([]); // switch to single
                const next = new URLSearchParams(searchParams);
                // clear multi
                next.delete('categories');
                next.delete('category');
                if (nextHuman) next.set('category', (NAME_TO_SLUG[nextHuman] || nextHuman).toLowerCase());
                next.delete('page');
                setSearchParams(next, { replace: false });
                setPage(1);
              }}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Price (max only for brevity) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <label className="text-sm font-medium text-gray-700">Price Range:</label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min={0}
                max={20000}
                value={priceRange[1]}
                onChange={(e) =>
                  setPriceRange(([lo]) => [
                    Math.max(0, lo),
                    Math.max(0, parseInt(e.target.value, 10) || 0),
                  ])
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
              onChange={(e) => {
                const v = e.target.value as typeof sortBy;
                setSortBy(v);
                const next = new URLSearchParams(searchParams);
                next.delete('page');
                setSearchParams(next, { replace: false });
                setPage(1);
              }}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Name</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Rating</option>
            </select>
          </div>

          {/* View + Refresh */}
          <div className="flex items-center space-x-2">
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
              onClick={() => handleManualRefresh()}
              className="p-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
              title="Refresh Products"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Results meta */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredProducts.length} of {total || products.length} products
            {activeCats.length ? ` in ${activeCats.join(', ')}` : ''}
            {searchTerm && ` · matching "${searchTerm}"`}
          </p>
        </div>

        {/* Grid/List */}
        {filteredProducts.length > 0 ? (
          <>
            <motion.div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'space-y-4'
              }
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {filteredProducts.map((product, i) => {
                const key = getId(product) || `${product.name || 'item'}-${i}`;
                const pid = getId(product);
                const summary = pid ? (reviewsMap as any)[pid] : undefined;

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ProductCard
                      product={product}
                      viewMode={viewMode}
                      reviewSummary={
                        summary
                          ? {
                              averageRating:
                                (summary as any).averageRating ??
                                (summary as any).avg ??
                                0,
                              reviewCount:
                                (summary as any).reviewCount ??
                                (summary as any).total ??
                                0,
                            }
                          : undefined
                      }
                    />
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Pager */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  disabled={!canPrev}
                  onClick={() => {
                    if (canPrev) goToPage(page - 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`px-3 py-2 rounded-md ${canPrev ? 'bg-gray-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                  Prev
                </button>

                {Array.from({ length: totalPages })
                  .map((_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                  .reduce<number[]>((acc, n, i, arr) => {
                    if (i && n - arr[i - 1] > 1) acc.push(-1);
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === -1 ? (
                      <span key={`gap-${i}`} className="px-2">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => {
                          goToPage(n);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`px-3 py-2 rounded-md ${n === page ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                      >
                        {n}
                      </button>
                    )
                  )}

                <button
                  disabled={!canNext}
                  onClick={() => {
                    if (canNext) goToPage(page + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
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
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setSelectedMulti([]);
                  setPriceRange([0, 20000]);
                  const next = new URLSearchParams(searchParams);
                  next.delete('category');
                  next.delete('categories');
                  next.delete('page');
                  setSearchParams(next, { replace: false });
                  setPage(1);
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={() => handleManualRefresh()}
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
