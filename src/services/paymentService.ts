// src/services/paymentService.ts - COMPLETE FIXED VERSION
import api from '../config/api';

export interface PaymentOrderData {
  items: any[];
  shippingAddress: any;
  billingAddress?: any; // ✅ FIXED: Optional with ?
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

export interface PaymentResponse {
  success: boolean;
  orderId: string;
  paymentOrderId: string;
  clientSecret?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  order: any;
  razorpayKeyId?: string; // ✅ ADDED: For Razorpay key from backend
}

export interface PaymentVerificationData {
  paymentId: string;
  orderId: string;
  signature: string;
  paymentMethod: string;
}

export const paymentService = {
  // ✅ FIXED: Create payment order
  async createPaymentOrder(
    amount: number,
    paymentMethod: 'razorpay' | 'cod', // ✅ REMOVED: stripe (not used)
    orderData: PaymentOrderData
  ): Promise<PaymentResponse> {
    console.log('📤 Creating payment order:', {
      amount,
      paymentMethod,
      hasOrderData: !!orderData
    });

    const response = await api.post('/payment/create-order', {
      amount,
      paymentMethod,
      orderData,
      currency: 'INR'
    });

    return response.data;
  },

  // ✅ FIXED: Verify payment - now accepts object parameter
  async verifyPayment(data: PaymentVerificationData) {
    console.log('🔍 Verifying payment:', {
      paymentId: data.paymentId,
      orderId: data.orderId,
      paymentMethod: data.paymentMethod,
      hasSignature: !!data.signature
    });

    const response = await api.post('/payment/verify', {
      paymentId: data.paymentId,
      orderId: data.orderId,
      signature: data.signature,
      paymentMethod: data.paymentMethod
    });

    return response.data;
  },

  // ✅ FIXED: Get payment status
  async getPaymentStatus(orderId: string) {
    console.log('📊 Getting payment status for order:', orderId);

    if (!orderId) {
      throw new Error('Order ID is required');
    }

    const response = await api.get(`/payment/status/${orderId}`);
    return response.data;
  },

  // ✅ BONUS: Check order exists
  async checkOrderExists(orderId: string): Promise<boolean> {
    try {
      const response = await this.getPaymentStatus(orderId);
      return response.success && !!response.order;
    } catch (error) {
      return false;
    }
  }
};
