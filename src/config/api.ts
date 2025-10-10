// src/config/api.ts
import axios, { AxiosError, AxiosRequestConfig } from "axios";

/* ============================================================================
   Base URL
   - Uses VITE_API_URL if present, otherwise a RELATIVE "/api" (works on any domain)
   - We normalize trailing slashes so axios doesn’t produce double slashes.
============================================================================ */
const norm = (s?: string) => (s || "").replace(/\/+$/, "");
const API_BASE_URL = norm(import.meta.env.VITE_API_URL) || "/api";

/* ============================================================================
   Axios instance
============================================================================ */
const api = axios.create({
  baseURL: API_BASE_URL, // e.g. "https://nakodamobile.com/api" or "/api"
  withCredentials: true,
  timeout: 30000,
});

// Small helper in case you ever want to set token after login without reload
export const setAuthToken = (token?: string) => {
  if (token) {
    localStorage.setItem("nakoda-token", token);
  } else {
    localStorage.removeItem("nakoda-token");
  }
};

/* ------------------------------- REQUEST ---------------------------------- */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("nakoda-token");

    // Don’t force auth header on phone auth endpoints
    const rawUrl = config.url || "";
    const base = config.baseURL ? norm(config.baseURL) : "";
    const url = base && rawUrl.startsWith(base) ? rawUrl.slice(base.length) : rawUrl;
    const isPhoneAuth = url.startsWith("/auth/phone/") || url.includes("/auth/phone/");

    if (!isPhoneAuth && token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    // Don’t globally set Content-Type; axios infers JSON vs FormData automatically.
    return config;
  },
  (error) => Promise.reject(error)
);

