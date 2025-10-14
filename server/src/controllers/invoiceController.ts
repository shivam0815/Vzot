// src/controllers/invoiceController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/Order";
import { createInvoicePdfStream } from "../config/generateInvoicePdf";

const isAdmin = (req: Request) =>
  !!req.user && ["admin", "super_admin"].includes((req.user as any).role);

const sellerFromEnv = () => ({
  name: (process.env.STORE_NAME || "Your Store").trim(),
  addressLines: (process.env.STORE_ADDRESS_LINES || "Street, City|State, PIN|India")
    .split("|")
    .map(s => s.trim())
    .filter(Boolean),
  gstin: (process.env.STORE_GSTIN || "").trim() || undefined,
  cin: (process.env.STORE_CIN || "").trim() || undefined,
  supportEmail: (process.env.STORE_SUPPORT_EMAIL || "").trim() || undefined,
  supportPhone: (process.env.STORE_SUPPORT_PHONE || "").trim() || undefined,
});

export const getInvoicePdf = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "Invalid order id" });
    }
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

    const sameUser =
      String(order.userId) === String((req.user as any).id);
    if (!sameUser && !isAdmin(req)) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

    const invOrder = {
      _id: order._id,
      orderNumber: order.orderNumber,
      invoiceNumber: (order as any).invoiceNumber,
      createdAt: order.createdAt,
      items: order.items?.map((it: any) => ({
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        hsn: (it as any).hsn || (it as any).hsnCode || "",
        sku: (it as any).sku || "",
      })) || [],
      subtotal: order.subtotal || 0,
      shipping: order.shipping || 0,
      tax: order.tax || 0,
      total: order.total || 0,
      paymentMethod: order.paymentMethod,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress || order.shippingAddress,
      gst: order.gst, // already built in your createOrder
    };

    const seller = sellerFromEnv();
    const { stream, filename } = createInvoicePdfStream(invOrder as any, seller);

    const disposition = (String(req.query.disposition || "attachment").toLowerCase() === "inline")
      ? "inline"
      : "attachment";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    stream.pipe(res);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "Failed to generate invoice" });
  }
};
