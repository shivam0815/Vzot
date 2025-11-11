// src/components/Products/ProductCard.tsx
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, CreditCard, Heart } from 'lucide-react';
import type { Product } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { getFirstImageUrl } from '../../utils/imageUtils';
import toast from 'react-hot-toast';
import { usePricingMode } from '../../context/PricingModeProvider';

export interface ProductCardProps {
  product: Product;
  viewMode?: 'grid' | 'list';
  className?: string;
  showWishlist?: boolean;
  reviewSummary?: { averageRating: number; reviewCount: number };
}

const isValidObjectId = (s?: string) => !!s && /^[a-f\d]{24}$/i.test(s);
const fmtPrice = (p?: number, currency = 'INR') => {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 'Contact for price';
  const symbol = currency === 'INR' ? '₹' : '';
  return `${symbol}${p.toLocaleString('en-IN')}`;
};
const coerceNumber = (x: any): number | undefined => {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : undefined;
};
const getInitialAverageRating = (p: any): number =>
  coerceNumber(p?.averageRating) ??
  coerceNumber(p?.avgRating) ??
  coerceNumber(p?.ratingAverage) ??
  coerceNumber(p?.rating) ??
  0;
const getInitialReviewCount = (p: any): number =>
  coerceNumber(p?.ratingsCount) ??
  coerceNumber(p?.reviewCount) ??
  coerceNumber(p?.reviewsCount) ??
  coerceNumber(p?.numReviews) ??
  (Array.isArray(p?.reviews) ? p.reviews.length : undefined) ??
  0;

const computeInStock = (p: any): boolean => {
  if (typeof p?.inStock === 'boolean') return p.inStock;
  if (typeof p?.stock === 'number') return p.stock > 0;
  if (typeof p?.stockQuantity === 'number') return p.stockQuantity > 0;
  return true;
};

/* ----- Buttons on dark theme ----- */
const btnBase =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-9 px-3 text-sm sm:h-10 sm:px-3';
const btnPrimary =
  'bg-sky-600 text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500/40';
const btnDark =
  'bg-white/10 text-white hover:bg-white/15 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/20';
const btnMinW = 'w-[112px] sm:w-[132px]';
const btnGhost =
  'border border-white/15 text-white/90 hover:text-red-400 hover:border-red-300/40 focus:outline-none focus:ring-2 focus:ring-red-300/20';

