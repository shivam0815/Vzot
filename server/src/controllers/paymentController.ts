// src/controllers/paymentController.ts — PHONEPE VERSION (GST persisted)
import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import axios from 'axios';
import Order from '../models/Order';
import Cart from '../models/Cart';
import Payment from '../models/Payment';
import { startOfDay, endOfDay } from 'date-fns';

interface AuthenticatedUser {
  id: string; role: string; email?: string; name?: string;
  isVerified?: boolean; twoFactorEnabled?: boolean;
}

/* ----------------------- PhonePe env ----------------------- */
const ENV = (process.env.PHONEPE_ENV || 'sandbox').toLowerCase();
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID!;
const SALT_KEY = process.env.PHONEPE_SALT_KEY!;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const BASE_URL = ENV === 'production'
  ? process.env.PHONEPE_BASE_URL_PROD!
  : process.env.PHONEPE_BASE_URL_SANDBOX!;
const REDIRECT_URL = process.env.PHONEPE_REDIRECT_URL!;
const CALLBACK_URL = process.env.PHONEPE_CALLBACK_URL!;

const sha256Hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const xHeaders = (body: object | '', path: string) => {
  const b64 = body === '' ? '' : Buffer.from(JSON.stringify(body)).toString('base64');
  const xVerify = `${sha256Hex(b64 + path + SALT_KEY)}###${SALT_INDEX}`;
  return { 'Content-Type': 'application/json', 'X-VERIFY': xVerify, 'X-MERCHANT-ID': MERCHANT_ID };
};

/* ----------------------- GST helpers ----------------------- */
const cleanGstin = (s?: any) => (s ?? '').toString().toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);
function buildGstBlock(payload: any, shippingAddress: any, computed: { subtotal: number; tax: number }) {
  const ex = payload?.orderData?.extras ?? payload?.extras ?? {};
  const rawGstin = ex.gstin ?? ex.gstNumber ?? ex.gst?.gstin ?? ex.gst?.gstNumber ?? payload?.gst?.gstin ?? payload?.gstNumber ?? payload?.gstin;
  const gstin = cleanGstin(rawGstin);
  const wantInvoice = Boolean(ex.wantGSTInvoice ?? ex.gst?.wantInvoice ?? payload?.needGSTInvoice ?? payload?.needGstInvoice ?? payload?.gst?.wantInvoice ?? payload?.gst?.requested) || !!gstin;
  const taxPercent =
    Number(payload?.pricing?.gstPercent ?? payload?.orderData?.pricing?.gstPercent ?? payload?.pricing?.taxRate) ||
    (computed.subtotal > 0 ? Math.round((computed.tax / computed.subtotal) * 100) : 0);
  const clientRequestedAt = ex.gst?.requestedAt ?? payload?.gst?.requestedAt ?? ex.requestedAt ?? payload?.requestedAt;
  const requestedAt = clientRequestedAt ? new Date(clientRequestedAt) : wantInvoice ? new Date() : undefined;

  return {
    wantInvoice,
    gstin: gstin || undefined,
    legalName: (ex.gst?.legalName ?? ex.gstLegalName ?? payload?.gst?.legalName ?? shippingAddress?.fullName)?.toString().trim() || undefined,
    placeOfSupply: (ex.gst?.placeOfSupply ?? ex.placeOfSupply ?? payload?.gst?.placeOfSupply ?? shippingAddress?.state)?.toString().trim() || undefined,
    taxPercent,
    taxBase: computed.subtotal || 0,
    taxAmount: computed.tax || 0,
    requestedAt,
    email: (ex.gst?.email ?? payload?.gst?.email ?? shippingAddress?.email)?.toString().trim() || undefined,
  };
}

