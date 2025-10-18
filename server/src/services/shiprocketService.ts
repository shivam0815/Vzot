// src/services/shiprocketService.ts
import axios from "axios";

const SR_BASE = process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external";
const SR_TOKEN = process.env.SHIPROCKET_TOKEN;            // use your saved token
const SR_CHANNEL_ID = process.env.SHIPROCKET_CHANNEL_ID;  // “Custom (5903066)” etc.



const client = axios.create({
  baseURL: SR_BASE,
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${SR_TOKEN}` },
});

export async function createShiprocketOrder(payload: any) {
  // SR expects /orders/create/adhoc
  const { data } = await client.post("/orders/create/adhoc", payload);
  return data;
}

/** Build SR payload with tax/shipping/COD shown correctly */
export function buildSrPayload(order: any) {
  const addr = order.shippingAddress || {};
  const items = (order.items || []).map((it: any) => ({
    name: it.name,
    sku: (it.productId?.sku || it.sku || it.name).slice(0, 30),
    units: it.quantity,
    selling_price: Number(it.price), // pre-tax unit price
    discount: 0,
    tax: 0, // per-item not used; we pass total tax below
  }));

  const cod = order.paymentMethod === "cod";
  const codFeePct = Number(process.env.SHIPROCKET_COD_PCT || 0);   // e.g. 1.5
  const codFeeMin = Number(process.env.SHIPROCKET_COD_MIN || 0);   // e.g. 30
  const codCharges = cod
    ? Math.max(codFeeMin, Math.round((order.total) * codFeePct / 100))
    : 0;

  return {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt || Date.now()).toISOString(),
    pickup_location: process.env.SHIPROCKET_PICKUP || "Sales Office",
    channel_id: SR_CHANNEL_ID,
    billing_customer_name: addr.fullName || "Customer",
    billing_last_name: "",
    billing_address: (addr.addressLine1 || "") + (addr.addressLine2 ? `, ${addr.addressLine2}` : ""),
    billing_city: addr.city || "",
    billing_pincode: addr.pincode || "",
    billing_state: addr.state || "",
    billing_country: "India",
    billing_email: addr.email || "no-reply@domain.in",
    billing_phone: addr.phoneNumber || "0000000000",
    shipping_is_billing: true,

    order_items: items,

    payment_method: cod ? "COD" : "Prepaid",

    sub_total: Number(order.subtotal),             // ₹870
    shipping_charges: Number(order.shipping || 150), // ₹0 or actual
    tax: Number(order.tax || 0),                   // ₹157 → shows as GST
    discount: Number(order.discount || 0),
    cod_charges: codCharges,                       // shows “Cash charge”
    total: Number(order.subtotal + order.shipping + order.tax + codCharges), // ₹1202 (+COD if any)

    length: 12, breadth: 10, height: 4, weight: 0.5, // default; override if you store per-order
    comment: order.customerNotes || "",
  };
}
