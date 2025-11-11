// src/controllers/cartController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import Cart from "../models/Cart";
import Product from "../models/Product";

/* ────────────────────────────────────────────────────────────── */
/* CACHE                                                          */
/* ────────────────────────────────────────────────────────────── */
const cartCache = new NodeCache({ stdTTL: 10, checkperiod: 20 }); // cache per user+mode 10s

interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
}

/* ────────────────────────────────────────────────────────────── */
/* PRICING MODE HELPERS                                           */
/* ────────────────────────────────────────────────────────────── */
type PricingMode = "retail" | "wholesale";

const getMode = (req: Request): PricingMode => {
  const raw =
    (req.headers["x-pricing-mode"] as string) ||
    (req.query.pricingMode as string) ||
    (req.body?.pricingMode as string) ||
    "retail";
  return String(raw).toLowerCase() === "wholesale" ? "wholesale" : "retail";
};

const unitPriceFor = (product: any, mode: PricingMode) =>
  mode === "wholesale" &&
  product?.wholesaleEnabled &&
  Number(product?.wholesalePrice) > 0
    ? Number(product.wholesalePrice)
    : Number(product.price);

const minQtyFor = (product: any, mode: PricingMode) =>
  mode === "wholesale" &&
  product?.wholesaleEnabled &&
  Number(product?.wholesaleMinQty) > 0
    ? Number(product.wholesaleMinQty)
    : 1;

const clampQty = (desired: number, minQty: number, stock: number) => {
  if (stock < minQty) return 0; // cannot satisfy MOQ with available stock
  if (desired < minQty) return minQty; // bump to MOQ
  return Math.min(desired, stock);
};

const recomputeTotal = (cart: any) => {
  cart.totalAmount = (cart.items || []).reduce(
    (sum: number, it: any) =>
      sum + Number(it.price || 0) * Number(it.quantity || 0),
    0
  );
  return cart.totalAmount;
};

const delBothModeCaches = (userId: string) => {
  cartCache.del([`cart:${userId}:retail`, `cart:${userId}:wholesale`]);
};

/* ────────────────────────────────────────────────────────────── */
/* GET CART                                                       */
/* ────────────────────────────────────────────────────────────── */
export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    if (!user?.id) {
      res.status(401).json({ message: "Unauthorized: No user id" });
      return;
    }

    const mode = getMode(req);
    const cacheKey = `cart:${user.id}:${mode}`;
    const cached = cartCache.get(cacheKey);
    if (cached) {
      res.json({ cart: cached, cached: true, mode });
      return;
    }

    const cart = await Cart.findOne({ userId: user.id }).populate("items.productId");

    // Narrow the union and get a plain object safely
    const base =
      cart
        ? (typeof (cart as any).toObject === "function"
            ? (cart as any).toObject()
            : (cart as any))
        : { items: [], totalAmount: 0 };

    // Build a mode-aware view without mutating DB
    const items = (base.items || []).map((it: any) => {
      const p = it.productId || {};
      const unit = unitPriceFor(p, mode);
      return {
        ...(typeof it.toObject === "function" ? it.toObject() : it),
        effectiveUnitPrice: unit,
        productId: p,
      };
    });

    const mapped = {
      ...base,
      items,
      computedTotal: items.reduce(
        (s: number, it: any) =>
          s + Number(it.effectiveUnitPrice) * Number(it.quantity),
        0
      ),
    };

    cartCache.set(cacheKey, mapped);
    res.json({ cart: mapped, cached: false, mode });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


