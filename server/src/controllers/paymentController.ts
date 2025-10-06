import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import axios from "axios";
import Order from "../models/Order";
import Cart from "../models/Cart";
import Payment from "../models/Payment";
import { startOfDay, endOfDay } from "date-fns";

interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
  isVerified?: boolean;
}

/* ----------------------- ENV VARS ----------------------- */
const ENV = (process.env.PHONEPE_ENV || "sandbox").toLowerCase();
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID!;
const SALT_KEY = process.env.PHONEPE_SALT_KEY!;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
const BASE_URL =
  ENV === "production"
    ? process.env.PHONEPE_BASE_URL_PROD || "https://api.phonepe.com/apis/hermes"
    : process.env.PHONEPE_BASE_URL_SANDBOX || "https://api-preprod.phonepe.com/apis/hermes";
const REDIRECT_URL = process.env.PHONEPE_REDIRECT_URL!;
const CALLBACK_URL = process.env.PHONEPE_CALLBACK_URL!;

/* ----------------------- HELPERS ----------------------- */
const sha256Hex = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const cleanGstin = (s?: any) =>
  (s ?? "").toString().toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);

function buildGstBlock(payload: any, shippingAddress: any, computed: { subtotal: number; tax: number }) {
  const ex = payload?.orderData?.extras ?? {};
  const gstin = cleanGstin(ex?.gstin);
  const wantInvoice = Boolean(ex?.wantGSTInvoice) || !!gstin;
  return {
    wantInvoice,
    gstin: gstin || undefined,
    legalName: shippingAddress?.fullName || undefined,
    placeOfSupply: shippingAddress?.state || undefined,
    taxPercent: Math.round((computed.tax / computed.subtotal) * 100) || 18,
    taxBase: computed.subtotal,
    taxAmount: computed.tax,
  };
}

const generateOrderNumber = (): string => {
  const ts = Date.now();
  const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `ORD${ts}${rnd}`;
};

/* ===========================================================================================
   CREATE PAYMENT ORDER (PhonePe + COD)
=========================================================================================== */
export const createPaymentOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, currency = "INR", paymentMethod, orderData } = req.body;
    const user = req.user as AuthenticatedUser;

    if (!user) return void res.status(401).json({ success: false, message: "User not authenticated" });
    if (!(Number(amount) > 0))
      return void res.status(400).json({ success: false, message: "Invalid amount" });
    if (!orderData?.items?.length)
      return void res.status(400).json({ success: false, message: "No order items provided" });
    if (!orderData.shippingAddress)
      return void res.status(400).json({ success: false, message: "Shipping address missing" });

    let paymentOrderId = "";
    let phonepeRedirect: string | undefined;

    /* ------------------ PHONEPE ------------------ */
    if (paymentMethod === "phonepe") {
      const orderId = `ORD-${Date.now()}`;
      const raw = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: orderId,
        merchantUserId: user.id,
        amount: Math.round(Number(amount) * 100),
        redirectUrl: REDIRECT_URL,
        callbackUrl: CALLBACK_URL,
        paymentInstrument: { type: "PAY_PAGE" },
      };

      const b64 = Buffer.from(JSON.stringify(raw)).toString("base64");
      const path = "/checkout/v2/pay";
      const xVerify = `${sha256Hex(b64 + path + SALT_KEY)}###${SALT_INDEX}`;
      const headers = {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify,
        "X-MERCHANT-ID": MERCHANT_ID,
      };

      console.log("▶️ PhonePe PAY call", {
        base: BASE_URL,
        path,
        env: ENV,
        merchantId: MERCHANT_ID,
        amountPaise: raw.amount,
        redirect: REDIRECT_URL,
        callback: CALLBACK_URL,
      });

      const { data } = await axios.post(`${BASE_URL}${path}`, { request: b64 }, { headers, timeout: 15000 });

      console.log("📩 PhonePe raw response:", data);

      if (!(data && (data.success === true || data.code === "PAYMENT_INITIATED"))) {
        throw Object.assign(new Error("PhonePe init failed"), { response: { data } });
      }

      paymentOrderId = orderId;
      phonepeRedirect =
        data?.data?.instrumentResponse?.redirectInfo?.url ||
        data?.data?.instrumentResponse?.intentUrl;
    }

    /* ------------------ COD ------------------ */
    else if (paymentMethod === "cod") {
      paymentOrderId = `COD_${Date.now().toString().slice(-8)}_${user.id.slice(-6)}`;
    } else {
      return void res
        .status(400)
        .json({ success: false, message: "Invalid payment method. Supported: phonepe, cod" });
    }

    const subtotal =
      typeof orderData.subtotal === "number"
        ? orderData.subtotal
        : orderData.items.reduce(
            (s: number, it: any) => s + Number(it.price || 0) * Number(it.quantity || 1),
            0
          );
    const tax = orderData.tax ?? Math.round(subtotal * 0.18);
    const shipping = orderData.shipping ?? 0;
    const total = orderData.total ?? amount;

    const gstBlock = buildGstBlock(req.body, orderData.shippingAddress, { subtotal, tax });

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
      gst: gstBlock,
      status: "pending",
      orderStatus: "pending",
      paymentStatus: paymentMethod === "cod" ? "cod_pending" : "awaiting_payment",
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
      phonepeRedirect,
    });
  } catch (error: any) {
    console.error("❌ Payment order creation error");
    if (error.response) console.error("📡 PhonePe responded:", error.response.data);
    else if (error.request) console.error("🚫 No response from PhonePe");
    else console.error("💥 Setup error:", error.message);

    res.status(500).json({
      success: false,
      message: error.message || "Payment order creation failed",
      debug: {
        env: ENV,
        base: BASE_URL,
        redirect: REDIRECT_URL,
        callback: CALLBACK_URL,
        merchantId: MERCHANT_ID,
      },
    });
  }
};

