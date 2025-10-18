import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Order, { IOrder } from "../models/Order";
import { ShiprocketAPI } from "../constants/shiprocketClient";
import { mapOrderToShiprocket, validateShiprocketPayload } from "../constants/shiprocketMapper";
import { authenticate } from "../middleware/auth";

const SHIPROCKET_PICKUP_NICKNAME = (process.env.SHIPROCKET_PICKUP_NICKNAME || "").trim();

/* ───────────────── Utils ───────────────── */
function firstNonEmpty<T = any>(...vals: any[]): T | undefined {
  for (const v of vals) {
    if (Array.isArray(v)) {
      if (v.length) return v[0] as T;
    } else if (v !== undefined && v !== null && (typeof v !== "string" || v.trim() !== "")) {
      return v as T;
    }
  }
  return undefined;
}

function extractAwbAndCourier(sr: any): { awb?: string; courier?: string } {
  const awb = firstNonEmpty<string>(
    sr?.awb_code,
    sr?.response?.awb_code,
    sr?.response?.data?.awb_code,
    sr?.data?.awb_code,
    sr?.awb_data?.[0]?.awb_code,
    sr?.response?.data?.awb_data?.[0]?.awb_code,
    sr?.data?.response?.awb_data?.[0]?.awb_code
  );

  const courier = firstNonEmpty<string>(
    sr?.courier_name,
    sr?.response?.courier_name,
    sr?.response?.data?.courier_name,
    sr?.data?.courier_name,
    sr?.awb_data?.[0]?.courier_name,
    sr?.response?.data?.awb_data?.[0]?.courier_name,
    sr?.data?.response?.awb_data?.[0]?.courier_name
  );

  return { awb, courier };
}

function isAdmin(req: Request) {
  const role = (req.user as any)?.role;
  return role === "admin" || role === "super_admin";
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  if (!isAdmin(req)) return res.status(403).json({ error: "Admin access required" });
  return next();
}

async function findOrderByIdOrNumber(idOrNumber: string) {
  if (mongoose.Types.ObjectId.isValid(idOrNumber)) return Order.findById(idOrNumber);
  return Order.findOne({ orderNumber: idOrNumber });
}

function pickSRerr(e: any) {
  const status = e?.response?.status ?? e?.status ?? null;
  const rawMsg =
    e?.response?.data?.message ??
    e?.response?.data?.error ??
    e?.message ??
    "Shiprocket error";

  const message = /too many failed login attempts/i.test(String(rawMsg))
    ? "Shiprocket temporarily locked due to repeated login failures. Try again in ~30 minutes."
    : String(rawMsg);

  return { status, message, details: e?.response?.data ?? null };
}

const onlyDigits = (s: any) => String(s ?? "").replace(/\D+/g, "");
const normalizePhone10 = (raw: any) => {
  const d = onlyDigits(raw);
  const trimmed = d.startsWith("91") && d.length === 12 ? d.slice(2) : d;
  return trimmed.slice(-10);
};
const isSixDigitPin = (p: any) => /^\d{6}$/.test(String(p || ""));

/* ───────────────── Router ───────────────── */
const r = Router();

/** GET /api/shiprocket/env */
r.get("/shiprocket/env", (_req, res) => {
  res.json({
    base: (process.env.SHIPROCKET_BASE_URL || "").trim(),
    hasEmail: !!process.env.SHIPROCKET_EMAIL,
    hasPassword: !!process.env.SHIPROCKET_PASSWORD,
    pickupNickname: SHIPROCKET_PICKUP_NICKNAME || "(not set)",
  });
});

