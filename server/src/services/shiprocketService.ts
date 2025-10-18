// src/services/shiprocketService.ts
import axios from "axios";

/* -------- Config -------- */
const SR_BASE: string =
  process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external";
const SR_EMAIL: string = process.env.SHIPROCKET_EMAIL || "";
const SR_PASSWORD: string = process.env.SHIPROCKET_PASSWORD || "";
const SR_CHANNEL_ID: string = process.env.SHIPROCKET_CHANNEL_ID || ""; // optional
const SR_PICKUP_NICKNAME: string =
  process.env.SHIPROCKET_PICKUP_NICKNAME || "Sales Office";

if (!SR_EMAIL || !SR_PASSWORD) {
  throw new Error("Shiprocket email/password not set in env");
}

/* -------- Token cache -------- */
let cachedToken: string | null = null;

async function getShiprocketToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const { data } = await axios.post(`${SR_BASE}/auth/login`, {
    email: SR_EMAIL,
    password: SR_PASSWORD,
  });
  if (!data?.token) throw new Error("Shiprocket login failed");
  cachedToken = String(data.token);
  // token valid ~10 days; refresh a bit earlier
  setTimeout(() => {
    cachedToken = null;
  }, 9 * 24 * 60 * 60 * 1000);
  return cachedToken;
}

/* -------- API call helpers -------- */
async function srPost<T = any>(path: string, body: any): Promise<T> {
  const token = await getShiprocketToken();
  const { data } = await axios.post<T>(`${SR_BASE}${path}`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return data;
}

/* -------- Payload builder -------- */
/**
 * Expects `order` to contain:
 * - orderNumber, createdAt
 * - paymentMethod ('cod' | 'razorpay')
 * - subtotal, shipping, tax (or gst.taxAmount)
 * - charges.codCharge (optional)
 * - shippingAddress { fullName, addressLine1, addressLine2, city, state, pincode, email, phoneNumber }
 * - items[] { name, price, quantity, image?, productId?{ hsn, taxPercent, sku } | hsn?, taxPercent?, sku? }
 *
 * Rules:
 * - Each item.tax must be a PERCENT (e.g., 18), not an amount.
 * - Top-level `tax` is the TOTAL GST amount.
 * - COD charge goes in `cod_charges`.
 * - `total = subtotal + tax + shipping + cod_charges`.
 */
export function buildSrPayload(order: any) {
  const addr = order.shippingAddress || {};

  const items = (order.items || []).map((it: any) => {
    const p = it.productId || {};
    const price = Number(it.price) || 0;
    const units = Number(it.quantity) || 1;
    const taxPercent = Number(
      p.taxPercent ?? it.taxPercent ?? order?.gst?.taxPercent ?? 18
    ); // %
    const hsn = String(p.hsn ?? it.hsn ?? "851762"); // fallback HSN
    const sku = String(p.sku ?? it.sku ?? it.name ?? "SKU").slice(0, 30);

    return {
      name: String(it.name ?? sku),
      sku,
      units,
      selling_price: +price.toFixed(2),
      discount: 0,
      hsn,
      tax: +taxPercent, // Shiprocket expects percentage here
    };
  });

  const cod = String(order.paymentMethod || "").toLowerCase() === "cod";
  const codCharges = cod ? Number(order.charges?.codCharge ?? 25) : 0;

  const subTotal = Number(order.subtotal ?? 0);
  const shipping = Number(order.shipping ?? 0);
  const taxAmount = Number(order.gst?.taxAmount ?? order.tax ?? 0);

  const total = +(subTotal + taxAmount + shipping + codCharges).toFixed(2);

  return {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt || Date.now()).toISOString(),
    pickup_location: SR_PICKUP_NICKNAME,
    channel_id: SR_CHANNEL_ID || undefined,

    billing_customer_name: addr.fullName || "Customer",
    billing_last_name: "",
    billing_address: [addr.addressLine1, addr.addressLine2]
      .filter(Boolean)
      .join(", "),
    billing_city: addr.city || "",
    billing_pincode: String(addr.pincode || ""),
    billing_state: addr.state || "",
    billing_country: "India",
    billing_email: addr.email || "no-reply@domain.in",
    billing_phone: String(addr.phoneNumber || "0000000000"),
    shipping_is_billing: true,

    order_items: items,
    payment_method: cod ? "COD" : "Prepaid",

    sub_total: +subTotal.toFixed(2),
    tax: +taxAmount.toFixed(2), // total GST amount for the order
    shipping_charges: +shipping.toFixed(2),
    discount: 0,
    cod_charges: +codCharges.toFixed(2),
    total,

    // basic dims; override from your package data if available
    length: Number(order.shippingPackage?.lengthCm ?? 12),
    breadth: Number(order.shippingPackage?.breadthCm ?? 10),
    height: Number(order.shippingPackage?.heightCm ?? 4),
    weight: Number(order.shippingPackage?.weightKg ?? 0.25),

    comment: order.customerNotes || "",
  };
}

/* -------- Public API -------- */
export async function createShiprocketOrder(payload: any) {
  // Endpoint: /orders/create/adhoc
  return srPost("/orders/create/adhoc", payload);
}

/* Optional helpers (uncomment if needed)
export async function assignAwb(shipmentId: number) {
  return srPost("/courier/assign/awb", { shipment_id: shipmentId });
}
export async function generatePickup(shipmentId: number) {
  return srPost("/courier/generate/pickup", { shipment_id: shipmentId });
}
export async function generateLabel(shipmentId: number) {
  return srPost("/courier/generate/label", { shipment_id: shipmentId });
}
export async function generateInvoice(shipmentId: number) {
  return srPost("/courier/generate/invoice", { shipment_id: shipmentId });
}
export async function generateManifest(shipmentId: number) {
  return srPost("/courier/generate/manifest", { shipment_id: shipmentId });
}
*/
