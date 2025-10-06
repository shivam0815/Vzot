// src/hooks/usePayment.ts - Complete Implementation (PhonePe + COD)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { paymentService } from '../services/paymentService';

interface PaymentOrderData {
  items: any[];
  shippingAddress: any;
  billingAddress?: any;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

interface UserDetails {
  name: string;
  email: string;
  phone: string;
}

interface PaymentResult {
  success: boolean;
  error?: string;
  orderId?: string;
  redirected?: boolean;
}

export const usePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const processPayment = async (
    amount: number,
    paymentMethod: 'phonepe' | 'cod',
    orderData: PaymentOrderData,
    userDetails: UserDetails
  ): Promise<PaymentResult> => {
    setIsProcessing(true);

    try {
      console.log('🔄 Starting payment process:', {
        amount,
        paymentMethod,
        hasOrderData: !!orderData,
        hasUserDetails: !!userDetails,
      });

      // ✅ Create payment order on backend
      const paymentOrder = await paymentService.createPaymentOrder(
        amount,
        paymentMethod,
        orderData
      );

      console.log('✅ Payment order created:', paymentOrder);

      if (paymentMethod === 'phonepe') {
        return await processPhonePePayment(paymentOrder);
      } else if (paymentMethod === 'cod') {
        return await processCODPayment(paymentOrder);
      } else {
        throw new Error('Invalid payment method');
      }
    } catch (error: any) {
      console.error('❌ Payment processing error:', error);

      if (error.response?.status === 500) {
        toast.error('Server error. Please try again later.');
      } else if (error.response?.status === 401) {
        toast.error('Please log in again to continue.');
      } else {
        toast.error(error.response?.data?.message || 'Payment processing failed');
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ PhonePe: redirect to hosted page and exit
  const processPhonePePayment = async (paymentOrder: any): Promise<PaymentResult> => {
    try {
      // Expected backend shapes (support multiple just in case):
      // - paymentOrder.phonepeRedirect
      // - paymentOrder.redirectUrl
      // - paymentOrder.data.instrumentResponse.redirectInfo.url
      const redirectUrl =
        paymentOrder?.phonepeRedirect ||
        paymentOrder?.redirectUrl ||
        paymentOrder?.data?.instrumentResponse?.redirectInfo?.url;

      if (!redirectUrl) {
        console.error('❌ PhonePe redirect URL missing in response', paymentOrder);
        toast.error('Payment configuration error');
        return { success: false, error: 'PhonePe redirect URL missing', orderId: paymentOrder?.orderId };
      }

      const orderId =
        paymentOrder?.orderId ||
        paymentOrder?.order?._id ||
        paymentOrder?.paymentOrderId ||
        null;

      // Inform the user & redirect
      toast.loading('Opening PhonePe...', { id: 'pp-open' });
      setTimeout(() => {
        toast.dismiss('pp-open');
        window.location.href = redirectUrl;
      }, 300);

      return {
        success: true,
        redirected: true,
        orderId: orderId || undefined,
      };
    } catch (err: any) {
      console.error('❌ PhonePe init error:', err);
      toast.error('Failed to start PhonePe payment');
      return { success: false, error: err.message };
    }
  };

  // ✅ COD: mark order as placed (uses backend verify endpoint to finalize)
  const processCODPayment = async (paymentOrder: any): Promise<PaymentResult> => {
    try {
      const ordId = paymentOrder?.orderId || paymentOrder?.order?._id;
      const payOrderId = paymentOrder?.paymentOrderId || ordId;

      console.log('💰 Processing COD payment for order:', ordId);

      toast.loading('Placing your COD order...', { id: 'cod-process' });

      const verificationResult = await paymentService.verifyPayment({
        paymentId: `cod_${Date.now()}`,
        orderId: payOrderId,
        signature: 'cod_signature',
        paymentMethod: 'cod',
      });

      toast.dismiss('cod-process');

      if (verificationResult.success) {
        console.log('✅ COD order placed successfully');
        toast.success('COD order placed successfully! 🎉');

        setTimeout(() => {
          navigate(`/order-success/${ordId || ''}`);
        }, 800);

        return {
          success: true,
          orderId: ordId,
        };
      } else {
        console.error('❌ COD order verification failed');
        toast.error('Failed to place COD order. Please try again.');
        return {
          success: false,
          error: 'COD verification failed',
          orderId: ordId,
        };
      }
    } catch (error: any) {
      console.error('❌ COD processing error:', error);
      toast.dismiss('cod-process');
      toast.error('Failed to place COD order. Please try again.');
      return {
        success: false,
        error: error.message,
        orderId: paymentOrder?.orderId,
      };
    }
  };

  // ✅ Retry: re-fetch order, then re-run with chosen method
  const retryPayment = async (
    orderId: string,
    paymentMethod: 'phonepe' | 'cod',
    userDetails: UserDetails
  ): Promise<PaymentResult> => {
    try {
      console.log('🔄 Retrying payment for order:', orderId);

      const status = await paymentService.getPaymentStatus(orderId);

      if (status.success && status.order) {
        const order = status.order;
        const orderData: PaymentOrderData = {
          items: order.items,
          shippingAddress: order.shippingAddress,
          billingAddress: order.billingAddress,
          subtotal: order.subtotal,
          tax: order.tax,
          shipping: order.shipping,
          total: order.total,
        };

        return await processPayment(order.total, paymentMethod, orderData, {
          name: order.shippingAddress?.fullName || '',
          email: order.shippingAddress?.email || '',
          phone: order.shippingAddress?.phoneNumber || '',
        });
      } else {
        throw new Error('Order not found');
      }
    } catch (error: any) {
      console.error('❌ Retry payment error:', error);
      toast.error('Failed to retry payment');
      return { success: false, error: error.message };
    }
  };

  return {
    processPayment,
    retryPayment,
    isProcessing,
  };
};
