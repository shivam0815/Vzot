// src/services/paymentService.ts - COMPLETE FIXED VERSION (PhonePe + COD)
import api from '../config/api';

export interface PaymentOrderData {
  items: any[];
  shippingAddress: any;
  billingAddress?: any;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

export interface PaymentResponse {
  success: boolean;
  orderId: string;
  paymentOrderId: string;
  amount: number;
  currency: string;
  paymentMethod: 'phonepe' | 'cod';
  order: any;

  // For PhonePe hosted redirect (backend may return any of these keys)
  phonepeRedirect?: string;
  redirectUrl?: string;
  data?: {
    instrumentResponse?: {
      redirectInfo?: { url?: string };
    };
  };
}

export interface PaymentVerificationData {
  paymentId: string;
  orderId: string;
  paymentMethod: 'phonepe' | 'cod';
  signature?: string; // optional for PhonePe/COD
}

export const paymentService = {
  async createPaymentOrder(
    amount: number,
    paymentMethod: 'phonepe' | 'cod',
    orderData: PaymentOrderData
  ): Promise<PaymentResponse> {
    console.log('📤 Creating payment order:', { amount, paymentMethod, hasOrderData: !!orderData });

    // NOTE: keep your base path as currently wired in your backend.
    const { data } = await api.post('/payment/create-order', {
      amount,
      paymentMethod,
      orderData,
      currency: 'INR',
    });

    return data as PaymentResponse;
  },

  async verifyPayment(data: PaymentVerificationData) {
    console.log('🔍 Verifying payment:', {
      paymentId: data.paymentId,
      orderId: data.orderId,
      paymentMethod: data.paymentMethod,
      hasSignature: !!data.signature,
    });

    const resp = await api.post('/payment/verify', data);
    return resp.data;
  },

  async getPaymentStatus(orderId: string) {
    console.log('📊 Getting payment status for order:', orderId);
    if (!orderId) throw new Error('Order ID is required');

    const resp = await api.get(`/payment/status/${orderId}`);
    return resp.data;
  },

  async checkOrderExists(orderId: string): Promise<boolean> {
    try {
      const resp = await this.getPaymentStatus(orderId);
      return resp.success && !!resp.order;
    } catch {
      return false;
    }
  },
};
