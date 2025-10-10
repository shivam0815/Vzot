import { Request, Response } from "express";
import type { Redis } from "ioredis";
import Product from "../models/Product";
import { cartKey } from "../config/redisKeys";

interface AuthenticatedUser { id: string; role: string; email?: string; name?: string; }

// GET /api/cart
export const getCart = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser;
    if (!user?.id) return res.status(401).json({ message: "Unauthorized: No user id" });

    const redis = req.app.get("redis") as Redis | undefined;
    if (!redis) return res.status(500).json({ message: "Redis not available" });

    const key = cartKey(user.id);
    const entries = await redis.hgetall(key); // { [productId]: "qty" }
    const productIds = Object.keys(entries);
    if (!productIds.length) return res.json({ cart: { items: [], totalAmount: 0 }, cached: false });

    const docs = await Product.find({ _id: { $in: productIds } })
      .select("name price images stockQuantity isActive inStock")
      .lean();

    const items = docs.map((p: any) => ({
      productId: String(p._id),
      product: p,                           // you were populating earlier
      quantity: Number(entries[String(p._id)]) || 0,
      price: p.price,
    }));

    const totalAmount = items.reduce((s, it) => s + (it.price ?? 0) * it.quantity, 0);
    res.json({ cart: { items, totalAmount }, cached: false });
  } catch (e: any) {
    console.error("Get cart error:", e);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/cart  { productId, quantity=1 }  (stock-capped)
export const addToCart = async (req: Request, res: Response) => {
  try {
    const { productId, quantity = 1 } = req.body || {};
    const user = req.user as AuthenticatedUser;
    if (!productId || !user?.id) return res.status(400).json({ message: "Product ID and user required" });

    const redis = req.app.get("redis") as Redis | undefined;
    if (!redis) return res.status(500).json({ message: "Redis not available" });

    const product = await Product.findById(productId);
    if (!product || !product.isActive || !product.inStock) {
      return res.status(404).json({ message: "Product not found or unavailable" });
    }
    const stock = Math.max(0, Number(product.stockQuantity ?? 0));
    if (stock < 1) return res.status(400).json({ message: "Insufficient stock", available: 0 });

    const key = cartKey(user.id);

    // current qty in cart
    const current = Number((await redis.hget(key, String(productId))) || 0);
    const desired = current + Math.max(1, Number(quantity) || 1);
    const allowed = Math.min(desired, stock);

    if (allowed === current) {
      return res.status(400).json({
        message: "Cannot add more items - insufficient stock",
        available: stock,
        currentInCart: current,
      });
    }

    await redis.hset(key, String(productId), String(allowed));
    return res.status(200).json({ success: true, message: "Item added to cart successfully" });
  } catch (e: any) {
    console.error("❌ Add to cart error:", e);
    res.status(500).json({ success: false, message: e.message || "Internal server error" });
  }
};

// PATCH /api/cart  { productId, quantity } (stock-capped)
export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body || {};
    const user = req.user as AuthenticatedUser;
    if (!productId || quantity == null) return res.status(400).json({ message: "productId & quantity required" });

    const redis = req.app.get("redis") as Redis | undefined;
    if (!redis) return res.status(500).json({ message: "Redis not available" });

    const product = await Product.findById(productId);
    if (!product || !product.isActive || !product.inStock) {
      return res.status(404).json({ message: "Product not found or unavailable" });
    }

    const stock = Math.max(0, Number(product.stockQuantity ?? 0));
    const desired = Math.max(1, Number(quantity) || 1);
    const allowed = Math.min(desired, stock);

    const key = cartKey(user.id);
    if (allowed <= 0) await redis.hdel(key, String(productId));
    else await redis.hset(key, String(productId), String(allowed));

    res.json({ message: "Cart updated" });
  } catch (e: any) {
    console.error("Update cart error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
};

// DELETE /api/cart/:productId
export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const user = req.user as AuthenticatedUser;

    const redis = req.app.get("redis") as Redis | undefined;
    if (!redis) return res.status(500).json({ message: "Redis not available" });

    const key = cartKey(user.id);
    await redis.hdel(key, String(productId));
    res.json({ message: "Item removed from cart" });
  } catch (e: any) {
    console.error("Remove from cart error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
};

// DELETE /api/cart
export const clearCart = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthenticatedUser;

    const redis = req.app.get("redis") as Redis | undefined;
    if (!redis) return res.status(500).json({ message: "Redis not available" });

    await redis.del(cartKey(user.id));
    res.json({ message: "Cart cleared" });
  } catch (e: any) {
    console.error("Clear cart error:", e);
    res.status(500).json({ message: e.message || "Server error" });
  }
};
