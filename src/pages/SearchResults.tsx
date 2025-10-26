// src/pages/Search.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search as SearchIcon,
  Grid,
  List,
  Heart,
  ShoppingCart,
  Star,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Clock3,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { Product } from '../types';
import SEO from '../components/Layout/SEO';

/* ------------------------------ Constants ------------------------------ */

const currencyFmt = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const CATEGORIES = [
  'TWS',
  'Bluetooth Neckbands',
  'Data Cables',
  'Mobile Chargers',
  'Mobile ICs',
  'Mobile Repairing Tools',
  'Electronics',
  'Accessories',
  'Other'
];

const SKELETON_ITEMS = Array.from({ length: 12 });
const RECENT_KEY = 'nakoda:recentSearches:v1';
const VIEWMODE_KEY = 'nakoda:search:viewMode';
const CACHE_MAX = 30; // client cache limit

// Rotating auto-suggest placeholder strings
const PLACEHOLDERS = [
  'Search earphone',
  'Search neckband',
  'Search car charger',
  'Search data cable',
  'Search power bank',
  'Search mobile tools'
];

/* -------------------------------- Types -------------------------------- */

interface SearchResponse {
  success: boolean;
  products: Product[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalProducts: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  query: string;
  filters: {
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    rating?: string;
    inStock?: string;
  };
}

type Suggestion = { id: string; name: string };

/* ------------------------------ Utilities ------------------------------ */

const getId = (p: Product | string) =>
  typeof p === 'string' ? p : ((p as any)?._id ?? (p as any)?.id ?? '') as string;

const discountPercent = (p: Product) =>
  p.originalPrice && p.originalPrice > p.price
    ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
    : 0;

const buildKey = (params: URLSearchParams) => params.toString();

/* ------------------------- Recent searches store ------------------------ */

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  const t = term.trim();
  if (!t) return;
  const current = loadRecents().filter((x) => x.toLowerCase() !== t.toLowerCase());
  current.unshift(t);
  localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, 10)));
}

