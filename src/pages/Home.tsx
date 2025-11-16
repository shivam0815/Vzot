// src/pages/Home.tsx (VZOT — 3D green/black gradient + glassmorphism)
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

/* ——————————————————— Types ——————————————————— */
export type Product = {
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

/* ——————————————————— Page ——————————————————— */
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
  const [company, setCompany] = useState(''); 

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
    { id: 'Bluetooth Neckbands', name: 'Bluetooth Neckband', icon: '🎧', description: 'Premium wireless neckbands' },
    { id: 'TWS', name: 'True Wireless Stereo', icon: '🎵', description: 'High-quality TWS earbuds' },
    { id: 'Data Cables', name: 'Data Cable', icon: '🔌', description: 'Fast charging & sync cables' },
    { id: 'Mobile Chargers', name: 'Wall Charger', icon: '⚡', description: 'Quick & safe charging' },
    { id: 'Car Chargers', name: 'Car Charger', icon: '🚗', description: 'On-the-go charging' },
    { id: 'ICs', name: 'Mobile IC', icon: '🔧', description: 'Integrated circuits' },
    { id: 'Power Banks', name: 'Power Banks', icon: '📱', description: 'Extra power anywhere' },
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

  // Card (glass)
  const Card: React.FC<{ p: Product; badge?: React.ReactNode; compact?: boolean }> = ({ p, badge, compact }) => {
    const raw = useMemo(() => pickPrimaryImage(p), [p]);
    const optimized = raw ? getOptimizedImageUrl(raw, 700, 700) : undefined;
    const [imgSrc, setImgSrc] = useState<string | undefined>(optimized ?? raw);
    useEffect(() => { setImgSrc(optimized ?? raw); }, [optimized, raw]);

    const off = priceOffPct(p.price, p.originalPrice);

    return (
      <article className={`group ${compact ? 'w-[240px] shrink-0' : ''}`}>
        <button
          onClick={() => navigate(`/products/${p.slug || p._id}`)}
          className="relative block w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)]"
          aria-label={p.name}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={p.name}
              className="aspect-square w-full object-contain bg-transparent transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
              onError={() => setImgSrc(imgSrc !== raw ? raw : undefined)}
            />
          ) : (
            <div className="aspect-square w-full bg-white/5" />
          )}
          {off > 0 && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-xs font-semibold bg-black/80 text-white px-2 py-1 rounded-full">
              <BadgePercent className="w-3 h-3" /> {off}% OFF
            </span>
          )}
          {badge && <span className="absolute top-3 right-3">{badge}</span>}
        </button>

        <div className="mt-3 text-white/90">
          <h3 className="line-clamp-2 text-[17px] font-medium leading-tight">{p.name}</h3>
          <div className="mt-1 text-[14px] text-white/70">{p.brand ?? 'VZOT'}</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-[17px] font-semibold">₹{(p.price ?? 0).toLocaleString()}</div>
            {p.originalPrice && p.originalPrice > p.price && (
              <div className="text-white/50 line-through">₹{p.originalPrice.toLocaleString()}</div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to={`/products/${p.slug || p._id}`}
              className="rounded-full bg-black/80 px-3 py-2 text-sm font-semibold text-white text-center hover:bg-black"
            >
              View
            </Link>
            <Link
              to={`/products/${p.slug || p._id}`}
              className="rounded-full border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 text-center"
            >
              Details
            </Link>
          </div>
        </div>
      </article>
    );
  };

  // Skeletons (glass)
  const SkeletonGrid: React.FC<{ count: number }> = ({ count }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-3xl border border-white/10 p-4 bg-white/5 backdrop-blur-xl">
          <div className="aspect-square w-full rounded-2xl bg-white/10 animate-pulse" />
          <div className="mt-4 h-5 w-3/4 bg-white/10 rounded animate-pulse" />
          <div className="mt-2 h-4 w-1/2 bg-white/10 rounded animate-pulse" />
          <div className="mt-4 h-9 w-full bg-white/10 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );

  const SkeletonScrollGrid: React.FC<{ count: number }> = ({ count }) => (
    <div className="flex gap-6 overflow-x-auto">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[240px] shrink-0 rounded-3xl border border-white/10 p-4 bg-white/5 backdrop-blur-xl">
          <div className="aspect-square w-full rounded-2xl bg-white/10 animate-pulse" />
          <div className="mt-4 h-5 w-3/4 bg-white/10 rounded animate-pulse" />
          <div className="mt-2 h-4 w-1/2 bg-white/10 rounded animate-pulse" />
          <div className="mt-4 h-9 w-full bg-white/10 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative min-h-screen text-white">
      {/* 3D gradient background (logo colors) */}
      <div className="fixed inset-0 -z-10">
        {/* Base radial + conic layers */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(1200px 700px at 20% 10%, rgba(0,255,180,0.18), transparent 60%),\
               radial-gradient(900px 600px at 85% 20%, rgba(3,180,140,0.18), transparent 60%),\
               radial-gradient(1000px 700px at 50% 100%, rgba(0,0,0,0.55), rgba(0,0,0,0.85))',
          }}
        />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              'conic-gradient(from 210deg at 70% 40%, rgba(18,170,120,0.20), rgba(0,0,0,0.2), rgba(0,140,110,0.25), rgba(0,0,0,0.25), rgba(18,170,120,0.20))',
            filter: 'saturate(1.1)',
          }}
        />
        {/* Soft noise for depth */}
        <div className="absolute inset-0 mix-blend-overlay opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+qY8QxQAAAABJRU5ErkJggg==)' }} />
        {/* Highlight blobs */}
        <div className="absolute -top-20 -left-20 h-[420px] w-[420px] rounded-full blur-[90px] opacity-60" style={{ background: 'linear-gradient(140deg, #25F4B7, #0B7C67)' }} />
        <div className="absolute top-40 right-[-120px] h-[520px] w-[520px] rounded-full blur-[100px] opacity-50" style={{ background: 'linear-gradient(160deg, #0A1E28, #0D2E3A)' }} />
      </div>

      <div ref={overlayRef} className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true" />
      <SEO
        title="Home"
        description="Shop mobile accessories—TWS, neckbands, chargers, cables, ICs & more."
        canonicalPath="/"
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Organization', name: 'VZOT', url: 'https://localhost:5000', logo: '/favicon-512.png' }}
      />

      {/* HERO / Store header */}
      <section className="pt-16 md:pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-8">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 backdrop-blur-xl px-4 py-2 mb-4">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Premium Mobile Accessories</span>
              </div>
              <h1 className="text-[44px] md:text-[56px] leading-[1.05] font-semibold tracking-tight">Store</h1>
              <p className="mt-3 text-lg text-white/80">The best way to buy the accessories you love.</p>
              <Link to="/contact" className="inline-block mt-4 text-sm font-semibold text-teal-300 hover:opacity-80">
                Talk to us →
              </Link>
            </div>
            <div className="lg:col-span-7">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 shadow-[0_15px_50px_rgba(0,0,0,0.25)]">
                <div className="absolute -top-10 -right-10 h-52 w-52 rounded-full blur-2xl opacity-60" style={{ background: 'radial-gradient(closest-side,#1ee5b2,transparent)' }} />
                <div className="flex items-center gap-4">
                  <img src="/logo.webp" alt="VZOT" className="h-14 w-auto" />
                  <div>
                    <p className="text-white/80">SMART ACCESSORIES, SMARTER YOU</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      
                      <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs">Bulk B2B</span>
                      <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs">Pan‑India Shipping</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick categories (glass chips) */}
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
             
              ].map((c) => (
                <button
                  key={c.slug}
                  onClick={() => navigate(`/products?category=${encodeURIComponent(c.slug)}`)}
                  className="group rounded-2xl bg-white/5 border border-white/10 px-4 py-6 flex flex-col items-center hover:bg-white/10 hover:-translate-y-0.5 transition-all backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)]"
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
                  <span className="mt-3 text-[13px] md:text-[14px] text-white/80">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Accessories rail */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center backdrop-blur-xl">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold">Mobile Accessories</h2>
                <p className="text-white/70">Best Mobile Accessories with varied features</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/products?category=neckband&category=tws&category=Data-Cables&category=chargers&category=Car-Charger"
                className="text-sm font-semibold hover:opacity-80 mr-2"
              >
                View all →
              </Link>
              <button onClick={mobileAccessoriesRef.scrollLeft} className="rounded-full border border-white/15 bg-white/5 p-2 hover:bg-white/10" aria-label="Prev">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={mobileAccessoriesRef.scrollRight} className="rounded-full border border-white/15 bg-white/5 p-2 hover:bg-white/10" aria-label="Next">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loadingMobileAccessories && mobileAccessories.length === 0 ? (
            <SkeletonScrollGrid count={8} />
          ) : mobileAccessories.length === 0 ? (
            <div className="text-sm text-white/70">Items will appear here soon.</div>
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
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center backdrop-blur-xl">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">TWS Earbuds</h2>
                <p className="text-white/70">True wireless. Compact. Powerful.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/products?category=tws" className="text-teal-300 hover:text-teal-200 font-semibold mr-4">
                View all →
              </Link>
              <button onClick={twsRef.scrollLeft} className="rounded-full border border-white/15 bg-white/5 p-2 hover:bg-white/10" aria-label="Prev">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={twsRef.scrollRight} className="rounded-full border border-white/15 bg-white/5 p-2 hover:bg-white/10" aria-label="Next">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loadingTws && tws.length === 0 ? (
            <SkeletonScrollGrid count={8} />
          ) : tws.length === 0 ? (
            <div className="text-sm text-white/70">TWS earbuds will appear here soon.</div>
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
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center backdrop-blur-xl">
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold">New Arrivals</h2>
                <p className="text-white/70">Fresh drops — updated often</p>
              </div>
            </div>
            <Link to="/products?sort=new" className="text-sm font-semibold hover:opacity-80">
              View all →
            </Link>
          </div>

          {loadingNew && newArrivals.length === 0 ? (
            <SkeletonGrid count={8} />
          ) : newArrivals.length === 0 ? (
            <div className="text-sm text-white/70">New arrivals will appear here soon.</div>
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
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center backdrop-blur-xl">
                <Bolt className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">Mobile Chargers</h2>
                <p className="text-white/70">Fast, reliable, and safe charging</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/products?category=chargers" className="text-teal-300 hover:text-teal-200 font-semibold mr-4">
                View all →
              </Link>
              <button onClick={chargerRef.scrollLeft} className="rounded-full border border-white/15 bg-white/5 p-2 hover:bg-white/10" aria-label="Prev">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={chargerRef.scrollRight} className="rounded-full border border-white/15 bg-white/5 p-2 hover:bg-white/10" aria-label="Next">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loadingChargers && chargers.length === 0 ? (
            <SkeletonScrollGrid count={8} />
          ) : chargers.length === 0 ? (
            <div className="text-sm text-white/70">Chargers will appear here soon.</div>
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
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center backdrop-blur-xl">
                <BadgePercent className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold">Hot Deals</h2>
                <p className="text-white/70">Top discounts across categories</p>
              </div>
            </div>
            <Link to="/products?sort=trending" className="text-sm font-semibold hover:opacity-80">
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
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-3">Shop by Category</h2>
            <p className="text-white/70 max-w-2xl mx-auto">
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
                  className={`relative rounded-3xl p-6 border border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 ${
                    hoveredCategory === category.id
                      ? 'shadow-[0_20px_60px_rgba(0,0,0,0.35)] -translate-y-1'
                      : 'hover:shadow-[0_12px_40px_rgba(0,0,0,0.25)]'
                  }`}
                >
                  <div className="relative text-4xl mb-4">{category.icon}</div>
                  <h3 className="text-lg font-medium">{category.name}</h3>
                  <p className="text-sm text-white/70 mb-4">{category.description}</p>
                  <button
                    onClick={() => handleCategoryClick(category.id)}
                    className="inline-flex items-center text-sm font-semibold rounded-full px-3 py-1 border border-white/15 bg-white/5 hover:bg-white/10"
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-2">
          <PromoSlider />
        </div>
      </div>

      {/* Why Choose Us */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-semibold mb-3">Why Choose Us?</h2>
            <p className="text-white/70">We focus on finish, reliability and service.</p>
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
              <div key={i} className="text-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5">
                  {b.icon}
                </div>
                <h3 className="text-lg font-medium mb-2">{b.title}</h3>
                <p className="text-white/80">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-3">What Our Customers Say</h2>
            <p className="text-white/70">Real feedback.</p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center"
              >
                <Quote className="h-10 w-10 mx-auto mb-6" />
                <p className="text-xl text-white/90 mb-6 italic">
                  "{testimonials[currentTestimonial].content}"
                </p>
                <div className="flex items-center justify-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-current" />
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
                    <p className="text-white/70">{testimonials[currentTestimonial].role}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            <button
              onClick={() =>
                setCurrentTestimonial((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1))
              }
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 rounded-full border border-white/15 bg-white/5 p-3 hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 rounded-full border border-white/15 bg-white/5 p-3 hover:bg-white/10"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentTestimonial(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    currentTestimonial === i ? 'bg-white' : 'bg-white/40'
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
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 md:p-14">
            <div className="mb-4 inline-block rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold">
              🏭 OEM Services Available
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">
              Need Bulk Orders or Custom Branding?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-3xl mx-auto">
              Bulk manufacturing, custom branding, and packaging solutions for businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://nakodamobile.in/oem"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-black/80 text-white px-8 py-3 font-semibold hover:bg-black inline-flex items-center justify-center"
              >
                <span>Learn More</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="https://nakodamobile.in/oem#contact-form"
                className="rounded-full border border-white/15 bg-white/5 px-8 py-3 font-semibold hover:bg-white/10"
              >
                Get Quote
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 md:p-14 text-center">
            <h2 className="text-3xl font-semibold mb-3">Stay Updated</h2>
            <p className="text-white/80 mb-8">New products, early deals. No spam.</p>

            {subscribed && (
              <div className="max-w-md mx-auto mb-4 text-sm bg-emerald-400/15 text-emerald-200 border border-emerald-300/20 rounded-md px-4 py-3">
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
                className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/20 focus:outline-none disabled:opacity-60"
                aria-label="Email address"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              <motion.button
                type="submit"
                className="rounded-full bg-black/80 text-white px-6 py-3 font-semibold hover:bg-black disabled:opacity-60"
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                disabled={loading}
              >
                {loading ? 'Subscribing…' : 'Subscribe'}
              </motion.button>
            </form>

            <p className="text-xs text-white/70 mt-3">
              By subscribing, you agree to our{' '}
              <Link to="/privacy" className="underline hover:text-white">
                Privacy Policy
              </Link>
              .
            </p>

            <div className="flex justify-center space-x-4 mt-8">
              <a
                href="https://www.facebook.com/jitukumarkothari/"
                className="text-white/60 hover:text-white"
                rel="noreferrer"
                aria-label="Facebook"
              >
                <Facebook className="h-6 w-6" />
              </a>
              <a
                href="https://x.com/_nakodamobile_?t=yJpXFZwym_u7fbB_3ORckQ&s=08"
                className="text-white/60 hover:text-white"
                rel="noreferrer"
                aria-label="Twitter"
              >
                <Twitter className="h-6 w-6" />
              </a>
              <a
                href="https://www.instagram.com/v2m_nakoda_mobile/"
                className="text-white/60 hover:text-white"
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
