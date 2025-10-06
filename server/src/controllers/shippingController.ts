// src/controllers/shipping.controller.ts
import { Request, Response } from 'express';
import Order, { IOrder } from '../models/Order';
import email from '../config/emailService';
import { createPhonePeTransaction } from '../lib/phonepe';

const asNum = (v: any) => (v === '' || v == null ? undefined : Number(v));
const genMtx = (order: IOrder, suffix = 'SHIP') =>
  `${suffix}_${order.orderNumber}_${Date.now().toString().slice(-6)}`.toUpperCase();

function extractRedirectUrl(resp: any): string | undefined {
  return (
    resp?.data?.data?.instrumentResponse?.redirectInfo?.url ||
    resp?.data?.instrumentResponse?.redirectInfo?.url ||
    resp?.data?.redirectUrl ||
    resp?.redirectUrl
  );
}

/**
 * Admin sets package dims/weight/images and (optionally) creates a PhonePe Shipping Payment Link.
 * Body:
 * {
 *   lengthCm, breadthCm, heightCm, weightKg, notes, images: string[],
 *   amount, currency, createPaymentLink: boolean
 * }
 */
export async function setPackageAndMaybeLink(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      lengthCm, breadthCm, heightCm, weightKg, notes, images,
      amount, currency = 'INR', createPaymentLink
    } = req.body ?? {};

    const order = (await Order.findById(id)) as IOrder | null;
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.shippingPackage = {
      lengthCm: asNum(lengthCm),
      breadthCm: asNum(breadthCm),
      heightCm: asNum(heightCm),
      weightKg: asNum(weightKg),
      notes,
      images: Array.isArray(images) ? images.slice(0, 5) : order.shippingPackage?.images || [],
      packedAt: new Date(),
    };

    if (createPaymentLink && Number(amount) > 0) {
      const mtx = genMtx(order); // merchantTransactionId
      const resp = await createPhonePeTransaction({
        merchantTransactionId: mtx,
        amountInPaise: Math.round(Number(amount) * 100),
        redirectUrl: process.env.PHONEPE_REDIRECT_URL!,
        callbackUrl: process.env.PHONEPE_CALLBACK_URL!,
        merchantUserId: String(order.userId),
      });

      const shortUrl = extractRedirectUrl(resp);
      if (!shortUrl) throw new Error('PhonePe redirect URL missing from response');

      order.shippingPayment = {
        linkId: mtx,            // store our MTX as link identifier
        shortUrl,               // hosted pay page
        status: 'pending',
        currency,
        amount: Number(amount),
        amountPaid: 0,
        paymentIds: [],
      };

      await email.sendShippingPaymentLink(order, {
        amount: Number(amount),
        currency,
        shortUrl,
        linkId: mtx,
        lengthCm: asNum(lengthCm),
        breadthCm: asNum(breadthCm),
        heightCm: asNum(heightCm),
        weightKg: asNum(weightKg),
        notes,
        images: Array.isArray(images) ? images.slice(0, 5) : undefined,
      });
    }

    await order.save();
    res.json({ success: true, order });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

/** Create/refresh the shipping payment link explicitly (PhonePe) */
export async function createShippingPaymentLink(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amount, currency = 'INR' } = req.body ?? {};
    if (!(Number(amount) > 0)) return res.status(400).json({ message: 'amount required' });

    const order = (await Order.findById(id)) as IOrder | null;
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const mtx = genMtx(order);
    const resp = await createPhonePeTransaction({
      merchantTransactionId: mtx,
      amountInPaise: Math.round(Number(amount) * 100),
      redirectUrl: process.env.PHONEPE_REDIRECT_URL!,
      callbackUrl: process.env.PHONEPE_CALLBACK_URL!,
      merchantUserId: String(order.userId),
    });

    const shortUrl = extractRedirectUrl(resp);
    if (!shortUrl) throw new Error('PhonePe redirect URL missing from response');

    order.shippingPayment = {
      linkId: mtx,
      shortUrl,
      status: 'pending',
      currency,
      amount: Number(amount),
      amountPaid: 0,
      paymentIds: [],
    };

    await order.save();

    const pkg = order.shippingPackage || {};
    await email.sendShippingPaymentLink(order, {
      amount: Number(amount),
      currency,
      shortUrl,
      linkId: mtx,
      lengthCm: pkg.lengthCm,
      breadthCm: pkg.breadthCm,
      heightCm: pkg.heightCm,
      weightKg: pkg.weightKg,
      notes: pkg.notes,
      images: (pkg.images || []).slice(0, 5),
    });

    res.json({ success: true, link: { id: mtx, shortUrl }, orderId: String(order._id) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}
