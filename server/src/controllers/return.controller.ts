// backend/src/controllers/return.controller.ts
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Order from '../models/Order';
import ReturnRequest from '../models/ReturnRequest';
import { v2 as cloudinary } from 'cloudinary';

const RETURN_WINDOW_DAYS = Number(process.env.RETURN_WINDOW_DAYS || 7);

const withinReturnWindow = (deliveredAt?: Date) => {
  if (!deliveredAt) return false;
  const diffMs = Date.now() - new Date(deliveredAt).getTime();
  return diffMs / (1000 * 60 * 60 * 24) <= RETURN_WINDOW_DAYS;
};

// What we expect an order item to minimally look like.
type OrderItem = {
  _id?: any;
  id?: any;
  productId: string | Types.ObjectId;
  quantity: number;
  price?: number;
  unitPrice?: number;
  name?: string;
  image?: string;
};

type IncomingItem = {
  productId?: string;
  orderItemId?: string;
  quantity: number;
  reason?: string;
};

const idStr = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (typeof v._id === 'string') return v._id;
    if (v._id) return String(v._id);
    if (v.id) return String(v.id);
  }
  try { return String(v); } catch { return ''; }
};

export const createReturnRequest = async (req: any, res: Response) => {
  try {
    const authUserId: string | undefined = req.user?._id || req.user?.id;
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const body = req.body || {};
    const orderId: string = body.orderId;
    const reasonType: string = body.reasonType;
    const reasonNote: string | undefined = body.reasonNote;

    const itemsPayload: IncomingItem[] =
      typeof body.items === 'string' ? JSON.parse(body.items) : body.items;

    const pickupAddress =
      typeof body.pickupAddress === 'string'
        ? JSON.parse(body.pickupAddress)
        : body.pickupAddress;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }
    if (!Array.isArray(itemsPayload) || itemsPayload.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }
    if (!reasonType) {
      return res.status(400).json({ success: false, message: 'reasonType is required' });
    }

    const order =
      (await Order.findOne({ _id: orderId, userId: authUserId })) ||
      (await Order.findOne({ _id: orderId, user: authUserId })) ||
      (await Order.findOne({ _id: orderId, 'user._id': authUserId }));

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const status = String((order as any).orderStatus || order.status || '').toLowerCase();
    const deliveredAt = (order as any).deliveredAt || (order as any).updatedAt;
    if (status !== 'delivered' || !withinReturnWindow(deliveredAt)) {
      return res.status(400).json({
        success: false,
        message: `Return window (${RETURN_WINDOW_DAYS} days) has expired or order not delivered`,
      });
    }

    // ---------- Build items robustly from order ----------
    const orderItems: OrderItem[] = Array.isArray((order as any).items)
      ? (order as any).items
      : [];

    const productIndex = new Map<string, OrderItem[]>();
    for (const oi of orderItems) {
      const pid = idStr((oi as any).productId);
      if (!pid) continue;
      const arr = productIndex.get(pid) || [];
      arr.push(oi);
      productIndex.set(pid, arr);
    }

    const builtItems = itemsPayload.map((it) => {
      const wantedPid = idStr(it.productId);
      if (!wantedPid) {
        throw new Error('Missing productId in request item');
      }
      if (!Types.ObjectId.isValid(wantedPid)) {
        throw new Error(`Invalid productId format: ${wantedPid}`);
      }

      const candidates = productIndex.get(wantedPid) || [];
      const match = it.orderItemId
        ? candidates.find((oi) => idStr((oi as any)._id ?? (oi as any).id) === String(it.orderItemId))
        : candidates[0];

      if (!match) {
        throw new Error(`Item not found on order for productId ${wantedPid}`);
      }

      const purchasedQty = Number((match as any).quantity || 1);
      const reqQty = Number(it.quantity || 0);
      if (!Number.isFinite(reqQty) || reqQty < 1) {
        throw new Error('Invalid quantity');
      }
      if (reqQty > purchasedQty) {
        throw new Error(`Requested quantity (${reqQty}) exceeds purchased (${purchasedQty})`);
      }

      const rawPid = idStr((match as any).productId);
      const productIdObj = new Types.ObjectId(rawPid);

      const unitPrice = Number((match as any).price ?? (match as any).unitPrice ?? 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error('Invalid price on order item');
      }

      return {
        productId: productIdObj,
        orderItemId: (match as any)._id ?? (match as any).id,
        name: (match as any).name,
        quantity: reqQty,
        unitPrice,
        reason: it.reason,
      };
    });

    const refundAmount = builtItems.reduce(
      (sum, it: any) => sum + Number(it.unitPrice || 0) * Number(it.quantity || 0),
      0
    );

    // ---------- Optional images ----------
    const imageUrls: string[] = [];
    const files: Express.Multer.File[] = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : ((req.files && (req.files as any).images) as Express.Multer.File[]) || [];

    for (const f of files) {
      const up = await cloudinary.uploader.upload(f.path, { folder: 'returns' });
      imageUrls.push(up.secure_url);
    }

    // ---------- Create ReturnRequest ----------
    const rr = await ReturnRequest.create({
      user: authUserId,
      order: (order as any)._id,
      status: 'pending',
      reasonType,
      reasonNote,
      items: builtItems,
      images: imageUrls,
      refundAmount,
      currency: 'INR',
      pickupAddress: pickupAddress || (order as any).shippingAddress,
      history: [{ at: new Date(), action: 'created', by: authUserId, note: reasonNote }],
    });

    req.io?.emit?.('returnCreated', { _id: rr._id, orderId: (order as any)._id });

    return res.json({ success: true, returnRequest: rr });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e?.message || 'Failed to create return' });
  }
};

