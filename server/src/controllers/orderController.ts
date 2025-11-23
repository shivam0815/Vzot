

import { Request, Response } from "express";
import mongoose from "mongoose";
import Order, { IOrder } from "../models/Order";
import Cart from "../models/Cart";
import Product from "../models/Product";
import EmailAutomationService from "../config/emailService";
import type {} from "../types/express";
import { buildSrPayload, createShiprocketOrder } from "../services/shiprocketService";



interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}



const cleanGstin = (s?: any) =>
  (s ?? "").toString().toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);


type Addr = {
  fullName?: string; phoneNumber?: string; email?: string;
  addressLine1?: string; addressLine2?: string; city?: string;
  state?: string; pincode?: string; landmark?: string;
};
const normAddr = (a: any = {}): Addr => ({
  fullName: (a?.fullName ?? "").toString().trim(),
  phoneNumber: (a?.phoneNumber ?? "").toString().trim(),
  email: (a?.email ?? "").toString().trim(),
  addressLine1: (a?.addressLine1 ?? "").toString().trim(),
  addressLine2: (a?.addressLine2 ?? "").toString().trim(),
  city: (a?.city ?? "").toString().trim(),
  state: (a?.state ?? "").toString().trim(),
  pincode: (a?.pincode ?? "").toString().trim(),
  landmark: (a?.landmark ?? "").toString().trim(),
});
const addrLen = (a: Addr) =>
  ((a.addressLine1 ?? "") + (a.addressLine2 ?? "")).trim().length;

