// src/components/Layout/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, User, Search, Menu, X, Heart, Loader2, Moon, Sun } from 'lucide-react';

import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../UI/ThemeProvider';
import { usePricingMode } from '../../context/PricingModeProvider';

interface SearchResult {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

type Category = {
  label: string;
  slug: string;
  img: string;
  alt?: string;
};

const CATEGORIES: Category[] = [
  { label: 'Chargers', slug: 'chargers', img: '/Charger1.webp' },
  { label: 'Car Charger', slug: 'Car-Charger', img: '/CarCharger.webp' },
  { label: 'Data Cables', slug: 'Data-Cables', img: '/cable.png' },
  { label: 'True Wireless Earbuds', slug: 'tws', img: '/Earbud-removebg-preview.png' },
  { label: 'Neckbands', slug: 'neckband', img: '/Neckband-removebg-preview.png' },
  { label: 'Bluetooth Speakers', slug: 'bluetooth-speakers', img: '/Bluetooth-Speaker.webp' },
  { label: 'Power Banks', slug: 'power-bank', img: '/Powerbank.webp' },
  { label: 'Mobile ICs', slug: 'ICs', img: '/ics.webp' },
  { label: 'Mobile Tools', slug: 'mobile-repairing-tools', img: '/Reapring-Tools.webp' },
];

const categoryUrl = (slug: string) => `/products?category=${encodeURIComponent(slug)}`;
const SEARCH_HINTS = ['Search IC', 'Search neckband', 'Search mobile tools', 'Search TWS', 'Search charger'];

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  const { getTotalItems } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { mode, setMode } = usePricingMode();

  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nakoda-token') window.location.reload();
      if (e.key === 'pricingMode' && e.newValue) {
        const v = e.newValue === 'wholesale' ? 'wholesale' : 'retail';
        document.documentElement.dataset.pricingMode = v;
        window.dispatchEvent(new CustomEvent('pricing:mode', { detail: v }));
      }
    };
    window.addEventListener('storage', onStorage);
    // initialize data attribute on first mount
    document.documentElement.dataset.pricingMode = mode;
    return () => window.removeEventListener('storage', onStorage);
  }, [mode]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm.trim().length > 2) void performSearch(searchTerm);
      else {
        abortRef.current?.abort();
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (searchTerm.trim().length > 0) return;
    const t = setInterval(() => setHintIndex((i) => (i + 1) % SEARCH_HINTS.length), 3000);
    return () => clearInterval(t);
  }, [searchTerm]);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (searchResultsRef.current && !searchResultsRef.current.contains(target)) setShowResults(false);
      if (categoriesRef.current && !categoriesRef.current.contains(target)) setIsCategoriesOpen(false);
      if (moreRef.current && !moreRef.current.contains(target)) setIsMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowResults(false);
        setIsCategoriesOpen(false);
        setIsMoreOpen(false);
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setSearchResults(Array.isArray(data.results) ? data.results : []);
        setShowResults(true);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      if ((err as any)?.name !== 'AbortError') console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (desktopSearchRef.current) desktopSearchRef.current.value = value;
    if (mobileSearchRef.current) mobileSearchRef.current.value = value;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setShowResults(false);
    setIsSearchOpen(false);
  };

  const handleResultClick = (productId: string) => {
    // fixed: detail route uses /product/:id
    navigate(`/product/${productId}`);
    setShowResults(false);
    setIsSearchOpen(false);
    setSearchTerm('');
  };

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Row: compact */}
        <div className="grid grid-cols-[auto,1fr,auto] items-center min-h-14 gap-4 py-1.5">
          {/* Logo bigger */}
          <Link to="/" className="flex items-center space-x-3 shrink-0" aria-label="VZOT Home">
            <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.6 }} className="p-1 rounded-lg">
              <img src="/logo.webp" alt="VZOT" className="h-16 w-auto object-contain" />
            </motion.div>
          </Link>

          {/* Desktop: nav + search */}
          <div className="hidden lg:flex items-center gap-5 min-w-0">
            <nav className="flex items-center gap-5 shrink-0">
              <Link to="/" className="text-slate-800/90 dark:text-slate-200/90 hover:text-slate-900 dark:hover:text-white text-sm md:text-[15px] font-semibold">
                Home
              </Link>

              {/* Categories */}
              <div
                ref={categoriesRef}
                className="relative"
                onMouseEnter={() => setIsCategoriesOpen(true)}
                onMouseLeave={() => setIsCategoriesOpen(false)}
              >
                <button
                  className="text-slate-800/90 dark:text-slate-200/90 hover:text-slate-900 dark:hover:text-white text-sm md:text-[15px] font-semibold"
                  aria-haspopup="menu"
                  aria-expanded={isCategoriesOpen}
                  onFocus={() => setIsCategoriesOpen(true)}
                  onClick={() => setIsCategoriesOpen((v) => !v)}
                >
                  Categories{' '}
                  <motion.span aria-hidden="true" animate={{ rotate: isCategoriesOpen ? 180 : 0 }} className="inline-block">
                    ▾
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isCategoriesOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-[92vw] max-w-[980px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl p-5"
                      role="menu"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-10 gap-y-3">
                        {CATEGORIES.map((c) => (
                          <Link
                            key={c.slug}
                            to={categoryUrl(c.slug)}
                            className="group flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors"
                            onClick={() => setIsCategoriesOpen(false)}
                            role="menuitem"
                          >
                            <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-gray-100 dark:bg-slate-800 shadow-sm">
                              <img
                                src={c.img}
                                alt={c.alt || c.label}
                                className="w-9 h-9 object-contain transition-transform duration-200 group-hover:scale-105"
                                loading="lazy"
                              />
                            </span>
                            <span className="text-[14px] text-gray-900 dark:text-slate-200 group-hover:text-sky-700 dark:group-hover:text-sky-400 font-medium">
                              {c.label}
                            </span>
                          </Link>
                        ))}
                      </div>

                      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-800">
                        <Link
                          to="/categories"
                          className="block text-center w-full border border-gray-200 dark:border-slate-700 hover:border-sky-600 dark:hover:border-sky-500 hover:text-sky-700 dark:hover:text-sky-400 rounded-xl py-2 text-sm font-medium text-slate-900 dark:text-slate-200"
                          onClick={() => setIsCategoriesOpen(false)}
                        >
                          View all categories
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link to="/products" className="text-slate-800/90 dark:text-slate-200/90 hover:text-slate-900 dark:hover:text-white text-sm md:text-[15px] font-semibold">
                Shop Now
              </Link>
              <Link to="/contact" className="text-slate-800/90 dark:text-slate-200/90 hover:text-slate-900 dark:hover:text-white text-sm md:text-[15px] font-semibold">
                Contact
              </Link>

              {/* More */}
              <div
                ref={moreRef}
                className="relative"
                onMouseEnter={() => setIsMoreOpen(true)}
                onMouseLeave={() => setIsMoreOpen(false)}
              >
                <button
                  className="text-slate-800/90 dark:text-slate-200/90 hover:text-slate-900 dark:hover:text-white text-sm md:text-[15px] font-semibold"
                  aria-haspopup="menu"
                  aria-expanded={isMoreOpen}
                  onFocus={() => setIsMoreOpen(true)}
                  onClick={() => setIsMoreOpen((v) => !v)}
                >
                  More{' '}
                  <motion.span aria-hidden="true" animate={{ rotate: isMoreOpen ? 180 : 0 }} className="inline-block">
                    ▾
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isMoreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-3 w-56 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl p-2"
                      role="menu"
                    >
                      <Link
                        to="/blog"
                        className="block px-3 py-2 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 text-sm"
                        onClick={() => setIsMoreOpen(false)}
                        role="menuitem"
                      >
                        Blog
                      </Link>
                      <a
                        href="https://nakodamobile.in/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-3 py-2 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 text-sm"
                        role="menuitem"
                        onClick={() => setIsMoreOpen(false)}
                      >
                        Explore B2B
                      </a>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Desktop Search */}
            <div className="relative flex-1 max-w-xl" ref={searchResultsRef}>
              <form onSubmit={handleSearchSubmit} className="relative" role="search" aria-label="Site search">
                <input
                  ref={desktopSearchRef}
                  type="text"
                  placeholder={searchTerm ? '' : 'Searching...'}
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-9 py-1.5 text-sm rounded-full border border-slate-300/60 dark:border-slate-700
                             bg-white/70 dark:bg-slate-800/70 shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-500
                             text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                  aria-label="Search products"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true">
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 text-slate-400 dark:text-slate-500 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  )}
                </span>
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                  aria-label="Search"
                >
                  <Search className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </button>
              </form>

              <AnimatePresence>
                {showResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50"
                  >
                    {searchResults.slice(0, 8).map((result) => (
                      <div
                        key={result.id}
                        onClick={() => handleResultClick(result.id)}
                        className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-200/70 dark:border-slate-800/70 last:border-b-0"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleResultClick(result.id)}
                        aria-label={`Go to ${result.name}`}
                      >
                        <img src={result.image} alt={result.name} className="w-12 h-12 object-cover rounded-md mr-3" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{result.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{result.category}</p>
                          <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
                            ₹{Number(result.price || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {searchResults.length > 8 && (
                      <div className="p-3 text-center border-t border-slate-200 dark:border-slate-800">
                        <Link
                          to={`/products?search=${encodeURIComponent(searchTerm)}`}
                          onClick={() => setShowResults(false)}
                          onMouseDown={(e) => e.preventDefault()}
                          className="text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-300 text-sm font-medium"
                        >
                          View all {searchResults.length} results
                        </Link>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center justify-self-end space-x-2 sm:space-x-3">
            {/* Pricing toggle */}
            <div className="hidden sm:flex items-center gap-1 rounded-full border border-gray-300 dark:border-slate-700 px-1 py-1">
              <button
                type="button"
                onClick={() => setMode('retail')}
                className={`px-2.5 py-1 text-xs rounded-full transition ${
                  mode === 'retail' ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900' : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                aria-pressed={mode === 'retail'}
              >
                Retail
              </button>
              <button
                type="button"
                onClick={() => setMode('wholesale')}
                className={`px-2.5 py-1 text-xs rounded-full transition ${
                  mode === 'wholesale' ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900' : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
                aria-pressed={mode === 'wholesale'}
              >
                Wholesale
              </button>
            </div>

            {/* theme */}
            <button
              onClick={toggle}
              className="p-1.5 rounded-full text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Toggle theme"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            <button
              onClick={() => setIsSearchOpen((v) => !v)}
              className="lg:hidden p-1.5 rounded-full text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Open search"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              to="/wishlist"
              className="p-1.5 rounded-full text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
            </Link>

            <Link to="/cart" className="relative p-1.5 rounded-full text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              {getTotalItems() > 0 && (
                <motion.span
                  initial={{ scale: 0 }}   
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center"
                >
                  {getTotalItems()}
                </motion.span>
              )}
            </Link>

            {user ? (
              <div className="relative group">
                <button className="flex items-center space-x-2 p-1.5 rounded-full text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5" aria-haspopup="menu" aria-expanded="false">
                  <User className="h-5 w-5" />
                  <span className="hidden sm:block text-sm">{user.name}</span>
                </button>
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <Link to="/profile" className="block px-4 py-2 text-slate-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800">Profile</Link>
                  <Link to="/video" className="block px-4 py-2 text-slate-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800">Video</Link>
                  <button onClick={logout} className="block w-full text-left px-4 py-2 text-slate-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800">
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Login
              </Link>
            )}

            <button
              onClick={() => {
                setIsMenuOpen((v) => !v);
                if (isMenuOpen) {
                  setIsCategoriesOpen(false);
                  setIsMoreOpen(false);
                }
              }}
              className="lg:hidden p-1.5 rounded-full text-slate-800 dark:text-slate-200 hover:bg-black/5 dark   :hover:bg-white/5"
              aria-label="Open menu"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden py-3 border-t border-slate-200 dark:border-slate-800"
            >
              {/* Mobile pricing toggle */}
              <div className="mb-3">
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Pricing Mode</div>
                <div className="inline-flex items-center gap-1 rounded-full border border-gray-300 dark:border-slate-700 px-1 py-1">
                  <button
                    type="button"
                    onClick={() => setMode('retail')}
                    className={`px-2.5 py-1 text-xs rounded-full ${mode === 'retail' ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900' : 'text-gray-700 dark:text-slate-200'}`}
                  >
                    Retail
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('wholesale')}
                    className={`px-2.5 py-1 text-xs rounded-full ${mode === 'wholesale' ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900' : 'text-gray-700 dark:text-slate-200'}`}
                  >
                    Wholesale
                  </button>
                </div>
              </div>

              <form onSubmit={handleSearchSubmit} className="relative" role="search" aria-label="Site search mobile">
                <input
                  ref={mobileSearchRef}
                  type="text"
                  placeholder={searchTerm ? '' : SEARCH_HINTS[hintIndex]}
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300/60 dark:border-slate-700 rounded-full bg-white/80 dark:bg-slate-800/70
                             focus:ring-2 focus:ring-sky-400 focus:border-transparent text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500
                             text-slate-900 dark:text-slate-100"
                  aria-label="Search products"
                />
                <button type="submit" className="absolute left-3 top-2.5" aria-label="Search">
                  {isSearching ? (
                    <Loader2 className="h-5 w-5 text-slate-400 dark:text-slate-500 animate-spin" />
                  ) : (
                    <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  )}
                </button>
              </form>

              <AnimatePresence>
                {showResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                  >
                    {searchResults.slice(0, 5).map((result) => (
                      <div
                        key={result.id}
                        onClick={() => handleResultClick(result.id)}
                        className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-200/70 dark:border-slate-800/70 last:border-b-0"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleResultClick(result.id)}
                        aria-label={`Go to ${result.name}`}
                      >
                        <img src={result.image} alt={result.name} className="w-10 h-10 object-cover rounded-md mr-3" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{result.name}</h4>
                          <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">
                            ₹{Number(result.price || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden py-3 border-t border-slate-200 dark:border-slate-800"
            >
              <nav className="flex flex-col space-y-2">
                <Link
                  to="/"
                  className="px-3 py-2 text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Home
                </Link>

                <div className="border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-slate-800 dark:text-slate-200"
                    onClick={() => setIsCategoriesOpen((s) => !s)}
                    aria-expanded={isCategoriesOpen}
                  >
                    <span className="font-medium">Categories</span>
                    <motion.span aria-hidden="true" animate={{ rotate: isCategoriesOpen ? 180 : 0 }}>▾</motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isCategoriesOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white dark:bg-slate-900"
                      >
                        {CATEGORIES.map((c) => (
                          <Link
                            key={c.slug}
                            to={categoryUrl(c.slug)}
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800"
                          >
                            <span className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 inline-flex items-center justify-center shadow-sm">
                              <img src={c.img} alt={c.alt || c.label} className="w-9 h-9 object-contain" loading="lazy" />
                            </span>
                            <span className="text-slate-800 dark:text-slate-200">{c.label}</span>
                          </Link>
                        ))}
                        <Link
                          to="/categories"
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-4 py-2 text-sky-700 dark:text-sky-400 font-medium hover:bg-sky-50 dark:hover:bg-slate-800"
                        >
                          View all categories
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Link
                  to="/products"
                  className="px-3 py-2 text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Shop Now
                </Link>
                <Link
                  to="/contact"
                  className="px-3 py-2 text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Contact
                </Link>

                {/* Mobile pricing toggle inside menu */}
                <div className="border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="w-full flex items-center justify-between px-3 py-2 text-slate-800 dark:text-slate-200">
                    <span className="font-medium">Pricing Mode</span>
                    <div className="inline-flex items-center gap-1 rounded-full border border-gray-300 dark:border-slate-700 px-1 py-1">
                      <button
                        type="button"
                        onClick={() => setMode('retail')}
                        className={`px-2.5 py-1 text-xs rounded-full ${mode === 'retail' ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900' : 'text-gray-700 dark:text-slate-200'}`}
                      >
                        Retail
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('wholesale')}
                        className={`px-2.5 py-1 text-xs rounded-full ${mode === 'wholesale' ? 'bg-gray-900 text-white dark:bg-white dark:text-slate-900' : 'text-gray-700 dark:text-slate-200'}`}
                      >
                        Wholesale
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-slate-800 dark:text-slate-200"
                    onClick={() => setIsMoreOpen((s) => !s)}
                    aria-expanded={isMoreOpen}
                  >
                    <span className="font-medium">More</span>
                    <motion.span aria-hidden="true" animate={{ rotate: isMoreOpen ? 180 : 0 }}>▾</motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isMoreOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white dark:bg-slate-900"
                      >
                        <Link
                          to="/blog"
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                        >
                          Blog
                        </Link>
                        <a
                          href="https://nakodamobile.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Explore B2B
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;
