// src/routes/reviews.public.ts
import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { body, param, query, validationResult } from "express-validator";
import NodeCache from "node-cache";
import Review from "../models/Review";
import Product from "../models/Product";

const r = Router();

// ✅ 60s cache for summary results
const reviewCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

/* ------------------------------ helpers ------------------------------ */
const setCacheHeaders = (res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
};

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

// When we approve/create (auto-publish) reviews, recompute product rating/count
async function recomputeProductStats(productId: string) {
  const pid = toObjectId(productId);
  const [agg] = await Review.aggregate([
    { $match: { productId: pid, status: "approved" } },
    { $group: { _id: "$productId", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
  ]);

  const total = agg?.count ?? 0;
  const avg = agg?.avg ? Math.round(agg.avg * 10) / 10 : 0;

  // Update both naming styles for safety (your schema might use either)
  await Product.findByIdAndUpdate(
    pid,
    { $set: { rating: avg, reviewsCount: total, averageRating: avg, ratingsCount: total } },
    { new: false }
  );

  reviewCache.del(`review-summary:${productId}`);
}

/* -------------------------------------------------------------------------- */
/* GET: list reviews (approved, paginated, typed & sorted)                     */
/* -------------------------------------------------------------------------- */
type ListParams = { productId: string };
type ListQuery = { page?: string; limit?: string; sort?: "top" | "new" | "old" };

r.get<ListParams, any, any, ListQuery>(
  "/products/:productId/reviews",
  param("productId").isMongoId(),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
  query("sort").optional().isIn(["top", "new", "old"]),
  async (req: Request<ListParams, any, any, ListQuery>, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const pid = toObjectId(req.params.productId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const sort = (req.query.sort as ListQuery["sort"]) || "new";

    // ✅ Fix TS: constrain to 1 | -1 literals
    type SortObj = Record<string, 1 | -1>;
    const sortOpt: SortObj =
      sort === "top"
        ? { rating: -1, createdAt: -1 }
        : sort === "old"
        ? { createdAt: 1 }
        : { createdAt: -1 };

    try {
      const match = { productId: pid, status: "approved" as const };
      const [data, total] = await Promise.all([
        Review.find(match).sort(sortOpt).skip((page - 1) * limit).limit(limit).lean(),
        Review.countDocuments(match),
      ]);

      setCacheHeaders(res);
      res.json({
        success: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      console.error("reviews.list err", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* POST: create review                                                         */
/* -------------------------------------------------------------------------- */
type CreateParams = { productId: string };

r.post<CreateParams>(
  "/products/:productId/reviews",
  param("productId").isMongoId(),
  body("rating").isInt({ min: 1, max: 5 }),
  body("comment").isString().isLength({ min: 5, max: 4000 }),
  body("title").optional().isString().isLength({ max: 120 }),
  body("userName").optional().isString(),
  body("userEmail").optional().isEmail(),
  async (req: Request<CreateParams>, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const pid = toObjectId(req.params.productId);
      const product = await Product.findById(pid).select("_id name").lean();
      if (!product) return res.status(404).json({ success: false, message: "Product not found" });

      const autoPublish = String(process.env.AUTO_PUBLISH_REVIEWS || "").toLowerCase() === "true";
      const user = (req as any).user;

      const created = await Review.create({
        productId: pid,
        productName: product.name,
        rating: Number(req.body.rating),
        title: String(req.body.title || "").trim() || undefined,
        comment: String(req.body.comment || "").trim(),
        verified: false,
        status: autoPublish ? "approved" : "pending",
        userId: user?._id,
        userName: user?.name || req.body.userName,
        userEmail: user?.email || req.body.userEmail,
      });

      if (autoPublish) await recomputeProductStats(String(pid));

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      console.error("reviews.create err", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);


type ApproveParams = { id: string };

r.patch<ApproveParams>("/reviews/:id/approve", param("id").isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const doc = await Review.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "approved" } },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ success: false, message: "Review not found" });

    await recomputeProductStats(String(doc.productId));
    res.json({ success: true });
  } catch (err: any) {
    console.error("reviews.approve err", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -------------------------------------------------------------------------- */
/* POST: mark helpful                                                          */
/* -------------------------------------------------------------------------- */
type HelpfulParams = { id: string };

r.post<HelpfulParams>("/reviews/:id/helpful", param("id").isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    await Review.findByIdAndUpdate(req.params.id, { $inc: { helpful: 1 } }, { upsert: false });
    res.json({ success: true });
  } catch (err: any) {
    console.error("reviews.helpful err", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -------------------------------------------------------------------------- */
/* GET: per-product summary (cached)                                           */
/* -------------------------------------------------------------------------- */
type SummaryQuery = { productId: string };

r.get<any, any, any, SummaryQuery>(
  "/reviews/summary",
  query("productId").isMongoId(),
  async (req: Request<any, any, any, SummaryQuery>, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { productId } = req.query;
      const cacheKey = `review-summary:${productId}`;
      const cached = reviewCache.get(cacheKey);
      if (cached) {
        setCacheHeaders(res);
        return res.json({ success: true, cached: true, data: cached });
      }

      const pid = toObjectId(productId);
      const [agg] = await Review.aggregate([
        { $match: { productId: pid, status: "approved" } },
        { $group: { _id: "$productId", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
      ]);

      const total = agg?.count ?? 0;
      const avg = agg?.avg ? Math.round(agg.avg * 10) / 10 : 0;

      await Product.findByIdAndUpdate(pid, {
        $set: { rating: avg, reviewsCount: total, averageRating: avg, ratingsCount: total },
      }).lean();

      const summary = { avg, total, averageRating: avg, reviewCount: total }; // both shapes
      reviewCache.set(cacheKey, summary);

      setCacheHeaders(res);
      res.json({ success: true, cached: false, data: summary });
    } catch (err: any) {
      console.error("reviews.summary err", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* POST: bulk summaries                                                        */
/* -------------------------------------------------------------------------- */
r.post("/reviews/bulk-summary", async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as { productIds?: string[] };
    const productIds = Array.isArray(body.productIds) ? body.productIds.slice(0, 300) : [];

    const ids = productIds.filter((id) => mongoose.isValidObjectId(id)).map(toObjectId);
    if (!ids.length) {
      setCacheHeaders(res);
      return res.json({ success: true, data: {} });
    }

    const agg = await Review.aggregate([
      { $match: { productId: { $in: ids }, status: "approved" } },
      { $group: { _id: "$productId", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
    ]);

    const data: Record<string, { avg: number; total: number; averageRating: number; reviewCount: number }> = {};
    for (const a of agg) {
      const avg = a.avg ? Math.round(a.avg * 10) / 10 : 0;
      const total = a.count || 0;
      data[String(a._id)] = { avg, total, averageRating: avg, reviewCount: total };
    }

    setCacheHeaders(res);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error("reviews.bulk-summary err", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default r;