// ───────── createOrder ─────────
// ───────── createOrder ─────────
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shippingAddress, paymentMethod, billingAddress, extras } = req.body;
    if (!req.user) { res.status(401).json({ message: "User not authenticated" }); return; }
    const userId = (req.user as AuthenticatedUser).id;

    // Load cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || !cart.items?.length) {
      res.status(400).json({ message: "Cart is empty" });
      return;
    }

    // Addresses
    let ship = normAddr(shippingAddress);
    let bill = normAddr(billingAddress);
    if (addrLen(ship) < 3 && addrLen(bill) >= 3) ship = { ...bill };
    if (addrLen(ship) < 3) {
      res.status(400).json({
        ok: false,
        error: "Validation failed: address1+address2 must be >= 3 chars",
        debug: {
          sa1: ship.addressLine1,
          sa2: ship.addressLine2,
          ba1: bill.addressLine1,
          ba2: bill.addressLine2,
        },
      });
      return;
    }
    if (addrLen(bill) < 3) bill = { ...ship };

    // Items
    const orderItems: Array<{
      productId: mongoose.Types.ObjectId;
      name: string;
      price: number;
      quantity: number;
      image: string;
    }> = [];
    let subtotal = 0;
    for (const cartItem of cart.items) {
      const product = cartItem.productId as any;
      if (!product || !product.isActive || !product.inStock) {
        res
          .status(400)
          .json({ message: `Product unavailable: ${product?.name || "Unknown"}` });
        return;
      }
      const stock = Math.max(0, Number(product.stockQuantity ?? 0));
      const desired = Math.max(1, Number(cartItem.quantity) || 1);
      if (stock < 1) {
        res
          .status(400)
          .json({ message: `Insufficient stock for ${product?.name || "item"}.` });
        return;
      }
      const qty = Math.min(desired, stock);
      if (qty < 1) {
        res
          .status(400)
          .json({ message: `Insufficient stock for ${product?.name || "item"}.` });
        return;
      }

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: cartItem.price,
        quantity: qty,
        image: product.images?.[0] || "",
      });
      subtotal += cartItem.price * qty; // subtotal is GST-INCLUSIVE product total
    }

    // Pricing (product prices are GST inclusive)
    const FREE_SHIPPING_THRESHOLD = 2000;
    const SHIPPING_COST = 150;
    const COD_FEE = 25;
    const ONLINE_FEE_RATE = 0.02;     // 2%
    const ONLINE_FEE_GST_RATE = 0.18; // 18% on the fee
    const GST_RATE = 0.18;            // 18% GST on products

    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

    // GST INCLUDED in subtotal:
    // subtotal = taxableValue + GST → GST = subtotal * r / (1 + r)
    const tax = Math.round((subtotal * GST_RATE) / (1 + GST_RATE)); // GST portion only (for display/invoice)
    const taxableValue = subtotal - tax; // value before GST (for GST block)

    const isCOD = paymentMethod === "cod";

    // IMPORTANT: DO NOT add `tax` on top of subtotal; it is already included
    const baseBeforeOnlineFee = subtotal + shipping;

    const onlineFee = isCOD ? 0 : Math.round(baseBeforeOnlineFee * ONLINE_FEE_RATE);
    const onlineFeeGst = isCOD ? 0 : Math.round(onlineFee * ONLINE_FEE_GST_RATE);
    const codCharge = isCOD ? COD_FEE : 0;

    const total = baseBeforeOnlineFee + codCharge + onlineFee + onlineFeeGst;

    // IDs
    const orderNumber = `NK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const paymentOrderId = isCOD ? `cod_${Date.now()}` : undefined;

    // GST block — use taxable value + GST amount
    const gstBlock = buildGstBlock(req.body, ship, {
      subtotal: taxableValue,
      tax,
    });

    // Create order
    const order = new Order({
      userId: new mongoose.Types.ObjectId(userId),
      orderNumber,
      items: orderItems,
      shippingAddress: ship,
      billingAddress: bill,
      paymentMethod,
      paymentOrderId,
      subtotal,        
      tax,               
      total,
      charges: { codCharge, onlineFee, onlineFeeGst },
      status: "pending",
      orderStatus: "pending",
      paymentStatus: isCOD ? "cod_pending" : "awaiting_payment",
      gst: gstBlock,
      customerNotes: (extras?.orderNotes || "").toString().trim() || undefined,
    });

    const savedOrder = await order.save();


    try {
      const srPayload = buildSrPayload(savedOrder); 
      const srRes = await createShiprocketOrder(srPayload);
      await Order.findByIdAndUpdate(savedOrder._id, {
        $set: {
          shipmentId: srRes?.shipment_id ?? undefined,
          shiprocketStatus: "ORDER_CREATED",
          shiprocketOrderId: srRes?.order_id ?? srRes?.orderId ?? undefined,
          shiprocketChannelId:
            srRes?.channel_id ?? process.env.SHIPROCKET_CHANNEL_ID ?? undefined,
          shiprocketResponse: srRes ?? null,
        },
      });
    } catch (e: any) {
      console.error("Shiprocket order create failed:", e?.response?.data || e?.message);
    }

    // Stock deduction
    try {
      for (const item of savedOrder.items) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.productId, stockQuantity: { $gte: item.quantity } },
          { $inc: { stockQuantity: -item.quantity } },
          { new: true }
        ).lean();
        if (!updated) throw new Error("Stock changed for an item during order save");
      }
    } catch {
      await Order.findByIdAndDelete(savedOrder._id);
      res.status(409).json({ message: "Stock changed. Please try again." });
      return;
    }

    // Clear cart
    await Cart.findOneAndDelete({ userId });

    // Emails
    const emailResults = {
      customerEmailSent: false,
      adminEmailSent: false,
      emailError: null as string | null,
    };
    try {
      emailResults.customerEmailSent =
        await EmailAutomationService.sendOrderConfirmation(
          savedOrder as any,
          savedOrder.shippingAddress.email
        );
      emailResults.adminEmailSent =
        await EmailAutomationService.notifyAdminNewOrder(savedOrder as any);
    } catch (e: any) {
      emailResults.emailError = e?.message || "Email error";
    }

    // Sockets
    if (req.io) {
      interface IUserSummary {
        _id: mongoose.Types.ObjectId;
        name?: string;
        email?: string;
      }
      let userDoc: IUserSummary | null = null;
      try {
        userDoc = await mongoose
          .model<IUserSummary>("User")
          .findById(savedOrder.userId)
          .select("name email")
          .lean()
          .exec();
      } catch {}
      const userSummary = {
        _id: savedOrder.userId.toString(),
        name: userDoc?.name || savedOrder.shippingAddress?.fullName,
        email: userDoc?.email || savedOrder.shippingAddress?.email,
      };
      req.io.to("admins").emit("orderCreated", {
        _id: (savedOrder._id as mongoose.Types.ObjectId).toString(),
        orderNumber: savedOrder.orderNumber,
        status: savedOrder.status || savedOrder.orderStatus || "pending",
        orderStatus: savedOrder.orderStatus,
        paymentMethod,
        paymentStatus: savedOrder.paymentStatus,
        total: savedOrder.total,
        items: orderItems,
        userId: userSummary,
        createdAt: savedOrder.createdAt,
        gst: savedOrder.gst,
      });
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: {
        _id: savedOrder._id,
        orderNumber: savedOrder.orderNumber,
        total: savedOrder.total,
        orderStatus: savedOrder.orderStatus,
        paymentStatus: savedOrder.paymentStatus,
        items: orderItems,
        gst: savedOrder.gst,
        charges: (savedOrder as any).charges,
        emailStatus: emailResults,
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};




/* ───────────────── GET USER ORDERS (paginated) ───────────────── */

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const user = req.user as AuthenticatedUser;
    const userId = user.id;

    const query: any = { userId: new mongoose.Types.ObjectId(userId) };
    if (status) query.orderStatus = status;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate("items.productId", "name images price category")
      .lean();

    const totalCount = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalOrders: totalCount,
        hasNextPage: Number(page) < Math.ceil(totalCount / Number(limit)),
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* ───────────────── GET SINGLE ORDER (by user) ───────────────── */

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const user = req.user as AuthenticatedUser;
    const userId = user.id;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
      return;
    }

    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate("items.productId", "name images price category description")
      .lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    res.json({
      success: true,
      order,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* ───────────────── GET ORDER DETAILS (user/admin) ───────────────── */

export const getOrderDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400).json({ success: false, message: "Invalid order ID format" });
      return;
    }

    const isAdmin =
      !!req.user && ["admin", "super_admin"].includes((req.user as any).role);
    const userId = (req.user as any)?.id;

    const query = isAdmin
      ? { _id: new mongoose.Types.ObjectId(orderId) }
      : {
          _id: new mongoose.Types.ObjectId(orderId),
          userId: new mongoose.Types.ObjectId(userId),
        };

    const order = await Order.findOne(query)
      .populate({
        path: "items.productId",
        select: "name images price category description stockQuantity",
      })
      .lean();

    if (!order) {
      res
        .status(404)
        .json({ success: false, message: "Order not found or access denied" });
      return;
    }

    const statusOrder = ["pending", "confirmed", "processing", "shipped", "delivered"];
    const currentStatusIndex = statusOrder.indexOf(order.orderStatus);
    const orderProgress =
      currentStatusIndex >= 0
        ? ((currentStatusIndex + 1) / statusOrder.length) * 100
        : 0;

    res.json({
      success: true,
      order: {
        ...order, // includes gst
        orderProgress,
        canCancel: ["pending", "confirmed"].includes(order.orderStatus),
        canTrack: ["shipped", "out_for_delivery"].includes(order.orderStatus),
        estimatedDelivery:
          order.estimatedDelivery ||
          new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "Failed to fetch order details" });
  }
};

/* ───────────────── UPDATE ORDER STATUS (emails + sockets) ───────────────── */

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, trackingNumber, notes, carrierName, trackingUrl } = req.body;

    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const user = req.user as AuthenticatedUser;
    if (!["admin", "super_admin"].includes(user.role)) {
      res.status(403).json({ message: "Admin access required" });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    const previousStatus = order.orderStatus;

    // Guard: immutable final states
    if (["delivered", "cancelled"].includes(previousStatus)) {
      res
        .status(400)
        .json({ success: false, message: `Order already ${previousStatus}` });
      return;
    }

    // NOTE: We DO NOT deduct stock here (stock was deducted during createOrder)

    // Apply fields
    order.orderStatus = status;
    order.status = status;

    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (carrierName) order.carrierName = carrierName;
    if (trackingUrl) order.trackingUrl = trackingUrl;
    if (notes) order.notes = notes;

    // Timestamps
    switch (status) {
      case "confirmed":
        if (!order.paidAt && order.paymentStatus === "paid")
          order.paidAt = new Date();
        break;
      case "shipped":
        order.shippedAt = new Date();
        break;
      case "delivered":
        order.deliveredAt = new Date();
        break;
      case "cancelled":
        order.cancelledAt = new Date();
        break;
    }

    const updatedOrder = await order.save();

    // Email (non-blocking)
    let emailSent = false;
    try {
      emailSent = await EmailAutomationService.sendOrderStatusUpdate(
        updatedOrder as any,
        previousStatus
      );
    } catch (emailError: any) {
      // swallow email failure
    }

    // Socket pushes
    if (req.io) {
      const payload = {
        _id: updatedOrder._id,
        userId: updatedOrder.userId.toString(),
        orderNumber: updatedOrder.orderNumber,
        orderStatus: updatedOrder.orderStatus,
        trackingNumber: updatedOrder.trackingNumber,
        carrierName: updatedOrder.carrierName,
        trackingUrl: updatedOrder.trackingUrl,
        updatedAt: updatedOrder.updatedAt,
      };
      req.io.to("admins").emit("orderStatusUpdated", payload);
      req.io.to(updatedOrder.userId.toString()).emit("orderStatusUpdated", payload);
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      order: {
        _id: updatedOrder._id,
        orderNumber: updatedOrder.orderNumber,
        orderStatus: updatedOrder.orderStatus,
        trackingNumber: updatedOrder.trackingNumber,
        carrierName: updatedOrder.carrierName,
        trackingUrl: updatedOrder.trackingUrl,
        updatedAt: updatedOrder.updatedAt,
      },
      emailSent,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/* ───────────────── ADMIN: GET ALL ORDERS (filters + summary) ───────────────── */

export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    const user = req.user as AuthenticatedUser;
    if (!["admin", "super_admin"].includes(user.role)) {
      res.status(403).json({ message: "Admin access required" });
      return;
    }

    const query: any = {};

    if (status) query.orderStatus = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "shippingAddress.fullName": { $regex: search, $options: "i" } },
        { "shippingAddress.email": { $regex: search, $options: "i" } },
        { "shippingAddress.phoneNumber": { $regex: search, $options: "i" } },
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate("userId", "name email phone")
      .populate("items.productId", "name images category")
      .lean();

    const totalCount = await Order.countDocuments(query);
    const totalValue = orders.reduce((sum, o: any) => sum + (o.total || 0), 0);

    const statusCounts = await Order.aggregate([
      { $match: query },
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalOrders: totalCount,
        hasNextPage: Number(page) < Math.ceil(totalCount / Number(limit)),
        hasPrevPage: Number(page) > 1,
      },
      summary: {
        totalValue,
        averageOrderValue: totalCount > 0 ? totalValue / totalCount : 0,
        statusBreakdown: statusCounts.reduce((acc: Record<string, number>, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/* ───────────────── CANCEL ORDER (restores stock + email) ───────────────── */

export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;

    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const user = req.user as AuthenticatedUser;
    const userId = user.id;

    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    if (!["pending", "confirmed"].includes(order.orderStatus)) {
      res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      });
      return;
    }

    const previousStatus = order.orderStatus;

    // Mark cancelled
    order.orderStatus = "cancelled";
    order.status = "cancelled";
    order.cancelledAt = new Date();
    (order as any).customerNotes = reason || "Cancelled by customer";

    // Restore inventory (since we deducted on create)
    try {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stockQuantity: item.quantity },
        });
      }
    } catch {
      // non-blocking
    }

    const cancelledOrder = await order.save();

    // Email (non-blocking)
    let emailSent = false;
    try {
      emailSent = await EmailAutomationService.sendOrderStatusUpdate(
        cancelledOrder as any,
        previousStatus
      );
    } catch {
      // swallow email failure
    }

    res.json({
      success: true,
      message: "Order cancelled successfully",
      order: {
        _id: cancelledOrder._id,
        orderNumber: cancelledOrder.orderNumber,
        orderStatus: cancelledOrder.orderStatus,
        cancelledAt: cancelledOrder.cancelledAt,
        customerNotes: (cancelledOrder as any).customerNotes,
      },
      emailSent,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/* ───────────────── TRACK ORDER (customer view) ───────────────── */

export const trackOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
      return;
    }

    const order = await Order.findById(orderId)
      .populate("items.productId", "name images")
      .lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    const timeline = [
      {
        status: "Order Placed",
        date: order.createdAt,
        completed: true,
        description: "Your order has been placed successfully",
      },
      {
        status: "Order Confirmed",
        date: (order as any).paidAt,
        completed: !!(order as any).paidAt,
        description: "Your order has been confirmed and is being processed",
      },
      {
        status: "Shipped",
        date: (order as any).shippedAt,
        completed: !!(order as any).shippedAt,
        description: order.trackingNumber
          ? `Shipped with tracking: ${order.trackingNumber}`
          : "Your order has been shipped",
      },
      {
        status: "Delivered",
        date: (order as any).deliveredAt,
        completed: !!(order as any).deliveredAt,
        description: "Your order has been delivered successfully",
      },
    ];

    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        trackingNumber: order.trackingNumber,
        carrierName: (order as any).carrierName,
        estimatedDelivery: (order as any).estimatedDelivery,
        items: order.items,
      },
      timeline,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/* ───────────────── SEND TEST EMAILS (admin) ───────────────── */

export const sendTestOrderEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    const user = req.user as AuthenticatedUser;
    if (!["admin", "super_admin"].includes(user.role)) {
      res.status(403).json({ message: "Admin access required" });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    const customerEmailSent = await EmailAutomationService.sendOrderConfirmation(
      order as any,
      order.shippingAddress.email
    );
    const adminEmailSent = await EmailAutomationService.notifyAdminNewOrder(
      order as any
    );

    res.json({
      success: true,
      message: "Test emails sent successfully",
      results: {
        customerEmailSent,
        adminEmailSent,
        orderNumber: order.orderNumber,
        customerEmail: order.shippingAddress.email,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Email test failed",
      error: error.message,
    });
  }
};

/* ───────────────── ADMIN: GET ORDER BY ID ───────────────── */

export const getOrderByIdAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const role = (req.user as any).role;
    if (!["admin", "super_admin"].includes(role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid order ID format" });
    }

    const order = await Order.findById(id)
      .populate("items.productId", "name images price category description")
      .lean();

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (e: any) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

function buildGstBlock(
  payload: any,
  shippingAddress: any,
  computed: { subtotal: number; tax: number }
) {
  const ex = payload?.extras || {};

  const rawGstin =
    ex.gstin ??
    ex.gstNumber ??
    ex.gst?.gstin ??
    ex.gst?.gstNumber ??
    payload.gstin ??
    payload.gstNumber ??
    payload.gst?.gstin;
  const gstin = cleanGstin(rawGstin);

  const wantInvoice =
    Boolean(
      ex.wantGSTInvoice ??
        ex.gst?.wantInvoice ??
        payload.needGSTInvoice ??
        payload.needGstInvoice ??
        payload.gst?.wantInvoice ??
        payload.gst?.requested
    ) || !!gstin;

  const taxPercent =
    Number(payload?.pricing?.gstPercent ?? payload?.pricing?.taxRate) ||
    (computed.subtotal > 0 ? Math.round((computed.tax / computed.subtotal) * 100) : 0);

  const clientRequestedAt =
    ex.gst?.requestedAt ?? payload.gst?.requestedAt ?? ex.requestedAt ?? payload.requestedAt;
  const requestedAt = clientRequestedAt ? new Date(clientRequestedAt) : wantInvoice ? new Date() : undefined;

  return {
    wantInvoice,
    gstin: gstin || undefined,
    legalName:
      (ex.gst?.legalName ??
        ex.gstLegalName ??
        payload.gst?.legalName ??
        shippingAddress?.fullName)?.toString().trim() || undefined,
    placeOfSupply:
      (ex.gst?.placeOfSupply ??
        ex.placeOfSupply ??
        payload.gst?.placeOfSupply ??
        shippingAddress?.state)?.toString().trim() || undefined,
    taxPercent,
    taxBase: computed.subtotal || 0,
    taxAmount: computed.tax || 0,
    requestedAt,
    email:
      (ex.gst?.email ?? payload.gst?.email ?? shippingAddress?.email)?.toString().trim() ||
      undefined,
  };
}