/* ----------------------- utils ----------------------- */
const generateOrderNumber = (): string => {
  const ts = Date.now(); const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${ts}${rnd}`;
};

/* ===========================================================================================
   CREATE PAYMENT ORDER (PhonePe + COD) — GST persisted
=========================================================================================== */
export const createPaymentOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, currency = 'INR', paymentMethod, orderData } = req.body;
    const user = req.user as AuthenticatedUser;

    if (!user) { res.status(401).json({ success: false, message: 'User not authenticated' }); return; }
    if (!amount || amount <= 0) { res.status(400).json({ success: false, message: 'Invalid amount' }); return; }
    if (!orderData?.items?.length) { res.status(400).json({ success: false, message: 'Invalid order data - items are required' }); return; }
    if (!orderData.shippingAddress) { res.status(400).json({ success: false, message: 'Shipping address is required' }); return; }

    let paymentOrderId = '';
    let phonepeRedirect: string | undefined;

    if (paymentMethod === 'phonepe') {
      if (!MERCHANT_ID || !SALT_KEY) { res.status(500).json({ success: false, message: 'PhonePe not configured' }); return; }
      const orderId = `ORD-${Date.now()}`; // merchantTransactionId
      const body = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: orderId,
        merchantUserId: user.id,
        amount: Math.round(Number(amount) * 100), // paise
        redirectUrl: REDIRECT_URL,
        callbackUrl: CALLBACK_URL,
        instrumentType: 'PAY_PAGE',
      };
      const path = '/checkout/v2/pay';
      const { data } = await axios.post(`${BASE_URL}${path}`, body, { headers: xHeaders(body, path), timeout: 10000 });
      paymentOrderId = orderId;
      phonepeRedirect = data?.data?.instrumentResponse?.redirectInfo?.url || data?.data?.instrumentResponse?.intentUrl;
    } else if (paymentMethod === 'cod') {
      paymentOrderId = `cod_${Date.now().toString().slice(-8)}_${user.id.slice(-8)}`;
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment method. Supported: phonepe, cod' }); return;
    }

    // Pricing fallbacks
    const fallbackSubtotal =
      typeof orderData.subtotal === 'number'
        ? orderData.subtotal
        : orderData.items.reduce((s: number, it: any) => s + Number(it.price || 0) * Number(it.quantity || 1), 0);

    const subtotal = Math.max(0, Number(fallbackSubtotal));
    const tax = typeof orderData.tax === 'number' ? Number(orderData.tax) : Math.round(subtotal * 0.18);
    const shipping = typeof orderData.shipping === 'number' ? Number(orderData.shipping) : 0;
    const total = typeof orderData.total === 'number' ? Number(orderData.total) : amount;

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

    res.json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentOrderId,
      amount: total, currency,
      paymentMethod,
      phonepeRedirect,         // <— redirect user here if present
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
    console.error('❌ Payment order creation error:', error?.response?.data || error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create payment order' });
  }
};

/* ===========================================================================================
   VERIFY PAYMENT — PhonePe: check order status (X-VERIFY on path)
=========================================================================================== */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser;
    const { orderId, paymentMethod } = req.body || {};

    if (!user) { res.status(401).json({ success: false, message: 'User not authenticated' }); return; }
    if (!orderId || !paymentMethod) { res.status(400).json({ success: false, message: 'Missing verification data' }); return; }

    let paymentVerified = false;
    if (paymentMethod === 'phonepe') {
      const path = `/checkout/v2/order/${orderId}/status`;
      const { data } = await axios.get(`${BASE_URL}${path}`, { headers: xHeaders('', path), timeout: 8000 });
      const status = data?.data?.status;
      paymentVerified = status === 'SUCCESS';
      if (!paymentVerified && status !== 'PENDING') {
        res.status(400).json({ success: false, message: 'Payment not successful', data });
        return;
      }
    } else if (paymentMethod === 'cod') {
      paymentVerified = true;
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment method for verification' });
      return;
    }

    const order = await Order.findOne({ paymentOrderId: orderId });
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    const same = (v: any) => (v && v.toString ? v.toString() : String(v));
    if (same(order.userId) !== same(user.id)) {
      res.status(403).json({ success: false, message: 'Unauthorized access to order' });
      return;
    }

    if (!paymentVerified) { res.json({ success: false, message: 'Payment pending' }); return; }

    order.paymentStatus = paymentMethod === 'cod' ? 'cod_pending' : 'paid';
    order.orderStatus = 'confirmed';
    order.status = 'confirmed';
    order.paymentId = order.paymentOrderId;
    order.paidAt = new Date();
    order.updatedAt = new Date();
    await order.save();

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

    try { await Cart.findOneAndDelete({ userId: user.id }); } catch {}

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
    res.status(500).json({ success: false, error: error?.message || 'Payment verification failed' });
  }
};


/* ===========================================================================================
   Status / listings – unchanged
=========================================================================================== */
export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const user = req.user as AuthenticatedUser;

    if (!user) { res.status(401).json({ success: false, message: 'User not authenticated' }); return; }
    if (!orderId) { res.status(400).json({ success: false, message: 'Order ID is required' }); return; }

    const order = await Order.findById(orderId).populate('items.productId');
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    if (!order.userId.equals(user.id)) { res.status(403).json({ success: false, message: 'Unauthorized access to order' }); return; }

    res.json({
      success: true,
      order,
      status: {
        payment: order.paymentStatus,
        order: order.orderStatus,
        total: order.total,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
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
    const start = startOfDay(new Date()); const end = endOfDay(new Date());
    const agg = await Payment.aggregate([
      { $match: { status: 'completed', paymentDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const list = await Payment.find({ status: 'completed', paymentDate: { $gte: start, $lte: end } }).sort({ paymentDate: -1 });
    res.json({ success: true, totalAmount: agg[0]?.totalAmount || 0, count: agg[0]?.count || 0, transactions: list });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const getAllPayments = async (_req: Request, res: Response) => {
  try { const payments = await Payment.find().sort({ paymentDate: -1 }); res.json({ success: true, data: payments }); }
  catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};