/* ────────────────────────────────────────────────────────────── */
/* ADD TO CART (MOQ + wholesale price enforced by server)         */
/* ────────────────────────────────────────────────────────────── */
export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    const user = req.user as AuthenticatedUser;

    if (!productId || !user?.id) {
      res
        .status(400)
        .json({ message: "Product ID and user authentication required" });
      return;
    }

    const product = mongoose.Types.ObjectId.isValid(productId)
      ? await Product.findById(productId)
      : null;

    if (!product || !product.isActive || !product.inStock) {
      res.status(404).json({ message: "Product not found or unavailable" });
      return;
    }

    const mode = getMode(req);
    const stock = Math.max(0, Number(product.stockQuantity ?? 0));
    const minQty = minQtyFor(product, mode);
    const unit = unitPriceFor(product, mode);

    if (stock < 1) {
      res.status(400).json({ message: "Insufficient stock" });
      return;
    }
    if (mode === "wholesale" && !product.wholesaleEnabled) {
      res
        .status(400)
        .json({ message: "Wholesale mode not available for this product" });
      return;
    }

    let cart = await Cart.findOne({ userId: user.id });
    if (!cart) cart = new Cart({ userId: user.id, items: [], totalAmount: 0 });

    const idx = cart.items.findIndex(
      (it: any) => String(it.productId) === String(product._id)
    );
    if (idx > -1) {
      const current = Number(cart.items[idx].quantity || 0);
      const desired = current + Math.max(1, Number(quantity) || 1);
      const allowed = clampQty(desired, minQty, stock);
      if (allowed === 0 || allowed === current) {
        res.status(400).json({
          message: "Cannot add more items - insufficient stock or below MOQ",
          available: stock,
          minQty,
        });
        return;
      }
      cart.items[idx].quantity = allowed;
      cart.items[idx].price = unit; // set unit price for this mode
    } else {
      const desired = Math.max(1, Number(quantity) || 1);
      const allowed = clampQty(desired, minQty, stock);
      if (allowed === 0) {
        res.status(400).json({
          message: "Insufficient stock to meet MOQ",
          available: stock,
          minQty,
        });
        return;
      }
      cart.items.push({
        productId: product._id,
        quantity: allowed,
        price: unit,
      });
    }

    recomputeTotal(cart);
    await cart.save();
    await cart.populate("items.productId");

    delBothModeCaches(user.id);

    res
      .status(200)
      .json({
        success: true,
        message: "Item added to cart successfully",
        cart,
        mode,
        minQty,
      });
  } catch (error: any) {
    console.error("❌ Add to cart error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Internal server error" });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* UPDATE CART ITEM (MOQ + wholesale price enforced)              */
/* ────────────────────────────────────────────────────────────── */
export const updateCartItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId, quantity } = req.body;
    const user = req.user as AuthenticatedUser;
    const mode = getMode(req);

    const desired = Math.max(1, Number(quantity) || 1);

    const cart = await Cart.findOne({ userId: user?.id });
    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    const idx = cart.items.findIndex(
      (it) => String(it.productId) === String(productId)
    );
    if (idx === -1) {
      res.status(404).json({ message: "Item not found in cart" });
      return;
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive || !product.inStock) {
      res.status(404).json({ message: "Product not found or unavailable" });
      return;
    }

    const stock = Math.max(0, Number(product.stockQuantity ?? 0));
    const minQty = minQtyFor(product, mode);
    const unit = unitPriceFor(product, mode);

    const allowed = clampQty(desired, minQty, stock);
    if (allowed === 0) {
      res
        .status(400)
        .json({ message: "Insufficient stock to meet MOQ", available: stock, minQty });
      return;
    }

    cart.items[idx].quantity = allowed;
    cart.items[idx].price = unit;

    recomputeTotal(cart);
    await cart.save();
    await cart.populate("items.productId");

    delBothModeCaches(user.id);

    res.json({ message: "Cart updated", cart, mode, minQty });
  } catch (error: any) {
    console.error("Update cart error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* REMOVE FROM CART                                               */
/* ────────────────────────────────────────────────────────────── */
export const removeFromCart = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;
    const user = req.user as AuthenticatedUser;

    const cart = await Cart.findOne({ userId: user?.id });
    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    cart.items = cart.items.filter(
      (item) => String(item.productId) !== String(productId)
    );

    recomputeTotal(cart);
    await cart.save();
    await cart.populate("items.productId");

    delBothModeCaches(user.id);

    res.json({ message: "Item removed from cart", cart });
  } catch (error: any) {
    console.error("Remove from cart error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* CLEAR CART                                                     */
/* ────────────────────────────────────────────────────────────── */
export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    await Cart.findOneAndDelete({ userId: user?.id });

    delBothModeCaches(user.id);

    res.json({ message: "Cart cleared" });
  } catch (error: any) {
    console.error("Clear cart error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};
