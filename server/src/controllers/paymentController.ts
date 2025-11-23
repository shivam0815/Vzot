// src/controllers/paymentController.ts - COMPLETE FIXED VERSION (GST persisted)
import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order';
import Cart from '../models/Cart';
import Payment from '../models/Payment';
import { startOfDay, endOfDay } from 'date-fns';

interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
  isVerified?: boolean;
  twoFactorEnabled?: boolean;
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

/* ----------------------- GST helpers (same logic as orderController) ----------------------- */
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
    Number(payload?.pricing?.gstPercent ?? payload?.orderData?.pricing?.gstPercent ?? payload?.pricing?.taxRate) ||
    (computed.subtotal > 0 ? Math.round((computed.tax / computed.subtotal) * 100) : 0);

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
      (ex.gst?.email ??
        payload?.gst?.email ??
        shippingAddress?.email)?.toString().trim() || undefined,
  };
}

/* ----------------------- utils ----------------------- */
const generateOrderNumber = (): string => {
  const ts = Date.now();
  const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${ts}${rnd}`;
};

/* ===========================================================================================
   CREATE PAYMENT ORDER  —  this is where GST must be persisted
=========================================================================================== */
export const createPaymentOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, currency = 'INR', paymentMethod, orderData } = req.body;
    const user = req.user as AuthenticatedUser;

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      res.status(500).json({ success: false, message: 'Payment gateway configuration error' });
      return;
    }
    if (!user) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Invalid amount' });
      return;
    }
    if (!orderData || !orderData.items?.length) {
      res.status(400).json({ success: false, message: 'Invalid order data - items are required' });
      return;
    }
    if (!orderData.shippingAddress) {
      res.status(400).json({ success: false, message: 'Shipping address is required' });
      return;
    }

    let paymentOrderId = '';

    if (paymentMethod === 'razorpay') {
      const shortReceipt = `ord_${Date.now().toString().slice(-8)}_${user.id.slice(-8)}`;
      if (shortReceipt.length > 40) throw new Error(`Receipt too long (${shortReceipt.length})`);

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency,
        receipt: shortReceipt,
        notes: {
          userId: user.id,
          orderType: 'product_purchase',
          itemCount: orderData.items.length,
          customerEmail: user.email || 'unknown',
          fullTimestamp: Date.now().toString(),
        },
      });
      paymentOrderId = razorpayOrder.id;
    } else if (paymentMethod === 'cod') {
      paymentOrderId = `cod_${Date.now().toString().slice(-8)}_${user.id.slice(-8)}`;
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment method. Supported: razorpay, cod' });
      return;
    }

    // ---------- BASIC AMOUNTS (subtotal / tax / shipping) ----------
    const fallbackSubtotal =
      typeof orderData.subtotal === 'number'
        ? orderData.subtotal
        : orderData.items.reduce(
            (s: number, it: any) => s + Number(it.price || 0) * Number(it.quantity || 1),
            0
          );

    const subtotal = Math.max(0, Number(fallbackSubtotal));
    // GST INCLUDED inside subtotal — extract only the GST portion
const tax =
  typeof orderData.tax === 'number'
    ? Number(orderData.tax)
    : +(subtotal * 18 / 118).toFixed(2);

    const shipping =
      typeof orderData.shipping === 'number'
        ? Number(orderData.shipping)
        : 0;

    // ---------- CHARGES (COD / online fee) ----------
    const pricing = orderData.pricing || {};
    const chargesInput = orderData.charges || {};

    let onlineFee =
      Number(
        pricing.convenienceFee ??
          pricing.onlineFee ??
          chargesInput.onlineFee ??
          0
      ) || 0;

    let onlineFeeGst =
      Number(
        pricing.convenienceFeeGst ??
          pricing.onlineFeeGst ??
          chargesInput.onlineFeeGst ??
          0
      ) || 0;

    let codCharge =
      Number(
        pricing.codCharges ??
          pricing.codCharge ??
          chargesInput.codCharge ??
          0
      ) || 0;

    // If COD order and codCharge was not explicitly provided, derive it from totals
    if (paymentMethod === 'cod' && codCharge <= 0) {
      const clientTotal =
        typeof orderData.total === 'number'
          ? Number(orderData.total)
          : Number(amount);

      const baseSum = subtotal + tax + shipping + onlineFee + onlineFeeGst;
      const diff = clientTotal - baseSum;

      if (diff > 0) {
        codCharge = diff;
      }
    }

    // ---------- FINAL TOTAL (normalized) ----------
    const total = subtotal + shipping + codCharge + onlineFee + onlineFeeGst;


    // ---------- GST BLOCK ----------
    const gstBlock = buildGstBlock(req.body, orderData.shippingAddress, { subtotal, tax });

    // ---------- CREATE ORDER ----------
    const order = new Order({
      userId: new mongoose.Types.ObjectId(user.id),
      orderNumber: generateOrderNumber(),
      items: orderData.items,
      shippingAddress: orderData.shippingAddress,
      billingAddress: orderData.billingAddress || orderData.shippingAddress,
      paymentMethod,
      paymentOrderId,
      subtotal,
      tax,
      shipping,
      total,
      status: 'pending',
      orderStatus: 'pending',
      paymentStatus: paymentMethod === 'cod' ? 'cod_pending' : 'awaiting_payment',
      gst: gstBlock,
      charges: {
        codCharge: codCharge > 0 ? codCharge : 0,
        onlineFee: onlineFee > 0 ? onlineFee : 0,
        onlineFeeGst: onlineFeeGst > 0 ? onlineFeeGst : 0,
      },
      customerNotes:
        (orderData?.extras?.orderNotes || '').toString().trim() || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await order.save();

    res.json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentOrderId,
      amount: total,
      currency,
      paymentMethod,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        items: order.items,
        gst: order.gst,
        charges: order.charges,
      },
    });
  } catch (error: any) {
    console.error('❌ Payment order creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order',
    });
  }
};

/* ===========================================================================================
   VERIFY PAYMENT — unchanged logic, kept for completeness
=========================================================================================== */
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    const body = req.body || {};
    const paymentId = body.paymentId ?? body.razorpay_payment_id;
    const orderId   = body.orderId   ?? body.razorpay_order_id;
    const signature = body.signature ?? body.razorpay_signature;
    const paymentMethod = body.paymentMethod;

    if (!user) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!paymentId || !orderId || !paymentMethod) {
      res.status(400).json({ success: false, message: 'Missing required payment verification data' });
      return;
    }

    let paymentVerified = false;
    if (paymentMethod === 'razorpay') {
      if (!signature) {
        res.status(400).json({ success: false, message: 'Payment signature is required for Razorpay' });
        return;
      }
      if (!process.env.RAZORPAY_KEY_SECRET) {
        res.status(500).json({ success: false, message: 'Payment gateway misconfiguration' });
        return;
      }
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      paymentVerified = expected === signature;
    } else if (paymentMethod === 'cod') {
      paymentVerified = true;
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment method for verification' });
      return;
    }

    if (!paymentVerified) {
      res.status(400).json({ success: false, message: 'Payment verification failed. Please try again or contact support.' });
      return;
    }

    const order = await Order.findOne({ paymentOrderId: orderId });
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const same = (v: any) => (v && v.toString ? v.toString() : String(v));
    if (same(order.userId) !== same(user.id)) {
      res.status(403).json({ success: false, message: 'Unauthorized access to order' });
      return;
    }

    order.paymentStatus   = paymentMethod === 'cod' ? 'cod_pending' : 'paid';
    order.orderStatus     = 'confirmed';
    order.status          = 'confirmed';
    order.paymentId       = paymentId;
    order.paymentSignature= signature;
    order.paidAt          = new Date();
    order.updatedAt       = new Date();
    await order.save();

    await Payment.findOneAndUpdate(
      { transactionId: paymentId },
      {
        userId: user.id,
        userName: user.name || '',
        userEmail: user.email || '',
        amount: order.total,
        paymentMethod,
        status: 'completed',
        transactionId: paymentId,
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
        paymentId,
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
    if (!order.userId.equals(user.id)) {
      res.status(403).json({ success: false, message: 'Unauthorized access to order' });
      return;
    }

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
  const timestamp = Date.now().toString().slice(-8);
  const userIdShort = userId.slice(-8);
  const receipt = `${prefix}_${timestamp}_${userIdShort}`;
  if (receipt.length > 40) throw new Error(`Receipt too long: ${receipt.length} chars (max 40)`);
  return receipt;
};

export const getTodayPaymentsSummary = async (req: Request, res: Response) => {
  try {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());

    const payments = await Payment.aggregate([
      { $match: { status: 'completed', paymentDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const todayList = await Payment.find({
      status: 'completed',
      paymentDate: { $gte: start, $lte: end },
    }).sort({ paymentDate: -1 });

    res.json({
      success: true,
      totalAmount: payments[0]?.totalAmount || 0,
      count: payments[0]?.count || 0,
      transactions: todayList,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const payments = await Payment.find().sort({ paymentDate: -1 });
    res.json({ success: true, data: payments });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
