// src/controllers/paymentController.ts — PhonePe + COD (GST persisted, with deep debug)
import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import axios from 'axios';
import Order from '../models/Order';
import Cart from '../models/Cart';
import Payment from '../models/Payment';
import { startOfDay, endOfDay } from 'date-fns';

/* -------------------------------- Types -------------------------------- */
interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
  isVerified?: boolean;
  twoFactorEnabled?: boolean;
}

/* ------------------------------ Env & Config --------------------------- */
const ENV = (process.env.PHONEPE_ENV || 'sandbox').toLowerCase();
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || '';
const SALT_KEY = process.env.PHONEPE_SALT_KEY || '';
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const BASE_URL =
  ENV === 'production'
    ? (process.env.PHONEPE_BASE_URL_PROD || 'https://api.phonepe.com/apis/hermes')
    : (process.env.PHONEPE_BASE_URL_SANDBOX || 'https://api-preprod.phonepe.com/apis/pg-sandbox');

const REDIRECT_URL = process.env.PHONEPE_REDIRECT_URL || '';
const CALLBACK_URL = process.env.PHONEPE_CALLBACK_URL || '';

const REQUIRED_FOR_PHONEPE = ['PHONEPE_MERCHANT_ID', 'PHONEPE_SALT_KEY', 'PHONEPE_SALT_INDEX', ENV === 'production' ? 'PHONEPE_BASE_URL_PROD' : 'PHONEPE_BASE_URL_SANDBOX'];

/* ------------------------------ Debug Utils ---------------------------- */
const sha256Hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// Redact helpers for logs
const redact = (v?: string) => (v ? v.replace(/.(?=.{4})/g, '•') : v);
const safeEnvSnapshot = () => ({
  ENV,
  BASE_URL,
  MERCHANT_ID: redact(MERCHANT_ID),
  SALT_INDEX,
  REDIRECT_URL,
  CALLBACK_URL,
  hasSALT_KEY: !!SALT_KEY,
});
const logDivider = () => console.log('='.repeat(80));

const xHeaders = (body: object | '', path: string) => {
  const b64 = body === '' ? '' : Buffer.from(JSON.stringify(body)).toString('base64');
  const xVerifyRaw = sha256Hex(b64 + path + SALT_KEY);
  const xVerify = `${xVerifyRaw}###${SALT_INDEX}`;
  return {
    'Content-Type': 'application/json',
    'X-VERIFY': xVerify,
    'X-MERCHANT-ID': MERCHANT_ID,
  };
};

const cleanGstin = (s?: any) =>
  (s ?? '').toString().toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);

function buildGstBlock(
  payload: any,
  shippingAddress: any,
  computed: { subtotal: number; tax: number }
) {
  const ex = payload?.orderData?.extras ?? payload?.extras ?? {};
  const rawGstin =
    ex.gstin ??
    ex.gstNumber ??
    ex.gst?.gstin ??
    ex.gst?.gstNumber ??
    payload?.gst?.gstin ??
    payload?.gstNumber ??
    payload?.gstin;

  const gstin = cleanGstin(rawGstin);
  const wantInvoice =
    Boolean(
      ex.wantGSTInvoice ??
        ex.gst?.wantInvoice ??
        payload?.needGSTInvoice ??
        payload?.needGstInvoice ??
        payload?.gst?.wantInvoice ??
        payload?.gst?.requested
    ) || !!gstin;

  const taxPercent =
    Number(
      payload?.pricing?.gstPercent ??
        payload?.orderData?.pricing?.gstPercent ??
        payload?.pricing?.taxRate
    ) ||
    (computed.subtotal > 0
      ? Math.round((computed.tax / computed.subtotal) * 100)
      : 0);

  const clientRequestedAt =
    ex.gst?.requestedAt ??
    payload?.gst?.requestedAt ??
    ex.requestedAt ??
    payload?.requestedAt;

  const requestedAt = clientRequestedAt
    ? new Date(clientRequestedAt)
    : wantInvoice
    ? new Date()
    : undefined;

  return {
    wantInvoice,
    gstin: gstin || undefined,
    legalName:
      (ex.gst?.legalName ??
        ex.gstLegalName ??
        payload?.gst?.legalName ??
        shippingAddress?.fullName)?.toString().trim() || undefined,
    placeOfSupply:
      (ex.gst?.placeOfSupply ??
        ex.placeOfSupply ??
        payload?.gst?.placeOfSupply ??
        shippingAddress?.state)?.toString().trim() || undefined,
    taxPercent,
    taxBase: computed.subtotal || 0,
    taxAmount: computed.tax || 0,
    requestedAt,
    email:
      (ex.gst?.email ?? payload?.gst?.email ?? shippingAddress?.email)?.toString().trim() ||
      undefined,
  };
}

