// src/components/Layout/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, User, Search, Menu, X, Heart, Loader2 } from 'lucide-react';

import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';

// ---- Types ----
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

// ---- Categories (update image paths to your assets) ----
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

// ---- Rotating search hints ----
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

  // Refs
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // reflect OAuth token
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nakoda-token') window.location.reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm.trim().length > 2) void performSearch(searchTerm);
      else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // rotate hints every 3s when input is empty
  useEffect(() => {
    if (searchTerm.trim().length > 0) return;
    const t = setInterval(() => {
      setHintIndex((i) => (i + 1) % SEARCH_HINTS.length);
    }, 3000);
    return () => clearInterval(t);
  }, [searchTerm]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await resp.json();
      if (resp.ok) {
        setSearchResults(data.results || []);
        setShowResults(true);
      } else {
        console.error('Search failed:', data.error);
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
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
    navigate(`/products/${productId}`);
    setShowResults(false);
    setIsSearchOpen(false);
    setSearchTerm('');
  };

  // close popovers on outside click
  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(ev.target as Node)) {
        setShowResults(false);
      }
      if (categoriesRef.current && !categoriesRef.current.contains(ev.target as Node)) {
        setIsCategoriesOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(ev.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <header className="bg-sky-200/80 backdrop-blur border-b border-sky-300 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Row */}
        <div className="grid grid-cols-[auto,1fr,auto] items-center h-15 gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }} className="p-1 rounded-lg">
              <img src="/logo.webp" alt="Logo" className="w-auto h-18 md:h-16 object-contain" />
            </motion.div>
          </Link>

          {/* Desktop: nav + search */}
          <div className="hidden lg:flex items-center gap-5 min-w-0">
            <nav className="flex items-center gap-7 shrink-0">
              <Link to="/" className="text-slate-800/90 hover:text-slate-900 text-base md:text-[17px] font-semibold">
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
                  className="text-slate-800/90 hover:text-slate-900 text-base font-semibold"
                  aria-haspopup="true"
                  aria-expanded={isCategoriesOpen}
                  onFocus={() => setIsCategoriesOpen(true)}
                  onClick={() => setIsCategoriesOpen((v) => !v)}
                >
                  Categories
                  <motion.span animate={{ rotate: isCategoriesOpen ? 180 : 0 }} className="inline-block">▾</motion.span>
                </button>

                <AnimatePresence>
                  {isCategoriesOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-[92vw] max-w-[980px] bg-white border border-gray-200 rounded-2xl shadow-xl p-5"
                      role="menu"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-10 gap-y-3">
                        {CATEGORIES.map((c) => (
                          <Link
                            key={c.slug}
                            to={categoryUrl(c.slug)}
                            className="group flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-gray-50 transition-colors"
                            onClick={() => setIsCategoriesOpen(false)}
                            role="menuitem"
                          >
                            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 shadow-sm">
                              <img
                                src={c.img}
                                alt={c.alt || c.label}
                                className="w-10 h-10 object-contain transition-transform duration-200 group-hover:scale-105"
                                loading="lazy"
                              />
                            </span>
                            <span className="text-[15px] text-gray-900 group-hover:text-sky-700 font-medium">
                              {c.label}
                            </span>
                          </Link>
                        ))}
                      </div>

                      <div className="pt-4 mt-4 border-t">
                        <Link
                          to="/categories"
                          className="block text-center w-full border border-gray-200 hover:border-sky-600 hover:text-sky-700 rounded-xl py-2.5 text-sm font-medium"
                          onClick={() => setIsCategoriesOpen(false)}
                        >
                          View all categories
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link to="/products" className="text-slate-800/90 hover:text-slate-900 text-base font-semibold">
                Shop Now
              </Link>
              <Link to="/contact" className="text-slate-800/90 hover:text-slate-900 text-base font-semibold">
                Contact
              </Link>

              {/* More dropdown replacing Blog */}
              <div
                ref={moreRef}
                className="relative"
                onMouseEnter={() => setIsMoreOpen(true)}
                onMouseLeave={() => setIsMoreOpen(false)}
              >
                <button
                  className="text-slate-800/90 hover:text-slate-900 text-base font-semibold"
                  aria-haspopup="true"
                  aria-expanded={isMoreOpen}
                  onFocus={() => setIsMoreOpen(true)}
                  onClick={() => setIsMoreOpen((v) => !v)}
                >
                  More
                  <motion.span animate={{ rotate: isMoreOpen ? 180 : 0 }} className="inline-block">▾</motion.span>
                </button>

                <AnimatePresence>
                  {isMoreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-3 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl p-2"
                      role="menu"
                    >
                      <Link
                        to="/blog"
                        className="block px-3 py-2 rounded-lg text-slate-800 hover:bg-gray-100 text-sm"
                        onClick={() => setIsMoreOpen(false)}
                        role="menuitem"
                      >
                        Blog
                      </Link>
                      <a
                        href="https://nakodamobile.in/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-3 py-2 rounded-lg text-slate-800 hover:bg-gray-100 text-sm"
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
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  ref={desktopSearchRef}
                  type="text"
                  placeholder={searchTerm ? '' : 'Searching...'}
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 text-sm rounded-full border border-slate-300/60
                             bg-white/70 shadow-inner placeholder:text-slate-400
                             focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 text-slate-400" />
                  )}
                </span>
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-black/5"
                  aria-label="Search"
                >
                  <Search className="h-4 w-4 text-slate-600" />
                </button>
              </form>

              <AnimatePresence>
                {showResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50"
                  >
                    {searchResults.slice(0, 8).map((result) => (
                      <div
                        key={result.id}
                        onClick={() => handleResultClick(result.id)}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <img src={result.image} alt={result.name} className="w-12 h-12 object-cover rounded-md mr-3" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{result.name}</h4>
                          <p className="text-xs text-gray-500">{result.category}</p>
                          <p className="text-sm font-semibold text-sky-700">₹{result.price.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {searchResults.length > 8 && (
                      <div className="p-3 text-center border-t">
                        <Link
                          to={`/products?search=${encodeURIComponent(searchTerm)}`}
                          onClick={() => setShowResults(false)}
                          onMouseDown={(e) => e.preventDefault()}
                          className="text-sky-700 hover:text-sky-900 text-sm font-medium"
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
            {/* Mobile Search toggle */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="lg:hidden p-2 rounded-full text-slate-800 hover:bg-black/5"
              aria-label="Open search"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Wishlist */}
            <Link to="/wishlist" className="p-2 rounded-full text-slate-800 hover:bg-black/5" aria-label="Wishlist">
              <Heart className="6-5 w-6" />
            </Link>

            {/* Cart */}
            <Link to="/cart" className="relative p-2 rounded-full text-slate-800 hover:bg-black/5" aria-label="Cart">
              <ShoppingCart className="h-6 w-6" />
              {getTotalItems() > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
                >
                  {getTotalItems()}
                </motion.span>
              )}
            </Link>

            {/* Account */}
            {user ? (
              <div className="relative group">
                <button className="flex items-center space-x-2 p-2 rounded-full text-slate-800 hover:bg-black/5">
                  <User className="h-6 w-6" />
                  <span className="hidden sm:block text-sm">{user.name}</span>
                </button>
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <Link to="/profile" className="block px-4 py-2 text-slate-800 hover:bg-gray-100">Profile</Link>
                  <Link to="/video" className="block px-4 py-2 text-slate-800 hover:bg-gray-100">Video</Link>
                  <button onClick={logout} className="block w-full text-left px-4 py-2 text-slate-800 hover:bg-gray-100">
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-base hover:bg-black"
              >
                Login
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => {
                setIsMenuOpen((v) => !v);
                if (isMenuOpen) {
                  setIsCategoriesOpen(false);
                  setIsMoreOpen(false);
                }
              }}
              className="lg:hidden p-2 rounded-full text-slate-800 hover:bg-black/5"
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
              className="lg:hidden py-3 border-t"
            >
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  ref={mobileSearchRef}
                  type="text"
                  placeholder={searchTerm ? '' : SEARCH_HINTS[hintIndex]}
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300/60 rounded-full bg-white/80
                             focus:ring-2 focus:ring-sky-400 focus:border-transparent text-sm placeholder:text-slate-400"
                />
                <button type="submit" className="absolute left-3 top-2.5">
                  {isSearching ? (
                    <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                  ) : (
                    <Search className="h-5 w-5 text-slate-400" />
                  )}
                </button>
              </form>

              <AnimatePresence>
                {showResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto"
                  >
                    {searchResults.slice(0, 5).map((result) => (
                      <div
                        key={result.id}
                        onClick={() => handleResultClick(result.id)}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <img src={result.image} alt={result.name} className="w-10 h-10 object-cover rounded-md mr-3" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{result.name}</h4>
                          <p className="text-sm font-semibold text-sky-700">₹{result.price.toLocaleString()}</p>
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
              className="lg:hidden py-3 border-t"
            >
              <nav className="flex flex-col space-y-2">
                <Link
                  to="/"
                  className="px-3 py-2 text-slate-800 hover:text-slate-900 hover:bg-black/5 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Home
                </Link>

                {/* Categories accordion */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-slate-800"
                    onClick={() => setIsCategoriesOpen((s) => !s)}
                    aria-expanded={isCategoriesOpen}
                  >
                    <span className="font-medium">Categories</span>
                    <motion.span animate={{ rotate: isCategoriesOpen ? 180 : 0 }}>▾</motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isCategoriesOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white"
                      >
                        {CATEGORIES.map((c) => (
                          <Link
                            key={c.slug}
                            to={categoryUrl(c.slug)}
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
                          >
                            <span className="w-12 h-12 rounded-full bg-gray-100 inline-flex items-center justify-center shadow-sm">
                              <img src={c.img} alt={c.alt || c.label} className="w-9 h-9 object-contain" loading="lazy" />
                            </span>
                            <span className="text-slate-800">{c.label}</span>
                          </Link>
                        ))}
                        <Link
                          to="/categories"
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-4 py-2 text-sky-700 font-medium hover:bg-sky-50"
                        >
                          View all categories
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Link
                  to="/products"
                  className="px-3 py-2 text-slate-800 hover:text-slate-900 hover:bg-black/5 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Shop Now
                </Link>
                <Link
                  to="/contact"
                  className="px-3 py-2 text-slate-800 hover:text-slate-900 hover:bg_black/5 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Contact
                </Link>

                {/* More accordion (Blog + Explore B2B) */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-slate-800"
                    onClick={() => setIsMoreOpen((s) => !s)}
                    aria-expanded={isMoreOpen}
                  >
                    <span className="font-medium">More</span>
                    <motion.span animate={{ rotate: isMoreOpen ? 180 : 0 }}>▾</motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isMoreOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white"
                      >
                        <Link
                          to="/blog"
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-4 py-2 hover:bg-gray-50 text-slate-800"
                        >
                          Blog
                        </Link>
                        <a
                          href="https://nakodamobile.in/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-4 py-2 hover:bg-gray-50 text-slate-800"
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
