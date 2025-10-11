// src/utils/imageUtils.ts — Cloudinary + S3 aware (handles spaces/+ in keys)

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const S3_PUBLIC_BASE = (import.meta.env.VITE_S3_PUBLIC_BASE || '').replace(/\/+$/, '');
const VARIANT_STYLE = (import.meta.env.VITE_IMG_VARIANT_STYLE || 'resized_dir') as 'resized_dir' | 'none';

const isHttp = (s: string) => /^https?:\/\//i.test(s);

export const isCloudinaryUrl = (url: string): boolean =>
  !!url && (/cloudinary\.com/.test(url) || /res\.cloudinary\.com/.test(url));

export const isS3Url = (url: string): boolean => {
  if (!url) return false;
  if (S3_PUBLIC_BASE && url.startsWith(S3_PUBLIC_BASE + '/')) return true;
  return /\.s3\.[^/]+\.amazonaws\.com\//.test(url);
};

// encode each path segment so spaces and '+' work
const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

// Convert absolute public URL → object key (best-effort)
const toKey = (src: string): string => {
  if (!src) return '';
  if (!isHttp(src)) return src.replace(/^\/+/, '');
  if (S3_PUBLIC_BASE && src.startsWith(S3_PUBLIC_BASE + '/')) return src.slice(S3_PUBLIC_BASE.length + 1);
  const m = src.match(/^https?:\/\/[^/]+\/(.+)$/);
  return m ? m[1] : src;
};

const toPublicUrl = (keyOrUrl: string): string => {
  if (!keyOrUrl) return '';
  if (isHttp(keyOrUrl)) return keyOrUrl;
  const key = keyOrUrl.replace(/^\/+/, '');
  const encoded = encodePath(key);
  const base = S3_PUBLIC_BASE || `${API_BASE_URL}/uploads`;
  return `${base}/${encoded}`;
};

/**
 * Resolve any image path to a usable URL (supports:
 *  - absolute URLs
 *  - local /uploads/*
 *  - relative keys (S3 object keys) like "products/abc.jpg"
 */
export const resolveImageUrl = (imagePath: string | undefined | null): string | undefined => {
  if (!imagePath || typeof imagePath !== 'string' || imagePath.trim() === '') return undefined;

  if (isHttp(imagePath)) {
    try {
      const u = new URL(imagePath);
      u.pathname = encodePath(u.pathname);
      return u.toString();
    } catch {
      // fallback simple replace if URL() fails
      return imagePath.replace(/ /g, '%20').replace(/\+/g, '%2B');
    }
  }

  if (imagePath.startsWith('/uploads/')) return `${API_BASE_URL}${encodePath(imagePath)}`;
  if (imagePath.startsWith('/')) return `${API_BASE_URL}${encodePath(imagePath)}`;

  // treat as S3 key or local filename
  return toPublicUrl(imagePath);
};

/** Return first valid image URL from list or CSV string */
export const getFirstImageUrl = (images: any): string | undefined => {
  if (!images) return;

  if (Array.isArray(images)) {
    const s = images.find((x) => typeof x === 'string' && x);
    if (s) return resolveImageUrl(s)!;

    const o = images.find((x) => x && (x.url || x.secure_url || x.path));
    if (o) return resolveImageUrl(o.url || o.secure_url || o.path)!;

    return;
  }

  if (typeof images === 'string') {
    const tok = images.split(/[,|\s]+/).find(Boolean);
    if (tok) return resolveImageUrl(tok)!;
  }

  return;
};

/** Basic Cloudinary transform injector */
const cloudinaryTransform = (url: string, width: number, height: number) => {
  const trans = `w_${Math.max(1, Math.floor(width))},h_${Math.max(1, Math.floor(height))},c_fill`;
  if (url.includes('/image/upload/')) {
    return url.replace(/(\/image\/upload\/)([^/]+\/)?/, `$1${trans}/`);
  }
  return url;
};

/** S3 variant URL by convention: products/foo.jpg → products/_resized/foo.md.jpg */
const s3VariantUrl = (src: string, width: number) => {
  const key = toKey(src);
  const parts = key.split('/');
  const file = parts.pop() || '';
  const dot = file.lastIndexOf('.');
  const name = dot > -1 ? file.slice(0, dot) : file;
  const ext = dot > -1 ? file.slice(dot) : '';
  const dir = parts.join('/');
  const resizedDir = (dir ? dir + '/' : '') + '_resized/';
  const suffix = width <= 200 ? 'thumb' : width <= 350 ? 'sm' : width <= 700 ? 'md' : 'lg';
  return toPublicUrl(`${resizedDir}${name}.${suffix}${ext}`);
};

/**
 * Optimized URL for thumbnails etc.
 * - Cloudinary: inject w_,h_,c_fill
 * - S3: return convention-based variant (if VARIANT_STYLE='resized_dir'), else original
 */
export const getOptimizedImageUrl = (urlOrKey: string, width: number, height: number): string => {
  if (!urlOrKey) return '';

  if (isCloudinaryUrl(urlOrKey)) return cloudinaryTransform(urlOrKey, width, height);

  if (VARIANT_STYLE === 'resized_dir') return s3VariantUrl(urlOrKey, width);

  return resolveImageUrl(urlOrKey) || '';
};
