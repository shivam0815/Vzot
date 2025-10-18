// src/constants/shiprocketMapper.ts
import { IOrder } from "../models/Order";

const PICKUP_NICKNAME = (process.env.SHIPROCKET_PICKUP_NICKNAME || "Sales Office").trim();

const toIST = (d: Date) =>
  new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace("T"," ").slice(0,16);

const digits = (s: unknown) => String(s ?? "").replace(/\D+/g, "");
const n = (v: any) => {
  const x = typeof v === "string" ? Number(v.replace(/[^\d.-]/g,"")) : Number(v);
  return Number.isFinite(x) ? x : 0;
};

export function mapOrderToShiprocket(order: IOrder) {
  const addr: any = order.shippingAddress || {};
  const [first, ...lastParts] = String(addr.fullName || "").trim().split(/\s+/);
  const isCOD = String(order.paymentMethod).toLowerCase() === "cod";

  const items = (order.items || []).map((it: any) => {
    const prod: any = (it?.productId && typeof it.productId === "object") ? it.productId : {};
    const base = Math.max(1, n(it?.price));                // base price (excl GST)
    const gstPct = n(it?.taxPercent ?? prod?.taxPercent ?? 18);
    const units  = Math.max(1, n(it?.quantity));
    const hsn    = String(it?.hsn ?? prod?.hsn ?? "851762");
    const sku    = String(it?.sku ?? prod?.sku ?? it?.name ?? it?.productId ?? "").trim() || `SKU-${it?.productId || "N/A"}`;

    const perUnitGst = +(base * gstPct / 100).toFixed(2);
    const selling_price = +(base + perUnitGst).toFixed(2); // ✅ GST-inclusive

    return { name: it?.name || "Item", sku, units, selling_price, discount: 0, hsn, tax: gstPct };
  });

  const sub_total = +items.reduce((s, it) => s + it.selling_price * it.units, 0).toFixed(2);
  const tax = +items.reduce((s, it) => s + (it.selling_price / (1 + it.tax/100) * (it.tax/100)) * it.units, 0).toFixed(2); // for reference
  const shipping_charges = +(n((order as any).shipping) || 150).toFixed(2);          // ✅ default ₹150
  const cod_charges = +(isCOD ? (n((order as any).charges?.codCharge) || 25) : 0).toFixed(2); // ✅ default ₹25 for COD
  const total = +(sub_total + shipping_charges + cod_charges).toFixed(2);           // SR totals are item price + extras
  const collectable_amount = +(isCOD ? total : 0).toFixed(2);
  const declared_value = +(sub_total).toFixed(2); // goods value (GST-inclusive)

  return {
    order_id: String(order.orderNumber || order._id),
    order_date: toIST(new Date(order.createdAt ?? Date.now())),
    pickup_location: PICKUP_NICKNAME,
    channel_id: process.env.SHIPROCKET_CHANNEL_ID,

    billing_customer_name: first || "Customer",
    billing_last_name: lastParts.join(" "),
    billing_address: [addr.addressLine1 || "", addr.addressLine2 || ""].filter(Boolean).join(", "),
    billing_city: String(addr.city || ""),
    billing_pincode: digits(addr.pincode),
    billing_state: String(addr.state || ""),
    billing_country: "India",
    billing_email: String(addr.email || "no-reply@example.com"),
    billing_phone: String(addr.phoneNumber || "").replace(/\D+/g, "").replace(/^91(?=\d{10}$)/,""),

    shipping_is_billing: true,

    order_items: items,
    payment_method: isCOD ? "COD" : "Prepaid",

    sub_total,
    tax,                          // informational for you
    shipping_charges,             // ✅ shows as “Shipping” in SR invoice
    discount: 0,
    cod_charges,                  // shows as “Transaction”
    total,

    collectable_amount,
    declared_value,

    length: 12, breadth: 10, height: 4, weight: Math.max(0.25, 0.25 * (order.items?.length || 1)),
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
  for (const k of req) {
    const v = p?.[k];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === ""))
      errs.push(`Missing/empty: ${k}`);
  }

  if (!/^\d{6}$/.test(String(p?.billing_pincode || ""))) errs.push("Invalid billing_pincode");
  if (!/^\d{10}$/.test(String(p?.billing_phone || ""))) errs.push("Invalid billing_phone");

  if (!Array.isArray(p?.order_items) || p.order_items.length === 0)
    errs.push("order_items empty");

  (p?.order_items || []).forEach((it: any, i: number) => {
    if (!String(it?.sku || "").trim()) errs.push(`order_items[${i}].sku missing`);
    if (!(typeof it?.units === "number" && it.units > 0)) errs.push(`order_items[${i}].units invalid`);
    if (!(typeof it?.selling_price === "number" && it.selling_price > 0))
      errs.push(`order_items[${i}].selling_price invalid`);
    if (!String(it?.hsn || "").trim()) errs.push(`order_items[${i}].hsn missing`);
  });

  if (p.payment_method === "COD" && !(p.collectable_amount > 0))
    errs.push("collectable_amount must be > 0 for COD");

  return errs;
}
