// src/controllers/shipping.controller.ts
import { Request, Response } from 'express';
import Razorpay from '../config/razorpay';
import Order, { IOrder } from '../models/Order';
import email from '../config/emailService';

const asNum = (v: any) => (v === '' || v == null ? undefined : Number(v));
const isHttp = (s: any) => typeof s === 'string' && /^https?:\/\//i.test(s);

function customerFromOrder(order: IOrder) {
  const ship = (order as any)?.shippingAddress || {};
  const user  = (order as any)?.userId || {};
  return {
    name: ship.fullName || user.name || 'Customer',
    email: ship.email || user.email || undefined,
    contact: ship.phoneNumber || undefined,
  };
}

function ensureRazorpayEnv() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const msg = 'Razorpay keys missing on server';
    return { ok: false as const, msg };
  }
  return { ok: true as const };
}

export async function setPackageAndMaybeLink(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      lengthCm, breadthCm, heightCm, weightKg, notes, images,
      amount, currency = 'INR', createPaymentLink
    } = req.body ?? {};

    const order = (await Order.findById(id)) as IOrder | null;
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Save package (safe coercions)
    order.shippingPackage = {
      lengthCm: asNum(lengthCm),
      breadthCm: asNum(breadthCm),
      heightCm: asNum(heightCm),
      weightKg: asNum(weightKg),
      notes,
      images: Array.isArray(images) ? images.filter(isHttp).slice(0, 5) : (order.shippingPackage?.images || []),
      packedAt: new Date(),
    };

    // If no link requested, persist and return now
    if (!createPaymentLink) {
      await order.save();
      return res.json({ success: true, order });
    }

    // Validate amount
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be > 0' });
    }

    // Validate env
    const env = ensureRazorpayEnv();
    if (!env.ok) {
      // do not throw — return clear error
      await order.save();
      return res.status(500).json({ success: false, message: env.msg });
    }

    // Create payment link
    const customer = customerFromOrder(order);
    // Optional callback — only if configured & looks like a URL
    const base = process.env.APP_BASE_URL;
    const callback_url = base && /^https?:\/\//i.test(base) ? `${base.replace(/\/+$/,'')}/orders/${String(order._id)}` : undefined;

    let link;
    try {
      link = await Razorpay.paymentLink.create({
        amount: Math.round(amt * 100),
        currency,
        accept_partial: false,
        description: `Shipping charges for order ${order.orderNumber || String(order._id)}`,
        customer,
        notify: { sms: true, email: true },
        notes: { orderId: String(order._id), purpose: 'shipping_payment' },
        reminder_enable: true,
        ...(callback_url ? { callback_url, callback_method: 'get' } : {}),
      });
    } catch (e: any) {
      // Surface Razorpay error clearly
      await order.save();
      return res.status(502).json({ success: false, message: 'Razorpay error', detail: e?.message || String(e) });
    }

    order.shippingPayment = {
      linkId: link.id,
      shortUrl: link.short_url,
      status: 'pending',
      currency,
      amount: amt,
      amountPaid: 0,
      paymentIds: [],
    };

    await order.save();

    // Send email/SMS — do NOT fail the API if mailer throws
    try {
  // ✅ ALWAYS use what we just saved on the order
  const photos = (order.shippingPackage?.images || [])
    .filter(isHttp)
    .slice(0, 5);

  await email.sendShippingPaymentLink(order, {
    amount: amt,
    currency,
    shortUrl: link.short_url,
    linkId: link.id,
    lengthCm: asNum(lengthCm),
    breadthCm: asNum(breadthCm),
    heightCm: asNum(heightCm),
    weightKg: asNum(weightKg),
    notes,
    images: photos,          // ⬅️ key change
  });
} catch (mailErr: any) {
  console.warn('[shipping] email.sendShippingPaymentLink failed:', mailErr?.message || mailErr);
}

    return res.json({ success: true, order });
  } catch (e: any) {
    console.error('[shipping] setPackageAndMaybeLink error:', e);
    return res.status(500).json({ success: false, message: e?.message || 'Internal error' });
  }
}

export async function createShippingPaymentLink(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const amt = Number(req.body?.amount);
    const currency = (req.body?.currency || 'INR') as string;

    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be > 0' });
    }

    const order = (await Order.findById(id)) as IOrder | null;
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const env = ensureRazorpayEnv();
    if (!env.ok) return res.status(500).json({ success: false, message: env.msg });

    const customer = customerFromOrder(order);
    const base = process.env.APP_BASE_URL;
    const callback_url = base && /^https?:\/\//i.test(base) ? `${base.replace(/\/+$/,'')}/orders/${String(order._id)}` : undefined;

    let link;
    try {
      link = await Razorpay.paymentLink.create({
        amount: Math.round(amt * 100),
        currency,
        accept_partial: false,
        description: `Shipping charges for order ${order.orderNumber || String(order._id)}`,
        customer,
        notify: { sms: true, email: true },
        notes: { orderId: String(order._id), purpose: 'shipping_payment' },
        reminder_enable: true,
        ...(callback_url ? { callback_url, callback_method: 'get' } : {}),
      });
    } catch (e: any) {
      return res.status(502).json({ success: false, message: 'Razorpay error', detail: e?.message || String(e) });
    }

    order.shippingPayment = {
      linkId: link.id,
      shortUrl: link.short_url,
      status: 'pending',
      currency,
      amount: amt,
      amountPaid: 0,
      paymentIds: [],
    };
    await order.save();

    // Non-blocking email
    try {
      const pkg = order.shippingPackage || {};
      await email.sendShippingPaymentLink(order, {
        amount: amt,
        currency,
        shortUrl: link.short_url,
        linkId: link.id,
        lengthCm: pkg.lengthCm,
        breadthCm: pkg.breadthCm,
        heightCm: pkg.heightCm,
        weightKg: pkg.weightKg,
        notes: pkg.notes,
        images: (pkg.images || []).filter(isHttp).slice(0, 5),
      });
    } catch (mailErr: any) {
      console.warn('[shipping] email.sendShippingPaymentLink failed:', mailErr?.message || mailErr);
    }

    return res.json({ success: true, link: { id: link.id, shortUrl: link.short_url }, orderId: String(order._id) });
  } catch (e: any) {
    console.error('[shipping] createShippingPaymentLink error:', e);
    return res.status(500).json({ success: false, message: e?.message || 'Internal error' });
  }
}
