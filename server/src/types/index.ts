// src/types/index.ts - COMPLETELY FIXED VERSION
import { Types, Document } from 'mongoose';
import { Request } from 'express';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'user' | 'admin';
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
} // ✅ Fixed closing brace

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  images: string[];
  rating: number;
  reviews: number;
  inStock: boolean;
  stockQuantity: number;
  features: string[];
  specifications: Record<string, any>; // ✅ Fixed Record type
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  businessName?: string;
} // ✅ Fixed closing brace

// ✅ ADDED: Missing Product interface for frontend
export interface Product {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  image?: string;
  
  images?: string[];
  rating: number;
  reviews: number;
   reviewsCount?: number;
  inStock: boolean;
  stockQuantity: number;
  features: string[];
  specifications: Record<string, any>; // ✅ Fixed: Complete Record type
  tags: string[];
  isActive: boolean;
    createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ICart extends Document {
  userId: Types.ObjectId;
  items: {
    productId: Types.ObjectId;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
} // ✅ Fixed closing brace

export interface IOrder extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  orderNumber?: string;
  items: Array<{ // ✅ Fixed HTML entities
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
  };
  paymentMethod: 'razorpay' | 'stripe' | 'cod';
  paymentOrderId: string;
  paymentId?: string;
  paymentSignature?: string;
  subtotal: number;
  tax: number;
  shipping: number;
  totalAmount: number;
  total?: number;
  paymentStatus: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid' | 'pending' | 'completed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  status?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
} // ✅ Fixed closing brace

export interface IOEMInquiry extends Document {
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
} // ✅ Fixed closing brace

export interface IReview extends Document {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  rating: number;
  comment: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
} // ✅ Fixed closing brace

export interface JwtPayload {
  id: string;
  role: string;
} // ✅ Fixed closing brace

 // ✅ Fixed closing brace

export interface CartItem {
  id: string;
  productId: string; // ✅ Fixed: Proper string type instead of any
  product?: string; // ✅ Added: For frontend compatibility
  name: string;
  price: number;
  quantity: number;
  images?: string[];
  image?: string;
  category?: string;
  originalPrice?: number;
  totalPrice?: number; // ✅ Added: For frontend compatibility
} // ✅ Fixed closing brace

export interface PaymentOrderData {
  items: Array<{ // ✅ Fixed HTML entities
    productId: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: IOrder['shippingAddress'];
  billingAddress?: IOrder['billingAddress'];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
} // ✅ Fixed closing brace

export interface AdminStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalUsers: number;
  lowStockItems: Array<{ // ✅ Fixed HTML entities
    productId: string;
    name: string;
    stockQuantity: number;
  }>;
} // ✅ Fixed closing brace
// backend/src/types/index.ts


// Database Models (with Document extension)
export interface IReturn extends Document {
  _id: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
  gateway?: 'razorpay' | 'stripe'; 
}

export interface IReviewModel extends Document {
  _id: Types.ObjectId;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  reviewDate: Date;
  helpful: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentModel extends Document {
  _id: Types.ObjectId;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  transactionId: string;
  paymentDate: Date;
  orderId: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface AuthRequest extends Request {
  user: Express.AuthenticatedUser; // ✅ use the global augmentation type
}