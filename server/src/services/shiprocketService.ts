// src/services/shiprocketService.ts
import axios from "axios";

const SR_BASE = process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external";
const SR_EMAIL = process.env.SHIPROCKET_EMAIL;
const SR_PASSWORD = process.env.SHIPROCKET_PASSWORD;

let cachedToken: string | null = null;

async function getShiprocketToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const { data } = await axios.post(`${SR_BASE}/auth/login`, {
    email: SR_EMAIL,
    password: SR_PASSWORD,
  });
  cachedToken = data.token;
  // token valid for 10 days
  setTimeout(() => (cachedToken = null), 1000 * 60 * 60 * 24 * 9);
  return cachedToken!;

}

export async function createShiprocketOrder(payload: any) {
  const token = await getShiprocketToken();
  const { data } = await axios.post(`${SR_BASE}/orders/create/adhoc`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return data;
}


/** Build SR payload with tax/shipping/COD shown correctly */
// src/services/shiprocketService.ts
export function buildSrPayload(order: any) {
  const addr = order.shippingAddress || {};
  const items = (order.items || []).map((it: any) => {
    const product = it.productId || {};
    const hsn = product.hsn || it.hsn || "851762";  // default electronics HSN
    const taxPercent = product.taxPercent || 18;   // default GST 18%

    const price = Number(it.price) || 0;
    const taxValue = +(price * (taxPercent / 100)).toFixed(2);

    return {
      name: it.name,
      sku: (product.sku || it.sku || it.name).slice(0, 30),
      units: Number(it.quantity) || 1,
      selling_price: price,
      discount: 0,
      hsn,
      tax: taxValue,
    };
  });

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
    cod_charges: codCharges,
    total,

    length: 12,
    breadth: 10,
    height: 4,
    weight: 0.25,
    comment: order.customerNotes || "",
  };
}




