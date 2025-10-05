// src/types/index.ts – unified FE/BE types with GST + pricing + categories
// Safe to import from both frontend and backend.

import type { Types } from 'mongoose';
import type { Request } from 'express';

/**
 * Shared Product shape (flexible for API responses)
 */
export interface Product {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number | null;
  category: string;
  subcategory?: string;
  images?: string[];
  image?: string;
  primaryImage?: string;
  imageUrl?: string;
  thumbnail?: string;
  rating?: number;
  reviewsCount?: number;
  inStock?: boolean;
  currency?: string; // default "INR" from UI when missing
  stockQuantity?: number;
  features?: string[];
  specifications?: Record<string, any>;
  tags?: string[];
  isActive?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  compareAtPrice?: number | null;
  brand?: string;

  // ➕ NEW SEO & catalog fields
  sku?: string;
  metaTitle?: string;
  metaDescription?: string;
}

/**
 * Cart item (frontend)
 */
export interface CartItem {
  product: string;
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  images?: string[];
  image?: string;
  category?: string;
  originalPrice?: number;
  totalPrice?: number;
}

/**
 * Basic user (frontend)
 */
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: Address;
  role: 'user' | 'admin';
  token?: any;
  isVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export interface Address {
  street?: string; // FE convenience (can be blank)
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

/**
 * Categories used on the site (runtime constant for FE widgets like Clara)
 */
export const CATEGORIES = [
  'Car Chargers',
  'Bluetooth Neckbands',
  'TWS',
  'Data Cables',
  'Mobile Chargers',
  'Bluetooth Speakers',
  'Power Banks',
  'Integrated Circuits & Chips',
  'Mobile Repairing Tools',
  'Electronics',
  'Accessories',
  'Others',
] as const;
export type CategoryName = typeof CATEGORIES[number];

/**
 * OEM types (aligned to catalog)
 */
export type OEMStatus = 'pending' | 'contacted' | 'quoted' | 'closed';
export type OEMCategory =
  | 'Car Chargers'
  | 'Bluetooth Neckbands'
  | 'TWS'
  | 'Data Cables'
  | 'Mobile Chargers'
  | 'Bluetooth Speakers'
  | 'Power Banks'
  | 'Integrated Circuits & Chips'
  | 'Mobile Repairing Tools'
  | 'Electronics'
  | 'Accessories'
  | 'Others'
  | 'Custom';

export interface OEMInquiry {
  id: string;        // FE-normalized id
  _id?: string;      // BE sometimes sends _id
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  productCategory: OEMCategory;
  quantity: number;
  customization: string;
  message?: string;
  status: OEMStatus;
  createdAt: string;
  updatedAt?: string;
}

/**
 * DB models (backend only — extend mongoose.Document)
 */
export interface IUser {
  _id?: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'user' | 'admin';
  address?: Address;
  isVerified: boolean;
  isActive: boolean;
  twoFactorEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct {
  _id?: Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  images?: string[];
  rating?: number;
  reviews?: number;
  inStock?: boolean;
  stockQuantity?: number;
  features?: string[];
  specifications?: Record<string, any>;
  tags?: string[];
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
  isOnSale?: boolean;
  views?: number;
  brand?: string;
  stock?: number;

  // ➕ NEW SEO & catalog fields
  sku?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface ICart {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  items: {
    productId: Types.ObjectId;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GST payload & pricing blocks used by checkout and admin
 */
export interface GstDetails {
  gstin: string;
  legalName: string;
  placeOfSupply: string; // state
  email?: string;
  requestedAt?: string;
}

export interface OrderPricing {
  rawSubtotal: number;
  discount: number;
  discountLabel?: string;
  coupon?: string;
  couponFreeShipping?: boolean;
  effectiveSubtotal: number;
  tax: number;
  shippingFee: number;
  shippingAddedPostPack?: boolean;
  codCharges: number;
  giftWrapFee: number;
  convenienceFee: number;
  convenienceFeeGst: number;
  convenienceFeeRate?: number;
  convenienceFeeGstRate?: number;
  gstSummary?: {
    requested: boolean;
    rate: number; // 0.18 for 18%
    taxableValue: number;
    gstAmount: number;
  };
  total: number;
}

/**
 * Frontend Order shape
 */
export interface Order {
  id?: string;
  _id?: string;
  orderNumber?: string;
  userId?: string;
  items: CartItem[];
  subtotal?: number;
  tax?: number;
  shipping?: number;
  total?: number;        // prefer this
  totalAmount?: number;  // kept for compatibility
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderStatus?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus?: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid' | 'pending' | 'completed' | 'refunded';
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: string;
  extras?: {
    orderNotes?: string;
    wantGSTInvoice?: boolean;
    gst?: GstDetails;
    giftWrap?: boolean;
  };
  pricing?: OrderPricing;
  trackingNumber?: string;
  paidAt?: string | Date;
  shippedAt?: string | Date;
  deliveredAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/**
 * Backend Order (mongoose) — mirrors the FE order plus ObjectIds
 */
export interface IOrder {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  orderNumber?: string;
  items: Array<{
    productId: Types.ObjectId;
    name?: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  shippingAddress: {
    fullName: string;
    phoneNumber: string;
    email: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    country?: string;
  };
  billingAddress?: {
    fullName: string;
    phoneNumber: string;
    email: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    country?: string;
  };
  paymentMethod: 'razorpay' | 'stripe' | 'cod';
  paymentOrderId: string;
  paymentId?: string;
  paymentSignature?: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total?: number;        // allow both
  totalAmount?: number;  // legacy name in some code paths
  paymentStatus: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid' | 'pending' | 'completed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  extras?: {
    orderNotes?: string;
    wantGSTInvoice?: boolean;
    gst?: GstDetails;
    giftWrap?: boolean;
  };
  pricing?: OrderPricing;
  createdAt: Date;
  updatedAt: Date;
}

/*** Reviews ***/
export interface IOEMInquiry {
  _id?: Types.ObjectId;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  productCategory: string;
  quantity: number;
  customization: string;
  message: string;
  status: 'pending' | 'contacted' | 'quoted' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface IReview {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  rating: number;
  comment: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Auth/JWT **/
export interface JwtPayload { id: string; role: string; }
export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string; name?: string; phone?: string; _id?: string; isVerified?: boolean; status?: string; };
}

/** Payment order creation payload (frontend → backend) **/
export interface PaymentOrderData {
  items: Array<{ productId: string; quantity: number; price: number; }>;
  shippingAddress: IOrder['shippingAddress'];
  billingAddress?: IOrder['billingAddress'];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  extras?: IOrder['extras'];
  pricing?: IOrder['pricing'];
}

/** Admin dashboard helpers (frontend only) **/
export interface ReturnedProduct {
  _id?: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  userEmail: string;
  returnReason: string;
  returnDate: Date;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  refundAmount: number;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Review {
  _id?: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  reviewDate: Date;
  helpful: number;
  verified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Payment {
  _id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  transactionId: string;
  paymentDate: Date;
  orderId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ReturnStatus = 'all' | 'pending' | 'approved' | 'rejected';
export type PaymentStatusFilter = 'all' | 'completed' | 'pending' | 'failed';
export type DateFilter = 'today' | 'weekly' | 'monthly' | 'all';

export interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  completedPayments: number;
  failedPayments: number;
  pendingPayments: number;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }>;
}

export interface QualityAssessment {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

export type Language = 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'gu';
export interface UserPrefs { notifications: boolean; theme: 'light' | 'dark'; language: Language; }
