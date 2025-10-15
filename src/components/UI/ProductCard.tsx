// src/components/ProductCard.tsx
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Tag, CreditCard, Heart } from 'lucide-react';
import type { Product } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { getFirstImageUrl } from '../../utils/imageUtils';
import toast from 'react-hot-toast';

export interface ProductCardProps {
  product: Product;
  viewMode?: 'grid' | 'list';
  className?: string;
  showWishlist?: boolean;
  // NEW: injected by parent (bulk fetched)
  reviewSummary?: { averageRating: number; reviewCount: number };
}

const isValidObjectId = (s?: string) => !!s && /^[a-f\d]{24}$/i.test(s);

const fmtPrice = (p?: number, currency = 'INR') => {
  if (typeof p !== 'number') return 'Contact for price';
  const symbol = currency === 'INR' ? '₹' : '';
  return `${symbol}${p.toLocaleString('en-IN')}`;
};

const getSku = (p: any): string | undefined => p?.sku || p?.productId || p?.pid;
const getColor = (p: any): string | undefined => p?.color;

const getPorts = (p: any): number | undefined => {
  const v = p?.ports;
  if (typeof v === 'number') return v;
  const parsed = parseInt(String(v ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getComparePrice = (p: any): number | undefined => {
  const v = (p as any).compareAtPrice ?? (p as any).originalPrice;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const computeInStock = (p: any): boolean => {
  if (typeof p?.inStock === 'boolean') return p.inStock;
  if (typeof p?.stock === 'number') return p.stock > 0;
  if (typeof p?.stockQuantity === 'number') return p.stockQuantity > 0;
  return true;
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

const btnBase =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-9 px-3 text-sm sm:h-10 sm:px-3';
const btnPrimary = 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50';
const btnDark = 'bg-gray-900 text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-900/40';
const btnMinW = 'w-[112px] sm:w-[132px]';
const btnGhost = 'border border-gray-300 text-gray-700 hover:text-red-600 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-300/40';

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  viewMode = 'grid',
  className = '',
  showWishlist = false,
  reviewSummary, // NEW
}) => {
  const isList = viewMode === 'list';

  const navigate = useNavigate();
  const { addToCart, isLoading } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist, isLoading: wishlistLoading } = useWishlist();

  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const rawId = (product as any)._id ?? (product as any).id;
  const productId = typeof rawId === 'string' ? rawId.trim() : rawId ? String(rawId) : '';
  const inStock = computeInStock(product);
  const inWishlist = productId ? isInWishlist(productId) : false;

  const imageUrl = getFirstImageUrl(product.images);

  const sku = getSku(product);
  const color = getColor(product);
  const ports = getPorts(product);

  const comparePrice = getComparePrice(product);
  const hasDiscount =
    typeof product.price === 'number' &&
    typeof comparePrice === 'number' &&
    comparePrice > product.price;

  const discountPct = hasDiscount
    ? Math.round(((comparePrice! - product.price) / comparePrice!) * 100)
    : 0;

  // NEW: derive rating from bulk summary or fallback to product fields. No fetch here.
  const avgRating = reviewSummary?.averageRating ?? getInitialAverageRating(product);
  const revCount = reviewSummary?.reviewCount ?? getInitialReviewCount(product);

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
      await addToCart(productId, 1);
      toast.success('Added to cart!');
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
      await addToCart(productId, 1);
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

  const detailPath = isValidObjectId(productId) ? `/products/${productId}` : '/products';
  const handleGuardedNav = (e: React.MouseEvent) => {
    if (!isValidObjectId(productId)) {
      e.preventDefault();
      toast.error('Invalid product link. Please try again.');
    }
  };

  const currency = (product as any).currency || 'INR';
  const roundedAvg = useMemo(
    () => Math.max(0, Math.min(5, Math.round((avgRating ?? 0) * 10) / 10)),
    [avgRating]
  );

  return (
    <Link to={detailPath} onClick={handleGuardedNav} className="block group" data-product-id={productId || ''}>
      <motion.div
        whileHover={{ y: -5 }}
        className={
          (isList
            ? 'bg-plaine-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 flex gap-4 p-4'
            : 'bg-plaine-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300') +
          (className ? ` ${className}` : '')
        }
      >
        {/* Image */}
        <div className={isList ? 'w-28 h-28 flex-shrink-0 relative overflow-hidden bg-gray-100 rounded-md' : 'relative aspect-square overflow-hidden bg-gray-100'}>
          {imageUrl && !imageError ? (
            <>
              {imageLoading && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center" aria-label="Loading image">
                  <div className="text-gray-400">Loading...</div>
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
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <div className="text-center text-gray-500">
                <div className="text-3xl mb-1">📦</div>
                <div className="text-xs font-medium">No Image</div>
              </div>
            </div>
          )}

          {/* Discount badge */}
          {hasDiscount && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-semibold z-10">
              {discountPct}% OFF
            </div>
          )}

          {/* Wishlist overlay */}
          {showWishlist && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleWishlistToggle}
              disabled={wishlistLoading}
              className={`absolute top-2 right-2 inline-flex ${btnGhost} h-9 w-9 p-0 min-w-[2.25rem] sm:h-10 sm:w-10 bg-white/90 backdrop-blur z-20`}
              title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={inWishlist}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={'h-4 w-4 ' + (inWishlist ? 'fill-current text-red-600' : '')} />
            </motion.button>
          )}

          {/* Stock overlay */}
          {inStock === false && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10" aria-label="Out of stock">
              <span className="text-white font-semibold text-sm">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={isList ? 'flex-1 min-w-0' : 'p-4'}>
          <h3 className={'text-lg font-semibold text-gray-900 mb-2 line-clamp-2 ' + (isList ? 'mt-0' : '')}>
            {product.name}
          </h3>

          {/* {(sku || color) && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
              {sku && (
                <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                  <Tag className="w-3 h-3" />
                  {sku}
                </span>
              )}
              {color && (
                <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                  Color: <strong className="font-medium">{color}</strong>
                </span>
              )}
            </div>
          )} */}

          {/* Rating */}
          <div className="flex items-center mb-2" aria-label={`Rating ${roundedAvg} out of 5`}>
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={'h-4 w-4 ' + (i < Math.floor(roundedAvg) ? 'text-yellow-400 fill-current' : 'text-gray-300')}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600 ml-2">({revCount} reviews)</span>
          </div>

          {/* Price + stock pill */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-gray-900">{fmtPrice(product.price, currency)}</span>
              {hasDiscount && (
                <span className="text-sm text-gray-500 line-through" aria-label="MRP">
                  {fmtPrice(comparePrice, currency)}
                </span>
              )}
            </div>
            <span
              className={
                'text-xs px-2 py-1 rounded ' +
                (inStock === false ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')
              }
            >
              {inStock === false ? 'Out of Stock' : 'In Stock'}
            </span>
          </div>

          {/* Optional tech facts */}
          {/* {ports !== undefined && (
            <div className="text-xs text-gray-700 mb-3">
              Ports: <strong>{ports}</strong>
            </div>
          )} */}

          {/* Actions */}
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