export const listMyReturns = async (req: any, res: Response) => {
  const userId = req.user?._id || req.user?.id;
  const list = await ReturnRequest.find({ user: userId }).sort({ createdAt: -1 });
  res.json({ success: true, returns: list });
};

export const getMyReturn = async (req: any, res: Response) => {
  const userId = req.user?._id || req.user?.id;
  const { id } = req.params;
  const r = await ReturnRequest.findOne({ _id: id, user: userId });
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, returnRequest: r });
};

export const cancelMyReturn = async (req: any, res: Response) => {
  const userId = req.user?._id || req.user?.id;
  const { id } = req.params;
  const r = await ReturnRequest.findOne({ _id: id, user: userId });
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  if (!['pending', 'approved'].includes(r.status)) {
    return res.status(400).json({ success: false, message: 'Cannot cancel at this stage' });
  }
  r.status = 'cancelled';
  r.history.push({ at: new Date(), by: userId, action: 'cancelled' });
  await r.save();
  req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
  res.json({ success: true, returnRequest: r });
};

// ==== ADMIN ====

export const adminListReturns = async (req: any, res: Response) => {
  const { status, q, page = 1, limit = 20 } = req.query as any;
  const filter: any = {};
  if (status) filter.status = status;
  if (q) filter.$text = { $search: q };

  const skip = (Number(page) - 1) * Number(limit);
  const [rows, total] = await Promise.all([
    ReturnRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name email')
      .populate('order', 'orderNumber'),
    ReturnRequest.countDocuments(filter),
  ]);

  res.json({
    success: true,
    returns: rows,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  });
};

export const adminGetReturn = async (req: Request, res: Response) => {
  const r = await ReturnRequest.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('order', 'orderNumber');
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, returnRequest: r });
};

export const adminDecision = async (req: any, res: Response) => {
  const { id } = req.params;
  const { action, adminNote } = req.body as { action: 'approve' | 'reject'; adminNote?: string };
  const r = await ReturnRequest.findById(id);
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  if (r.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Already processed' });
  }

  if (action === 'approve') r.status = 'approved';
  if (action === 'reject') r.status = 'rejected';
  r.adminNote = adminNote;
  r.history.push({ at: new Date(), by: req.user._id, action, note: adminNote });
  await r.save();
  req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
  res.json({ success: true, returnRequest: r });
};

export const adminMarkReceived = async (req: any, res: Response) => {
  const { id } = req.params;
  const { note } = req.body as { note?: string };
  const r = await ReturnRequest.findById(id);
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  if (!['approved', 'in_transit', 'pickup_scheduled'].includes(r.status)) {
    return res.status(400).json({ success: false, message: 'Invalid status for receive' });
  }
  r.status = 'received';
  r.history.push({ at: new Date(), by: req.user._id, action: 'received', note });
  await r.save();
  req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
  res.json({ success: true, returnRequest: r });
};

export const adminRefund = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { method, reference } = req.body as { method: 'original' | 'wallet' | 'manual'; reference?: string };

    const r = await ReturnRequest.findById(id);
    if (!r) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['received', 'refund_initiated'].includes(r.status))
      return res.status(400).json({ success: false, message: 'Return not received yet' });

    const order = await Order.findById(r.order).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Neutral refund info (Razorpay removed)
    const refundInfo: any = { method, reference, note: 'Refund recorded by admin' };

    // If you later integrate PhonePe refunds or a wallet system, implement here.
    // For now, we simply mark refund completed with the provided reference.
    r.status = 'refund_completed';
    r.refund = { ...refundInfo, at: new Date() };
    r.history.push({ at: new Date(), by: req.user._id, action: 'refund_completed', note: reference });
    await r.save();

    req.io?.emit?.('returnUpdated', { _id: r._id, status: r.status });
    return res.json({ success: true, returnRequest: r });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e?.message || 'Refund failed' });
  }
};