const slugify = (s?: string) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  viewMode = 'grid',
  className = '',
  showWishlist = false,
  reviewSummary,
}) => {
  const isList = viewMode === 'list';

  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, isLoading } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist, isLoading: wishlistLoading } = useWishlist();
  const { mode } = usePricingMode();

  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const rawId = (product as any)._id ?? (product as any).id;
  const productId = typeof rawId === 'string' ? rawId.trim() : rawId ? String(rawId) : '';
  const inStock = computeInStock(product);
  const inWishlist = productId ? isInWishlist(productId) : false;

  const imageUrl = getFirstImageUrl(product.images);

  // ----- Pricing mode + wholesale handling (single source of truth) -----
  const wholesaleEnabled = Boolean((product as any).wholesaleEnabled);
  const wholesalePrice = coerceNumber((product as any).wholesalePrice);
  const wholesaleMinQty = coerceNumber((product as any).wholesaleMinQty) ?? 1;
  const wholesaleActive = mode === 'wholesale' && wholesaleEnabled && typeof wholesalePrice === 'number';

  const unitPrice = wholesaleActive ? (wholesalePrice as number) : product.price;
  const minQty = wholesaleActive ? wholesaleMinQty : 1;

  const compareAt = (product as any).compareAtPrice ?? (product as any).originalPrice;
  const comparePrice = typeof compareAt === 'number' ? compareAt : Number(compareAt);
  const hasDiscount =
    Number.isFinite(comparePrice) && Number.isFinite(unitPrice) && (comparePrice as number) > (unitPrice as number);
  const discountPct = hasDiscount ? Math.round(((comparePrice - (unitPrice as number)) / comparePrice) * 100) : 0;

  const avgRating = reviewSummary?.averageRating ?? getInitialAverageRating(product);
  const revCount = reviewSummary?.reviewCount ?? getInitialReviewCount(product);
  const roundedAvg = useMemo(
    () => Math.max(0, Math.min(5, Math.round((avgRating ?? 0) * 10) / 10)),
    [avgRating]
  );

  // detail URL
  const slug = slugify((product as any).slug || (product as any).name);
  const handle = slug || (isValidObjectId(productId) ? productId : '');
  const detailPath = handle ? `/product/${handle}` : '/products';

  // Preserve list URL for back
  const fromPath = `${location.pathname}${location.search}`;

  const isUserLoggedIn = () => {
    try {
      const ls = localStorage;
      return Boolean(ls.getItem('nakoda-token') && ls.getItem('nakoda-user'));
    } catch {
      return false;
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUserLoggedIn()) {
      toast.error('Please login to buy this item');
      return;
    }
    try {
      if (!isValidObjectId(productId)) {
        toast.error('Product ID not found or invalid link');
        return;
      }
      // Enforce stock and MOQ
      const stock = coerceNumber((product as any).stockQuantity) ?? 0;
      if (stock < minQty) {
        toast.error(`Insufficient stock. Required MOQ: ${minQty}`);
        return;
      }
      await addToCart(productId, minQty); // MOQ respected
      toast.success(wholesaleActive ? `Added ${minQty} (Wholesale)` : 'Added to cart');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add to cart');
    }
  };

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUserLoggedIn()) {
      toast.error('Please login to buy this item');
      return;
    }
    try {
      if (!isValidObjectId(productId)) {
        toast.error('Product ID not found or invalid link');
        return;
      }
      const stock = coerceNumber((product as any).stockQuantity) ?? 0;
      if (stock < minQty) {
        toast.error(`Insufficient stock. Required MOQ: ${minQty}`);
        return;
      }
      await addToCart(productId, minQty);
      navigate('/cart');
    } catch (error: any) {
      toast.error(error?.message || 'Could not proceed to checkout');
    }
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (!isValidObjectId(productId)) {
        toast.error('Product ID not found or invalid link');
        return;
      }
      if (isInWishlist(productId)) {
        await removeFromWishlist(productId);
      } else {
        await addToWishlist(productId);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Wishlist operation failed');
    }
  };

  const guardNav: React.MouseEventHandler = (e) => {
    if (!handle) {
      e.preventDefault();
      toast.error('Invalid product link. Please try again.');
    }
  };

  const currency = (product as any).currency || 'INR';

  return (
    <Link
      to={detailPath}
      state={{ fromPath }}
      onClick={guardNav}
      className="block group"
      data-product-id={productId || ''}
    >
      <motion.div
        whileHover={{ y: -5 }}
        className={
          (isList
            ? 'rounded-xl overflow-hidden transition-all duration-300 flex gap-4 p-4 ' +
              'bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/7.5'
            : 'rounded-xl overflow-hidden transition-all duration-300 ' +
              'bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/7.5') +
          (className ? ` ${className}` : '')
        }
      >
        {/* Image */}
        <div
          className={
            isList
              ? 'w-28 h-28 flex-shrink-0 relative overflow-hidden rounded-md bg-slate-800/60'
              : 'relative aspect-square overflow-hidden rounded-t-xl sm:rounded-xl bg-slate-800/60'
          }
        >
          {imageUrl && !imageError ? (
            <>
              {imageLoading && (
                <div
                  className="absolute inset-0 bg-slate-700/40 animate-pulse flex items-center justify-center"
                  aria-label="Loading image"
                >
                  <div className="text-white/60 text-xs">Loading…</div>
                </div>
              )}
              <img
                src={imageUrl}
                alt={product.name}
                className={
                  (isList
                    ? 'w-full h-full object-cover rounded-md'
                    : 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300') +
                  (imageLoading ? ' opacity-0' : ' opacity-100')
                }
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
                loading="lazy"
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <div className="text-center text-white/60">
                <div className="text-3xl mb-1">📦</div>
                <div className="text-xs font-medium">No Image</div>
              </div>
            </div>
          )}

          {hasDiscount && (
            <div className="absolute top-2 left-2 bg-rose-600/90 backdrop-blur px-2 py-1 rounded-md text-[11px] font-semibold text-white z-10">
              {discountPct}% OFF
            </div>
          )}

          {/* Wholesale badge */}
          {wholesaleActive && (
            <div className="absolute top-2 right-2 bg-emerald-600/90 backdrop-blur px-2 py-1 rounded-md text-[11px] font-semibold text-white z-10">
              Wholesale • MOQ {minQty}
            </div>
          )}

          {showWishlist && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleWishlistToggle}
              disabled={wishlistLoading}
              className={`absolute ${wholesaleActive ? 'top-10' : 'top-2'} right-2 inline-flex ${btnGhost} h-9 w-9 p-0 min-w-[2.25rem] sm:h-10 sm:w-10 bg-black/30 backdrop-blur z-20`}
              title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={inWishlist}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={'h-4 w-4 ' + (inWishlist ? 'fill-current text-rose-400' : 'text-white/90')} />
            </motion.button>
          )}

          {inStock === false && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10" aria-label="Out of stock">
              <span className="text-white font-semibold text-sm">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={isList ? 'flex-1 min-w-0' : 'p-4'}>
          <h3 className={'text-lg font-semibold text-white mb-2 line-clamp-2 ' + (isList ? 'mt-0' : '')}>
            {product.name}
          </h3>

          <div className="flex items-center mb-2" aria-label={`Rating ${roundedAvg} out of 5`}>
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={'h-4 w-4 ' + (i < Math.floor(roundedAvg) ? 'text-yellow-400 fill-current' : 'text-white/20')}
                />
              ))}
            </div>
            <span className="text-sm text-white/70 ml-2">({revCount} reviews)</span>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-white">{fmtPrice(unitPrice, currency)}</span>

              {wholesaleActive && (
                <span className="ml-2 text-[11px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                  MOQ {minQty}
                </span>
              )}

              {hasDiscount && (
                <span className="text-sm text-white/50 line-through" aria-label="MRP">
                  {fmtPrice(comparePrice, currency)}
                </span>
              )}
            </div>
            <span
              className={
                'text-[11px] px-2 py-1 rounded ' +
                (inStock === false
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-400/20'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20')
              }
            >
              {inStock === false ? 'Out of Stock' : 'In Stock'}
            </span>
          </div>

          {wholesaleActive && (
            <div className="text-[11px] text-white/70 mb-2">
              Wholesale mode active. MOQ <span className="font-semibold text-white">{minQty}</span>.
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAddToCart}
              disabled={inStock === false || isLoading}
              className={`${btnBase} ${btnPrimary} ${btnMinW}`}
              title="Add to Cart"
              aria-busy={isLoading}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{isLoading ? 'Adding…' : 'Add to Cart'}</span>
              <span className="sm:hidden">{isLoading ? '…' : 'Add'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBuyNow}
              disabled={inStock === false || isLoading}
              className={`${btnBase} ${btnDark} ${btnMinW}`}
              title="Buy Now"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{isLoading ? 'Processing…' : 'Buy Now'}</span>
              <span className="sm:hidden">{isLoading ? '…' : 'Buy'}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default ProductCard;
