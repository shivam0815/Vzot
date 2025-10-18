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
// src/services/shiprocketService.ts
export function buildSrPayload(order: any) {
  const addr = order.shippingAddress || {};

  const gstPct =
    Number(order.gst?.taxPercent) ||
    Number(process.env.DEFAULT_GST_PERCENT || 18); // fallback

  const items = (order.items || []).map((it: any) => {
    const units = Number(it.quantity || 1);
    const price = Number(it.price || 0);        // base price (pre-tax)
    return {
      name: it.name,
      sku: (it.productId?.sku || it.sku || it.name || 'NA').slice(0, 30),
      units,
      selling_price: price,                      // pre-tax price
      discount: 0,
      tax: gstPct,                               // ✅ PERCENT, per SR
      hsn: it.hsn || it.productId?.hsn || '8518' // ✅ recommended
    };
  });

  const subtotal = items.reduce((s: number, i: any) => s + i.units * i.selling_price, 0);
const gstAmount = +(subtotal * (gstPct / 100)).toFixed(2);

  const shipping = Number(order.shipping || 0);
  const cod = order.paymentMethod === 'cod';
  const codCharges = cod ? Number(order.charges?.codCharge ?? 0) : 0;

  return {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt || Date.now()).toISOString(),
    pickup_location: process.env.SHIPROCKET_PICKUP_NICKNAME || 'Sales Office',
    channel_id: process.env.SHIPROCKET_CHANNEL_ID,

    billing_customer_name: addr.fullName || 'Customer',
    billing_last_name: '',
    billing_address: (addr.addressLine1 || '') + (addr.addressLine2 ? `, ${addr.addressLine2}` : ''),
    billing_city: addr.city || '',
    billing_pincode: addr.pincode || '',
    billing_state: addr.state || '',
    billing_country: 'India',
    billing_email: addr.email || 'no-reply@domain.in',
    billing_phone: addr.phoneNumber || '0000000000',
    shipping_is_billing: true,

    payment_method: cod ? 'COD' : 'Prepaid',
    order_items: items,

    sub_total: +subtotal.toFixed(2),             // pre-tax subtotal
    shipping_charges: +shipping.toFixed(2),      // appears on SR
    // SR ignores top-level "tax" amount; GST comes from item.tax%
    cod_charges: +codCharges.toFixed(2),
    total: +(subtotal + gstAmount + shipping + codCharges).toFixed(2),

    length: 12, breadth: 10, height: 4, weight: 0.5,
    comment: order.customerNotes || ''
  };
}


