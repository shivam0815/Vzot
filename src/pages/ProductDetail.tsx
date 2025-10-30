// src/pages/ProductDetail.tsx — B2C detail page with full SEO + smart back
import React, { useState, useEffect, useMemo } from 'react';
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

const fullImage = (src?: string | null) =>
  resolveImageUrl(src ?? undefined) || (src ?? '');

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

/* ------------------------------ Component ------------------------------ */
const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // can be id or slug; route path should be /product/:id
  const navigate = useNavigate();
  const location = useLocation();

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

  /* Qty helpers */
  const clampQty = (raw: unknown, max: number) => {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.max(1, Math.min(max, n));
  };
  const maxQty = (product as any)?.inStock ? Math.max(1, Number((product as any).stockQuantity) || 99) : 0;

  useEffect(() => {
    if (!product) return;
    const init = clampQty(quantity, maxQty || 1);
    setQuantity(init);
    setRawQty(String(init));
  }, [product, maxQty]);

  const commitQty = (v: string | number) => {
    const final = clampQty(v, maxQty || 1);
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

  const { addToWishlist: addWish, removeFromWishlist: remWish } = { addToWishlist, removeFromWishlist };

  /* Actions */
  const handleAddToCart = async () => {
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
    if (!isUserLoggedIn()) {
      toast.error('Please log in to add items to your cart');
      navigate('/login', { state: { from: location } });
      return;
    }
    if (!product || !maxQty) return;

    try {
      const productId: string = (product as any)._id || (product as any).id;
      if (!productId) { toast.error('Product ID not found'); return; }
      const finalQty = commitQty(rawQty === '' ? 1 : rawQty);
      await addToCart(productId, finalQty);
      toast.success(`Added ${finalQty} ${finalQty === 1 ? 'item' : 'items'} to cart`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to cart');
    }
  };

  const handleBuyNow = async () => {
    if (!product || !maxQty) return;
    try {
      const productId: string = (product as any)._id || (product as any).id;
      if (!productId) { toast.error('Product ID not found'); return; }
      const finalQty = commitQty(rawQty === '' ? 1 : rawQty);
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
        await remWish(productId);
      } else {
        await addWish(productId);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product details</p>
        </div>
      </div>
    );
  }

  if (error) {
    const invalidId = error.includes('Invalid product ID') || error.includes('Cast to ObjectId');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">{invalidId ? '🔍' : '⚠️'}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {invalidId ? 'Invalid Product ID' : 'Oops! Something went wrong'}
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          {invalidId && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4 text-left">
              <h4 className="font-semibold text-blue-800 mb-2">Valid Product ID Format:</h4>
              <p className="text-blue-700 text-sm">
                Product IDs must be 24-character MongoDB ObjectIds like:
                <code className="bg-blue-100 px-1 rounded ml-1">6889d318a654a6aef33eb902</code>
              </p>
            </div>
          )}
          <div className="space-y-3">
            <button onClick={() => window.location.reload()} className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Try Again
            </button>
            <a href={backTarget} onClick={smartBack} className="block w-full bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-center">
              Back to Products
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist or has been removed.</p>
          <a href={backTarget} onClick={smartBack} className="inline-flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
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
  const avgRating = Number((product as any)?.rating) || Number((product as any)?.averageRating) || undefined;
  const reviewCount = Number((product as any)?.reviewsCount) || Number((product as any)?.reviewCount) || undefined;

  const seoTitle = `${product.name} Price in India | Buy Online`;
  const seoDesc = (product.description || '').replace(/\s+/g, ' ').slice(0, 155) ||
    `${product.name} available at Nakoda Mobile. Fast delivery. GST invoice.`;

  const productJsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: (validImages || []).map((i: string) => safeImage(i)).slice(0, 8),
    description: product.description || undefined,
    sku: productId || undefined,
    mpn: (product as any)?.mpn || undefined,
    brand: (product as any)?.brand ? { '@type': 'Brand', name: (product as any).brand } : undefined,
    category: product.category || undefined,
    url: productUrlAbs(product),
    offers: {
      '@type': 'Offer',
      availability: (product as any).inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      priceCurrency: 'INR',
      price: product.price ?? undefined,
      url: productUrlAbs(product),
    },
  };
  if (avgRating && reviewCount) {
    productJsonLd.aggregateRating = { '@type': 'AggregateRating', ratingValue: String(avgRating), reviewCount: String(reviewCount) };
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
    <div className="min-h-screen bg-gray-50 pb-24 sm:pb-10">
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
        />

        <div className="bg-white rounded-xl shadow-sm sm:shadow-lg overflow-hidden mt-3 sm:mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 p-4 sm:p-6">
            {/* Gallery */}
            <div className="space-y-3 sm:space-y-4">
              <div className="aspect-[4/4] sm:aspect-square bg-gray-100 rounded-xl overflow-hidden relative">
                {currentImage ? (
                  <img
                    src={safeImage(currentImage)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = safeImage(undefined); }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-5xl sm:text-6xl mb-2">📷</div>
                      <div>No Image Available</div>
                    </div>
                  </div>
                )}
              </div>

              {hasMultipleImages && (
                <div className="flex gap-2 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [-ms-overflow-style:none]">
                  {validImages.map((img: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all snap-start ${selectedImage === index ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
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
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 leading-snug">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{product.category}</span>
                  {(product as any).brand && <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{(product as any).brand}</span>}
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2 sm:gap-4">
                <span className="text-2xl sm:text-3xl font-bold text-gray-900">₹{product.price?.toLocaleString('en-IN')}</span>
                {(product as any).originalPrice && (product as any).originalPrice > (product.price ?? 0) && (
                  <>
                    <span className="text-lg sm:text-xl text-gray-500 line-through">₹{(product as any).originalPrice.toLocaleString('en-IN')}</span>
                    <span className="bg-red-100 text-red-800 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full">
                      {Math.round((((product as any).originalPrice - (product.price ?? 0)) / (product as any).originalPrice) * 100)}% OFF
                    </span>
                  </>
                )}
              </div>

              {(product as any).inStock && (
                <div className="flex items-center gap-3 sm:gap-4">
                  <label className="text-gray-700 text-sm sm:text-base font-medium">Qty</label>
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => commitQty((quantity || 1) - 1)}
                      disabled={quantity <= 1}
                      className="p-2 sm:p-2.5 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={maxQty || 1}
                      value={rawQty}
                      placeholder="1"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') { setRawQty(''); return; }
                        if (/^\d+$/.test(v)) {
                          setRawQty(v);
                          setQuantity(parseInt(v, 10));
                        }
                      }}
                      onBlur={() => commitQty(rawQty === '' ? 1 : rawQty)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); }
                        if (e.key === 'Escape') { setRawQty(String(quantity)); }
                      }}
                      className="w-14 sm:w-16 text-center text-sm sm:text-base border-0 focus:ring-0 focus:outline-none"
                      aria-label="Quantity"
                    />

                    <button
                      onClick={() => commitQty((quantity || 1) + 1)}
                      disabled={!maxQty || quantity >= maxQty}
                      className="p-2 sm:p-2.5 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch sm:gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToCart}
                  disabled={!(product as any).inStock || isLoading}
                  className={`col-span-2 sm:col-auto h-11 px-4 rounded-lg font-medium inline-flex items-center justify-center gap-2 transition-all ${
                    (product as any).inStock && !isLoading ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
                  className="col-span-2 sm:col-auto h-11 px-4 rounded-lg font-medium inline-flex items-center justify-center gap-2 bg-gray-900 text-white hover:bg-black disabled:opacity-60"
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
                      inWishlist ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                    aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart className={`h-5 w-5 ${inWishlist ? 'fill-current' : ''}`} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-10 h-10 sm:w-11 sm:h-11 inline-flex items-center justify-center p-0 border border-gray-300 rounded-lg hover:bg-gray-50"
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
                    className="w-10 h-10 sm:w-11 sm:h-11 inline-flex items-center justify-center p-0 border border-green-300 rounded-lg hover:bg-green-50 text-green-700"
                    title="Chat on WhatsApp"
                    aria-label="Chat on WhatsApp"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </a>
                </div>
              </div>

              <div className="border-t pt-4 sm:pt-6">
                <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
                  <div className="flex flex-col items-center space-y-1.5 sm:space-y-2">
                    <div className="bg-blue-100 p-2 rounded-full"><Truck className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" /></div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Free Delivery</span>
                    <span className="text-[11px] sm:text-xs text-gray-500">On orders above ₹1999</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1.5 sm:space-y-2">
                    <div className="bg-green-100 p-2 rounded-full"><Shield className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" /></div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700">1 Year Warranty</span>
                    <span className="text-[11px] sm:text-xs text-gray-500">Manufacturer warranty</span>
                  </div>
                  <div className="flex flex-col items-center space-y-1.5 sm:space-y-2">
                    <div className="bg-orange-100 p-2 rounded-full"><RotateCcw className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" /></div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Easy Returns</span>
                    <span className="text-[11px] sm:text-xs text-gray-500">7 day return policy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t">
            <div className="flex border-b overflow-x-auto sticky top-0 sm:top-[60px] z-10 bg-white">
              {(['description', 'specifications', 'reviews'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium capitalize transition-colors whitespace-nowrap ${
                    activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === 'description' && (
                <div className="prose max-w-none">
                  <div className="text-gray-700 leading-relaxed whitespace-pre-line text-sm sm:text-base">
                    {product.description || 'No description available for this product.'}
                  </div>

                  {(product as any).features && (product as any).features.length > 0 && (
                    <div className="mt-6 sm:mt-8">
                      <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Key Features</h3>
                      <div className="grid gap-2 sm:gap-3">
                        {(product as any).features.map((feature: string, index: number) => (
                          <div key={index} className="flex items-start gap-2 sm:gap-3">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-gray-700 text-sm sm:text-base">{feature}</span>
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
                        <tbody className="divide-y divide-gray-200">
                          {Object.entries((product as any).specifications as Record<string, unknown>).map(
                            ([key, value]: [string, unknown]) => (
                              <tr key={key} className="hover:bg-gray-50">
                                <td className="py-2 sm:py-3 px-3 sm:px-4 font-medium text-gray-900 bg-gray-50 w-1/3">{prettyKey(key)}</td>
                                <td className="py-2 sm:py-3 px-3 sm:px-4 text-gray-700">{renderSpecValue(value)}</td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10 sm:py-12">
                      <div className="text-gray-400 text-5xl sm:text-6xl mb-3 sm:mb-4">📋</div>
                      <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">No Specifications</h3>
                      <p className="text-gray-600 text-sm sm:text-base">Technical specifications are not available for this product.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div id="reviews">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Customer Reviews</h3>
                    <button
                      onClick={() => {
                        setActiveTab('reviews');
                        window.location.hash = '#reviews';
                        setTimeout(() => { document.getElementById('review-textarea')?.focus(); }, 250);
                      }}
                      className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      Write a Review
                    </button>
                  </div>
                  <Reviews productId={productId!} productName={product.name} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Highlights */}
        {highlightImages.length > 0 && (
          <section id="highlights" className="border-t bg-white mt-6 sm:mt-10">
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
      <div className="fixed inset-x-0 bottom-0 sm:hidden border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-lg font-semibold text-gray-900">₹{product.price?.toLocaleString('en-IN')}</div>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!(product as any).inStock || isLoading}
            className={`h-10 px-4 rounded-lg font-medium inline-flex items-center justify-center gap-2 ${
              (product as any).inStock && !isLoading ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
            }`}
          >
            <ShoppingCart className="h-4 w-4" /> Add
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!(product as any).inStock || isLoading}
            className="h-10 px-4 rounded-lg font-medium inline-flex items-center justify-center gap-2 bg-gray-900 text-white"
          >
            <CreditCard className="h-4 w-4" /> Buy
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