const generateOrderNumber = (): string => {
  const ts = Date.now();
  const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${ts}${rnd}`;
};

/* ============================ CREATE ORDER ============================ */
export const createPaymentOrder = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const { amount, currency = 'INR', paymentMethod, orderData } = req.body;
  const user = req.user as AuthenticatedUser;

  // ✅ PhonePe env sanity check (place it here)
  const missing: string[] = [];
  if (paymentMethod === 'phonepe') {
    if (!MERCHANT_ID) missing.push('PHONEPE_MERCHANT_ID');
    if (!SALT_KEY) missing.push('PHONEPE_SALT_KEY');
    if (!SALT_INDEX) missing.push('PHONEPE_SALT_INDEX');
    if (!BASE_URL) missing.push(ENV === 'production' ? 'PHONEPE_BASE_URL_PROD' : 'PHONEPE_BASE_URL_SANDBOX');
    if (!REDIRECT_URL) missing.push('PHONEPE_REDIRECT_URL');
    if (!CALLBACK_URL) missing.push('PHONEPE_CALLBACK_URL');
  }
  if (missing.length) {
    console.error('❌ Missing PhonePe env:', missing);
    return res.status(500).json({ success: false, message: 'PhonePe not configured', missing });
  }

  try {
    const { amount, currency = 'INR', paymentMethod, orderData } = req.body;
    const user = req.user as AuthenticatedUser;

    if (!user) return void res.status(401).json({ success: false, message: 'User not authenticated' });
    if (!(Number(amount) > 0)) return void res.status(400).json({ success: false, message: 'Invalid amount' });
    if (!orderData?.items?.length) return void res.status(400).json({ success: false, message: 'Items required' });
    if (!orderData.shippingAddress) return void res.status(400).json({ success: false, message: 'Shipping address required' });

    let paymentOrderId = '';
    let phonepeRedirect: string | undefined;

    if (paymentMethod === 'phonepe') {
      const orderId = `ORD-${Date.now()}`; // merchantTransactionId
      const body = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: orderId,
        merchantUserId: String(user.id),
        amount: Math.round(Number(amount) * 100), // paise
        redirectUrl: REDIRECT_URL,
        callbackUrl: CALLBACK_URL,
        instrumentType: 'PAY_PAGE',
      };
      const path = '/checkout/v2/pay';
      const url = `${BASE_URL}${path}`;
      const headers = xHeaders(body, path);

      console.log('➡️  PhonePe PAY request:', {
        url, path, method: 'POST',
        headers: { ...headers, 'X-VERIFY': redact(headers['X-VERIFY'] as string) },
        body,
      });

      const respp = await axios.post(url, body, {
        headers,
        timeout: 15000,
        validateStatus: () => true, // let us inspect non-2xx
      });

      const { status, statusText, data } = respp;
      console.log('⬅️  PhonePe PAY response meta:', { status, statusText });
      console.log('⬅️  PhonePe PAY response body:', JSON.stringify(data, null, 2));

      // Accept success signals
      const ok =
        (data && (data.success === true || data.code === 'PAYMENT_INITIATED' || data.code === 'SUCCESS')) ||
        status === 200;

      if (!ok) {
        return void res.status(400).json({
          success: false,
          source: 'phonepe',
          phase: 'init',
          code: data?.code || 'UNKNOWN',
          message: data?.message || 'PhonePe init failed',
          data,
        });
      }

      paymentOrderId = orderId;
      phonepeRedirect =
        data?.data?.instrumentResponse?.redirectInfo?.url ||
        data?.data?.instrumentResponse?.intentUrl;

      if (!phonepeRedirect) {
        console.warn('⚠️  PhonePe success but no redirect URL in response. Data:', data);
      }
    } else if (paymentMethod === 'cod') {
      paymentOrderId = `cod_${Date.now().toString().slice(-8)}_${String(user.id).slice(-8)}`;
    } else {
      return void res.status(400).json({ success: false, message: 'Invalid payment method. Use phonepe or cod.' });
    }

    // Pricing
    const fallbackSubtotal =
      typeof orderData.subtotal === 'number'
        ? orderData.subtotal
        : orderData.items.reduce(
            (s: number, it: any) => s + Number(it.price || 0) * Number(it.quantity || 1),
            0
          );

    const subtotal = Math.max(0, Number(fallbackSubtotal));
    const tax =
      typeof orderData.tax === 'number' ? Number(orderData.tax) : Math.round(subtotal * 0.18);
    const shipping = typeof orderData.shipping === 'number' ? Number(orderData.shipping) : 0;
    const total = typeof orderData.total === 'number' ? Number(orderData.total) : Number(amount);

    const gstBlock = buildGstBlock(req.body, orderData.shippingAddress, { subtotal, tax });

    const order = new Order({
      userId: new mongoose.Types.ObjectId(user.id),
      orderNumber: generateOrderNumber(),
      items: orderData.items,
      shippingAddress: orderData.shippingAddress,
      billingAddress: orderData.billingAddress || orderData.shippingAddress,
      paymentMethod,
      paymentOrderId,
      subtotal, tax, shipping, total,
      status: 'pending',
      orderStatus: 'pending',
      paymentStatus: paymentMethod === 'cod' ? 'cod_pending' : 'awaiting_payment',
      gst: gstBlock,
      customerNotes: (orderData?.extras?.orderNotes || '').toString().trim() || undefined,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await order.save();
    console.log('💾 Order saved:', { _id: order._id, orderNumber: order.orderNumber, paymentOrderId });

    res.json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentOrderId,
      amount: total,
      currency,
      paymentMethod,
      phonepeRedirect,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        items: order.items,
        gst: order.gst,
      },
    });
  } catch (error: any) {
    console.error('❌ createPaymentOrder error caught');
    if (error?.response) {
      console.error('📡 PhonePe error response:', {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data,
      });
      return void res.status(400).json({
        success: false,
        source: 'phonepe',
        message: error.response.data?.message || 'PhonePe error',
        code: error.response.data?.code,
        data: error.response.data,
        debug: safeEnvSnapshot(),
      });
    }
    if (error?.request) {
      console.error('🚫 PhonePe no-response (network/timeout):', { code: error.code, errno: error.errno });
      return void res.status(502).json({
        success: false,
        source: 'network',
        message: 'Gateway timeout contacting PhonePe',
        debug: safeEnvSnapshot(),
      });
    }
    console.error('💥 Setup/logic error:', error?.message);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to create payment order',
      debug: safeEnvSnapshot(),
    });
  } finally {
    logDivider();
  }
};

/* ============================ VERIFY PAYMENT =========================== */
export const verifyPayment = async (req: Request, res: Response) => {
  logDivider();
  console.log('▶️  verifyPayment body:', req.body);
  console.log('🧪 PhonePe env snapshot:', safeEnvSnapshot());

  try {
    const user = req.user as AuthenticatedUser;
    const { orderId, paymentMethod } = req.body || {};

    if (!user) return void res.status(401).json({ success: false, message: 'User not authenticated' });
    if (!orderId || !paymentMethod) return void res.status(400).json({ success: false, message: 'Missing verification data' });

    let paymentVerified = false;

    if (paymentMethod === 'phonepe') {
      const path = `/checkout/v2/order/${orderId}/status`;
      const url = `${BASE_URL}${path}`;
      const headers = xHeaders('', path);

      console.log('➡️  PhonePe STATUS request:', {
        url, path, method: 'GET',
        headers: { ...headers, 'X-VERIFY': redact(headers['X-VERIFY'] as string) },
      });

      const respp = await axios.get(url, {
        headers,
        timeout: 12000,
        validateStatus: () => true,
      });

      const { status, statusText, data } = respp;
      console.log('⬅️  PhonePe STATUS response meta:', { status, statusText });
      console.log('⬅️  PhonePe STATUS response body:', JSON.stringify(data, null, 2));

      const st = data?.data?.status;
      paymentVerified = st === 'SUCCESS';

      if (!paymentVerified) {
        if (st === 'PENDING') {
          return void res.json({ success: false, message: 'Payment pending', data });
        }
        return void res.status(400).json({ success: false, message: 'Payment not successful', data });
      }
    } else if (paymentMethod === 'cod') {
      paymentVerified = true;
    } else {
      return void res.status(400).json({ success: false, message: 'Invalid payment method for verification' });
    }

    const order = await Order.findOne({ paymentOrderId: orderId });
    if (!order) return void res.status(404).json({ success: false, message: 'Order not found' });

    const same = (v: any) => (v && v.toString ? v.toString() : String(v));
    if (same(order.userId) !== same(user.id)) {
      return void res.status(403).json({ success: false, message: 'Unauthorized access to order' });
    }

    order.paymentStatus = paymentMethod === 'cod' ? 'cod_pending' : 'paid';
    order.orderStatus = 'confirmed';
    order.status = 'confirmed';
    order.paymentId = order.paymentOrderId;
    order.paidAt = new Date();
    order.updatedAt = new Date();
    await order.save();
    console.log('💾 Order marked paid/confirmed:', { _id: order._id, paymentOrderId: order.paymentOrderId });

    await Payment.findOneAndUpdate(
      { transactionId: order.paymentOrderId },
      {
        userId: user.id,
        userName: user.name || '',
        userEmail: user.email || '',
        amount: order.total,
        paymentMethod,
        status: 'completed',
        transactionId: order.paymentOrderId,
        orderId: order.id.toString(),
        paymentDate: new Date(),
      },
      { upsert: true, new: true }
    );

    try {
      await Cart.findOneAndDelete({ userId: user.id });
    } catch (e) {
      console.warn('🧹 Failed to clear cart (non-fatal):', (e as Error).message);
    }

    const populatedOrder = await Order.findById(order._id).populate('items.productId');
    res.json({
      success: true,
      message: 'Payment verified and order confirmed! 🎉',
      order: populatedOrder,
      paymentDetails: {
        paymentId: order.paymentOrderId,
        paymentMethod,
        amount: order.total,
        paidAt: order.paidAt,
      },
    });
  } catch (error: any) {
    if (error?.response) {
      console.error('📡 verifyPayment PhonePe error:', error.response.data);
      return void res.status(400).json({
        success: false,
        source: 'phonepe',
        message: error.response.data?.message || 'PhonePe error',
        code: error.response.data?.code,
        data: error.response.data,
      });
    }
    console.error('❌ verifyPayment error:', error?.message);
    res.status(500).json({ success: false, error: error?.message || 'Payment verification failed' });
  } finally {
    logDivider();
  }
};

/* ============================ Status / listings ======================== */
export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const user = req.user as AuthenticatedUser;

    if (!user) return void res.status(401).json({ success: false, message: 'User not authenticated' });
    if (!orderId) return void res.status(400).json({ success: false, message: 'Order ID is required' });

    const order = await Order.findById(orderId).populate('items.productId');
    if (!order) return void res.status(404).json({ success: false, message: 'Order not found' });
    if (!order.userId.equals(user.id)) return void res.status(403).json({ success: false, message: 'Unauthorized access to order' });

    res.json({
      success: true,
      order,
      status: {
        payment: order.paymentStatus,
        order: order.orderStatus,
        total: order.total,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        paidAt: (order as any).paidAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get payment status' });
  }
};

export const generateShortReceipt = (prefix: string, userId: string): string => {
  const ts = Date.now().toString().slice(-8);
  const uid = userId.slice(-8);
  const receipt = `${prefix}_${ts}_${uid}`;
  if (receipt.length > 40) throw new Error(`Receipt too long: ${receipt.length} chars (max 40)`);
  return receipt;
};

export const getTodayPaymentsSummary = async (_req: Request, res: Response) => {
  try {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    const agg = await Payment.aggregate([
      { $match: { status: 'completed', paymentDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const list = await Payment.find({
      status: 'completed',
      paymentDate: { $gte: start, $lte: end },
    }).sort({ paymentDate: -1 });
    res.json({
      success: true,
      totalAmount: agg[0]?.totalAmount || 0,
      count: agg[0]?.count || 0,
      transactions: list,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllPayments = async (_req: Request, res: Response) => {
  try {
    const payments = await Payment.find().sort({ paymentDate: -1 });
    res.json({ success: true, data: payments });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
