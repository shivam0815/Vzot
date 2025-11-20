// src/pages/ProductDetail.tsx — dark glass B2C detail page with pricing mode + MOQ
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Heart,
  Share2,
  ChevronLeft,
  Plus,
  Minus,
  Truck,
  Shield,
  RotateCcw,
  MessageCircle,
  CreditCard,
} from 'lucide-react';
import { productService } from '../services/productService';
import type { Product } from '../types';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { resolveImageUrl } from '../utils/imageUtils';
import toast from 'react-hot-toast';
import SEO from '../components/Layout/SEO';
import Reviews from '../components/Layout/Reviews';
import Breadcrumbs from './Breadcrumbs';
import VZOTBackground from '../components/Layout/VZOTBackground';
import { usePricingMode } from '../context/PricingModeProvider';

/* ------------------------- Helpers ------------------------- */
const normalizeSpecifications = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw as Map<string, unknown>);
  if (Array.isArray(raw)) {
    if (raw.length && Array.isArray(raw[0]) && (raw[0] as unknown[]).length === 2) {
      try { return Object.fromEntries(raw as unknown as [string, unknown][]); } catch { return {}; }
    }
    return {};
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch { return {}; }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
};

const fullImage = (src?: string | null) => resolveImageUrl(src ?? undefined) || (src ?? '');

const safeImage = (src?: string | null, w = 400, h = 400) => {
  const resolved = resolveImageUrl(src ?? undefined);
  if (resolved) return resolved;
  return `https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=${w}&h=${h}&fit=crop&crop=center&auto=format&q=60`;
};

const prettyKey = (k: string) =>
  k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase());

const renderSpecValue = (val: unknown) => {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return (val as unknown[]).join(', ');
  return <code className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(val, null, 2)}</code>;
};

const slugify = (s?: string) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const productHandle = (p: any) => slugify(p?.slug || p?.name) || (p?._id || p?.id) || '';
const productUrlAbs = (p: any) => `https://nakodamobile.com/product/${productHandle(p)}`;

const num = (v: any): number | undefined => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/* ------------------------------ Component ------------------------------ */
const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // slug or id; route path: /product/:id
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = usePricingMode(); // <<< single source of truth for pricing mode

  // smart back plumbing
  const backTarget =
    (location.state as any)?.fromPath ||
    sessionStorage.getItem('last-products-url') ||
    '/products';

  const cameFromProducts = (() => {
    try {
      if (!document.referrer) return false;
      const u = new URL(document.referrer);
      return u.origin === window.location.origin && u.pathname.startsWith('/products');
    } catch { return false; }
  })();

  const smartBack: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement> = (e) => {
    e.preventDefault();
    if (cameFromProducts && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(backTarget, { replace: true });
    }
  };

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<number>(0);

  // quantity reflects MOQ when wholesale is active
  const [quantity, setQuantity] = useState<number>(1);
  const [rawQty, setRawQty] = useState<string>('1');

  const { addToCart, isLoading } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist, isLoading: wishlistLoading } = useWishlist();



  /* Normalize images */
  const normalizedImages = useMemo<string[]>(() => {
    const raw = (product as any)?.images;
    const arr: unknown[] = Array.isArray(raw) ? raw : [];
    return arr
      .map((img: unknown) => {
        if (typeof img === 'string') return img;
        if (img && typeof img === 'object') {
          const o = img as Record<string, unknown>;
          return (o.secure_url as string) || (o.url as string) || '';
        }
        return '';
      })
      .filter((s: string) => typeof s === 'string' && s.trim() !== '' && s !== 'undefined' && s !== 'null');
  }, [product]);

  const highlightImages = useMemo<string[]>(() => {
    const raw = (product as any)?.highlightImages;
    const arr = Array.isArray(raw) ? raw : normalizedImages;
    const seen = new Set<string>();
    return arr.filter((u) => {
      if (typeof u !== 'string' || !u) return false;
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }, [product, normalizedImages]);

  /* Fetch product */
  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const response = await productService.getProduct(id);
        const normalizedProduct: Product = {
          ...(response.product as Product),
          specifications: normalizeSpecifications((response.product as any)?.specifications),
          reviewsCount: (response.product as any)?.reviewsCount ?? (response.product as any)?.reviews ?? 0,
        };
        setProduct(normalizedProduct);
      } catch (err: any) {
        setError(err.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  /* Pricing mode + wholesale bindings (from context) */
  const wholesaleEnabled = Boolean((product as any)?.wholesaleEnabled);
  const wholesalePrice = num((product as any)?.wholesalePrice);
  const wholesaleMinQty = num((product as any)?.wholesaleMinQty) ?? 1;
  const wholesaleActive = mode === 'wholesale' && wholesaleEnabled && typeof wholesalePrice === 'number';

  const unitPrice: number | undefined = wholesaleActive ? (wholesalePrice as number) : (product as any)?.price;
  const minQty = wholesaleActive ? wholesaleMinQty : 1;

  /* Qty helpers with MOQ awareness */
  const maxQty = (product as any)?.inStock ? Math.max(minQty, Number((product as any).stockQuantity) || minQty) : 0;

  const clampQty = (raw: unknown, max: number, min: number) => {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  };

  // reset qty when product, minQty, maxQty, or mode changes
  useEffect(() => {
    if (!product) return;
    const init = clampQty(minQty, maxQty || minQty, minQty);
    setQuantity(init);
    setRawQty(String(init));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, minQty, maxQty, mode]);

  const commitQty = (v: string | number) => {
    const final = clampQty(v, maxQty || minQty, minQty);
    setQuantity(final);
    setRawQty(String(final));
    return final;
  };

  /* Reviews deep-link */
  useEffect(() => {
    if (window.location.hash === '#reviews') {
      setActiveTab('reviews');
      setTimeout(() => {
        const el = document.getElementById('review-textarea') as HTMLTextAreaElement | null;
        if (el) el.focus();
      }, 300);
    }
  }, []);

  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'reviews'>('description');

  const imgContainerRef = useRef<HTMLDivElement | null>(null);
const [zoomActive, setZoomActive] = useState(false);
const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 });

const handleZoomMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
  if (!imgContainerRef.current) return;
  const rect = imgContainerRef.current.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  // clamp between 0–1
  const nx = Math.min(1, Math.max(0, x));
  const ny = Math.min(1, Math.max(0, y));
  setZoomPos({ x: nx, y: ny });
};

