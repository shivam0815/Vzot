import { Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../models/Review";
import Product from "../models/Product";
import NodeCache from "node-cache";

const AUTO_APPROVE_REVIEWS = process.env.AUTO_APPROVE_REVIEWS === "true";
const reviewCache = new NodeCache({ stdTTL: 60, checkperiod: 120 }); // 60s

/* ----------------------------- Helpers ----------------------------- */
const toObjectId = (id: string | mongoose.Types.ObjectId) =>
  typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;

const setCacheHeaders = (res: Response) => {
  // browser/CDN can cache; client may re-use for 60s and serve stale for 30s
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
};

const recalcProductRating = async (productId: mongoose.Types.ObjectId | string) => {
  const pid = toObjectId(productId);
  const agg = await Review.aggregate([
    { $match: { productId: pid, status: "approved" } },
    { $group: { _id: "$productId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const avg = agg[0]?.avg ?? 0;
  const count = agg[0]?.count ?? 0;

  await Product.findByIdAndUpdate(pid, {
    rating: Math.round(avg * 10) / 10,
    reviewsCount: count,
  });

  // bust per-product caches
  reviewCache.del(`review-summary:${pid.toString()}`);
};

/* ----------------------------- Endpoints ----------------------------- */

// GET /api/reviews?productId=...&page=&limit=
export const listReviews = async (req: Request, res: Response) => {
  try {
    const { productId, page = 1, limit = 10 } = req.query as any;
    if (!productId || !mongoose.isValidObjectId(String(productId))) {
      return res.status(400).json({ success: false, message: "productId required" });
    }

    const pid = toObjectId(String(productId));
    const p = Math.max(1, Number(page));
    const l = Math.max(1, Math.min(50, Number(limit)));
    const skip = (p - 1) * l;

    const match = { productId: pid, status: "approved" as const };

    const [items, total, summary] = await Promise.all([
      Review.find(match).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
      Review.countDocuments(match),
      Review.aggregate([{ $match: match }, { $group: { _id: "$rating", count: { $sum: 1 } } }]),
    ]);

    const distribution: Record<"1" | "2" | "3" | "4" | "5", number> =
      { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const s of summary)
      distribution[String(s._id) as keyof typeof distribution] = s.count;

    setCacheHeaders(res);
    res.json({
      success: true,
      reviews: items,
      pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
      distribution,
    });
  } catch (e: any) {
    console.error("❌ listReviews error:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to fetch reviews" });
  }
};

// GET /api/reviews/summary?productId=...
export const getReviewSummary = async (req: Request, res: Response) => {
  try {
    const { productId } = req.query as { productId: string };
    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: "Valid productId required" });
    }

    const cacheKey = `review-summary:${productId}`;
    const cached = reviewCache.get(cacheKey);
    if (cached) {
      setCacheHeaders(res);
      return res.json({ success: true, cached: true, ...cached });
    }

    const pid = toObjectId(productId);
    const agg = await Review.aggregate([
      { $match: { productId: pid, status: "approved" } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]);

    const distribution: Record<"1" | "2" | "3" | "4" | "5", number> =
      { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const s of agg)
      distribution[String(s._id) as keyof typeof distribution] = s.count;

    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    const avg = total
      ? Object.entries(distribution).reduce(
          (sum, [rating, count]) => sum + Number(rating) * count,
          0
        ) / total
      : 0;

    const summary = { distribution, total, avg: Math.round(avg * 10) / 10 };
    reviewCache.set(cacheKey, summary);

    setCacheHeaders(res);
    return res.json({ success: true, cached: false, ...summary });
  } catch (e: any) {
    console.error("❌ getReviewSummary error:", e);
    return res.status(500).json({ success: false, message: e.message || "Failed to get summary" });
  }
};

// POST /api/reviews/summary/bulk  { productIds: string[] }
export const getBulkReviewSummaries = async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body as { productIds: string[] };
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: "productIds required" });
    }

    const ids = productIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (!ids.length) {
      return res.json({ success: true, data: {} });
    }

    const agg = await Review.aggregate([
      { $match: { productId: { $in: ids }, status: "approved" } },
      { $group: { _id: "$productId", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
    ]);

   // in getBulkReviewSummaries
const summaries: Record<string, { avg: number; total: number; averageRating: number; reviewCount: number }> = {};
for (const a of agg) {
  const avg = a.avg ? Math.round(a.avg * 10) / 10 : 0;
  const total = a.count || 0;
  summaries[String(a._id)] = {
    avg,
    total,
    averageRating: avg,
    reviewCount: total,
  };
}
setCacheHeaders(res);
return res.json({ success: true, data: summaries });

  } catch (e: any) {
    console.error("❌ getBulkReviewSummaries error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/reviews
export const createReview = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as any;
    const { productId, rating } = body;
    let { comment = "", title = "", userName, userEmail } = body;

    if (!productId || !mongoose.isValidObjectId(String(productId))) {
      return res.status(400).json({ success: false, message: "Valid productId required" });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "rating must be 1..5" });
    }

    // hygiene
    title = String(title || "").trim().slice(0, 120);
    comment = String(comment || "").trim();
    if (comment.length < 5) {
      return res.status(400).json({ success: false, message: "comment is too short" });
    }
    if (comment.length > 4000) {
      return res.status(400).json({ success: false, message: "comment too long (max 4000 chars)" });
    }

    const user = (req as any).user; // optional if route open
    const status: "pending" | "approved" = AUTO_APPROVE_REVIEWS ? "approved" : "pending";

    const doc = await Review.create({
      productId: toObjectId(String(productId)),
      rating,
      comment,
      title,
      userId: user?._id,
      userName: user?.name || userName,
      userEmail: user?.email || userEmail,
      status,
      verified: false,
    });

    if (status === "approved") await recalcProductRating(productId);

    return res.status(201).json({
      success: true,
      message: status === "approved" ? "Review published" : "Review submitted for approval",
      review: doc,
    });
  } catch (e: any) {
    console.error("❌ createReview error:", e);
    return res.status(500).json({ success: false, message: e.message || "Failed to create review" });
  }
};

// PATCH /api/reviews/:id/status   (admin)
export const adminSetReviewStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: "approved" | "rejected" | "pending" };
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid review id" });
    }
    const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    await recalcProductRating(review.productId);
    res.json({ success: true, review });
  } catch (e: any) {
    console.error("❌ adminSetReviewStatus error:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to update status" });
  }
};
