// utils/cloudinaryBrowser.ts  (S3 version, same API)
// --------------------------------------------------

// We keep the same exports to avoid changing your components:
// - uploadToBrowser(file)               -> returns { secure_url, public_id, ... } like Cloudinary
// - uploadMultipleToBrowser(files, n?)
// - generateResponsiveImageUrl(src, options?)

export interface CloudinaryResponse {
  public_id: string;   // S3 key
  secure_url: string;  // public URL (CDN/S3)
  url: string;         // same as secure_url
  format: string;
  bytes: number;
  width: number;       // unknown in S3: 0
  height: number;      // unknown in S3: 0
  resource_type: string;
  created_at: string;
  tags: string[];
}

export interface ImageOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'crop' | 'scale' | 'limit' | 'pad';
  quality?: string;
  format?: string;
}

// ----- env -----
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
const PUBLIC_BASE = (import.meta.env.VITE_S3_PUBLIC_BASE || '').replace(/\/+$/, '');
const VARIANT_STYLE = (import.meta.env.VITE_IMG_VARIANT_STYLE || 'resized_dir') as
  | 'resized_dir'
  | 'none';

// ----- validation -----
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (!validTypes.includes(file.type)) return { valid: false, error: 'Invalid file type. Please select JPG, PNG, WebP, or GIF.' };
  if (file.size > maxSize) return { valid: false, error: 'File too large. Maximum size is 10MB.' };
  return { valid: true };
};

// ----- helpers -----
const apiUrl = (path: string) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
const nowISO = () => new Date().toISOString();

const toKey = (src: string): string => {
  // convert absolute public URL to S3 key if needed
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) {
    const base = PUBLIC_BASE;
    if (base && src.startsWith(base)) return src.slice(base.length + 1);
    // fallback: try to strip generic s3 host
    const m = src.match(/https?:\/\/[^/]+\/(.+)/);
    return m ? m[1] : src;
  }
  return src.replace(/^\/+/, '');
};

const toPublicUrl = (keyOrUrl: string) => {
  if (!keyOrUrl) return '';
  if (/^https?:\/\//i.test(keyOrUrl)) return keyOrUrl;
  if (!PUBLIC_BASE) return keyOrUrl; // backend already returns full URL usually
  return `${PUBLIC_BASE}/${keyOrUrl.replace(/^\/+/, '')}`;
};

// variant: products/foo.jpg -> products/_resized/foo.md.jpg
const variantUrl = (keyOrUrl: string, suffix: 'thumb' | 'sm' | 'md' | 'lg') => {
  const key = toKey(keyOrUrl);
  const parts = key.split('/');
  const file = parts.pop() || '';
  const dot = file.lastIndexOf('.');
  const name = dot > -1 ? file.slice(0, dot) : file;
  const ext = dot > -1 ? file.slice(dot) : '';
  const dir = parts.join('/');
  const resizedDir = (dir ? dir + '/' : '') + '_resized/';
  return toPublicUrl(`${resizedDir}${name}.${suffix}${ext}`);
};

// ----- core: S3 presign + PUT -----
async function presign(filename: string, contentType: string, folder = 'products') {
  const res = await fetch(apiUrl('/uploads/s3/sign'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, folder }),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Presign failed: ${res.status}`);
  }
  return json as { success: true; key: string; uploadUrl: string; publicUrl: string; expiresIn: number };
}

// ----- Single upload (keeps CloudinaryResponse shape) -----
export const uploadToBrowser = async (file: File): Promise<CloudinaryResponse> => {
  const v = validateFile(file);
  if (!v.valid) throw new Error(v.error);

  // 1) ask backend for PUT URL
  const { key, uploadUrl, publicUrl } = await presign(file.name, file.type, 'products');

  // 2) upload file to S3
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!put.ok) throw new Error(`S3 upload failed: ${put.status}`);

  // 3) return Cloudinary-like response so the rest of your app keeps working
  return {
    public_id: key,
    secure_url: publicUrl,
    url: publicUrl,
    format: (file.name.split('.').pop() || '').toLowerCase(),
    bytes: file.size,
    width: 0,  // unknown (S3 doesn’t give image dims)
    height: 0, // unknown
    resource_type: 'image',
    created_at: nowISO(),
    tags: [],
  };
};

// ----- Multi upload with concurrency -----
export const uploadMultipleToBrowser = async (files: File[], concurrency = 3): Promise<CloudinaryResponse[]> => {
  const out: CloudinaryResponse[] = [];
  let i = 0;
  async function worker() {
    while (i < files.length) {
      const idx = i++;
      out[idx] = await uploadToBrowser(files[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return out;
};

// ----- “Responsive” URL helper (S3 has no transforms; we use a convention) -----
// If you generate variants via Lambda or build, set VITE_IMG_VARIANT_STYLE=resized_dir
// and create files under products/_resized/<name>.(thumb|sm|md|lg).ext
export const generateResponsiveImageUrl = (
  src: string,
  options: ImageOptions = { width: 400, height: 400, crop: 'fill', quality: 'auto', format: 'auto' }
): string => {
  if (!src) return '';
  if (VARIANT_STYLE === 'resized_dir') {
    // Pick a suffix roughly by requested size
    const w = Number(options.width) || 0;
    const suffix = w <= 200 ? 'thumb' : w <= 350 ? 'sm' : w <= 700 ? 'md' : 'lg';
    return variantUrl(src, suffix);
  }
  // 'none' → return original URL/key
  return toPublicUrl(src);
};

// Optional validator for S3/CF URLs
export const validateCloudinaryUrl = (url: string): boolean => {
  // keep function name for compatibility; checks basic http(s) + image extension
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url);
};