/** GET /api/shiprocket/serviceability */
r.get("/shiprocket/serviceability", async (req, res) => {
  try {
    const codParam = String(req.query.cod ?? "").toLowerCase();
    const cod = codParam === "1" || codParam === "true" ? 1 : 0;

    const weight = Number(req.query.weight ?? 0.5);
    if (!isFinite(weight) || weight <= 0) {
      return res.status(400).json({ ok: false, error: "weight must be a positive number (kg)" });
    }

    const data = await ShiprocketAPI.serviceability({
      pickup_postcode: String(req.query.pickup_postcode || ""),
      delivery_postcode: String(req.query.delivery_postcode || ""),
      weight,
      cod,
      declared_value: Number(req.query.declared_value ?? 0),
      mode: String(req.query.mode || "Surface") as "Air" | "Surface",
    });
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});


/** GET /api/shiprocket/payload/:id */
// replace the current payload route

/** GET /api/shiprocket/payload/:id */
r.get("/shiprocket/payload/:id", async (req, res) => {
  const id = req.params.id;

  // populate to access product.sku/hsn/taxPercent
  const order = await Order.findById(id)
    .populate("items.productId", "sku hsn taxPercent")
    .lean();

  if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

  // default shipping if missing
  if (!order.shipping || order.shipping === 0) (order as any).shipping = 150;

  const payload = mapOrderToShiprocket(order as any);
  return res.json({ ok: true, payload });
});


/** POST /api/orders/:id/shiprocket/create */
r.post("/orders/:id/shiprocket/create", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    // populate to access product.sku/hsn/taxPercent
    const orderDoc = await Order.findById(id).populate("items.productId", "sku hsn taxPercent");
    if (!orderDoc) return res.status(404).json({ ok: false, error: "Order not found" });
    if (orderDoc.orderStatus === "cancelled")
      return res.status(400).json({ ok: false, error: "Order is cancelled" });
    if (!SHIPROCKET_PICKUP_NICKNAME)
      return res.status(500).json({ ok: false, error: "Pickup nickname not configured. Set SHIPROCKET_PICKUP_NICKNAME in .env" });

    // phone + pincode checks
    const s: any = orderDoc.shippingAddress || {};
    const phone10 = normalizePhone10(s?.phoneNumber);
    if (!/^\d{10}$/.test(phone10))
      return res.status(400).json({ ok: false, error: "Invalid shipping phone (10 digits, no +91)" });
    if (!isSixDigitPin(s?.pincode))
      return res.status(400).json({ ok: false, error: "Invalid shipping pincode (must be 6 digits)" });

    // ensure shipping default before mapping
    const lean = orderDoc.toObject() as any;
    if (!lean.shipping || lean.shipping === 0) lean.shipping = 150;

    const payload = mapOrderToShiprocket(lean);
    payload.pickup_location = SHIPROCKET_PICKUP_NICKNAME;
    payload.billing_phone = phone10;
    payload.billing_pincode = onlyDigits(s.pincode);

    // minimal address hardening
    const addrOK = (a: string = "", b: string = "") => (a + b).trim().length >= 3;
    const s1 = String((payload as any).shipping_address || (payload as any).shipping_address_1 || "");
    const s2 = String((payload as any).shipping_address_2 || "");
    const b1 = String((payload as any).billing_address || (payload as any).billing_address_1 || "");
    const b2 = String((payload as any).billing_address_2 || "");

    if (!addrOK(s1, s2) && addrOK(b1, b2)) {
      (payload as any).shipping_address = b1;
      (payload as any).shipping_address_1 = b1;
      (payload as any).shipping_address_2 = b2;
      (payload as any).customer_address = b1;
      (payload as any).customer_address_1 = b1;
      (payload as any).customer_address_2 = b2;
    }
    if (!addrOK(b1, b2))
      return res.status(400).json({ ok: false, error: "Validation failed: address1+address2 must be >= 3 chars" });

    const errs = validateShiprocketPayload(payload);
    if (errs.length) return res.status(400).json({ ok: false, error: "Validation failed", errors: errs, payload });

    const sr = await ShiprocketAPI.createAdhocOrder(payload);
    const shipmentId = sr?.shipment_id ?? sr?.response?.shipment_id ?? sr?.data?.shipment_id;
    if (!shipmentId)
      return res.status(400).json({ ok: false, error: "Shiprocket did not return shipment_id", shiprocket: sr });

    orderDoc.shipmentId = shipmentId;
    await orderDoc.save();
    res.json({ ok: true, shipmentId, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});


/** POST /api/orders/:id/shiprocket/assign-awb */
r.post("/orders/:id/shiprocket/assign-awb", authenticate, requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order. Create Shiprocket order first." });
    if (order.orderStatus === "cancelled") return res.status(400).json({ ok: false, error: "Order is cancelled" });

    let { courier_id } = req.body || {};
    if (courier_id != null && Number.isNaN(Number(courier_id))) {
      return res.status(400).json({ ok: false, error: "courier_id must be a number" });
    }

    let sr;
    try {
      sr = await ShiprocketAPI.assignAwb({ shipment_id: (order as any).shipmentId, courier_id });
    } catch (e: any) {
      const msg = e?.message || e?.response?.data?.message || "";
      if (!courier_id && /courier/i.test(msg)) {
        const s = order.shippingAddress as any;
        const data = await ShiprocketAPI.serviceability({
          pickup_postcode: process.env.SHIPROCKET_PICKUP_PINCODE || "",
          delivery_postcode: String(s?.pincode || ""),
          weight: 0.5,
          cod: order.paymentMethod === "cod" ? 1 : 0,
          declared_value: Math.max(1, Number(order.total || 0)),
          mode: "Surface",
        });
        const recId =
          data?.data?.recommended_courier_company_id ||
          data?.recommended_courier_company_id ||
          data?.courier_company_id;
        const firstAvailable =
          data?.data?.available_courier_companies?.[0]?.courier_company_id ||
          data?.available_courier_companies?.[0]?.courier_company_id ||
          recId;

        if (firstAvailable) {
          sr = await ShiprocketAPI.assignAwb({
            shipment_id: (order as any).shipmentId,
            courier_id: Number(firstAvailable),
          });
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

    const { awb, courier } = extractAwbAndCourier(sr);
    if (!awb) {
      return res.status(400).json({ ok: false, error: "AWB not returned by Shiprocket", shiprocket: sr });
    }

    (order as any).awbCode = awb.toUpperCase();
    if (courier) (order as any).courierName = courier;
    (order as any).shiprocketStatus = "AWB_ASSIGNED";
    await order.save();

    res.json({ ok: true, awbCode: (order as any).awbCode, courierName: (order as any).courierName || null, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/** POST /api/orders/:id/shiprocket/pickup */
r.post("/orders/:id/shiprocket/pickup", authenticate, requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order." });
    if (order.orderStatus === "cancelled") return res.status(400).json({ ok: false, error: "Order is cancelled" });

    const sr = await ShiprocketAPI.generatePickup({ shipment_id: [(order as any).shipmentId] });
    (order as any).pickupRequestedAt = new Date();
    await order.save();

    res.json({ ok: true, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/** POST /api/orders/:id/shiprocket/label */
r.post("/orders/:id/shiprocket/label", authenticate, requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order." });

    const sr = await ShiprocketAPI.generateLabel({ shipment_id: [(order as any).shipmentId] });
    const url = sr?.label_url ?? sr?.response?.data?.label_url ?? sr?.data?.label_url;

    if (url) {
      (order as any).labelUrl = url;
      await order.save();
    }

    res.json({ ok: true, labelUrl: url || null, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/** POST /api/orders/:id/shiprocket/invoice */
r.post("/orders/:id/shiprocket/invoice", authenticate, requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order." });

    const sr = await ShiprocketAPI.printInvoice({ ids: [(order as any).shipmentId] });
    const url = sr?.invoice_url ?? sr?.response?.data?.invoice_url ?? sr?.data?.invoice_url;

    if (url) {
      (order as any).invoiceUrl = url;
      await order.save();
    }

    res.json({ ok: true, invoiceUrl: url || null, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/** POST /api/orders/:id/shiprocket/manifest */
r.post("/orders/:id/shiprocket/manifest", authenticate, requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (!(order as any).shipmentId) return res.status(400).json({ ok: false, error: "No shipmentId on order." });

    await ShiprocketAPI.generateManifest({ shipment_id: [(order as any).shipmentId] });
    const sr = await ShiprocketAPI.printManifest({ shipment_id: [(order as any).shipmentId] });
    const url = sr?.manifest_url ?? sr?.response?.data?.manifest_url ?? sr?.data?.manifest_url;

    if (url) {
      (order as any).manifestUrl = url;
      await order.save();
    }

    res.json({ ok: true, manifestUrl: url || null, shiprocket: sr });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

/** GET /api/shiprocket/track/:awb */
r.get("/shiprocket/track/:awb", authenticate, requireAdmin, async (req, res) => {
  try {
    const data = await ShiprocketAPI.trackByAwb(req.params.awb);
    res.json({ ok: true, data });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: pickSRerr(e) });
  }
});

export default r;
