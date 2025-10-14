// src/routes/sitemaps.ts
import express from "express";
import Product from "../models/Product";
const router = express.Router();

const BASE = "https://nakodamobile.com";
const MAX_URLS_PER_FILE = 45000; // safety < 50k
const SIX_HOURS = 6 * 60 * 60 * 1000;

let cache: Record<string, { xml: string; ts: number; etag: string }> = {};

const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const xmlWrap = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>${body}`;

const setHeaders = (res: express.Response, etag: string) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.setHeader("ETag", etag);
};

const fromCache = (key: string, res: express.Response) => {
  const hit = cache[key];
  if (!hit) return false;
  if (Date.now() - hit.ts > SIX_HOURS) return false;
  setHeaders(res, hit.etag);
  if (res.get("If-None-Match") === hit.etag) {
    res.status(304).end();
    return true;
  }
  res.send(hit.xml);
  return true;
};

const saveCache = (key: string, xml: string, res: express.Response) => {
  const etag = `"sm-${Buffer.from(String(xml.length)).toString("base64")}"`;
  cache[key] = { xml, ts: Date.now(), etag };
  setHeaders(res, etag);
  res.send(xml);
};

// ---- 1) Sitemap index ------------------------------------------------------
router.get("/sitemap.xml", async (req, res) => {
  if (fromCache("index", res)) return;

  // Count products for sharding
  const total = await Product.countDocuments({ isActive: { $ne: false } });
  const shards = Math.max(1, Math.ceil(total / MAX_URLS_PER_FILE));

  const parts: string[] = [];
  parts.push(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);

  // Static
  parts.push(`<sitemap><loc>${BASE}/sitemaps/static.xml</loc></sitemap>`);
  // Categories
  parts.push(`<sitemap><loc>${BASE}/sitemaps/categories.xml</loc></sitemap>`);
  // Products shards
  for (let i = 0; i < shards; i++) {
    parts.push(
      `<sitemap><loc>${BASE}/sitemaps/products-${i + 1}.xml</loc></sitemap>`
    );
  }
  parts.push(`</sitemapindex>`);

  saveCache("index", xmlWrap(parts.join("")), res);
});

// ---- 2) Static pages --------------------------------------------------------
router.get("/sitemaps/static.xml", async (req, res) => {
  if (fromCache("static", res)) return;

  const urls = [
    { loc: `${BASE}/`, pri: "1.0" },
    { loc: `${BASE}/products`, pri: "0.8" },
    { loc: `${BASE}/about`, pri: "0.5" },
    { loc: `${BASE}/contact`, pri: "0.5" },
    { loc: `${BASE}/policies/shipping`, pri: "0.4" },
    { loc: `${BASE}/policies/returns`, pri: "0.4" },
  ];

  const body =
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls
      .map(
        (u) =>
          `<url><loc>${u.loc}</loc><changefreq>weekly</changefreq><priority>${u.pri}</priority></url>`
      )
      .join("") +
    `</urlset>`;

  saveCache("static", xmlWrap(body), res);
});

// ---- 3) Categories ----------------------------------------------------------
router.get("/sitemaps/categories.xml", async (req, res) => {
  if (fromCache("categories", res)) return;

  const categories: string[] = await Product.distinct("category", {
    isActive: { $ne: false },
  });

  const urls = categories
    .filter(Boolean)
    .map((c) => {
      const slug = slugify(c);
      return `<url><loc>${BASE}/products?category=${encodeURIComponent(
        slug
      )}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
    });

  const body =
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.join("") +
    `</urlset>`;

  saveCache("categories", xmlWrap(body), res);
});

// ---- 4) Products (sharded) with <image:image> -------------------------------
router.get("/sitemaps/products-:n.xml", async (req, res) => {
  const key = `products-${req.params.n}`;
  if (fromCache(key, res)) return;

  const n = Math.max(1, parseInt(String(req.params.n || "1"), 10));
  const skip = (n - 1) * MAX_URLS_PER_FILE;

  const rows = await Product.find({ isActive: { $ne: false } })
    .select("slug name updatedAt images _id")
    .sort({ _id: 1 })
    .skip(skip)
    .limit(MAX_URLS_PER_FILE)
    .lean();

  const head =
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

  const urls = rows.map((p: any) => {
    const handle = slugify(p.slug || p.name || String(p._id));
    const loc = `${BASE}/product/${handle}`;
    const lastmod = new Date(p.updatedAt || Date.now()).toISOString();

    // choose one image if available
    const imgs = Array.isArray(p.images) ? p.images : [];
    const firstImg =
      imgs
        .map((x: any) =>
          typeof x === "string" ? x : x?.secure_url || x?.url || ""
        )
        .find((s: string) => !!s) || "";

    const imageTag = firstImg
      ? `<image:image><image:loc>${firstImg}</image:loc></image:image>`
      : "";

    return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>${imageTag}</url>`;
  });

  const body = head + urls.join("") + `</urlset>`;
  saveCache(key, xmlWrap(body), res);
});

export default router;