/* ===========================================================================================
   VERIFY PAYMENT — PhonePe: GET /checkout/v2/order/:mtx/status
=========================================================================================== */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser;
    const { orderId, paymentMethod } = req.body;

    if (!user) return void res.status(401).json({ success: false, message: "User not authenticated" });
    if (!orderId) return void res.status(400).json({ success: false, message: "Missing orderId" });

    let paymentVerified = false;

    if (paymentMethod === "phonepe") {
      const path = `/checkout/v2/order/${orderId}/status`;
      const xVerify = `${sha256Hex(path + SALT_KEY)}###${SALT_INDEX}`;
      const headers = { "X-VERIFY": xVerify, "X-MERCHANT-ID": MERCHANT_ID };

      const { data } = await axios.get(`${BASE_URL}${path}`, { headers, timeout: 10000 });
      console.log("📦 PhonePe verify response:", data);

      const status = data?.data?.status;
      paymentVerified = status === "SUCCESS";
    } else if (paymentMethod === "cod") {
      paymentVerified = true;
    }

    const order = await Order.findOne({ paymentOrderId: orderId });
    if (!order) return void res.status(404).json({ success: false, message: "Order not found" });

    if (!paymentVerified) return void res.json({ success: false, message: "Payment pending" });

    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.status = "confirmed";
    order.paidAt = new Date();
    await order.save();

    await Payment.findOneAndUpdate(
      { transactionId: order.paymentOrderId },
      {
        userId: user.id,
        userName: user.name || "",
        userEmail: user.email || "",
        amount: order.total,
        paymentMethod,
        status: "completed",
        transactionId: order.paymentOrderId,
        orderId: order.id.toString(),
        paymentDate: new Date(),
      },
      { upsert: true }
    );

    await Cart.findOneAndDelete({ userId: user.id });

    res.json({ success: true, message: "Payment verified successfully!", order });
  } catch (error: any) {
    console.error("❌ verifyPayment error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===========================================================================================
   GET PAYMENT STATUS + ADMIN LISTINGS
=========================================================================================== */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("items.productId");
    if (!order) return void res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, order });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTodayPaymentsSummary = async (_req: Request, res: Response) => {
  try {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    const agg = await Payment.aggregate([
      { $match: { status: "completed", paymentDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    res.json({
      success: true,
      totalAmount: agg[0]?.totalAmount || 0,
      count: agg[0]?.count || 0,
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
