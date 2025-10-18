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
r.get("/shiprocket/payload/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Order.findById(id)
      .populate({ path: "items.productId", select: "sku hsn taxPercent" })
      .lean();

    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

    const items = Array.isArray(order.items) ? order.items : [];
    const firstProd: any = items[0]?.productId || {};
    const gstPercent = Number(firstProd.taxPercent ?? 18);

    const shippingFee = 150;
    const isCOD = order.paymentMethod === "cod";
    const codCharge = isCOD ? 25 : 0;

    const base = Number(order.subtotal || 100);
    const taxAmount = +(base * (gstPercent / 100)).toFixed(2);
    const total = +(base + taxAmount + shippingFee + codCharge).toFixed(2);

    const payload = {
      order_id: order.orderNumber,
      order_date: new Date(order.createdAt).toISOString().slice(0, 16).replace("T", " "),
      pickup_location: "Sales Office",
      billing_customer_name: order.shippingAddress?.fullName?.split(" ")[0] || "Customer",
      billing_last_name: order.shippingAddress?.fullName?.split(" ").slice(1).join(" ") || "",
      billing_address: order.shippingAddress?.addressLine1 || "",
      billing_city: order.shippingAddress?.city || "",
      billing_pincode: order.shippingAddress?.pincode || "",
      billing_state: order.shippingAddress?.state || "",
      billing_country: "India",
      billing_email: order.shippingAddress?.email || "",
      billing_phone: order.shippingAddress?.phoneNumber || "",
      shipping_is_billing: true,
      order_items: items.map((it: any) => {
        const prod: any = it.productId || {};
        return {
          name: it.name || "Item",
          sku: prod.sku || "",
          units: it.quantity || 1,
          selling_price: base,
          discount: 0,
          hsn: prod.hsn || "851762",
          tax: gstPercent
        };
      }),
      payment_method: isCOD ? "COD" : "Prepaid",
      sub_total: base,
      tax: taxAmount,
      shipping_charges: shippingFee,
      discount: 0,
      cod_charges: codCharge,
      total,
      collectable_amount: total,
      declared_value: +(base + taxAmount).toFixed(2),
      length: 12,
      breadth: 10,
      height: 4,
      weight: 0.25
    };

    return res.json({ ok: true, payload });
  } catch (e) {
    console.error("Shiprocket payload error:", e);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});




/** POST /api/orders/:id/shiprocket/create */
r.post("/orders/:id/shiprocket/create", authenticate, requireAdmin, async (req, res) => {
  try {
    const order = (await findOrderByIdOrNumber(req.params.id)) as IOrder | null;
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    if (order.orderStatus === "cancelled") {
      return res.status(400).json({ ok: false, error: "Order is cancelled" });
    }
    if (!SHIPROCKET_PICKUP_NICKNAME) {
      return res.status(500).json({ ok: false, error: "Pickup nickname not configured. Set SHIPROCKET_PICKUP_NICKNAME in .env" });
    }

    const s = order.shippingAddress as any;
    const phone10 = normalizePhone10(s?.phoneNumber);
    if (!/^\d{10}$/.test(phone10)) {
      return res.status(400).json({ ok: false, error: "Invalid shipping phone (10 digits, no +91)" });
    }
    if (!isSixDigitPin(s?.pincode)) {
      return res.status(400).json({ ok: false, error: "Invalid shipping pincode (must be 6 digits)" });
    }

    const payload = mapOrderToShiprocket(order);
    payload.pickup_location = SHIPROCKET_PICKUP_NICKNAME;
    payload.billing_phone = phone10; // normalized
    payload.billing_pincode = onlyDigits(s.pincode);
    payload.sub_total = Number(payload.sub_total ?? 0);
    (["length", "breadth", "height", "weight"] as const).forEach(
      (k) => (payload[k] = Number(payload[k] ?? 0))
    );

    // -------- address hardening: enforce addr1+addr2 >= 3 chars --------
    function ensureMinAddress(p: any, a1Keys: string[], a2Keys: string[], fallback: string) {
      const get = (keys: string[]) =>
        keys.map((k) => String(p[k] ?? "").trim()).find((v) => v !== "") || "";
      const set = (keys: string[], val: string) => keys.forEach((k) => { if (k in p) p[k] = val; });

      const a1 = get(a1Keys);
      const a2 = get(a2Keys);
      const combo = (a1 + a2).trim();
      if (combo.length >= 3) return;

      const fixed = (a1 || a2 || fallback || "Address Missing").trim();
      set(a1Keys, fixed);
      if (!a2) set(a2Keys, "");
    }

    const cityShip = String((order.shippingAddress as any)?.city || "");
    const cityBill = String((order.billingAddress as any)?.city || "");

    ensureMinAddress(
      payload,
      ["shipping_address", "shipping_address_1", "customer_address", "customer_address_1"],
      ["shipping_address_2", "customer_address_2"],
      cityShip
    );
    ensureMinAddress(
      payload,
      ["billing_address", "billing_address_1"],
      ["billing_address_2"],
      cityBill
    );

    // canonical getters + copy billing->shipping if shipping too short
    const getFirst = (p: any, keys: string[]) =>
      keys.map((k) => String(p[k] ?? "").trim()).find((v) => v) || "";
    const setAll = (p: any, keys: string[], val: string) => { keys.forEach((k) => { p[k] = val; }); };

    const S_A1 = ["shipping_address", "shipping_address_1", "customer_address", "customer_address_1"];
    const S_A2 = ["shipping_address_2", "customer_address_2"];
    const B_A1 = ["billing_address", "billing_address_1"];
    const B_A2 = ["billing_address_2"];

    const s1 = getFirst(payload, S_A1);
    const s2 = getFirst(payload, S_A2);
    const b1 = getFirst(payload, B_A1);
    const b2 = getFirst(payload, B_A2);

    if ((s1 + s2).trim().length < 3 && (b1 + b2).trim().length >= 3) {
      setAll(payload, S_A1, b1);
      setAll(payload, S_A2, b2);
    }

    // final guard before hitting Shiprocket
    const sa1 = getFirst(payload, S_A1);
    const sa2 = getFirst(payload, S_A2);
    const ba1 = getFirst(payload, B_A1);
    const ba2 = getFirst(payload, B_A2);

    if ((sa1 + sa2).trim().length < 3 || (ba1 + ba2).trim().length < 3) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed: address1+address2 must be >= 3 chars",
        debug: { sa1, sa2, ba1, ba2 },
      });
    }
    // -------- end address hardening --------

    const errs = validateShiprocketPayload(payload);
    if (errs.length) {
      return res.status(400).json({ ok: false, error: "Validation failed", errors: errs, payload });
    }

    const sr = await ShiprocketAPI.createAdhocOrder(payload);
    const shipmentId = sr?.shipment_id ?? sr?.response?.shipment_id ?? sr?.data?.shipment_id;
    if (!shipmentId) {
      return res.status(400).json({ ok: false, error: "Shiprocket did not return shipment_id", shiprocket: sr });
    }

    (order as any).shipmentId = shipmentId;
    await order.save();
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
