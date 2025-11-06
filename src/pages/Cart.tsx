// src/pages/Cart.tsx — compact, modern UI/UX (B2C)
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2, ShoppingBag, ArrowLeft, ImageIcon, BadgePercent, ShieldCheck, Truck } from 'lucide-react';
import { useCartContext } from '../context/CartContext';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import type { CartItem } from '../types';

/* -------- Config (B2C: no MOQ) -------- */
const clampCartQty = (q: number) => Math.max(1, Math.floor(q || 1));
const getMaxQtyFromItem = (item: any): number => {
  const p = item?.productId || item || {};
  const stock = Number(p?.stockQuantity ?? item?.stockQuantity ?? 0);
  return stock > 0 ? stock : 99; // soft cap for unknown stock
};
const getItemId = (item: any): string => String(
  item?.productId?._id || item?.productId?.id || item?.productId || item?._id || item?.id || ''
);
const FREE_SHIP_MIN = 1499; // show progress bar to free shipping
const SHIPPING_FLAT = 150; // else flat shipping

const Cart: React.FC = () => {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    getTotalPrice,
    getTotalItems,
    isLoading,
    error,
    refreshCart,
  } = useCartContext();

  const { user } = useAuth();
  const navigate = useNavigate();

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
    const imageUrl = productData.image || productData.images?.[0] || item.image || item.images?.[0];
    const altText = String(productData.name || item.name || 'Product');

    return (
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
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
              <ImageIcon className="h-6 w-6 text-gray-400" />
            </div>
          </>
        ) : (
          <ImageIcon className="h-6 w-6 text-gray-400" />
        )}
      </div>
    );
  };

  if (isLoading && (!cartItems || cartItems.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-gray-600 text-sm">Loading cart…</p>
        </div>
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <ShoppingBag className="h-14 w-14 text-gray-400 mx-auto mb-3" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-600 mb-6 text-sm">Add items to checkout faster later.</p>
          <Link
            to="/products"
            className="inline-flex items-center px-5 py-2.5 rounded-md text-white bg-blue-600 hover:bg-blue-700 text-sm font-medium"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = getTotalPrice();
  const totalItems = getTotalItems();
  const qualifiesFree = subtotal >= FREE_SHIP_MIN;
  const shippingFee = qualifiesFree ? 0 : (subtotal > 0 ? SHIPPING_FLAT : 0);
  const grandTotal = subtotal + shippingFee;
  const freeProgress = Math.min(100, Math.round((subtotal / FREE_SHIP_MIN) * 100));

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <Link to="/products" className="p-2 rounded-md hover:bg-gray-200 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cart</h1>
          </div>
          <div className="text-xs sm:text-sm text-gray-600">{totalItems} {totalItems === 1 ? 'item' : 'items'}</div>
        </div>

        {/* Free shipping bar */}
        <div className={`mb-4 sm:mb-6 rounded-xl border ${qualifiesFree ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
          <div className="p-3 sm:p-4 flex items-center gap-3">
            <Truck className={`h-5 w-5 ${qualifiesFree ? 'text-green-600' : 'text-blue-600'}`} />
            <div className="flex-1">
              {qualifiesFree ? (
                <p className="text-sm font-medium text-green-800">You got FREE shipping on this order.</p>
              ) : (
                <p className="text-sm text-gray-700">
                  Add <span className="font-semibold">₹{(FREE_SHIP_MIN - subtotal).toLocaleString()}</span> more for free shipping.
                </p>
              )}
              {!qualifiesFree && (
                <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${freeProgress}%` }} />
                </div>
              )}
            </div>
            <BadgePercent className="h-5 w-5 text-gray-400" />
          </div>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-md text-sm">
            <p className="text-red-600">{String(error)}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-3 sm:p-4 border-b flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Items</h2>
                <div className="text-xs text-gray-500">Tap and hold on quantity for faster edits</div>
              </div>

              <div className="p-3 sm:p-4 space-y-3">
                <AnimatePresence initial={false}>
                  {cartItems.map((item: any, index: number) => {
                    let itemId = '';
                    let productName = '';
                    let productPrice = 0;
                    let productCategory = '';
                    let itemQuantity = 0;

                    try {
                      if (item.productId && typeof item.productId === 'object') {
                        itemId = String(item.productId._id || item.productId.id || '');
                        productName = String(item.productId.name || 'Unknown Product');
                        productPrice = Number(item.price ?? item.productId.price ?? 0);
                        productCategory = String(item.productId.category || '');
                      } else {
                        itemId = String(item.productId ?? item._id ?? item.id ?? '');
                        productName = String(item.name || 'Unknown Product');
                        productPrice = Number(item.price ?? 0);
                        productCategory = String(item.category || '');
                      }
                      itemQuantity = Number(item.quantity || 0);
                    } catch {
                      return (
                        <div key={`error-${index}`} className="p-3 bg-red-50 border border-red-200 rounded-md text-sm">
                          <p className="text-red-600">Error loading an item. Refresh the page.</p>
                        </div>
                      );
                    }

                    const uniqueKey = itemId ? `${itemId}-${index}` : `fallback-${index}`;
                    if (!itemId || !productName) {
                      return (
                        <div key={`err-${index}`} className="p-3 bg-red-50 border border-red-200 rounded-md text-sm">
                          <p className="text-red-600">Error loading item. Please refresh.</p>
                        </div>
                      );
                    }

                    const maxQty = getMaxQtyFromItem(item);
                    const atMin = itemQuantity <= 1;
                    const atMax = itemQuantity >= maxQty;

                    return (
                      <motion.div
                        key={uniqueKey}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className="bg-white rounded-lg border p-3 sm:p-4"
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="flex-shrink-0">{renderProductImage(item)}</div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">{productName}</h3>
                                {productCategory && (
                                  <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 truncate">{productCategory}</p>
                                )}
                              </div>
                              <div className="hidden sm:block text-right">
                                <p className="text-base font-semibold text-gray-900">₹{productPrice.toLocaleString()}</p>
                                <p className="text-[11px] text-gray-500">per item</p>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-3">
                              {/* Qty stepper */}
                              <div className="inline-flex items-center rounded-md border bg-white shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityUpdate(item, itemQuantity - 1)}
                                  className="p-1.5 sm:p-2 disabled:opacity-50 hover:bg-gray-50"
                                  disabled={isLoading || atMin}
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <input
                                  aria-label="Quantity"
                                  className="w-10 sm:w-12 text-center py-1 outline-none text-sm"
                                  value={itemQuantity}
                                  onChange={(e) => {
                                    const n = parseInt(e.target.value.replace(/\D/g, '') || '1', 10);
                                    handleQuantityUpdate(item, n);
                                  }}
                                  inputMode="numeric"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQuantityUpdate(item, itemQuantity + 1)}
                                  className="p-1.5 sm:p-2 disabled:opacity-50 hover:bg-gray-50"
                                  disabled={isLoading || atMax}
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>

                              {/* Line total */}
                              <div className="text-right">
                                <p className="text-base sm:text-lg font-bold text-gray-900">₹{(productPrice * itemQuantity).toLocaleString()}</p>
                              </div>

                              {/* Remove */}
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(itemId)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
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
            <div className="bg-white rounded-xl shadow-sm border p-5 sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-medium">₹{subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Shipping</span><span className="font-medium">{shippingFee === 0 ? 'Free' : `₹${shippingFee.toLocaleString()}`}</span></div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-medium text-gray-900">Total</span>
                    <span className="text-lg font-bold text-gray-900">₹{grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500">
                <ShieldCheck className="h-4 w-4" />
                Secure checkout via Razorpay/PhonePe
              </div>

              <button
                onClick={handleCheckout}
                className="w-full mt-5 inline-flex items-center justify-center bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Proceed to Checkout
              </button>

              <div className="mt-3">
                <Link to="/products" className="w-full block text-center text-blue-600 hover:text-blue-700 font-medium text-sm">Continue Shopping</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky footer summary */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="max-w-6xl mx-auto px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="text-[11px] text-gray-500">Subtotal ₹{subtotal.toLocaleString()} • {shippingFee === 0 ? 'Free shipping' : `Shipping ₹${shippingFee.toLocaleString()}`}</div>
            <div className="text-base font-semibold">₹{grandTotal.toLocaleString()}</div>
          </div>
          <button
            onClick={handleCheckout}
            className="flex-1 ml-2 inline-flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;

/* --------- Types cleanup --------- */
export type CartItemWithProduct = CartItem & {
  productId?: {
    _id?: string;
    id?: string;
    name?: string;
    price?: number;
    category?: string;
    image?: string;
    images?: string[];
    stockQuantity?: number;
  };
};
