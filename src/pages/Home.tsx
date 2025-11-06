// src/pages/Home.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Star,
  ShoppingBag,
  Users,
  Award,
  Shield,
  Truck,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Quote,
  Instagram,
  Twitter,
  Facebook,
  Sparkles,
  Banknote,
  BadgePercent,
  BadgeCheck,
  Smartphone,
  Bolt,
} from 'lucide-react';

import { useFirstVisitCelebration } from '../hooks/useFirstVisitCelebration';
import { useAuth } from '../hooks/useAuth';

import PromoSlider from '../components/Layout/PromoSlider';
import SEO from '../components/Layout/SEO';
import { newsletterService } from '../services/newsletterService';
import toast from 'react-hot-toast';

import { resolveImageUrl, getOptimizedImageUrl } from '../utils/imageUtils';
import { useTranslation } from 'react-i18next';

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(e.trim());
const API_BASE =
  (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

type Product = {
  _id: string;
  name: string;
  slug?: string;
  price: number;
  originalPrice?: number;
  images?: string[];
  imageUrl?: string;
  rating?: number;
  category?: string;
  status?: string;
  brand?: string;
  stock?: number;
  tags?: string[];
};

const priceOffPct = (price?: number, original?: number) => {
  if (!price || !original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
};

const Home: React.FC = () => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const { user, isAuthenticated } = useAuth();

  useFirstVisitCelebration({
    enabled: Boolean(isAuthenticated),
    userId: user?.id || user?.id,
    cooldownHours: 24,
    containerRef: overlayRef,
  });

  useTranslation();
  const navigate = useNavigate();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Newsletter
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [company, setCompany] = useState(''); // honeypot

  // Product lists
  const [hot, setHot] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [popular, setPopular] = useState<Product[]>([]);
  const [mobileAccessories, setMobileAccessories] = useState<Product[]>([]);
  const [chargers, setChargers] = useState<Product[]>([]);
  const [tws, setTws] = useState<Product[]>([]);

  // Loading flags
  const [loadingHot, setLoadingHot] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [loadingMobileAccessories, setLoadingMobileAccessories] = useState(false);
  const [loadingChargers, setLoadingChargers] = useState(false);
  const [loadingTws, setLoadingTws] = useState(false);

  const categories = [
    { id: 'Bluetooth Neckbands', name: 'Bluetooth Neckband', icon: '🎧', gradient: 'from-neutral-900 to-neutral-900', description: 'Premium wireless neckbands', color: 'bg-neutral-900' },
    { id: 'TWS', name: 'True Wireless Stereo', icon: '🎵', gradient: 'from-neutral-900 to-neutral-900', description: 'High-quality TWS earbuds', color: 'bg-neutral-900' },
    { id: 'Data Cables', name: 'Data Cable', icon: '🔌', gradient: 'from-neutral-900 to-neutral-900', description: 'Fast charging & sync cables', color: 'bg-neutral-900' },
    { id: 'Mobile Chargers', name: 'Wall Charger', icon: '⚡', gradient: 'from-neutral-900 to-neutral-900', description: 'Quick & safe charging', color: 'bg-neutral-900' },
    { id: 'Car Chargers', name: 'Car Charger', icon: '🚗', gradient: 'from-neutral-900 to-neutral-900', description: 'On-the-go charging', color: 'bg-neutral-900' },
    { id: 'ICs', name: 'Mobile IC', icon: '🔧', gradient: 'from-neutral-900 to-neutral-900', description: 'Integrated circuits', color: 'bg-neutral-900' },
    { id: 'Power Banks', name: 'Power Banks', icon: '📱', gradient: 'from-neutral-900 to-neutral-900', description: 'Extra power anywhere', color: 'bg-neutral-900' },
  ];

  const testimonials = [
    { name: 'Saransh', role: 'Tech Enthusiast', content: 'Amazing quality products! The TWS earbuds I bought exceeded my expectations. Crystal clear sound and perfect fit.', rating: 5, image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' },
    { name: 'Mike chen', role: 'Mobile Repair Shop Owner', content: "Their repair tools are professional grade. I've been using them for 2 years and they're still like new. Highly recommended!", rating: 5, image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' },
    { name: 'Priya Sharma', role: 'Business Owner', content: 'Excellent OEM services. They delivered 1000+ custom branded chargers on time with perfect quality. Great team!', rating: 5, image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleCategoryClick = (categoryId: string) =>
    navigate(`/products?category=${encodeURIComponent(categoryId)}`);

  // Primary image picker
  const pickPrimaryImage = (p: any): string | undefined => {
    const list: any[] = [
      p.imageUrl,
      p.image,
      p.thumbnail,
      Array.isArray(p.images) ? p.images : undefined,
      p.photo,
      p.photos?.[0],
      p.media?.[0],
      p.gallery?.[0],
    ]
      .flat()
      .filter(Boolean);

    for (const cand of list) {
      const raw =
        typeof cand === 'string'
          ? cand
          : cand?.url || cand?.secure_url || cand?.path || cand?.src;
      const resolved = resolveImageUrl(raw);
      if (resolved) return resolved;
    }
    return undefined;
  };

  // Fetch products
  useEffect(() => {
    const loadHot = async () => {
      try {
        setLoadingHot(true);
        const res = await fetch(
          `${API_BASE}/products?limit=24&sort=trending&status=active`,
          { credentials: 'include' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to load trending products');
        setHot(data.products || data.items || []);
      } finally {
        setLoadingHot(false);
      }
    };

    const loadNew = async () => {
      try {
        setLoadingNew(true);
        const res = await fetch(
          `${API_BASE}/products?limit=20&sort=new&status=active`,
          { credentials: 'include' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to load new arrivals');
        setNewArrivals(data.products || data.items || []);
      } finally {
        setLoadingNew(false);
      }
    };

    const loadPopular = async () => {
      try {
        setLoadingPopular(true);
        const res = await fetch(
          `${API_BASE}/products?limit=24&sort=popular&status=active`,
          { credentials: 'include' }
        );
        const data = await res.json();
        setPopular(res.ok ? data.products || data.items || [] : []);
      } finally {
        setLoadingPopular(false);
      }
    };

    const loadMobileAccessories = async () => {
      try {
        setLoadingMobileAccessories(true);
        const slugs = ['neckband', 'tws', 'Data-Cables', 'chargers', 'Car-Charger'];
        const params = new URLSearchParams();
        params.set('categories', slugs.join(','));
        params.set('limit', '12');
        params.set('status', 'active');
        const res = await fetch(`${API_BASE}/products?${params.toString()}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to load mobile accessories');
        setMobileAccessories(data.products || data.items || []);
      } finally {
        setLoadingMobileAccessories(false);
      }
    };

    const loadChargers = async () => {
      try {
        setLoadingChargers(true);
        const res = await fetch(
          `${API_BASE}/products?category=${encodeURIComponent('chargers')}&limit=20&status=active`,
          { credentials: 'include' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to load chargers');
        setChargers(data.products || data.items || []);
      } finally {
        setLoadingChargers(false);
      }
    };

    const loadTws = async () => {
      try {
        setLoadingTws(true);
        const res = await fetch(
          `${API_BASE}/products?category=${encodeURIComponent('tws')}&limit=20&status=active`,
          { credentials: 'include' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to load TWS');
        setTws(data.products || data.items || []);
      } finally {
        setLoadingTws(false);
      }
    };

    loadHot();
    loadNew();
    loadPopular();
    loadMobileAccessories();
    loadChargers();
    loadTws();
  }, []);

  // Derived lists
  const hotDeals = useMemo(() => {
    const base = hot.length ? hot : newArrivals;
    const withOff = base
      .map((p) => ({ p, off: priceOffPct(p.price, p.originalPrice) }))
      .filter((x) => x.off >= 15)
      .sort((a, b) => b.off - a.off)
      .slice(0, 8)
      .map((x) => x.p);
    return withOff.length ? withOff : base.slice(0, 8);
  }, [hot, newArrivals]);

  // scrollers
  const useScroller = () => {
    const ref = useRef<HTMLDivElement | null>(null);
    const scrollBy = (dx: number) => ref.current?.scrollBy({ left: dx, behavior: 'smooth' });
    return { ref, scrollLeft: () => scrollBy(-600), scrollRight: () => scrollBy(600) };
  };

  const mobileAccessoriesRef = useScroller();
  const twsRef = useScroller();
  const chargerRef = useScroller();

  // Newsletter
  const handleSubscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast.error('Enter a valid email');
      return;
    }
    if (company.trim()) {
      setEmail('');
      setSubscribed(true);
      return;
    }
    try {
      setLoading(true);
      await newsletterService.subscribe(email, 'home-newsletter', 'home');
      setSubscribed(true);
      setEmail('');
      toast.success('Please check your inbox and confirm your subscription.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Subscription failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Product Card
  const Card: React.FC<{ p: Product; badge?: React.ReactNode; compact?: boolean }> = ({
    p,
    badge,
    compact,
  }) => {
    const raw = useMemo(() => pickPrimaryImage(p), [p]);
    const optimized = raw ? getOptimizedImageUrl(raw, 700, 700) : undefined;
    const [imgSrc, setImgSrc] = useState<string | undefined>(optimized ?? raw);
    useEffect(() => {
      setImgSrc(optimized ?? raw);
    }, [optimized, raw]);

    const off = priceOffPct(p.price, p.originalPrice);

    return (
      <article className={`group ${compact ? 'w-[240px] shrink-0' : ''}`}>
        <button
          onClick={() => navigate(`/products/${p.slug || p._id}`)}
          className="relative block w-full overflow-hidden rounded-3xl border border-neutral-200 bg-white"
          aria-label={p.name}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={p.name}
              className="aspect-square w-full object-contain bg-white transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
              onError={() => setImgSrc(imgSrc !== raw ? raw : undefined)}
            />
          ) : (
            <div className="aspect-square w-full bg-neutral-100" />
          )}
          {off > 0 && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-xs font-semibold bg-black text-white px-2 py-1 rounded-full">
              <BadgePercent className="w-3 h-3" /> {off}% OFF
            </span>
          )}
          {badge && <span className="absolute top-3 right-3">{badge}</span>}
        </button>

        <div className="mt-3">
          <h3 className="line-clamp-2 text-[17px] font-medium leading-tight">{p.name}</h3>
          <div className="mt-1 text-[14px] text-neutral-500">{p.brand ?? 'VZOT'}</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-[17px] font-semibold">₹{(p.price ?? 0).toLocaleString()}</div>
            {p.originalPrice && p.originalPrice > p.price && (
              <div className="text-neutral-400 line-through">₹{p.originalPrice.toLocaleString()}</div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to={`/products/${p.slug || p._id}`}
              className="rounded-full bg-black px-3 py-2 text-sm font-semibold text-white text-center hover:opacity-90"
            >
              View
            </Link>
            <Link
              to={`/products/${p.slug || p._id}`}
              className="rounded-full border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-black/5 text-center"
            >
              Details
            </Link>
          </div>
        </div>
      </article>
    );
  };

  // Skeletons
  const SkeletonGrid: React.FC<{ count: number }> = ({ count }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-3xl border border-neutral-200 p-4">
          <div className="aspect-square w-full rounded-2xl bg-neutral-100 animate-pulse" />
          <div className="mt-4 h-5 w-3/4 bg-neutral-100 rounded animate-pulse" />
          <div className="mt-2 h-4 w-1/2 bg-neutral-100 rounded animate-pulse" />
          <div className="mt-4 h-9 w-full bg-neutral-100 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );

  const SkeletonScrollGrid: React.FC<{ count: number }> = ({ count }) => (
    <div className="flex gap-6 overflow-x-auto">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[240px] shrink-0 rounded-3xl border border-neutral-200 p-4">
          <div className="aspect-square w-full rounded-2xl bg-neutral-100 animate-pulse" />
          <div className="mt-4 h-5 w-3/4 bg-neutral-100 rounded animate-pulse" />
          <div className="mt-2 h-4 w-1/2 bg-neutral-100 rounded animate-pulse" />
          <div className="mt-4 h-9 w-full bg-neutral-100 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div ref={overlayRef} className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true" />
      <SEO
        title="Home"
        description="Shop mobile accessories—TWS, neckbands, chargers, cables, ICs & more."
        canonicalPath="/"
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Organization', name: 'vzot', url: 'https://localhost:5000', logo: '/favicon-512.png' }}
      />

      {/* Store header + categories (Apple-like) */}
      <section className="bg-[#f5f5f7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-8">
            <div className="lg:col-span-5">
              <h1 className="text-[44px] leading-[1.05] font-semibold tracking-tight text-neutral-900">Store</h1>
            </div>
            <div className="lg:col-span-7">
              <p className="text-[22px] leading-snug text-neutral-800">The best way to buy the accessories you love.</p>
              <Link to="/contact" className="inline-block mt-2 text-sm font-semibold text-blue-600 hover:opacity-80">
                Talk to us →
              </Link>
            </div>
          </div>

          <div className="mt-10 lg:mt-14">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-6 md:gap-8">
              {[
                { label: 'Neckband', slug: 'neckband', img: '/Neckband-removebg-preview.png' },
                { label: 'TWS', slug: 'tws', img: '/Earbud-removebg-preview.png' },
                { label: 'Chargers', slug: 'chargers', img: '/Charger1.webp' },
                { label: 'Power Banks', slug: 'power-bank', img: '/Powerbank.webp' },
                { label: 'Data Cables', slug: 'Data-Cables', img: '/cable.png' },
                { label: 'Car Charger', slug: 'Car-Charger', img: '/CarCharger.webp' },
                { label: 'Speakers', slug: 'bluetooth-speakers', img: '/Bluetooth-Speaker.webp' },
                { label: 'Mobile ICs', slug: 'ICs', img: '/ics.webp' },
              ].map((c) => (
                <button
                  key={c.slug}
                  onClick={() => navigate(`/products?category=${encodeURIComponent(c.slug)}`)}
                  className="group rounded-2xl bg-white border border-neutral-200 px-4 py-6 flex flex-col items-center hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all"
                  aria-label={c.label}
                >
                  <span className="inline-flex h-20 w-20 md:h-24 md:w-24 items-center justify-center">
                    <img
                      src={c.img}
                      alt={c.label}
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </span>
                  <span className="mt-3 text-[13px] md:text-[14px] text-neutral-700">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Accessories rail */}
      <section className="py-16 bg-[#fafafa]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-neutral-200 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-neutral-900" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold">Mobile Accesoories</h2>
                <p className="text-neutral-500">Best Mobile Accessories with varied features</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/products?category=neckband&category=tws&category=Data-Cables&category=chargers&category=Car-Charger"
                className="text-sm font-semibold hover:opacity-70 mr-2"
              >
                View all →
              </Link>
              <button onClick={mobileAccessoriesRef.scrollLeft} className="rounded-full border border-neutral-200 p-2 hover:bg-black/5" aria-label="Prev">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={mobileAccessoriesRef.scrollRight} className="rounded-full border border-neutral-200 p-2 hover:bg-black/5" aria-label="Next">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loadingMobileAccessories && mobileAccessories.length === 0 ? (
            <SkeletonScrollGrid count={8} />
          ) : mobileAccessories.length === 0 ? (
            <div className="text-sm text-neutral-500">Items will appear here soon.</div>
          ) : (
            <div ref={mobileAccessoriesRef.ref} className="flex gap-6 overflow-x-auto scroll-smooth no-scrollbar py-1">
              {mobileAccessories.slice(0, 12).map((p) => (
                <Card key={p._id} p={p} compact />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* TWS rail */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                <BadgeCheck className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">TWS Earbuds</h2>
                <p className="text-gray-500">True wireless. Compact. Powerful.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/products?category=tws" className="text-indigo-600 hover:text-indigo-700 font-semibold mr-4">
                View all →
              </Link>
              <button onClick={twsRef.scrollLeft} className="rounded-full border p-2 hover:bg-gray-50" aria-label="Prev">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={twsRef.scrollRight} className="rounded-full border p-2 hover:bg-gray-50" aria-label="Next">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loadingTws && tws.length === 0 ? (
            <SkeletonScrollGrid count={8} />
          ) : tws.length === 0 ? (
            <div className="text-sm text-gray-600">TWS earbuds will appear here soon.</div>
          ) : (
            <div ref={twsRef.ref} className="flex gap-4 overflow-x-auto scroll-smooth no-scrollbar py-1">
              {tws.slice(0, 12).map((p) => (
                <Card key={p._id} p={p} compact />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-neutral-200 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-neutral-900" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold">New Arrivals</h2>
                <p className="text-neutral-500">Fresh drops — updated often</p>
              </div>
            </div>
            <Link to="/products?sort=new" className="text-sm font-semibold hover:opacity-70">
              View all →
            </Link>
          </div>

          {loadingNew && newArrivals.length === 0 ? (
            <SkeletonGrid count={8} />
          ) : newArrivals.length === 0 ? (
            <div className="text-sm text-neutral-500">New arrivals will appear here soon.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {newArrivals.slice(0, 8).map((p) => (
                <Card key={p._id} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Mobile Chargers rail */}
      <section className="py-14 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center">
                <Bolt className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Mobile Chargers</h2>
                <p className="text-gray-500">Fast, reliable, and safe charging</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/products?category=chargers" className="text-indigo-600 hover:text-indigo-700 font-semibold mr-4">
                View all →
              </Link>
              <button onClick={chargerRef.scrollLeft} className="rounded-full border p-2 hover:bg-gray-50" aria-label="Prev">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={chargerRef.scrollRight} className="rounded-full border p-2 hover:bg-gray-50" aria-label="Next">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loadingChargers && chargers.length === 0 ? (
            <SkeletonScrollGrid count={8} />
          ) : chargers.length === 0 ? (
            <div className="text-sm text-gray-600">Chargers will appear here soon.</div>
          ) : (
            <div ref={chargerRef.ref} className="flex gap-4 overflow-x-auto scroll-smooth no-scrollbar py-1">
              {chargers.slice(0, 12).map((p) => (
                <Card key={p._id} p={p} compact />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Hot Deals */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-neutral-200 flex items-center justify-center">
                <BadgePercent className="h-5 w-5 text-neutral-900" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold">Hot Deals</h2>
                <p className="text-neutral-500">Top discounts across categories</p>
              </div>
            </div>
            <Link to="/products?sort=trending" className="text-sm font-semibold hover:opacity-70">
              View all →
            </Link>
          </div>

          {loadingHot && hot.length === 0 ? (
            <SkeletonGrid count={8} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {(hotDeals.length ? hotDeals : hot.slice(0, 8)).map((p) => (
                <Card key={p._id} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Shop by Category */}
      <section className="py-16 border-t border-neutral-200/70 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-3">Shop by Category</h2>
            <p className="text-neutral-500 max-w-2xl mx-auto">
              Explore our collection of mobile accessories organized for quick decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <div
                key={category.id}
                className="group cursor-pointer"
                onMouseEnter={() => setHoveredCategory(category.id)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <div
                  className={`relative bg-white rounded-3xl p-6 border border-neutral-200 transition-all duration-300 ${
                    hoveredCategory === category.id
                      ? 'shadow-[0_20px_60px_rgba(0,0,0,0.06)] -translate-y-1'
                      : 'hover:shadow-[0_12px_40px_rgba(0,0,0,0.05)]'
                  }`}
                >
                  <div className="relative text-4xl mb-4">{category.icon}</div>
                  <h3 className="text-lg font-medium">{category.name}</h3>
                  <p className="text-sm text-neutral-500 mb-4">{category.description}</p>
                  <button
                    onClick={() => handleCategoryClick(category.id)}
                    className="inline-flex items-center text-sm font-semibold rounded-full px-3 py-1 border border-neutral-200 hover:bg-black/5"
                  >
                    Explore
                    <ArrowRight className="ml-1 w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secondary promos */}
      <PromoSlider />

      {/* Why Choose Us */}
      <section className="py-16 border-t border-neutral-200/70 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-semibold mb-3">Why Choose Us?</h2>
            <p className="text-neutral-500">We focus on finish, reliability and service.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Shield className="h-8 w-8" />,
                title: 'Quality Guaranteed',
                description: 'Every product is QA-checked and backed by counter-warranty approval.',
              },
              {
                icon: <Truck className="h-8 w-8" />,
                title: 'Fast Delivery',
                description: 'Quick shipping across India with tracking.',
              },
              {
                icon: <Headphones className="h-8 w-8" />,
                title: 'Expert Support',
                description: 'Real help from technical staff.',
              },
              {
                icon: <Award className="h-8 w-8" />,
                title: 'Best Prices',
                description: 'Competitive wholesale pricing with bulk discounts.',
              },
            ].map((b, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-neutral-200">
                  {b.icon}
                </div>
                <h3 className="text-lg font-medium mb-2">{b.title}</h3>
                <p className="text-neutral-600">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-[#fafafa]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-3">What Our Customers Say</h2>
            <p className="text-neutral-500">Real feedback.</p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <div className="rounded-3xl border border-neutral-200 bg-white p-8 md:p-10">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center"
              >
                <Quote className="h-10 w-10 text-neutral-900 mx-auto mb-6" />
                <p className="text-xl text-neutral-800 mb-6 italic">
                  "{testimonials[currentTestimonial].content}"
                </p>
                <div className="flex items-center justify-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-black fill-current" />
                  ))}
                </div>
                <div className="flex items-center justify-center">
                  <img
                    src={testimonials[currentTestimonial].image}
                    alt={testimonials[currentTestimonial].name}
                    className="w-12 h-12 rounded-full mr-4"
                  />
                  <div>
                    <h4 className="font-semibold">{testimonials[currentTestimonial].name}</h4>
                    <p className="text-neutral-500">{testimonials[currentTestimonial].role}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            <button
              onClick={() =>
                setCurrentTestimonial((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1))
              }
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 rounded-full border border-neutral-200 bg-white p-3 hover:bg-black/5"
            >
              <ChevronLeft className="h-5 w-5 text-neutral-700" />
            </button>
            <button
              onClick={() => setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 rounded-full border border-neutral-200 bg-white p-3 hover:bg-black/5"
            >
              <ChevronRight className="h-5 w-5 text-neutral-700" />
            </button>

            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentTestimonial(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    currentTestimonial === i ? 'bg-black' : 'bg-neutral-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* OEM CTA */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl border border-neutral-200 p-10 md:p-14">
            <div className="mb-4 inline-block rounded-full border border-neutral-200 px-5 py-2 text-sm font-semibold">
              🏭 OEM Services Available
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">
              Need Bulk Orders or Custom Branding?
            </h2>
            <p className="text-lg text-neutral-600 mb-8 max-w-3xl mx-auto">
              Bulk manufacturing, custom branding, and packaging solutions for businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://nakodamobile.in/oem"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-black text-white px-8 py-3 font-semibold hover:opacity-90 inline-flex items-center justify-center"
              >
                <span>Learn More</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="https://nakodamobile.in/oem#contact-form"
                className="rounded-full border border-neutral-200 px-8 py-3 font-semibold hover:bg-black/5"
              >
                Get Quote
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-20 bg-[#fafafa]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-neutral-200 p-10 md:p-14 text-center bg-white">
            <h2 className="text-3xl font-semibold mb-3">Stay Updated</h2>
            <p className="text-neutral-600 mb-8">New products, early deals. No spam.</p>

            {subscribed && (
              <div className="max-w-md mx-auto mb-4 text-sm bg-green-600/10 text-green-700 border border-green-400/30 rounded-md px-4 py-3">
                Thanks. Please check your email to confirm.
              </div>
            )}

            <form onSubmit={handleSubscribe} className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row" noValidate>
              <input
                type="text"
                name="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="flex-1 rounded-full border border-neutral-200 px-5 py-3 text-neutral-900 focus:ring-2 focus:ring-black/10 focus:outline-none disabled:opacity-60"
                aria-label="Email address"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              <motion.button
                type="submit"
                className="rounded-full bg-black text-white px-6 py-3 font-semibold hover:opacity-90 disabled:opacity-60"
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                disabled={loading}
              >
                {loading ? 'Subscribing…' : 'Subscribe'}
              </motion.button>
            </form>

            <p className="text-xs text-neutral-500 mt-3">
              By subscribing, you agree to our{' '}
              <Link to="/privacy" className="underline hover:text-neutral-700">
                Privacy Policy
              </Link>
              .
            </p>

            <div className="flex justify-center space-x-4 mt-8">
              <a
                href="https://www.facebook.com/jitukumarkothari/"
                className="text-neutral-400 hover:text-neutral-800"
                rel="noreferrer"
                aria-label="Facebook"
              >
                <Facebook className="h-6 w-6" />
              </a>
              <a
                href="https://x.com/_nakodamobile_?t=yJpXFZwym_u7fbB_3ORckQ&s=08"
                className="text-neutral-400 hover:text-neutral-800"
                rel="noreferrer"
                aria-label="Twitter"
              >
                <Twitter className="h-6 w-6" />
              </a>
              <a
                href="https://www.instagram.com/v2m_nakoda_mobile/"
                className="text-neutral-400 hover:text-neutral-800"
                rel="noreferrer"
                aria-label="Instagram"
              >
                <Instagram className="h-6 w-6" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
