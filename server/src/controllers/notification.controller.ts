import { Request, Response } from 'express';
import Notification from '../models/Notification';

// ===== USER =====

// include both user-specific + global ('all') notifications
export const listMyNotifications = async (req: any, res: Response) => {
  try {
    const userId = req.user?._id;
    const { limit = 50, page = 1 } = req.query;

    const q = {
      $or: [
        { audience: 'user', userId },
        { audience: 'all' }, // global broadcasts
      ],
    };

    const docs = await Notification.find(q)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Notification.countDocuments(q);

    res.json({ success: true, notifications: docs, total });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const markOneRead = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    const n = await Notification.findOne({ _id: id, userId, audience: 'user' });
    if (!n) return res.status(404).json({ success: false, message: 'Not found' });

    n.isRead = true;
    await n.save();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const markAllRead = async (req: any, res: Response) => {
  try {
    const userId = req.user?._id;
    await Notification.updateMany({ audience: 'user', userId }, { $set: { isRead: true } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const removeOne = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const n = await Notification.findOneAndDelete({ _id: id, userId, audience: 'user' });
    if (!n) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ===== ADMIN =====

export const adminListNotifications = async (req: Request, res: Response) => {
  try {
    const { limit = 200, page = 1 } = req.query;
    const docs = await Notification.find({})
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await Notification.countDocuments({});
    res.json({ success: true, notifications: docs, total });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const adminCreateNotification = async (req: Request, res: Response) => {
  try {
    const { title, message, type = 'system', audience = 'all', targetUserId, cta } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message are required' });
    }
    if (audience === 'user' && !targetUserId) {
      return res.status(400).json({ success: false, message: 'targetUserId is required for audience=user' });
    }

    const doc = await Notification.create({
      title,
      message,
      type,
      audience,
      userId: audience === 'user' ? targetUserId : undefined,
      cta,
    });

    // Optional: emit over socket.io to clients if you have `io` on app locals
    // req.app.get('io')?.emit('notificationCreated', doc);

    res.status(201).json({ success: true, notification: doc });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const adminDeleteNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const n = await Notification.findByIdAndDelete(id);
    if (!n) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
        