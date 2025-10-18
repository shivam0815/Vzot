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
    selling_price: Number(it.price),
    discount: 0,
    tax: 0,
  }));

  const cod = order.paymentMethod === "cod";
  const codCharges = cod ? Number(order.charges?.codCharge ?? 25) : 0;

  const subtotal = Number(order.subtotal || 0);
  const shipping = Number(order.shipping || 0);
  const tax = Number(order.tax || 0);
  const total = Number(order.total || subtotal + shipping + tax + codCharges);

  return {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt || Date.now()).toISOString(),
    pickup_location: process.env.SHIPROCKET_PICKUP_NICKNAME || "Sales Office",
    channel_id: process.env.SHIPROCKET_CHANNEL_ID,

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

    sub_total: subtotal,
    shipping_charges: shipping,
    tax,
    discount: 0,
    cod_charges: codCharges,     // shows as “Cash charge”
    total,                       // SR details page shows this

    length: 12, breadth: 10, height: 4, weight: 0.5,
    comment: order.customerNotes || "",
  };
}

