import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import mongoose from "mongoose";
import { parseUserQuery } from "../scripts/parseQuery";
import { composeAnswer } from "../config/ai";

const router = Router();


const Product: any =
  (mongoose.models as any).Product ||
  mongoose.model(
    "Product",
    new (mongoose as any).Schema({}, { strict: false }),
    "products"
  );

const limiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

const bodySchema = z.object({
  message: z.string().min(1),
  userId: z.string().optional(),
  context: z.any().optional(),
  limit: z.number().min(1).max(12).optional(),
});

router.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const { message, limit = 8 } = parsed.data;

  try {
    const { q, minPrice, maxPrice, requireFeatures = [], categoryHint } = parseUserQuery(message);
    const useAtlas = process.env.ATLAS_SEARCH === "1" || process.env.ATLAS_SEARCH === "true";

    let products: any[] = [];

    if (useAtlas) {
      const pipeline: any[] = [];

      if (q?.trim()) {
        pipeline.push({
          $search: {
            index: process.env.ATLAS_INDEX || "default",
            compound: {
              should: [
                { text: { path: ["name","description","brand","category","features"], query: q } },
                { autocomplete: { path: "name", query: q, tokenOrder: "sequential" } }
              ]
            }
          }
        });
      }

      const match: any = {};
      if (minPrice != null || maxPrice != null) match.price = {};
      if (minPrice != null) match.price.$gte = minPrice;
      if (maxPrice != null) match.price.$lte = maxPrice;

      if (categoryHint) match.category = new RegExp(categoryHint, "i");
      if (requireFeatures.length) match.features = { $all: requireFeatures.map(f => new RegExp(f, "i")) };

      if (Object.keys(match).length) pipeline.push({ $match: match });

      pipeline.push({ $addFields: { score: { $meta: "searchScore" } } });
      pipeline.push({ $sort: { score: -1, price: 1 } }, { $limit: limit });

      products = await Product.aggregate(pipeline);
    } else {
      const match: any = {};
      if (minPrice != null) match.price = { ...match.price, $gte: minPrice };
      if (maxPrice != null) match.price = { ...match.price, $lte: maxPrice };
      if (categoryHint) match.category = new RegExp(categoryHint, "i");
      if (requireFeatures.length) match.features = { $all: requireFeatures.map(f => new RegExp(f, "i")) };

      if (q?.trim()) {
        products = await Product
          .find({ $text: { $search: q }, ...match }, { score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" }, price: 1 })
          .limit(limit)
          .lean();
      } else {
        products = await Product
          .find(match)
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
      }
    }

    const normalized = products.map((p: any) => ({
      id: p._id?.toString?.() ?? p.id,
      name: p.name,
      price: p.price,
      currency: p.currency,
      brand: p.brand,
      category: p.category,
      features: p.features,
      stock: p.stock,
      images: p.images,
      description: p.description,
    }));

    const text = await composeAnswer(
      `Filters -> price<=${maxPrice ?? "∞"}, features:${requireFeatures.join(",") || "-"}, category:${categoryHint || "-"}\n\n` + message,
      normalized
    );

    res.json({ text, products: normalized });
  } catch (e: any) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ error: "Chat failed" });
  }
});

export default router;