/* ------------------------------- RESPONSE --------------------------------- */
const shouldSkip401Redirect = (config?: AxiosRequestConfig): boolean => {
  const url: string = (config?.url as string) || "";
  if (url.includes("/support/tickets/my")) return true; // public tokenless view
  const p = (config?.params || {}) as Record<string, any>;
  if (String(p.skip401) === "1" || String(p.skipRedirect) === "1") return true;
  return false;
};

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    const status = error?.response?.status;
    if (status === 401 && !shouldSkip401Redirect(error.config as AxiosRequestConfig)) {
      setAuthToken(undefined);
      localStorage.removeItem("nakoda-user");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/* ============================================================================
   Types
============================================================================ */
export type Product = {
  _id: string;
  name: string;
  slug?: string;
  price: number;
  originalPrice?: number;
  images?: string[];
  imageUrl?: string;
  rating?: number;
  category?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Category = {
  _id: string;
  id?: string;
  name: string;
  slug?: string;
  image?: string;
  order?: number;
  isActive?: boolean;
};

export type ReviewSummary = {
  productId: string;
  avg: number;
  count: number;
};

export type Paginated<T> = {
  success?: boolean;
  items?: T[];
  products?: T[];
  total?: number;
  page?: number;
  limit?: number;
};

export type SortKey = "popular" | "trending" | "new" | "price_asc" | "price_desc";
export interface ProductListParams {
  page?: number;
  limit?: number;
  sort?: SortKey;
  status?: "active" | "inactive";
  category?: string;
  q?: string;
}

/* ============================================================================
   Helper: unwrap axios data
============================================================================ */
const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

/* ============================================================================
   PRODUCTS
============================================================================ */
export const getProducts = (params?: ProductListParams) =>
  data<Paginated<Product>>(api.get("/products", { params }));

export const getProductByIdOrSlug = (idOrSlug: string) =>
  data<{ success?: boolean; product: Product }>(api.get(`/products/${encodeURIComponent(idOrSlug)}`));

export const getCategories = () =>
  data<{ success?: boolean; categories?: Category[]; items?: Category[] }>(
    api.get("/products/categories")
  );

export const getReviewSummary = (productId: string) =>
  data<ReviewSummary>(api.get("/reviews/summary", { params: { productId } }));

/* ============================================================================
   NEWSLETTER
============================================================================ */
export const subscribeNewsletter = (email: string, tag = "default", source = "site") =>
  data<{ success: boolean }>(
    api.post("/newsletter/subscribe", { email, tag, source })
  );

/* ============================================================================
   S3 UPLOAD UTILITIES (presign + delete)
   Pairs with your /routes/uploads.s3.ts on the server
============================================================================ */
export const presignUpload = (file: File) => {
  const params = {
    filename: file.name,
    contentType: file.type,
    size: file.size,
  };
  return data<{ uploadUrl: string; publicUrl: string; key: string }>(
    api.get("/uploads/s3/sign", { params })
  );
};

export const deleteS3Object = (url: string) =>
  data<{ success?: boolean }>(api.delete("/uploads/s3", { params: { url } }));

/* ============================================================================
   RETURNS (user)
============================================================================ */
export const getMyReturns = () => data(api.get("/returns"));

export const createReturn = (payload: {
  orderId: string;
  items: { productId: string; orderItemId?: string; quantity: number; reason?: string }[];
  reasonType: "damaged" | "wrong_item" | "not_as_described" | "defective" | "no_longer_needed" | "other";
  reasonNote?: string;
  images?: File[];
  pickupAddress?: any;
}) => {
  const fd = new FormData();
  fd.append("orderId", payload.orderId);
  fd.append("reasonType", payload.reasonType);
  if (payload.reasonNote) fd.append("reasonNote", payload.reasonNote);
  fd.append("items", JSON.stringify(payload.items));
  if (payload.pickupAddress) fd.append("pickupAddress", JSON.stringify(payload.pickupAddress));
  (payload.images || []).forEach((f) => fd.append("images", f));
  return data(api.post("/returns", fd));
};

export const cancelMyReturn = (id: string) =>
  data(api.patch(`/returns/${id}/cancel`, {}));

/* ============================================================================
   SUPPORT
============================================================================ */
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high";

export interface SupportFaq {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  order?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportConfig {
  channels: { email: boolean; phone: boolean; whatsapp: boolean; chat?: boolean };
  email: { address: string; responseTimeHours: number };
  phone: { number: string; hours: string };
  whatsapp: { number: string; link: string };
  faq: { enabled: boolean; url?: string };
  updatedAt?: string;
  createdAt?: string;
  _id?: string;
}

export interface SupportTicket {
  _id: string;
  subject: string;
  message: string;
  email: string;
  phone?: string;
  orderId?: string;
  category?: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt?: string;
}

export const getSupportConfig = () =>
  data<{ success: boolean; config: SupportConfig }>(api.get("/support/config"));

export const getSupportFaqs = (params?: { q?: string; category?: string }) =>
  data<{ success: boolean; faqs: SupportFaq[] }>(api.get("/support/faqs", { params }));

export const createSupportTicket = (payload: {
  subject: string;
  message: string;
  email: string;
  phone?: string;
  orderId?: string;
  category?: string;
  priority?: TicketPriority;
  attachments?: File[];
}) => {
  const form = new FormData();
  form.append("subject", payload.subject);
  form.append("message", payload.message);
  form.append("email", payload.email);
  if (payload.phone) form.append("phone", payload.phone);
  if (payload.orderId) form.append("orderId", payload.orderId);
  if (payload.category) form.append("category", payload.category);
  if (payload.priority) form.append("priority", payload.priority);
  (payload.attachments || []).forEach((f) => form.append("attachments", f));
  return data<{ success: boolean; ticket: { _id: string; status: TicketStatus } }>(
    api.post("/support/tickets", form)
  );
};

// Public (skip 401 redirect)
export const getMySupportTickets = () =>
  data<{ success: boolean; tickets: SupportTicket[] }>(
    api.get("/support/tickets/my", { params: { skip401: 1 } })
  );

/* ============================================================================
   AUTH (Phone OTP)
============================================================================ */
export const sendPhoneOtp = (phone: string) =>
  data(api.post("/auth/phone/send-otp", { phone }, { params: { skip401: 1 } }));

export const verifyPhoneOtp = (phone: string, otp: string) =>
  data(api.post("/auth/phone/verify", { phone, otp }, { params: { skip401: 1 } }));

/* ============================================================================
   Misc
============================================================================ */
export const health = () => data(api.get("/health").catch(() => ({ data: { ok: false } })));
export const getApiBase = () => API_BASE_URL;

export default api;