/* --------------------------------- View --------------------------------- */

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    () => ((localStorage.getItem(VIEWMODE_KEY) as 'grid' | 'list') || 'grid')
  );
  const [showFilters, setShowFilters] = useState(false);

  // New: query box + suggestions + recents + instant results
  const [inputValue, setInputValue] = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => loadRecents());

  // Instant product results while typing
  const [instantResults, setInstantResults] = useState<Product[]>([]);
  const [showInstant, setShowInstant] = useState(false);

  // Typewriter/rotating placeholder
  const [phIndex, setPhIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Filters/params
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const sort = searchParams.get('sort') || 'newest';
  const rating = searchParams.get('rating') || ''; // "4&up", "3&up", ...
  const inStock = searchParams.get('inStock') || ''; // "true" or ""
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
    hasNext: false,
    hasPrev: false
  });

  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  // Persist view mode
  useEffect(() => {
    localStorage.setItem(VIEWMODE_KEY, viewMode);
  }, [viewMode]);

  // Focus shortcut: press "/" to focus search
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && targetTag !== 'INPUT' && targetTag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ------------------------ Typewriter placeholder ----------------------- */
  useEffect(() => {
    if (inputValue) return; // don't animate when user has typed
    let t1: number | undefined;
    let t2: number | undefined;

    const current = PLACEHOLDERS[phIndex % PLACEHOLDERS.length];
    let i = 0;

    const type = () => {
      setTyped(current.slice(0, i + 1));
      i++;
      if (i < current.length) {
        t1 = window.setTimeout(type, 70);
      } else {
        // pause, then clear and go to next
        t2 = window.setTimeout(() => {
          setTyped('');
          setPhIndex((x) => (x + 1) % PLACEHOLDERS.length);
        }, 1200);
      }
    };

    t1 = window.setTimeout(type, 120);
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [phIndex, inputValue]);

  /* ----------------------------- Suggestions ----------------------------- */

  const suggestAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!inputValue.trim() || inputValue.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        // cancel previous
        suggestAbort.current?.abort();
        const controller = new AbortController();
        suggestAbort.current = controller;

        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(inputValue.trim())}`, {
          signal: controller.signal
        });
        if (!res.ok) return;
        const data = (await res.json()) as { success: boolean; suggestions: Suggestion[] };
        if (data?.success) setSuggestions(data.suggestions || []);
      } catch {
        /* ignore */
      }
    }, 160);

    return () => clearTimeout(t);
  }, [inputValue]);

  /* ----------------------- Instant product results ----------------------- */

  const instantAbort = useRef<AbortController | null>(null);
  const instantCacheRef = useRef(new Map<string, Product[]>());

  useEffect(() => {
    const q = inputValue.trim();
    if (!q) {
      setInstantResults([]);
      setShowInstant(false);
      return;
    }

    // Fetch from first character
    const run = async () => {
      // cache first
      const cached = instantCacheRef.current.get(q.toLowerCase());
      if (cached) {
        setInstantResults(cached);
        setShowInstant(true);
        return;
      }

      try {
        instantAbort.current?.abort();
        const controller = new AbortController();
        instantAbort.current = controller;

        const params = new URLSearchParams({
          q,
          page: '1',
          limit: '8',
          sort: 'popular'
        });

        const res = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SearchResponse = await res.json();
        const items = data?.products || [];
        setInstantResults(items);
        setShowInstant(true);
        instantCacheRef.current.set(q.toLowerCase(), items);
        if (instantCacheRef.current.size > 80) {
          // simple cleanup
          const firstKey = instantCacheRef.current.keys().next().value as string | undefined;
          if (firstKey) instantCacheRef.current.delete(firstKey);
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setInstantResults([]);
        setShowInstant(false);
      }
    };

    const t = setTimeout(run, 140);
    return () => clearTimeout(t);
  }, [inputValue]);

  /* ----------------------------- Client cache ---------------------------- */

  const cacheRef = useRef(
    new Map<
      string,
      {
        ts: number;
        data: { products: Product[]; pagination: typeof pagination };
      }
    >()
  );

  const fetchAbort = useRef<AbortController | null>(null);

  // Debounced fetch + cache + cancel for main results
  useEffect(() => {
    if (!query.trim()) {
      setProducts([]);
      setLoading(false);
      setError(null);
      return;
    }

    const run = async () => {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        limit: '24'
      });
      if (category) params.set('category', category);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (sort) params.set('sort', sort);
      if (rating) params.set('rating', rating);
      if (inStock) params.set('inStock', inStock);

      const key = buildKey(params);

      // Cached?
      const cached = cacheRef.current.get(key);
      if (cached) {
        setProducts(cached.data.products);
        setPagination(cached.data.pagination);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        fetchAbort.current?.abort();
        const controller = new AbortController();
        fetchAbort.current = controller;

        const res = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SearchResponse = await res.json();

        if (!data.success) throw new Error('Search failed');

        setProducts(data.products || []);
        setPagination(data.pagination);

        cacheRef.current.set(key, { ts: Date.now(), data: { products: data.products || [], pagination: data.pagination } });
        if (cacheRef.current.size > CACHE_MAX) {
          // simple LRU-ish cleanup
          const firstKey = cacheRef.current.keys().next().value as string | undefined;
          if (firstKey) cacheRef.current.delete(firstKey);
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setProducts([]);
        setPagination({ currentPage: 1, totalPages: 1, totalProducts: 0, hasNext: false, hasPrev: false });
        setError('Search failed. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [query, category, minPrice, maxPrice, sort, rating, inStock, page]);

  /* ------------------------------ Handlers ------------------------------- */

  const updateSearchParams = (newParams: Record<string, string>) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) updated.set(k, v);
      else updated.delete(k);
    });
    if (Object.keys(newParams).some((k) => k !== 'page')) {
      updated.set('page', '1'); // reset to first page on filter change
    }
    setSearchParams(updated);
  };

  const submitQuery = (term: string) => {
    const t = term.trim();
    if (!t) return;
    updateSearchParams({ q: t });
    setInputValue(t);
    setShowSuggest(false);
    setShowInstant(false);
    saveRecent(t);
    setRecents(loadRecents());
  };

  const clearAllFilters = () => {
    updateSearchParams({ category: '', minPrice: '', maxPrice: '', sort: 'newest', rating: '', inStock: '', page: '1' });
  };

  const handleAddToCart = (p: Product) => {
    const id = getId(p);
    if (!id) return;
    addToCart(id);
  };

  const toggleWishlist = (p: Product) => {
    const id = getId(p);
    if (!id) return;
    if (isInWishlist(id)) removeFromWishlist(id);
    else addToWishlist(id);
  };

  /* --------------------------- Reusable blocks --------------------------- */

  const ratingBlock = (p: Product) => {
    const r = Math.max(0, Math.min(5, p.rating ?? 0));
    const count = p.reviewsCount ?? 0;
    return (
      <div className="flex items-center gap-1.5 mb-2" aria-label={`Rating ${r} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < Math.floor(r);
          const half = i === Math.floor(r) && r % 1 >= 0.5;
          return <Star key={i} className={`h-4 w-4 ${filled || half ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />;
        })}
        <span className="text-xs text-gray-600 ml-1">({count})</span>
      </div>
    );
  };

  const priceBlock = (p: Product) => (
    <div className="flex items-end gap-2 mb-3">
      <span className="text-xl font-semibold text-gray-900">{currencyFmt(p.price, (p as any).currency || 'INR')}</span>
      {p.originalPrice && p.originalPrice > p.price && (
        <>
          <span className="text-sm text-gray-500 line-through">{currencyFmt(p.originalPrice, (p as any).currency || 'INR')}</span>
          <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">-{discountPercent(p)}%</span>
        </>
      )}
    </div>
  );

  /* --------------------------------- SEO --------------------------------- */

  const title = query ? `Search: ${query}` : 'Search';
  const description = query ? `Results for "${query}"` : 'Search Nakoda Mobile';
  const canonicalPath = `/search?${searchParams.toString()}`;

  /* ------------------------------- Sub-UI -------------------------------- */

  const SearchBar = () => (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggest(true);
              setShowInstant(true);
            }}
            onFocus={() => {
              setIsInputFocused(true);
              if (inputValue) {
                setShowSuggest(true);
                setShowInstant(true);
              }
            }}
            onBlur={() => {
              setIsInputFocused(false);
              // slight delay so a click inside dropdown still works
              setTimeout(() => {
                setShowSuggest(false);
                setShowInstant(false);
              }, 160);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitQuery(inputValue);
              if (e.key === 'Escape') {
                setShowSuggest(false);
                setShowInstant(false);
              }
            }}
            placeholder={inputValue ? '' : typed || PLACEHOLDERS[phIndex % PLACEHOLDERS.length]}
            className="w-full pl-10 pr-20 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-autocomplete="list"
            aria-expanded={showSuggest || showInstant}
            aria-controls="search-suggest-panel"
          />
          {/* Clear button */}
          {inputValue && (
            <button
              onClick={() => {
                setInputValue('');
                setShowSuggest(false);
                setShowInstant(false);
                setSuggestions([]);
                setInstantResults([]);
              }}
              className="absolute right-14 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {/* Search button */}
          <button
            onClick={() => submitQuery(inputValue)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Search
          </button>
        </div>

        {/* View toggle */}
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
            title="Grid view"
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            aria-pressed={viewMode === 'list'}
            aria-label="List view"
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Suggestions, Recents & Instant Results dropdown */}
      {(isInputFocused && (showSuggest || showInstant) && (suggestions.length > 0 || recents.length > 0 || instantResults.length > 0)) && (
        <div id="search-suggest-panel" className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Quick category chips */}
          <div className="px-3 py-2 border-b bg-gray-50">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.slice(0, 8).map((cat) => (
                <button
                  key={cat}
                  onClick={() => submitQuery(cat)}
                  className="px-2.5 py-1 text-xs bg-white border rounded-full hover:bg-gray-50"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Instant product previews */}
          {instantResults.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">Top products</div>
              <ul className="max-h-72 overflow-auto divide-y">
                {instantResults.map((p) => {
                  const id = getId(p);
                  const img = (p as any).image || p.images?.[0] || '/placeholder-product.jpg';
                  return (
                    <li key={id} className="hover:bg-gray-50">
                      <Link
                        to={`/products/${id}`}
                        className="flex items-center gap-3 px-3 py-2"
                        onMouseDown={(e) => e.preventDefault()} // keep focus for click-in-dropdown
                      >
                        <img src={img} alt={p.name} className="w-12 h-12 rounded-md object-cover bg-gray-100" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                          <div className="text-xs text-gray-500 truncate">{p.category}</div>
                        </div>
                        <div className="text-sm font-semibold">{currencyFmt(p.price, (p as any).currency || 'INR')}</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="px-3 py-2 border-t bg-white">
                <Link
    to={`/search?q=${encodeURIComponent(inputValue)}`}
    onMouseDown={(e) => e.preventDefault()}
    className="w-full inline-flex items-center justify-center gap-2 text-sm text-blue-700 font-medium hover:underline"
  >
    View all results for “{inputValue}”
    <ArrowRight className="h-4 w-4" />
  </Link>
              </div>
            </div>
          )}

          {/* Text suggestions */}
          {suggestions.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">Suggestions</div>
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => submitQuery(s.name)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Recents */}
          {recents.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">Recent searches</div>
              {recents.slice(0, 6).map((r, i) => (
                <button
                  key={`${r}-${i}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => submitQuery(r)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Clock3 className="h-4 w-4 text-gray-400" />
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const ResultHeader = () => (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <SearchIcon className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Search Results for “{query}”</h1>
      </div>
      {!loading && (
        <p className="text-gray-600">
          {pagination.totalProducts > 0 ? `Found ${pagination.totalProducts} products` : 'No products found'}
        </p>
      )}
    </div>
  );

  const ControlsBar = () => (
    <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 border-b border-gray-200 py-3 mb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
        <SearchBar />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          {/* Left: Filters toggle + chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
              aria-expanded={showFilters}
              aria-controls="filters-panel"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {(category || minPrice || maxPrice || rating || inStock) && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Active</span>
              )}
            </button>

            {/* Active filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {category && <Chip onClear={() => updateSearchParams({ category: '' })}>{category}</Chip>}
              {minPrice && <Chip onClear={() => updateSearchParams({ minPrice: '' })}>Min ₹{minPrice}</Chip>}
              {maxPrice && <Chip onClear={() => updateSearchParams({ maxPrice: '' })}>Max ₹{maxPrice}</Chip>}
              {rating && <Chip onClear={() => updateSearchParams({ rating: '' })}>{rating.replace('&', ' ').toUpperCase()}</Chip>}
              {inStock && <Chip onClear={() => updateSearchParams({ inStock: '' })}>In stock</Chip>}
              {(category || minPrice || maxPrice || rating || inStock) && (
                <button onClick={clearAllFilters} className="text-sm text-blue-700 hover:underline">Clear all</button>
              )}
            </div>
          </div>

          {/* Right: Sort */}
          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="sort-select">Sort</label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => updateSearchParams({ sort: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="newest">Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="popular">Most Popular</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const FiltersPanel = () => (
    <motion.div
      id="filters-panel"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-white p-6 rounded-xl shadow-sm border mb-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => updateSearchParams({ category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Min Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Min Price (₹)</label>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => updateSearchParams({ minPrice: e.target.value })}
            placeholder="0"
            min={0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Max Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Max Price (₹)</label>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => updateSearchParams({ maxPrice: e.target.value })}
            placeholder="10000"
            min={0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Rating & In-stock */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
            <select
              value={rating}
              onChange={(e) => updateSearchParams({ rating: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Any</option>
              <option value="4&up">4★ & up</option>
              <option value="3&up">3★ & up</option>
              <option value="2&up">2★ & up</option>
              <option value="1&up">1★ & up</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!inStock}
              onChange={(e) => updateSearchParams({ inStock: e.target.checked ? 'true' : '' })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show only in-stock
          </label>
        </div>
      </div>
    </motion.div>
  );

  const CardActions = ({ p }: { p: Product }) => {
    const id = getId(p);
    const wishlisted = isInWishlist(id);
    return (
      <div className="flex gap-2">
        <button
          onClick={() => handleAddToCart(p)}
          disabled={!p.inStock}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-colors ${
            p.inStock ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
          aria-label={p.inStock ? 'Add to cart' : 'Out of stock'}
          title={p.inStock ? 'Add to cart' : 'Out of stock'}
        >
          <ShoppingCart className="h-4 w-4" />
          {p.inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
        <button
          onClick={() => toggleWishlist(p)}
          className={`px-4 rounded-lg border transition-all ${
            wishlisted ? 'border-red-500 text-red-600 bg-red-50 hover:bg-red-100' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`h-5 w-5 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
        </button>
      </div>
    );
  };

  const ProductCard = ({ p }: { p: Product }) => {
    const id = getId(p);
    const img = (p as any).image || p.images?.[0] || '/placeholder-product.jpg';

    return (
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all duration-200 ${
          viewMode === 'list' ? 'flex items-center p-5' : 'p-4'
        }`}
      >
        {/* Image */}
        <div className={`${viewMode === 'list' ? 'w-36 h-36 mr-6' : 'w-full h-48 mb-4'} relative`}>
          <img src={img} alt={p.name} loading="lazy" className="w-full h-full object-cover rounded-lg bg-gray-100" />
          {!p.inStock && (
            <div className="absolute top-2 left-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full font-medium">
              Out of Stock
            </div>
          )}
          {discountPercent(p) > 0 && (
            <div className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium">
              Save {discountPercent(p)}%
            </div>
          )}
        </div>

        {/* Info */}
        <div className={`${viewMode === 'list' ? 'flex-1' : ''}`}>
          <Link to={`/products/${id}`} className="block">
            <h3 className="font-semibold text-gray-900 mb-1 hover:text-blue-600 transition-colors line-clamp-2">{p.name}</h3>
          </Link>
          <p className="text-xs text-gray-500 mb-2">{p.category}</p>
          {ratingBlock(p)}
          {priceBlock(p)}

          {/* Availability hint */}
          {p.inStock ? (
            <div className="flex items-center text-green-700 text-sm mb-2">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              In stock
            </div>
          ) : (
            <div className="text-sm text-gray-500 mb-2">Back soon</div>
          )}

          <CardActions p={p} />
        </div>
      </motion.div>
    );
  };

  const SkeletonCard = () => (
    <div className={`bg-white rounded-xl shadow-sm border animate-pulse ${viewMode === 'list' ? 'flex items-center p-5' : 'p-4'}`}>
      <div className={`${viewMode === 'list' ? 'w-36 h-36 mr-6' : 'w-full h-48 mb-4'} bg-gray-200 rounded-lg`} />
      <div className={`${viewMode === 'list' ? 'flex-1' : ''}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-full" />
      </div>
    </div>
  );

  const Pagination = () => {
    if (pagination.totalPages <= 1) return null;

    const { currentPage, totalPages } = pagination;
    const makeRange = () => {
      const out: (number | '...')[] = [];
      const win = 1;
      const start = Math.max(2, currentPage - win);
      const end = Math.min(totalPages - 1, currentPage + win);
      out.push(1);
      if (start > 2) out.push('...');
      for (let i = start; i <= end; i++) out.push(i);
      if (end < totalPages - 1) out.push('...');
      if (totalPages > 1) out.push(totalPages);
      return out;
    };
    const items = makeRange();

    return (
      <div className="flex justify-center items-center mt-10 gap-2">
        <button
          onClick={() => updateSearchParams({ page: String(page - 1) })}
          disabled={!pagination.hasPrev}
          className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-1"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>

        {items.map((it, idx) =>
          it === '...' ? (
            <span key={`dots-${idx}`} className="px-3 py-2 text-gray-500 select-none">…</span>
          ) : (
            <button
              key={it}
              onClick={() => updateSearchParams({ page: String(it) })}
              className={`px-3 py-2 rounded-lg border ${it === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}
              aria-current={it === currentPage ? 'page' : undefined}
            >
              {it}
            </button>
          )
        )}

        <button
          onClick={() => updateSearchParams({ page: String(page + 1) })}
          disabled={!pagination.hasNext}
          className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-1"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  /* -------------------------------- Render ------------------------------- */

  if (!query.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SEO title={title} description={description} canonicalPath={canonicalPath} />
        <div className="max-w-xl w-full px-6">
          <div className="text-center mb-6">
            <SearchIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Start Your Search</h2>
            <p className="text-gray-600">Enter a search term to find products in our store</p>
          </div>
          <SearchBar />
          {recents.length > 0 && (
            <div className="mt-6">
              <div className="text-sm text-gray-500 mb-2">Recent searches</div>
              <div className="flex flex-wrap gap-2">
                {recents.map((r, i) => (
                  <button key={`${r}-${i}`} onClick={() => submitQuery(r)} className="px-3 py-1.5 text-sm bg-white border rounded-full hover:bg-gray-50">
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-8 text-center">
            <Link to="/products" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              Browse All Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title={title} description={description} canonicalPath={canonicalPath} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ResultHeader />
        <ControlsBar />
        {showFilters && <FiltersPanel />}

        {/* Loading */}
        {loading && (
          <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
            {SKELETON_ITEMS.map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-16">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
              <SearchIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Search Error</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button onClick={() => updateSearchParams({ _ts: String(Date.now()) })} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && products.length === 0 && (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <SearchIcon className="mx-auto h-16 w-16 text-gray-400 mb-6" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">No Products Found</h2>
              <p className="text-gray-600 mb-6">
                We couldn't find any products matching “{query}”. Try adjusting your search terms or filters.
              </p>
              <div className="space-y-3">
                <button onClick={clearAllFilters} className="inline-block px-6 py-3 border rounded-lg hover:bg-gray-50">Clear Filters</button>
                <Link to="/products" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                  Browse All Products
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && !error && products.length > 0 && (
          <>
            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
              {products.map((p) => <ProductCard key={getId(p)} p={p} />)}
            </div>
            <Pagination />
          </>
        )}
      </div>
    </div>
  );
};

/* ------------------------------- Components ----------------------------- */

const Chip: React.FC<{ onClear: () => void; children: React.ReactNode }> = ({ onClear, children }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-800 border">
    {children}
    <button onClick={onClear} className="text-gray-500 hover:text-gray-700" aria-label="Remove filter">
      <X className="h-3.5 w-3.5" />
    </button>
  </span>
);

export default Search;
