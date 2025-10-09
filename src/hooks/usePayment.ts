// src/hooks/usePayment.ts - Complete Implementation
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
}

export const usePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const processPayment = async (
    amount: number,
    paymentMethod: 'razorpay' | 'cod',
    orderData: PaymentOrderData,
    userDetails: UserDetails
  ): Promise<PaymentResult> => {
    setIsProcessing(true);
    
    try {
      console.log('🔄 Starting payment process:', {
        amount,
        paymentMethod,
        hasOrderData: !!orderData,
        hasUserDetails: !!userDetails
      });
      
      // ✅ Create payment order on backend
      const paymentOrder = await paymentService.createPaymentOrder(
        amount,
        paymentMethod,
        orderData
      );
      
      console.log('✅ Payment order created:', paymentOrder);
      
      if (paymentMethod === 'razorpay') {
        return await processRazorpayPayment(paymentOrder, userDetails);
      } else if (paymentMethod === 'cod') {
        return await processCODPayment(paymentOrder);
      } else {
        throw new Error('Invalid payment method');
      }
      
    } catch (error: any) {
      console.error('❌ Payment processing error:', error);
      
      // Enhanced error messages
      if (error.response?.status === 500) {
        toast.error('Server error. Please try again later.');
      } else if (error.response?.status === 401) {
        toast.error('Please log in again to continue.');
      } else {
        toast.error(error.response?.data?.message || 'Payment processing failed');
      }
      
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ COMPLETE: Process Razorpay Payment
  const processRazorpayPayment = async (
    paymentOrder: any,
    userDetails: UserDetails
  ): Promise<PaymentResult> => {
    return new Promise((resolve) => {
      try {
        // ✅ RECOMMENDED: Get key from backend API response (more secure)
        const razorpayKey = paymentOrder.razorpayKeyId; // From backend
        
        if (!razorpayKey) {
          console.error('❌ Razorpay key not found in response');
          toast.error('Payment configuration error');
          resolve({ success: false, error: 'Missing Razorpay key' });
          return;
        }

        console.log('💳 Initializing Razorpay with key:', razorpayKey.substring(0, 10) + '...');

        const options = {
          key: razorpayKey, // ✅ Use key from backend response
          amount: paymentOrder.amount * 100, // Convert to paise
          currency: paymentOrder.currency || 'INR',
          name: 'Nakoda Mobile',
          description: 'Product Purchase',
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Optional: Add your company logo
          order_id: paymentOrder.paymentOrderId,
          prefill: {
            name: userDetails.name,
            email: userDetails.email,
            contact: userDetails.phone
          },
          notes: {
            orderId: paymentOrder.orderId,
            customerId: userDetails.email
          },
          theme: {
            color: '#2300a3'
          },
          modal: {
            ondismiss: () => {
              console.log('💔 Payment cancelled by user');
              toast.error('Payment was cancelled');
              resolve({ 
                success: false, 
                error: 'Payment cancelled by user',
                orderId: paymentOrder.orderId
              });
            }
          },
          handler: async (response: any) => {
            console.log('💳 Razorpay payment response received:', {
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature ? 'Present' : 'Missing'
            });
            
            try {
              // Show processing message
              toast.loading('Verifying payment...', { id: 'payment-verify' });
              
              // ✅ Verify payment on backend
              const verificationResult = await paymentService.verifyPayment({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                paymentMethod: 'razorpay'
              });

              // Dismiss loading toast
              toast.dismiss('payment-verify');

              if (verificationResult.success) {
                console.log('✅ Payment verified successfully');
                toast.success('Payment successful! 🎉');
                
                // Navigate to success page
                setTimeout(() => {
                  navigate(`/order-success/${paymentOrder.orderId}`);
                }, 1000);
                
                resolve({ 
                  success: true, 
                  orderId: paymentOrder.orderId 
                });
              } else {
                console.error('❌ Payment verification failed:', verificationResult);
                toast.error('Payment verification failed. Please contact support.');
                resolve({ 
                  success: false, 
                  error: 'Payment verification failed',
                  orderId: paymentOrder.orderId
                });
              }
            } catch (verifyError: any) {
              console.error('❌ Payment verification error:', verifyError);
              toast.dismiss('payment-verify');
              toast.error('Payment verification failed. Please contact support.');
              resolve({ 
                success: false, 
                error: verifyError.message,
                orderId: paymentOrder.orderId
              });
            }
          }
        };

        // ✅ Check if Razorpay SDK is loaded
        if (typeof window !== 'undefined' && (window as any).Razorpay) {
          console.log('🚀 Opening Razorpay checkout...');
          const rzp = new (window as any).Razorpay(options);
          
          // Handle Razorpay errors
          rzp.on('payment.failed', (response: any) => {
            console.error('💥 Razorpay payment failed:', response.error);
            toast.error(`Payment failed: ${response.error.description}`);
            resolve({ 
              success: false, 
              error: response.error.description,
              orderId: paymentOrder.orderId
            });
          });
          
          rzp.open();
        } else {
          console.error('❌ Razorpay SDK not loaded');
          toast.error('Payment gateway not available. Please refresh the page.');
          resolve({ 
            success: false, 
            error: 'Razorpay SDK not loaded',
            orderId: paymentOrder.orderId
          });
        }
      } catch (error: any) {
        console.error('❌ Razorpay initialization error:', error);
        toast.error('Failed to initialize payment gateway');
        resolve({ 
          success: false, 
          error: error.message,
          orderId: paymentOrder.orderId
        });
      }
    });
  };

  // ✅ COMPLETE: Process COD Payment
  const processCODPayment = async (paymentOrder: any): Promise<PaymentResult> => {
    try {
      console.log('💰 Processing COD payment for order:', paymentOrder.orderId);
      
      // Show processing message
      toast.loading('Placing your COD order...', { id: 'cod-process' });
      
      // ✅ Verify COD payment (auto-approved)
      const verificationResult = await paymentService.verifyPayment({
        paymentId: `cod_${Date.now()}`,
        orderId: paymentOrder.paymentOrderId,
        signature: 'cod_signature',
        paymentMethod: 'cod'
      });

      // Dismiss loading toast
      toast.dismiss('cod-process');

      if (verificationResult.success) {
        console.log('✅ COD order placed successfully');
        toast.success('COD order placed successfully! 🎉');
        
        // Navigate to success page
        setTimeout(() => {
          navigate(`/order-success/${paymentOrder.orderId}`);
        }, 1000);
        
        return { 
          success: true, 
          orderId: paymentOrder.orderId 
        };
      } else {
        console.error('❌ COD order verification failed');
        toast.error('Failed to place COD order. Please try again.');
        return { 
          success: false, 
          error: 'COD verification failed',
          orderId: paymentOrder.orderId
        };
      }
    } catch (error: any) {
      console.error('❌ COD processing error:', error);
      toast.dismiss('cod-process');
      toast.error('Failed to place COD order. Please try again.');
      return { 
        success: false, 
        error: error.message,
        orderId: paymentOrder.orderId
      };
    }
  };

  // ✅ BONUS: Retry payment functionality
  const retryPayment = async (
    orderId: string,
    paymentMethod: 'razorpay' | 'cod',
    userDetails: UserDetails
  ): Promise<PaymentResult> => {
    try {
      console.log('🔄 Retrying payment for order:', orderId);
      
      // Get payment status first
      const status = await paymentService.getPaymentStatus(orderId);
      
      if (status.success && status.order) {
        const orderData = {
          items: status.order.items,
          shippingAddress: status.order.shippingAddress,
          billingAddress: status.order.billingAddress,
          subtotal: status.order.subtotal,
          tax: status.order.tax,
          shipping: status.order.shipping,
          total: status.order.total
        };
        
        return await processPayment(
          status.order.total,
          paymentMethod,
          orderData,
          userDetails
        );
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
    isProcessing
  };
};
