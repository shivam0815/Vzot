// src/pages/Cart.tsx — dark glass cart with dynamic wholesale pricing (frontend-only)
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowLeft,
  ImageIcon,
  BadgePercent,
  ShieldCheck,
  Truck
} from 'lucide-react';
import { useCartContext } from '../context/CartContext';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import type { CartItem } from '../types';
import VZOTBackground from '../components/Layout/VZOTBackground';

/* -------- Helpers -------- */
const clampCartQty = (q: number) => Math.max(1, Math.floor(q || 1));
const getMaxQtyFromItem = (item: any): number => {
  const p = item?.productId || item || {};
  const stock = Number(p?.stockQuantity ?? item?.stockQuantity ?? 0);
  return stock > 0 ? stock : 99;
};
const getItemId = (item: any): string =>
  String(item?.productId?._id || item?.productId?.id || item?.productId || item?._id || item?.id || '');

const FREE_SHIP_MIN = 1999;
const SHIPPING_FLAT = 150;

const Cart: React.FC = () => {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    refreshCart,
    isLoading,
    error
  } = useCartContext();

  const { user } = useAuth();
  const navigate = useNavigate();

  // read current pricing mode set by header toggle
  const pricingMode: 'retail' | 'wholesale' =
    (localStorage.getItem('pricingMode') as any) === 'wholesale' ? 'wholesale' : 'retail';

  useEffect(() => {
    refreshCart(true);
  }, [refreshCart]);

  const handleCheckout = () => {
    if (!user) return navigate('/login', { state: { from: '/checkout' } });
    navigate('/checkout');
  };

  const handleQuantityUpdate = (item: any, newQuantity: number) => {
    const itemId = getItemId(item);
    if (!itemId || itemId === 'undefined' || itemId === 'null') {
      toast.error('Unable to update item. Please refresh.');
      return;
    }
    const clampedBase = clampCartQty(newQuantity);
    const maxQty = getMaxQtyFromItem(item);
    const finalQty = Math.min(clampedBase, maxQty);
    if (finalQty < 1) return handleRemoveItem(itemId);
    updateQuantity(itemId, finalQty);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!itemId || itemId === 'undefined' || itemId === 'null') {
      toast.error('Unable to remove item. Please refresh.');
      return;
    }
    removeFromCart(itemId);
    toast.success('Removed from cart');
  };

  const renderProductImage = (item: any) => {
    const productData = item.productId || {};
    const imageUrl =
      productData.image ||
      productData.images?.[0] ||
      item.image ||
      item.images?.[0];
    const altText = String(productData.name || item.name || 'Product');

    return (
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center">
        {imageUrl ? (
          <>
            <img
              src={String(imageUrl)}
              alt={altText}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const t = e.currentTarget as HTMLImageElement;
                t.style.display = 'none';
                const ph = t.nextElementSibling as HTMLElement;
                if (ph) ph.style.display = 'flex';
              }}
            />
            <div className="hidden w-full h-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-white/50" />
            </div>
          </>
        ) : (
          <ImageIcon className="h-6 w-6 text-white/50" />
        )}
      </div>
    );
  };

  // Loading
  if (isLoading && (!cartItems || cartItems.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400 mx-auto" />
          <p className="mt-3 text-white/80 text-sm">Loading cart…</p>
        </div>
      </div>
    );
  }

  // Empty
  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <ShoppingBag className="h-14 w-14 text-white/60 mx-auto mb-3" />
          <h2 className="text-2xl font-semibold text-white mb-2">Your cart is empty</h2>
          <p className="text-white/70 mb-6 text-sm">Add items to checkout faster later.</p>
          <Link
            to="/products"
            className="inline-flex items-center px-5 py-2.5 rounded-md text-white bg-sky-600 hover:bg-sky-700 text-sm font-medium"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  /* ------- Price resolver: retail vs wholesale per line ------- */
  const getEffectiveUnit = (it: any) => {
    const p = it?.productId || {};
    const retail = Number(it?.unitRetailPrice ?? it?.price ?? p?.price ?? 0);
    const wsEnabled = Boolean(p?.wholesaleEnabled ?? it?.wholesaleEnabled);
    const wsPrice = Number(it?.wholesalePrice ?? p?.wholesalePrice);
    const moq = Number(it?.moqApplied ?? p?.wholesaleMinQty ?? 1);
    const qty = Number(it?.quantity ?? 1);

    const eligible =
      pricingMode === 'wholesale' &&
      wsEnabled &&
      Number.isFinite(wsPrice) &&
      qty >= Math.max(1, moq);

    return {
      unit: eligible ? wsPrice : retail,
      eligibleWholesale: eligible,
      wsMin: Math.max(1, moq),
      wsEnabled,
      retail
    };
  };

  /* Subtotal computed from effective unit per line */
  const subtotal = cartItems.reduce((sum, it) => {
    const { unit } = getEffectiveUnit(it);
    const qty = Number(it?.quantity ?? 1);
    return sum + unit * qty;
  }, 0);

  const totalItems = cartItems.reduce((n, it) => n + Number(it?.quantity ?? 0), 0);
  const qualifiesFree = subtotal >= FREE_SHIP_MIN;
  const shippingFee = qualifiesFree ? 0 : subtotal > 0 ? SHIPPING_FLAT : 0;
  const grandTotal = subtotal + shippingFee;
  const freeProgress = Math.min(100, Math.round((subtotal / FREE_SHIP_MIN) * 100));

  return (
    <div className="relative min-h-screen text-white">
      <VZOTBackground />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <Link to="/products" className="p-2 rounded-md hover:bg-white/10 transition-colors text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Cart</h1>
          </div>
          <div className="text-xs sm:text-sm text-white/70">
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </div>
        </div>

        {/* Free shipping bar */}
        <div
          className={`mb-4 sm:mb-6 rounded-xl border ${
            qualifiesFree ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/5'
          } backdrop-blur-sm`}
        >
          <div className="p-3 sm:p-4 flex items-center gap-3">
            <Truck className={`h-5 w-5 ${qualifiesFree ? 'text-emerald-300' : 'text-sky-300'}`} />
            <div className="flex-1">
              {qualifiesFree ? (
                <p className="text-sm font-medium text-emerald-200">You got FREE shipping on this order.</p>
              ) : (
                <p className="text-sm text-white/80">
                  Add <span className="font-semibold text-white">₹{(FREE_SHIP_MIN - subtotal).toLocaleString()}</span> more for free shipping.
                </p>
              )}
              {!qualifiesFree && (
                <div className="mt-2 h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${freeProgress}%` }} />
                </div>
              )}
            </div>
            <BadgePercent className="h-5 w-5 text-white/50" />
          </div>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-rose-500/10 border border-rose-400/30 rounded-md text-sm text-rose-100">
            {String(error)}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-semibold text-white">Items</h2>
                <div className="text-xs text-white/60">
                  {pricingMode === 'wholesale' ? 'Wholesale mode active' : 'Retail mode active'}
                </div>
              </div>

              <div className="p-3 sm:p-4 space-y-3">
                <AnimatePresence initial={false}>
                  {cartItems.map((item: any, index: number) => {
                    const p = item?.productId || {};
                    const itemId = getItemId(item);
                    const productName = String(p?.name ?? item?.name ?? 'Unknown Product');
                    const productCategory = String(p?.category ?? item?.category ?? '');
                    const quantity = Number(item?.quantity ?? 1);
                    const maxQty = getMaxQtyFromItem(item);

                    const { unit, eligibleWholesale, wsMin, wsEnabled, retail } = getEffectiveUnit(item);
                    const atMin =
                      pricingMode === 'wholesale' && wsEnabled
                        ? quantity <= Math.max(1, wsMin)
                        : quantity <= 1;
                    const atMax = quantity >= maxQty;

                    const minQtyForStepper =
                      pricingMode === 'wholesale' && wsEnabled ? Math.max(1, wsMin) : 1;

                    const uniqueKey = itemId ? `${itemId}-${index}` : `fallback-${index}`;
                    if (!itemId || !productName) {
                      return (
                        <div
                          key={`err-${index}`}
                          className="p-3 bg-rose-500/10 border border-rose-400/30 rounded-md text-sm text-rose-100"
                        >
                          Error loading item. Please refresh.
                        </div>
                      );
                    }

                    return (
                      <motion.div
                        key={uniqueKey}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className="rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4"
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="flex-shrink-0">{renderProductImage(item)}</div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="text-sm sm:text-base font-medium text-white truncate">
                                  {productName}
                                  {eligibleWholesale && (
                                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                                      Wholesale • MOQ {wsMin}
                                    </span>
                                  )}
                                </h3>
                                {productCategory && (
                                  <p className="text-[11px] sm:text-xs text-white/60 mt-0.5 truncate">
                                    {productCategory}
                                  </p>
                                )}
                              </div>
                              <div className="hidden sm:block text-right">
                                <p className="text-base font-semibold text-white">
                                  ₹{unit.toLocaleString()}
                                </p>
                                <p className="text-[11px] text-white/60">
                                  per item{eligibleWholesale ? ' (WS)' : ' (Retail)'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-3">
                              {/* Qty stepper with correct min */}
                              <div className="inline-flex items-center rounded-md border border-white/15 bg-white/10 backdrop-blur px-1">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityUpdate(item, quantity - 1)}
                                  className="p-1.5 sm:p-2 disabled:opacity-50 hover:bg-white/10 rounded"
                                  disabled={isLoading || atMin}
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="h-4 w-4 text-white" />
                                </button>
                                <input
                                  aria-label="Quantity"
                                  className="w-10 sm:w-12 text-center py-1 outline-none text-sm bg-transparent text-white"
                                  value={quantity}
                                  min={minQtyForStepper}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, '');
                                    const parsed = raw === '' ? minQtyForStepper : parseInt(raw, 10);
                                    const n = Math.max(minQtyForStepper, parsed);
                                    handleQuantityUpdate(item, n);
                                  }}
                                  inputMode="numeric"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQuantityUpdate(item, quantity + 1)}
                                  className="p-1.5 sm:p-2 disabled:opacity-50 hover:bg-white/10 rounded"
                                  disabled={isLoading || atMax}
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="h-4 w-4 text-white" />
                                </button>
                              </div>

                              {/* Line total */}
                              <div className="text-right">
                                {/* show crossed retail if wholesale applied */}
                                {eligibleWholesale ? (
                                  <div className="flex flex-col items-end">
                                    <p className="text-xs text-white/60 line-through">
                                      ₹{(retail * quantity).toLocaleString()}
                                    </p>
                                    <p className="text-base sm:text-lg font-bold text-white">
                                      ₹{(unit * quantity).toLocaleString()}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-base sm:text-lg font-bold text-white">
                                    ₹{(unit * quantity).toLocaleString()}
                                  </p>
                                )}
                              </div>

                              {/* Remove */}
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(itemId)}
                                className="p-2 text-rose-300 hover:bg-rose-400/10 rounded-md transition-colors disabled:opacity-50"
                                disabled={isLoading}
                                title="Remove item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 sticky top-4">
              <h2 className="text-lg font-semibold text-white mb-4">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Subtotal</span>
                  <span className="font-medium text-white">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Shipping</span>
                  <span className="font-medium text-white">
                    {shippingFee === 0 ? 'Free' : `₹${shippingFee.toLocaleString()}`}
                  </span>
                </div>
                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-medium text-white">Total</span>
                    <span className="text-lg font-bold text-white">₹{grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-[11px] text-white/70">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Secure checkout via Razorpay/PhonePe
              </div>

              <button
                onClick={handleCheckout}
                className="w-full mt-5 inline-flex items-center justify-center bg-sky-600 text-white py-2.5 px-4 rounded-md hover:bg-sky-700 transition-colors font-medium"
              >
                Proceed to Checkout
              </button>

              <div className="mt-3">
                <Link
                  to="/products"
                  className="w-full block text-center text-sky-300 hover:text-sky-200 font-medium text-sm"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky footer summary */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-slate-900/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-3 py-2.5 flex items-center justify-between gap-3 text-white">
          <div className="flex-1">
            <div className="text-[11px] text-white/70">
              Subtotal ₹{subtotal.toLocaleString()} •{' '}
              {shippingFee === 0 ? 'Free shipping' : `Shipping ₹${shippingFee.toLocaleString()}`}
            </div>
            <div className="text-base font-semibold">₹{grandTotal.toLocaleString()}</div>
          </div>
          <button
            onClick={handleCheckout}
            className="flex-1 ml-2 inline-flex items-center justify-center gap-2 bg-sky-600 text-white py-2 rounded-md hover:bg-sky-700 text-sm font-medium"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;

/* --------- Types --------- */
export type CartItemWithProduct = CartItem & {
  productId?: {
    _id?: string;
    id?: string;
    name?: string;
    price?: number;              // retail
    category?: string;
    image?: string;
    images?: string[];
    stockQuantity?: number;
    wholesaleEnabled?: boolean;
    wholesalePrice?: number;
    wholesaleMinQty?: number;
  };
  unitRetailPrice?: number;      // optional retail snapshot
  wholesalePrice?: number;       // optional wholesale snapshot
  moqApplied?: number;           // optional MOQ snapshot
};
