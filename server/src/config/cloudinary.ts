// S3-backed replacement for your Cloudinary module
// ------------------------------------------------
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  GetBucketLocationCommand,
} from "@aws-sdk/client-s3";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import mime from "mime-types";

// ---------- ENV ----------
const required = {
  S3_BUCKET: process.env.S3_BUCKET,
  S3_REGION: process.env.S3_REGION || "ap-south-1",
  S3_PUBLIC_BASE: process.env.S3_PUBLIC_BASE, // e.g. https://cdn.nakodamobile.in
  S3_UPLOAD_PREFIX: process.env.S3_UPLOAD_PREFIX || "products/",
  S3_PRESIGN_TTL_SECONDS: process.env.S3_PRESIGN_TTL_SECONDS || "120",
};
const missing = Object.entries(required)
  .filter(([k, v]) => !v && !["S3_PUBLIC_BASE"].includes(k))
  .map(([k]) => k);
if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);

const S3_BUCKET = required.S3_BUCKET!;
const S3_REGION = required.S3_REGION!;
const S3_PUBLIC_BASE =
  required.S3_PUBLIC_BASE ||
  `http://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
const PREFIX = required.S3_UPLOAD_PREFIX.replace(/^\/+|\/+$/g, "") + "/";
const PRESIGN_TTL = Number(required.S3_PRESIGN_TTL_SECONDS);

// ---------- CLIENT ----------
export const s3 = new S3Client({
  region: S3_REGION,
  credentials: fromNodeProviderChain(), // env/role/SSO automatically
});

// ---------- Types (compat with your code) ----------
export interface CloudinaryUploadResult {
  public_id: string;   // S3 key
  secure_url: string;  // public URL (S3 or CloudFront)
  url: string;         // same as secure_url
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  resource_type?: string;
  created_at: string;
  tags?: string[];
}
export interface CloudinaryError { message: string }

export interface ImageTransformOptions {
  width?: number; height?: number;
  crop?: "fill" | "fit" | "limit" | "scale" | "crop";
  quality?: "auto" | number;
  format?: "auto" | "jpg" | "png" | "webp";
  gravity?: "auto" | "face" | "center";
}
export interface UploadOptions {
  folder?: string; public_id?: string;
  resource_type?: "image" | "video" | "raw" | "auto";
  transformation?: ImageTransformOptions;
  tags?: string[]; context?: Record<string, string>;
  contentType?: string; metadata?: Record<string, string>;
}

// ---------- helpers ----------
const rand = (n = 9) => crypto.randomBytes(n).toString("hex");
const cleanFolder = (p?: string) => (p ? p.replace(/^\/+|\/+$/g, "") + "/" : "");
const publicUrlForKey = (key: string) =>
  `${S3_PUBLIC_BASE}/${key.replace(/^\/+/, "")}`;

function buildKey(filename: string, contentType?: string, folder?: string, explicit?: string) {
  if (explicit) return `${PREFIX}${cleanFolder(folder)}${explicit.replace(/^\/+/, "")}`;
  const ext =
    (contentType && (mime.extension(contentType) as string)) ||
    filename.split(".").pop() || "bin";
  return `${PREFIX}${cleanFolder(folder)}${Date.now()}-${rand()}.${ext}`;
}

// ---------- Upload single (Buffer or remote URL) ----------
export const uploadProductImages = async (
  file: Buffer | string,
  publicId: string,               // treated as desired relative key when provided
  originalFilename?: string
): Promise<CloudinaryUploadResult> => {
  try {
    let body: Buffer;
    let contentType: string | undefined;

    if (Buffer.isBuffer(file)) {
      body = file;
      contentType = "application/octet-stream";
    } else if (/^https?:\/\//i.test(file)) {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      body = Buffer.from(await res.arrayBuffer());
      contentType =
        res.headers.get("content-type") ||
        (mime.lookup(file) as string) ||
        "application/octet-stream";
    } else {
      body = Buffer.from(file);
      contentType = "application/octet-stream";
    }

    const key = buildKey(
      originalFilename || "image",
      contentType,
      "products",
      publicId // honor explicit id to mimic cloudinary public_id
    );

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      // ACL: "public-read", // only if you're not using CloudFront OAC + you allow ACLs
      Metadata: {},
    }));

    const url = publicUrlForKey(key);
    return {
      public_id: key,
      secure_url: url,
      url,
      format: key.split(".").pop(),
      bytes: body.length,
      resource_type: "image",
      created_at: new Date().toISOString(),
      tags: [],
    };
  } catch (error: any) {
    console.error("S3 upload error:", error?.message || error);
    throw new Error(`Failed to upload image: ${error?.message || error}`);
  }
};

// ---------- Batch upload with true limited concurrency ----------
export const batchUploadProductImages = async (
  files: Array<{ buffer: Buffer; filename: string; publicId: string }>,
  concurrency: number = 3
): Promise<CloudinaryUploadResult[]> => {
  const out: CloudinaryUploadResult[] = new Array(files.length);
  let i = 0;
  async function worker() {
    while (i < files.length) {
      const idx = i++;
      const f = files[idx];
      out[idx] = await uploadProductImages(f.buffer, f.publicId, f.filename);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, files.length) }, worker);
  await Promise.all(workers);
  return out;
};

// ---------- “Responsive” URLs (convention-based variants) ----------
const VARIANTS = { thumbnail: "thumb", small: "sm", medium: "md", large: "lg" } as const;

function variantKey(original: string, suffix: string) {
  const parts = original.split("/");
  const file = parts.pop() as string;
  const dot = file.lastIndexOf(".");
  const name = dot > -1 ? file.slice(0, dot) : file;
  const ext = dot > -1 ? file.slice(dot) : "";
  const dir = parts.join("/");
  const resizedDir = (dir ? dir + "/" : "") + "_resized/";
  return `${resizedDir}${name}.${suffix}${ext}`;
}

// NOTE: S3 can’t transform on-the-fly. These URLs assume you’ll generate
// _resized variants (via Lambda/Image pipeline). For now they’re just helpers.
export const generateResponsiveImageUrl = (
  publicId: string,
  _options: ImageTransformOptions = {}
): string => {
  const isUrl = /^https?:\/\//i.test(publicId);
  const key = isUrl ? publicId.replace(S3_PUBLIC_BASE + "/", "") : publicId;
  return publicUrlForKey(variantKey(key, VARIANTS.medium));
};
export const generateResponsiveImageSet = (
  publicId: string,
  sizes: (keyof typeof VARIANTS)[] = ["thumbnail", "small", "medium", "large"]
): Record<string, string> => {
  const isUrl = /^https?:\/\//i.test(publicId);
  const key = isUrl ? publicId.replace(S3_PUBLIC_BASE + "/", "") : publicId;
  const out: Record<string, string> = {};
  for (const s of sizes) out[s] = publicUrlForKey(variantKey(key, VARIANTS[s]));
  return out;
};

// ---------- Delete ----------
export const deleteImage = async (publicId: string): Promise<any> => {
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: publicId }));
  return { result: "ok" };
};
export const deleteImages = async (keys: string[]) => {
  if (!keys?.length) return { deleted: 0 };
  await s3.send(new DeleteObjectsCommand({
    Bucket: S3_BUCKET,
    Delete: { Objects: keys.map((Key) => ({ Key })) },
  }));
  return { deleted: keys.length };
};

// ---------- Search-like (prefix list) ----------
export const searchImagesByTag = async (tag: string): Promise<any> => {
  const Prefix = `${PREFIX}${tag.replace(/^\/+|\/+$/g, "")}`;
  const keys: string[] = [];
  let ContinuationToken: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix,
      ContinuationToken,
      MaxKeys: 1000,
    }));
    res.Contents?.forEach((o) => o.Key && keys.push(o.Key));
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return {
    resources: keys.map((k) => ({ public_id: k, secure_url: publicUrlForKey(k) })),
    total_count: keys.length,
  };
};

// ---------- Head/details ----------
export const getImageDetails = async (publicId: string): Promise<any> => {
  const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: publicId }));
  return {
    public_id: publicId,
    content_type: head.ContentType,
    content_length: head.ContentLength,
    eTag: head.ETag,
    last_modified: head.LastModified,
    metadata: head.Metadata,
    secure_url: publicUrlForKey(publicId),
  };
};

// ---------- Health ----------
export const testCloudinaryConnection = async (retries = 3): Promise<boolean> => {
  // kept old name for drop-in; this now pings S3
  for (let i = 1; i <= retries; i++) {
    try {
      await s3.send(new GetBucketLocationCommand({ Bucket: S3_BUCKET }));
      console.log("✅ S3 connection successful");
      return true;
    } catch (e) {
      console.error(`❌ S3 connection attempt ${i} failed`, e);
      if (i === retries) return false;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  return false;
};

// ---------- Usage/stats (Cloudinary-only concept) ----------
export const getUploadStats = async (): Promise<any> => null;

export default s3;