const zoomBgPosition = `${zoomPos.x * 100}% ${zoomPos.y * 100}%`;

  /* Actions */
  const isUserLoggedIn = () => {
    try {
      const ls = localStorage;
      const hasToken = ls.getItem('nakoda-token');
      const hasUser = ls.getItem('nakoda-user');
      return Boolean(hasToken && hasUser);
    } catch {
      return false;
    }
  };

  const handleAddToCart = async () => {
    if (!isUserLoggedIn()) {
      toast.error('Please log in to add items to your cart');
      navigate('/login', { state: { from: location } });
      return;
    }
    if (!product || !maxQty) return;

    try {
      const productId: string = (product as any)._id || (product as any).id;
      if (!productId) { toast.error('Product ID not found'); return; }

      // enforce MOQ and stock
      const finalQty = commitQty(rawQty === '' ? minQty : rawQty);
      if (finalQty < minQty) {
        toast.error(`MOQ is ${minQty} in wholesale mode`);
        return;
      }
      const stock = Math.max(minQty, Number((product as any).stockQuantity ?? 0));
      if (stock < finalQty) {
        toast.error(`Only ${stock} in stock`);
        return;
      }

      await addToCart(productId, finalQty);
      toast.success(`Added ${finalQty}${wholesaleActive ? ' (Wholesale)' : ''}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to cart');
    }
  };

  const handleBuyNow = async () => {
    if (!product || !maxQty) return;
    try {
      const productId: string = (product as any)._id || (product as any).id;
      if (!productId) { toast.error('Product ID not found'); return; }

      const finalQty = commitQty(rawQty === '' ? minQty : rawQty);
      if (finalQty < minQty) {
        toast.error(`MOQ is ${minQty} in wholesale mode`);
        return;
      }
      const stock = Math.max(minQty, Number((product as any).stockQuantity ?? 0));
      if (stock < finalQty) {
        toast.error(`Only ${stock} in stock`);
        return;
      }

      await addToCart(productId, finalQty);
      navigate('/checkout');
    } catch (err: any) {
      toast.error(err?.message || 'Could not proceed to checkout');
    }
  };

  const handleWishlistToggle = async () => {
    if (!product) return;
    try {
      const productId: string = (product as any)._id || (product as any).id;
      if (!productId) { toast.error('Product ID not found'); return; }
      if (isInWishlist(productId)) {
        await removeFromWishlist(productId);
      } else {
        await addToWishlist(productId);
      }
    } catch (err: any) {
      toast.error(err.message || 'Wishlist operation failed');
    }
  };

  const productId = useMemo<string | undefined>(() => (product ? ((product as any)._id || (product as any).id) : undefined), [product]);
  const inWishlist = productId ? isInWishlist(productId) : false;

  /* Guards */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-white/70">Loading product details</p>
        </div>
      </div>
    );
  }

  if (error) {
    const invalidId = error.includes('Invalid product ID') || error.includes('Cast to ObjectId');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-black">
        <SEO
          title="Shop Products"
          description="Browse TWS, Bluetooth neckbands, data cables, chargers, ICs, and tools."
          canonicalPath="/products"
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Products',
            url: 'https://nakodamobile.com/products',
          }}
        />
        <div className="text-center max-w-md mx-auto p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {invalidId ? 'Invalid Product ID' : 'Something went wrong'}
          </h2>
          <p className="text-rose-300 mb-6">{error}</p>
          {invalidId && (
            <div className="bg-sky-500/10 border border-sky-500/20 text-sky-200 p-4 rounded-lg mb-4 text-left">
              <h4 className="font-semibold mb-2">Valid Product ID Format</h4>
              <p className="text-sm">
                24-character MongoDB ObjectId, e.g.
                <code className="bg-sky-500/10 px-1 rounded ml-1 text-sky-100">6889d318a654a6aef33eb902</code>
              </p>
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-sky-600 text-white px-6 py-2 rounded-lg hover:bg-sky-700"
            >
              Try Again
            </button>
            <a
              href={backTarget}
              onClick={smartBack}
              className="block w-full bg-white/10 text-white px-6 py-2 rounded-lg hover:bg-white/15 border border-white/15"
            >
              Back to Products
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-black">
        <div className="text-center max-w-md mx-auto p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-white mb-2">Product Not Found</h2>
          <p className="text-white/70 mb-6">The product you’re looking for doesn’t exist or has been removed.</p>
          <a
            href={backTarget}
            onClick={smartBack}
            className="inline-flex items-center bg-sky-600 text-white px-6 py-2 rounded-lg hover:bg-sky-700"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Products
          </a>
        </div>
      </div>
    );
  }

  const validImages: string[] = normalizedImages;
  const currentImage: string | undefined = validImages[selectedImage] || validImages[0];
  const hasMultipleImages = validImages.length > 1;

  /* SEO data */
  const canonicalPath = `/product/${productHandle(product)}`;
  const avgRatingSEO = Number((product as any)?.rating) || Number((product as any)?.averageRating) || undefined;
  const reviewCountSEO = Number((product as any)?.reviewsCount) || Number((product as any)?.reviewCount) || undefined;

  const seoTitle = `${product.name} Price in India | Buy Online`;
  const seoDesc =
    (product.description || '').replace(/\s+/g, ' ').slice(0, 155) ||
    `${product.name} available at Vzot. Fast delivery. GST invoice.`;

  const productJsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: (validImages || []).map((i: string) => safeImage(i)).slice(0, 8),
    description: product.description || undefined,
    sku: (product as any)?._id || (product as any)?.id || undefined,
    mpn: (product as any)?.mpn || undefined,
    brand: (product as any)?.brand ? { '@type': 'Brand', name: (product as any).brand } : undefined,
    category: product.category || undefined,
    url: productUrlAbs(product),
    offers: {
      '@type': 'Offer',
      availability: (product as any).inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      priceCurrency: 'INR',
      price: unitPrice ?? undefined,
      url: productUrlAbs(product),
    },
  };
  if (avgRatingSEO && reviewCountSEO) {
    productJsonLd.aggregateRating = { '@type': 'AggregateRating', ratingValue: String(avgRatingSEO), reviewCount: String(reviewCountSEO) };
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nakodamobile.com/' },
      { '@type': 'ListItem', position: 2, name: 'Products', item: 'https://nakodamobile.com/products' },
      { '@type': 'ListItem', position: 3, name: product.name, item: `https://nakodamobile.com${canonicalPath}` },
    ],
  };

  /* -------------------------------- Render -------------------------------- */
  return (
    <div className="relative min-h-screen text-white">
      <VZOTBackground />
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonicalPath={canonicalPath}
        robots="index,follow"
        image={validImages[0] ? safeImage(validImages[0], 1200, 630) : undefined}
        jsonLd={[productJsonLd, breadcrumbJsonLd]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Products', to: backTarget, onClick: smartBack },
            { label: product.name },
          ]}
          className="text-white/70"
        />

        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur shadow-sm sm:shadow-lg overflow-hidden mt-3 sm:mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 p-4 sm:p-6">
            {/* Gallery */}
            <div className="space-y-3 sm:space-y-4 relative">
  {/* MAIN IMAGE + ZOOM TRIGGER */}
  <div
    ref={imgContainerRef}
    className="aspect-[4/4] sm:aspect-square bg-gray-100 rounded-xl overflow-hidden relative cursor-zoom-in"
    onMouseEnter={() => setZoomActive(true)}
    onMouseLeave={() => setZoomActive(false)}
    onMouseMove={handleZoomMove}
  >
    {currentImage ? (
      <>
        <img
          src={safeImage(currentImage)}
          alt={product.name}
          className="w-full h-full object-cover select-none"
          onError={(e) => { (e.target as HTMLImageElement).src = safeImage(undefined); }}
        />

        {/* small lens box on main image (desktop only) */}
        {zoomActive && (
          <div
            className="hidden lg:block absolute w-28 h-28 border border-blue-400 bg-white/25 backdrop-blur-sm pointer-events-none rounded-md"
            style={{
              left: `${zoomPos.x * 100}%`,
              top: `${zoomPos.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}
      </>
    ) : (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-5xl sm:text-6xl mb-2">📷</div>
          <div>No Image Available</div>
        </div>
      </div>
    )}
  </div>

  {/* ZOOM WINDOW LIKE FLIPKART (right side, desktop only) */}
  {currentImage && (
    <div
      className={`hidden lg:block absolute top-0 left-full ml-4 w-[420px] h-[420px] rounded-xl border bg-white shadow-lg overflow-hidden transition-opacity ${
        zoomActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className="w-full h-full bg-no-repeat"
        style={{
          backgroundImage: `url(${safeImage(currentImage, 1200, 1200)})`,
          backgroundSize: '200%',       // zoom level (increase for more zoom)
          backgroundPosition: zoomBgPosition,
        }}
      />
    </div>
  )}

  {/* THUMBNAILS (unchanged except what we did earlier for hover-switch) */}
  {hasMultipleImages && (
    <div className="flex gap-2 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [-ms-overflow-style:none]">
      {validImages.map((img: string, index: number) => (
        <button
          key={index}
          type="button"
          onClick={() => setSelectedImage(index)}
          onMouseEnter={() => setSelectedImage(index)}
          onFocus={() => setSelectedImage(index)}
          className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all snap-start ${
            selectedImage === index ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
          }`}
          aria-label={`View image ${index + 1}`}
        >
          <img
            src={safeImage(img, 160, 160)}
            alt={`${product.name} view ${index + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = safeImage(undefined, 160, 160); }}
          />
        </button>
      ))}
    </div>
  )}
</div>


            {/* Info */}
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 leading-snug">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-white/70">
                  <span className="bg-sky-500/15 text-sky-200 border border-sky-400/20 px-2 py-0.5 rounded-full">{product.category}</span>
                 
                    
                  {wholesaleActive && (
                    <span className="bg-emerald-500/15 text-emerald-200 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                      Wholesale • MOQ {minQty}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2 sm:gap-4">
                <span className="text-2xl sm:text-3xl font-bold text-white">
                  ₹{(unitPrice ?? 0).toLocaleString('en-IN')}
                  {wholesaleActive && <span className="ml-1 text-xs text-white/70">/pc</span>}
                </span>
                {(() => {
                  const cmp = num((product as any).originalPrice) ?? num((product as any).compareAtPrice);
                  if (cmp && unitPrice && cmp > unitPrice) {
                    const pct = Math.round(((cmp - unitPrice) / cmp) * 100);
                    return (
                      <>
                        <span className="text-lg sm:text-xl text-white/60 line-through">₹{cmp.toLocaleString('en-IN')}</span>
                        <span className="bg-rose-600/20 text-rose-200 border border-rose-400/30 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full">
                          {pct}% OFF
                        </span>
                      </>
                    );
                  }
                  return null;
                })()}
              </div>

              {(product as any).inStock && (
                <div className="flex items-center gap-3 sm:gap-4">
                  <label className="text-white/90 text-sm sm:text-base font-medium">Qty</label>
                  <div className="flex items-center rounded-lg border border-white/15 bg-white/5">
                    <button
                      onClick={() => commitQty((quantity || minQty) - 1)}
                      disabled={quantity <= minQty}
                      className="p-2 sm:p-2.5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <input
                      type="number"
                      inputMode="numeric"
                      min={minQty}
                      max={maxQty || minQty}
                      value={rawQty}
                      placeholder={String(minQty)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') { setRawQty(''); return; }
                        if (/^\d+$/.test(v)) {
                          setRawQty(v);
                          setQuantity(parseInt(v, 10));
                        }
                      }}
                      onBlur={() => commitQty(rawQty === '' ? minQty : rawQty)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); }
                        if (e.key === 'Escape') { setRawQty(String(quantity)); }
                      }}
                      className="w-14 sm:w-16 text-center text-sm sm:text-base bg-transparent text-white border-0 focus:ring-0 focus:outline-none"
                      aria-label="Quantity"
                    />

                    <button
                      onClick={() => commitQty((quantity || minQty) + 1)}
                      disabled={!maxQty || quantity >= maxQty}
                      className="p-2 sm:p-2.5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {wholesaleActive && (
                    <span className="text-xs text-white/70">Min {minQty}</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch sm:gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToCart}
                  disabled={!(product as any).inStock || isLoading}
                  className={`col-span-2 sm:col-auto h-11 px-4 rounded-lg font-medium inline-flex items-center justify-center gap-2 transition-all ${
                    (product as any).inStock && !isLoading ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-md hover:shadow-lg' : 'bg-white/10 text-white/50 cursor-not-allowed'
                  }`}
                  aria-label="Add to Cart"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>Add to Cart</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBuyNow}
                  disabled={!(product as any).inStock || isLoading}
                  className="col-span-2 sm:col-auto h-11 px-4 rounded-lg font-medium inline-flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-white/15 border border-white/15 disabled:opacity-60"
                  aria-label="Buy Now"
                >
                  <CreditCard className="h-5 w-5" />
                  <span>Buy Now</span>
                </motion.button>

                <div className="col-span-2 flex items-center justify-center sm:justify-start gap-3 mt-1 sm:mt-0">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleWishlistToggle}
                    disabled={wishlistLoading}
                    className={`w-10 h-10 sm:w-11 sm:h-11 inline-flex items-center justify-center p-0 border rounded-lg ${
                      inWishlist
                        ? 'border-rose-400/30 bg-rose-500/15 text-rose-300 hover:bg-rose-500/20'
                        : 'border-white/15 text-white hover:bg-white/10'
                    }`}
                    title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                    aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart className={`h-5 w-5 ${inWishlist ? 'fill-current' : ''}`} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-10 h-10 sm:w-11 sm:h-11 inline-flex items-center justify-center p-0 border border-white/15 rounded-lg hover:bg-white/10 text-white"
                    onClick={() => {
                      const url = window.location.href;
                      const text = `${product.name} - ${product.description ?? ''}`.slice(0, 180);
                      if ((navigator as any).share) {
                        (navigator as any).share({ title: product.name, text, url }).catch(() => {
                          navigator.clipboard.writeText(url);
                          toast.success('Product link copied to clipboard');
                        });
                      } else {
                        navigator.clipboard.writeText(url);
                        toast.success('Product link copied to clipboard');
                      }
                    }}
                    title="Share"
                    aria-label="Share"
                  >
                    <Share2 className="h-5 w-5" />
                  </motion.button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${product.name} ${window.location.href}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-10 h-10 sm:w-11 sm:h-11 inline-flex items-center justify-center p-0 border border-emerald-400/30 rounded-lg hover:bg-emerald-500/10 text-emerald-300"
                    title="Chat on WhatsApp"
                    aria-label="Chat on WhatsApp"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </a>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 sm:pt-6">
                <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
                  <div className="flex flex-col items-center space-y-1.5 sm:space-y-2">
                    <div className="bg-sky-500/15 border border-sky-400/20 p-2 rounded-full"><Truck className="h-5 w-5 sm:h-6 sm:w-6 text-sky-300" /></div>
                    <span className="text-xs sm:text-sm font-medium text-white">Free Delivery</span>
                    <span className="text-[11px] sm:text-xs text-white/70">On orders above ₹1999</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1.5 sm:space-y-2">
                    <div className="bg-emerald-500/15 border border-emerald-400/20 p-2 rounded-full"><Shield className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-300" /></div>
                    <span className="text-xs sm:text-sm font-medium text-white">1 Year Warranty</span>
                    <span className="text-[11px] sm:text-xs text-white/70">Manufacturer warranty</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1.5 sm:space-y-2">
                    <div className="bg-orange-500/15 border border-orange-400/20 p-2 rounded-full"><RotateCcw className="h-5 w-5 sm:h-6 sm:w-6 text-orange-300" /></div>
                    <span className="text-xs sm:text-sm font-medium text-white">Easy Returns</span>
                    <span className="text-[11px] sm:text-xs text-white/70">7 day return policy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-white/10">
            <div className="flex border-b border-white/10 overflow-x-auto sticky top-0 sm:top-[60px] z-10 bg-black/20 backdrop-blur">
              {(['description', 'specifications', 'reviews'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium capitalize transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-b-2 border-sky-500 text-sky-300 bg-sky-500/10'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === 'description' && (
                <div className="prose max-w-none">
                  <div className="text-white/85 leading-relaxed whitespace-pre-line text-sm sm:text-base">
                    {product.description || 'No description available for this product.'}
                  </div>

                  {(product as any).features && (product as any).features.length > 0 && (
                    <div className="mt-6 sm:mt-8">
                      <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-white">Key Features</h3>
                      <div className="grid gap-2 sm:gap-3">
                        {(product as any).features.map((feature: string, index: number) => (
                          <div key={index} className="flex items-start gap-2 sm:gap-3">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-sky-400 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-white/85 text-sm sm:text-base">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'specifications' && (
                <div>
                  {(product as any).specifications && Object.keys((product as any).specifications).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm sm:text-base">
                        <tbody className="divide-y divide-white/10">
                          {Object.entries((product as any).specifications as Record<string, unknown>).map(
                            ([key, value]: [string, unknown]) => (
                              <tr key={key} className="hover:bg-white/5">
                                <td className="py-2 sm:py-3 px-3 sm:px-4 font-medium text-white bg-white/5 w-1/3">{prettyKey(key)}</td>
                                <td className="py-2 sm:py-3 px-3 sm:px-4 text-white/85">{renderSpecValue(value)}</td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10 sm:py-12">
                      <div className="text-white/40 text-5xl sm:text-6xl mb-3 sm:mb-4">📋</div>
                      <h3 className="text-base sm:text-lg font-medium text-white mb-1 sm:mb-2">No Specifications</h3>
                      <p className="text-white/70 text-sm sm:text-base">Technical specifications are not available for this product.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div id="reviews">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-white">Customer Reviews</h3>
                    <button
                      onClick={() => {
                        setActiveTab('reviews');
                        window.location.hash = '#reviews';
                        setTimeout(() => { document.getElementById('review-textarea')?.focus(); }, 250);
                      }}
                      className="bg-sky-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors font-medium text-sm"
                    >
                      Write a Review
                    </button>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <Reviews productId={productId!} productName={product.name} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Highlights */}
        {highlightImages.length > 0 && (
          <section id="highlights" className="border-t border-white/10 bg-white/5 rounded-xl mt-6 sm:mt-10">
            <div className="max-w-[1280px] mx-auto sm:px-6 py-0">
              <h2 className="sr-only">Product Highlights</h2>
              <div>
                <div className="flex flex-col space-y-0">
                  {highlightImages.map((img, i) => (
                    <figure key={i} className="mx-[-1rem] sm:mx-[-1.5rem] lg:mx-0">
                      <img
                        src={fullImage(img)}
                        alt={`${product.name} highlight ${i + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="block w-full h-auto"
                        onError={(e) => { (e.target as HTMLImageElement).src = fullImage(undefined); }}
                      />
                    </figure>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Sticky mobile checkout bar */}
      <div className="fixed inset-x-0 bottom-0 sm:hidden border-t border-white/10 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-white/70">Total</div>
            <div className="text-lg font-semibold text-white">
              ₹{((unitPrice ?? 0) * (quantity || minQty)).toLocaleString('en-IN')}
            </div>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!(product as any).inStock || isLoading}
            className={`h-10 px-4 rounded-lg font-medium inline-flex items-center justify-center gap-2 ${
              (product as any).inStock && !isLoading ? 'bg-sky-600 text-white' : 'bg-white/10 text-white/50'
            }`}
          >
            <ShoppingCart className="h-4 w-4" /> Add
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!(product as any).inStock || isLoading}
            className="h-10 px-4 rounded-lg font-medium inline-flex items-center justify-center gap-2 bg-white/10 text-white border border-white/15"
          >
            <CreditCard className="h-4 w-4" /> Buy
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
