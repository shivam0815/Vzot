// src/controllers/wishlistController.ts
import { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import Product from '../models/Product';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    name: string;
    isVerified: boolean;
    twoFactorEnabled: boolean;
  };
}

const wishKey = (userId: string) => `wishlist:user:${userId}`;

/* GET /api/wishlist */
export const getWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const redis = req.app.get('redis') as Redis | undefined;
    if (!redis) { res.status(500).json({ message: 'Redis not available' }); return; }

    const ids = await redis.smembers(wishKey(userId)); // string[]
    if (!ids.length) { res.json({ success: true, wishlist: { items: [] } }); return; }

    const products = await Product.find({ _id: { $in: ids } }).lean();
    const formattedItems = products
      .filter((p: any) => p?.isActive)
      .map((p: any) => ({
        productId: String(p._id || p.id),
        product: p,
        // Redis set has no per-item timestamp; optional: store a parallel hash if needed
        addedAt: undefined,
      }));

    res.json({ success: true, wishlist: { items: formattedItems } });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* POST /api/wishlist  { productId } */
export const addToWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { productId } = req.body || {};
    if (!userId || !productId) { res.status(400).json({ message: 'User ID and Product ID required' }); return; }

    const redis = req.app.get('redis') as Redis | undefined;
    if (!redis) { res.status(500).json({ message: 'Redis not available' }); return; }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) { res.status(404).json({ message: 'Product not found' }); return; }

    const key = wishKey(userId);
    const already = await redis.sismember(key, String(productId));
    if (already) { res.status(409).json({ message: 'Item already in wishlist' }); return; }

    await redis.sadd(key, String(productId));

    // return updated list (optional)
    const ids = await redis.smembers(key);
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const formattedItems = products
      .filter((p: any) => p?.isActive)
      .map((p: any) => ({ productId: String(p._id || p.id), product: p, addedAt: undefined }));

    res.status(201).json({ success: true, message: 'Added to wishlist', wishlist: { items: formattedItems } });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* DELETE /api/wishlist/:productId */
export const removeFromWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { productId } = req.params;
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const redis = req.app.get('redis') as Redis | undefined;
    if (!redis) { res.status(500).json({ message: 'Redis not available' }); return; }

    await redis.srem(wishKey(userId), String(productId));

    // return updated list (optional)
    const ids = await redis.smembers(wishKey(userId));
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const formattedItems = products
      .filter((p: any) => p?.isActive)
      .map((p: any) => ({ productId: String(p._id || p.id), product: p, addedAt: undefined }));

    res.json({ success: true, message: 'Removed from wishlist', wishlist: { items: formattedItems } });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* DELETE /api/wishlist */
export const clearWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const redis = req.app.get('redis') as Redis | undefined;
    if (!redis) { res.status(500).json({ message: 'Redis not available' }); return; }

    await redis.del(wishKey(userId));
    res.json({ success: true, message: 'Wishlist cleared' });
  } catch (error) {
    console.error('Clear wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
