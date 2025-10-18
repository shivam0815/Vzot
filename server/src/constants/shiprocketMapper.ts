// src/constants/shiprocketMapper.ts
import { IOrder } from "../models/Order";

const PICKUP_NICKNAME = (process.env.SHIPROCKET_PICKUP_NICKNAME || "Sales Office").trim();

const toISTDate = (d: Date) =>
  new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace("T", " ").slice(0, 16);

const digits = (s: unknown) => String(s ?? "").replace(/\D+/g, "");
const normalizePhone10 = (raw: unknown) => {
  const only = digits(raw);
  const stripped = only.startsWith("91") && only.length === 12 ? only.slice(2) : only;
  return stripped.slice(-10);
};
const safeEmail = (e: unknown) => (String(e || "").trim() || "no-reply@example.com");
const num = (v: any) => {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function mapOrderToShiprocket(order: IOrder) {
  const items = Array.isArray(order.items) ? order.items : [];
  const totalUnits = items.reduce((n: number, it: any) => n + (num(it?.quantity) || 0), 0);

  const addr = (order.shippingAddress || {}) as any;
  const fullName = String(addr.fullName || "").trim();
  const [first, ...lastParts] = fullName.split(/\s+/);

  // ----- items with HSN + per-unit GST -----
  const order_items = items.map((it: any) => {
    const prod = it?.productId || {};
    const hsn = String(it?.hsn || prod?.hsn || "851762");              // fallback HSN
    const gstPct = Number(it?.taxPercent ?? prod?.taxPercent ?? 18);   // fallback 18%

    const units = Math.max(1, num(it?.quantity));
    const selling_price = Math.max(1, num(it?.price));                 // unit price excluding GST
    const tax = +(selling_price * (gstPct / 100)).toFixed(2);          // GST per unit

    const skuRaw = String(it?.sku ?? prod?.sku ?? it?.name ?? it?.productId ?? "").trim();

    return { name: it?.name || "Item", sku: skuRaw || `SKU-${String(it?.productId || "N/A")}`,
             units, selling_price, discount: 0, hsn, tax };
  });

  // ----- totals -----
  const sub_total = +order_items.reduce((s, it) => s + it.selling_price * it.units, 0).toFixed(2);
  const taxFromItems = +order_items.reduce((s, it) => s + it.tax * it.units, 0).toFixed(2);

  const tax = +(num((order as any).tax) || taxFromItems).toFixed(2);
  const shipping_charges = +num((order as any).shipping).toFixed(2);

  const isCOD = String(order.paymentMethod).toLowerCase() === "cod";
  const cod_charges = +(isCOD ? num((order as any).charges?.codCharge ?? 0) : 0).toFixed(2);

  const total = +( (num((order as any).total) || (sub_total + tax + shipping_charges + cod_charges)) ).toFixed(2);
  const collectable_amount = +(isCOD ? total : 0).toFixed(2);
  const declared_value = +(sub_total + tax).toFixed(2);                // goods value incl. GST, excl. shipping/COD

  return {
    order_id: String(order.orderNumber || order._id),
    order_date: toISTDate(new Date(order.createdAt ?? Date.now())),
    pickup_location: PICKUP_NICKNAME,
    channel_id: process.env.SHIPROCKET_CHANNEL_ID,

    billing_customer_name: first || "Customer",
    billing_last_name: lastParts.join(" "),
    billing_address: [addr.addressLine1 || "", addr.addressLine2 || ""].filter(Boolean).join(", "),
    billing_city: String(addr.city || ""),
    billing_pincode: digits(addr.pincode),
    billing_state: String(addr.state || ""),
    billing_country: "India",
    billing_email: safeEmail(addr.email),
    billing_phone: normalizePhone10(addr.phoneNumber),
    shipping_is_billing: true,

    order_items,
    payment_method: isCOD ? "COD" : "Prepaid",

    sub_total,
    tax,
    shipping_charges,
    discount: 0,
    cod_charges,
    total,

    collectable_amount,
    declared_value,

    length: 12, breadth: 10, height: 4, weight: Math.max(0.25, 0.25 * totalUnits),
  };
}

export function validateShiprocketPayload(p: any): string[] {
  const errs: string[] = [];
  const req = [
    "order_id","order_date","pickup_location","billing_customer_name","billing_address",
    "billing_city","billing_state","billing_country","billing_email","billing_phone",
    "billing_pincode","payment_method","sub_total","tax","shipping_charges","total",
    "declared_value","collectable_amount","length","breadth","height","weight"
  ];
  req.forEach((k) => {
    const v = p?.[k];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) errs.push(`Missing/empty: ${k}`);
  });
  if (!/^\d{6}$/.test(String(p?.billing_pincode || ""))) errs.push("Invalid billing_pincode");
  if (!/^\d{10}$/.test(String(p?.billing_phone || ""))) errs.push("Invalid billing_phone");

  if (!Array.isArray(p?.order_items) || p.order_items.length === 0) errs.push("order_items empty");
  p?.order_items?.forEach((it: any, i: number) => {
    if (!String(it?.sku || "").trim()) errs.push(`order_items[${i}].sku missing`);
    if (!(typeof it?.units === "number" && it.units > 0)) errs.push(`order_items[${i}].units invalid`);
    if (!(typeof it?.selling_price === "number" && it.selling_price > 0)) errs.push(`order_items[${i}].selling_price invalid`);
    if (!String(it?.hsn || "").trim()) errs.push(`order_items[${i}].hsn missing`);
  });

  if (p.payment_method === "COD" && !(p.collectable_amount > 0)) errs.push("collectable_amount must be > 0 for COD");
  return errs;
}
