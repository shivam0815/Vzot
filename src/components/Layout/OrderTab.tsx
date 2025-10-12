// src/pages/admin/OrdersTab.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getSocket, joinAdminRoom } from '../../config/socket';
import {
  EyeIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  XMarkIcon,
  CheckCircleIcon,
  TruckIcon,
  ClockIcon,
  BanknotesIcon,
  DocumentDuplicateIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';

/* =========================
   Types
========================= */
type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

interface IUser {
  _id?: string;
  name?: string;
  email?: string;
}

interface IOrderItem {
  productId?: string | { _id?: string; name?: string; image?: string };
  name?: string;
  image?: string;
  quantity: number;
  price: number;
}

interface IOrder {
  _id: string;
  orderNumber?: string;
  userId?: IUser;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus; // mapped from .orderStatus if needed
  paymentMethod: 'razorpay' | 'cod';
  paymentStatus?: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid';
  createdAt: string;
}

/** GST details as stored on the Order (optional) */
type GstDetails = {
  wantInvoice: boolean;
  gstin?: string;
  legalName?: string;
  placeOfSupply?: string;
  taxPercent?: number;  // e.g. 18
  taxBase?: number;     // taxable value
  taxAmount?: number;   // total GST

  // UI/possible-future fields (not in backend GstSchema yet)
  cgst?: number;
  sgst?: number;
  igst?: number;
  invoiceNumber?: string;
  invoiceUrl?: string;
};

/** Full order (drawer fetch) – fields optional to be resilient */
interface IOrderFull extends IOrder {
  shippingAddress?: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  };
  billingAddress?: IOrderFull['shippingAddress'];
  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
  estimatedDelivery?: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  updatedAt?: string;
  paymentOrderId?: string;
  paymentId?: string;
  paymentSignature?: string;

  /* ---- Shiprocket fields ---- */
  shipmentId?: number;
  awbCode?: string;
  courierName?: string;
  labelUrl?: string;
  invoiceUrl?: string;
  manifestUrl?: string;
  shiprocketStatus?:
    | 'ORDER_CREATED'
    | 'AWB_ASSIGNED'
    | 'PICKUP_GENERATED'
    | 'LABEL_READY'
    | 'INVOICE_READY'
    | 'MANIFEST_READY'
    | 'TRACKING_UPDATED';

  /* ---- GST ---- */
  gst?: GstDetails;

  /* ---- Package & shipping payment ---- */
  shippingPackage?: IShippingPackage;
  shippingPayment?: IShippingPayment;
}

// at top
type ShippingPaymentStatus = 'pending' | 'paid' | 'partial' | 'expired' | 'cancelled';
interface IShippingPackage {
  lengthCm?: number; breadthCm?: number; heightCm?: number; weightKg?: number;
  notes?: string; images?: string[]; packedAt?: string;
}
interface IShippingPayment {
  linkId?: string; shortUrl?: string;
  status?: ShippingPaymentStatus;
  currency?: string; amount?: number; amountPaid?: number; paymentIds?: string[];
  paidAt?: string;
}

/* =========================
   Utils
========================= */

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);

const dt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

const getInitials = (name?: string, email?: string) => {
  const src = (name || email || 'U').trim();
  const parts = src.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getAdminToken = () =>
  localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

/** NOTE: keep base the same to avoid breaking existing API wiring */
const API_BASE = '/api/orders';
const API_SHIPROCKET_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, ''); // our backend mount for shiprocket routes

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

const ORDER_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
];

const nextStatus = (s: OrderStatus): OrderStatus | null => {
  const i = ORDER_FLOW.indexOf(s);
  if (i === -1 || i === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[i + 1];
};

const pill = (s: string) =>
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs capitalize border ' +
  (s === 'pending'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : s === 'confirmed'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : s === 'processing'
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : s === 'shipped'
    ? 'bg-purple-50 text-purple-700 border-purple-200'
    : s === 'delivered'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : s === 'cod_paid' || s === 'paid'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : s === 'awaiting_payment' || s === 'cod_pending'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : s === 'failed' || s === 'cancelled'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-gray-50 text-gray-700 border-gray-200');

const iconFor = (s: string) => {
  switch (s) {
    case 'delivered':
    case 'paid':
    case 'cod_paid':
      return <CheckCircleIcon className="w-4 h-4" />;
    case 'shipped':
      return <TruckIcon className="w-4 h-4" />;
    case 'processing':
    case 'pending':
    default:
      return <ClockIcon className="w-4 h-4" />;
  }
};

const toNum = (v: any) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/** Robust GST view that falls back to order.invoiceUrl for link and computes % if missing */
function getGstView(o?: IOrderFull) {
  const g = (o?.gst || {}) as GstDetails;
  const subtotal = toNum(o?.subtotal ?? 0);
  const tax = toNum(o?.tax ?? 0);

  const taxPercent =
    typeof g.taxPercent === 'number'
      ? g.taxPercent
      : subtotal > 0
        ? Math.round((tax / subtotal) * 100)
        : 0;

  return {
    wantInvoice: !!g.wantInvoice || !!g.gstin,
    gstin: g.gstin || '',
    legalName: g.legalName || '',
    pos: g.placeOfSupply || '',
    taxPercent,
    taxBase: typeof g.taxBase === 'number' ? g.taxBase : subtotal,
    taxAmount: typeof g.taxAmount === 'number' ? g.taxAmount : tax,

    // fall back to root order.invoiceUrl (Shiprocket) if GST-specific url not present
    invoiceNumber: g.invoiceNumber || '',
    invoiceUrl: g.invoiceUrl || (o?.invoiceUrl || ''),

    // optional splits (unused unless backend adds them)
    cgst: g.cgst,
    sgst: g.sgst,
    igst: g.igst,
  };
}


// helper inside OrdersTab component (top-level, before return)
async function presign(file: File) {
  const qs = new URLSearchParams({
    filename: file.name,
    contentType: file.type,
    size: String(file.size),
  });
  const r = await fetch(`/api/uploads/s3/sign?${qs.toString()}`, { credentials: "include" });
  if (!r.ok) throw new Error("Sign failed");
  return r.json(); // { uploadUrl, publicUrl }
}

async function putWithProgress(url: string, file: File, onProgress?: (pct:number)=>void) {
  // Plain fetch doesn't expose progress; use XHR for progress bar
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded/e.total)*100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
    xhr.onerror = () => reject(new Error("Upload error"));
    xhr.send(file);
  });
}

async function deleteS3(url: string) {
  const qs = new URLSearchParams({ url });
  const r = await fetch(`/api/uploads/s3?${qs.toString()}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error("Delete failed");
}



/* =========================
   Small UI helpers
========================= */
const Segment: React.FC<{
  value: string;
  options: string[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
  <div className="inline-flex rounded-xl border bg-white overflow-hidden">
    {options.map((opt) => {
      const active = opt === value;
      return (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={
            'px-3 py-1.5 text-sm transition whitespace-nowrap ' +
            (active
              ? 'bg-gray-900 text-white'
              : 'text-gray-700 hover:bg-gray-50')
          }
        >
          {opt}
        </button>
      );
    })}
  </div>
);

const ChipButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
> = ({ active, className = '', children, ...props }) => (
  <button
    {...props}
    className={
      'px-3 py-1.5 rounded-full text-xs border transition ' +
      (active
        ? 'bg-gray-900 text-white border-gray-900'
        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50') +
      (className ? ' ' + className : '')
    }
  >
    {children}
  </button>
);

/* =========================
   Main Component
========================= */
const OrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters & sorting
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<'createdAt' | 'total'>('createdAt');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [toolbarLayout, setToolbarLayout] = useState<'compact' | 'expanded'>('expanded');

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // actions state
  const [busyId, setBusyId] = useState<string | null>(null);

  // drawer state
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<IOrderFull | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Alerts/sounds
  const [banner, setBanner] = useState<string | null>(null);
  const dingRef = useRef<HTMLAudioElement | null>(null);
  const originalTitle = useRef<string>(document.title);

  const queryDebounced = useDebounced(query, 250);

  /* preload sound & notifications */
  useEffect(() => {
    dingRef.current = new Audio('/sounds/new-order.wav');
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    const onVisible = () => (document.title = originalTitle.current);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  /* fetch list */
  async function fetchOrders() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/all`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || data.success === false)
        throw new Error(data.message || 'Failed to load orders');

      const list: IOrder[] = (Array.isArray(data) ? data : data.orders || data.data || []).map(
        (o: any) => ({ ...o, status: o.status || o.orderStatus || 'pending' })
      );
      list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setOrders(list);
    } catch (e: any) {
      setError(e.message || 'Error loading orders');
    } finally {
      setLoading(false);
    }
  }

  // fetch one
  const fetchOrderDetails = async (id: string) => {
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/orders/admin/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to load order');

      const o = data.order || {};
      const sp = o.shippingPayment || o.shipping_payment || {};
      const pkg = o.shippingPackage || o.shipping_package || {};

      setSelected({
        ...o,
        status: o.status || o.orderStatus || 'pending',
        shippingPayment: {
          status: sp.status,
          // map snake_case -> camelCase too
          shortUrl: sp.shortUrl ?? sp.short_url,
          linkId: sp.linkId ?? sp.link_id,
          currency: sp.currency,
          amount: sp.amount ?? undefined,
          amountPaid: sp.amountPaid ?? sp.amount_paid,
          paymentIds: sp.paymentIds ?? sp.payment_ids ?? [],
          paidAt: sp.paidAt ?? sp.paid_at,
        },
        shippingPackage: {
          lengthCm: pkg.lengthCm ?? pkg.length_cm,
          breadthCm: pkg.breadthCm ?? pkg.breadth_cm,
          heightCm: pkg.heightCm ?? pkg.height_cm,
          weightKg: pkg.weightKg ?? pkg.weight_kg,
          notes: pkg.notes,
          images: pkg.images || [],
          packedAt: pkg.packedAt ?? pkg.packed_at,
        },
      });
    } catch (e: any) {
      alert(e.message || 'Failed to load order');
    } finally {
      setDrawerLoading(false);
    }
  };

  async function setStatus(id: string, status: OrderStatus) {
    try {
      setBusyId(id);
      const res = await fetch(`${API_BASE}/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false)
        throw new Error(data.message || 'Failed to update order');

      const updated = (data.order || data.data || data) as any;
      setOrders(prev =>
        prev.map(o =>
          o._id === id
            ? { ...o, ...updated, status: (updated.status || updated.orderStatus || status) as OrderStatus }
            : o
        )
      );
      if (selected && selected._id === id) {
        setSelected(prev => (prev ? { ...prev, ...updated, status: updated.status || updated.orderStatus || status } : prev));
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update order');
    } finally {
      setBusyId(null);
    }
  }

  const acceptOrder = (id: string) => setStatus(id, 'confirmed');
  const advance = (id: string, s: OrderStatus) => {
    const ns = nextStatus(s);
    if (ns) setStatus(id, ns);
  };
  const cancelOrder = (id: string) => {
    if (!confirm('Cancel this order?')) return;
    setStatus(id, 'cancelled');
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  /* sockets */
  const notifyNewOrder = (order: IOrder) => {
    const titleNum = (order.orderNumber || order._id.slice(-8)).toUpperCase();
    const who = order.userId?.name || order.userId?.email || 'New customer';
    const body = `${who} • ${order.items.length} item(s) • ${currency(order.total)}`;

    setBanner(`🆕 New order #${titleNum} — ${body}`);
    setTimeout(() => setBanner(null), 6000);

    dingRef.current?.play().catch(() => {});
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New order #${titleNum}`, {
        body,
        icon: '/favicon.ico',
        tag: order._id,
      });
    }
    if (document.hidden) document.title = `● New order! — ${originalTitle.current}`;
    if (navigator.vibrate) navigator.vibrate(150);
  };

  useEffect(() => {
    const socket = getSocket();
    joinAdminRoom();

    const onCreated = (payload: any) => {
      const normalized: IOrder = {
        ...payload,
        status: payload.status || payload.orderStatus || 'pending',
      };
      setOrders(prev =>
        prev.some(o => o._id === normalized._id) ? prev : [normalized, ...prev]
      );
      notifyNewOrder(normalized);
    };

    const onUpdated = (payload: any) => {
      setOrders(prev =>
        prev.map(o =>
          o._id === payload._id
            ? { ...o, ...payload, status: payload.status || payload.orderStatus || o.status }
            : o
        )
      );
      if (selected && selected._id === payload._id) {
        setSelected(prev =>
            prev ? { ...prev, ...payload, status: payload.status || payload.orderStatus || prev.status } : prev
        );
      }
    };

    socket.on('orderCreated', onCreated);
    socket.on('orderStatusUpdated', onUpdated);
    return () => {
      socket.off('orderCreated', onCreated);
      socket.off('orderStatusUpdated', onUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /* quick stats & computed views */
  const totals = useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const avgOrderValue = orders.length ? Math.round(totalRevenue / orders.length) : 0;
    const byStatus: Record<string, number> = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { totalRevenue, avgOrderValue, byStatus };
  }, [orders]);

  /* filters + sorting + date range */
  const filtered = useMemo(() => {
    const q = queryDebounced.trim().toLowerCase();
    const start = fromDate ? +new Date(fromDate) : null;
    const end = toDate ? +new Date(toDate + 'T23:59:59') : null;

    let rows = orders.filter(o => {
      const byStatus = filter === 'all' || o.status === filter;
      const idMatch =
        o._id.toLowerCase().includes(q) ||
        (o.orderNumber || '').toLowerCase().includes(q);
      const userMatch =
        (o.userId?.email || '').toLowerCase().includes(q) ||
        (o.userId?.name || '').toLowerCase().includes(q);

      const createdTs = +new Date(o.createdAt);
      const dateOK =
        (start === null || createdTs >= start) &&
        (end === null || createdTs <= end);

      return byStatus && (q ? idMatch || userMatch : true) && dateOK;
    });

    rows = rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'createdAt') {
        return (+(new Date(a.createdAt)) - +(new Date(b.createdAt))) * dir;
      }
      return (a.total - b.total) * dir;
    });

    return rows;
  }, [orders, filter, queryDebounced, sortKey, sortDir, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    // reset page on key filter/sort changes
    setPage(1);
  }, [filter, queryDebounced, sortKey, sortDir, fromDate, toDate, pageSize]);

  /* csv export */
  const exportCSV = () => {
    const headers = [
      'OrderID',
      'OrderNumber',
      'CustomerName',
      'CustomerEmail',
      'ItemsCount',
      'Subtotal',
      'Tax',
      'Shipping',
        'ShippingStatus',
      'Total',
      'Status',
      'PaymentMethod',
      'PaymentStatus',
      'CreatedAt',
      'GSTIN',       // NEW
      'GST_%',       // NEW
      'GST_Amount',  // NEW
    ];
    const lines = filtered.map(o =>
      [
        o._id,
        o.orderNumber || '',
        o.userId?.name || '',
        o.userId?.email || '',
        o.items.length,
        o.subtotal,
        o.tax,
        o.shipping === 0 ? 'FREE' : 'PAID',
        o.total,
        o.status,
        o.paymentMethod,
        o.paymentStatus || '',
        dt(o.createdAt),
        (o as any).gst?.gstin || '',
        (o as any).gst?.taxPercent ?? '',
        (o as any).gst?.taxAmount ?? o.tax ?? '',
      ].join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openDetails = (id: string) => {
    setSelectedId(id);
    setOpenDrawer(true);
    setSelected(null);
    fetchOrderDetails(id);
  };

  const copyText = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
    } catch {}
  };

  const setPreset = (preset: 'today' | '7d' | '30d' | 'clear') => {
    const today = new Date();
    if (preset === 'clear') {
      setFromDate('');
      setToDate('');
      return;
    }
    const toStr = today.toISOString().slice(0, 10);
    if (preset === 'today') {
      setFromDate(toStr);
      setToDate(toStr);
    } else if (preset === '7d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(toStr);
    } else {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(toStr);
    }
  };

  /* =========================
     Shiprocket action callers
  ========================= */
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getAdminToken()}`,
  });

  const srCreate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/create`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to create Shiprocket order');
      alert(`Shiprocket order created. shipmentId = ${data.shipmentId}`);
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally {
      setBusyId(null);
    }
  };

  const srAssignAwb = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/assign-awb`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to assign AWB');

      alert(`AWB: ${data.awbCode} (${data.courierName || 'courier'})`);
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally {
      setBusyId(null);
    }
  };

  const srPickup = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/pickup`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to generate pickup');

      alert('Pickup generated.');
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally {
      setBusyId(null);
    }
  };

  const srLabel = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/label`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to generate label');

      if (data.labelUrl) window.open(data.labelUrl, '_blank');
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally {
      setBusyId(null);
    }
  };

  const srInvoice = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/invoice`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to print invoice');

      if (data.invoiceUrl) window.open(data.invoiceUrl, '_blank');
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally {
      setBusyId(null);
    }
  };

  const srManifest = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/manifest`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to print manifest');

      if (data.manifestUrl) window.open(data.manifestUrl, '_blank');
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally {
      setBusyId(null);
    }
  };

  // tracking link helper
  function trackingHref(o: IOrderFull): string {
    const url = (o.trackingUrl || '').trim();
    if (url) return url;

    const awb = (o.awbCode || o.trackingNumber || '').trim();
    if (!awb) return '';

    const courier = (o.courierName || o.carrierName || '').toLowerCase();
    if (courier.includes('delhivery'))   return `https://www.delhivery.com/track/package/${awb}`;
    if (courier.includes('bluedart'))    return `https://bluedart.com/tracking?awb=${awb}`;
    if (courier.includes('dtdc'))        return `https://www.dtdc.in/tracking/default.aspx?awb=${awb}`;
    if (courier.includes('xpressbees'))  return `https://www.xpressbees.com/track?awb=${awb}`;
    if (courier.includes('ecom'))        return `https://ecomexpress.in/tracking/?awb=${awb}`;
    if (courier.includes('india post') || courier.includes('speed post'))
                                         return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?awb=${awb}`;
    // generic Shiprocket fallback
    return `https://track.shiprocket.in/?awb=${awb}`;
  }

  // package + payment helpers
  async function savePackAndLink(id: string, payload: any) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/orders/${id}/shipping/package`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save package');
      await fetchOrderDetails(id); // refresh
      alert(data?.order?.shippingPayment?.shortUrl ? 'Saved, link created & email sent.' : 'Package saved.');
    } catch (e:any) { alert(e.message); }
    finally { setBusyId(null); }
  }

  async function createShipPayLink(id: string, amount: number) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/orders/${id}/shipping/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        credentials: 'include',
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create link');
      await fetchOrderDetails(id);
      alert('Payment link created & emailed to customer.');
    } catch (e:any) { alert(e.message); }
    finally { setBusyId(null); }
  }

  /* =========================
     Render
  ========================= */
  return (
    <div className="p-3 sm:p-4 md:p-6 bg-gray-50 min-h-[calc(100vh-60px)]">
      {banner && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 shadow-sm">
          {banner}
        </div>
      )}

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Orders</h2>
          <p className="text-sm text-gray-600">Manage orders in real-time. Click a row to view full details.</p>
        </div>
        <Segment
          value={toolbarLayout}
          options={['expanded', 'compact']}
          onChange={(v) => setToolbarLayout(v as 'expanded' | 'compact')}
        />
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative overflow-hidden rounded-2xl border bg-white p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/70 to-transparent" />
          <div className="relative text-xs text-gray-500">Total revenue</div>
          <div className="relative text-2xl font-bold">{currency(totals.totalRevenue)}</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border bg-white p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/70 to-transparent" />
          <div className="relative text-xs text-gray-500">Average order value</div>
          <div className="relative text-2xl font-bold">{currency(totals.avgOrderValue)}</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border bg-white p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-50/70 to-transparent" />
          <div className="relative text-xs text-gray-500">Orders</div>
          <div className="relative text-2xl font-bold">{orders.length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 rounded-2xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative grow min-w-[220px]">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by order ID, number, customer, email"
              className="w-full border rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200"
              inputMode="search"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {(['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const).map(s => (
              <ChipButton key={s} active={filter === s} onClick={() => setFilter(s as any)}>
                {s}
              </ChipButton>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2 ml-auto">
            <button
              onClick={fetchOrders}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
              title="Refresh"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
              title="Export CSV"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              CSV
            </button>
          </div>

          {/* break */}
          <div className="w-full h-0" />

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="border rounded-xl px-3 py-2 text-sm"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              aria-label="From date"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              className="border rounded-xl px-3 py-2 text-sm"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              aria-label="To date"
            />

            <div className="flex items-center gap-1">
              <ChipButton onClick={() => setPreset('today')}>Today</ChipButton>
              <ChipButton onClick={() => setPreset('7d')}>7d</ChipButton>
              <ChipButton onClick={() => setPreset('30d')}>30d</ChipButton>
              <ChipButton onClick={() => setPreset('clear')}>Clear</ChipButton>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => {
                  setSortKey('createdAt');
                  setSortDir(d => (sortKey === 'createdAt' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'));
                }}
                className={
                  'rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2 ' +
                  (sortKey === 'createdAt' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50')
                }
                title="Sort by created date"
              >
                <ClockIcon className="w-4 h-4" />
                Date {sortKey === 'createdAt' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
              </button>
              <button
                onClick={() => {
                  setSortKey('total');
                  setSortDir(d => (sortKey === 'total' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'));
                }}
                className={
                  'rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2 ' +
                  (sortKey === 'total' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50')
                }
                title="Sort by total"
              >
                <BanknotesIcon className="w-4 h-4" />
                Total {sortKey === 'total' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status summary quick cards */}
      <div className="mb-4 -mx-1 sm:mx-0">
        <div className="flex gap-2 overflow-x-auto px-1 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-4">
          {(['pending', 'confirmed', 'processing', 'shipped'] as OrderStatus[]).map(s => {
            const count = orders.filter(o => o.status === s).length;
            return (
              <div key={s} className="min-w-[12rem] sm:min-w-0 bg-white border rounded-2xl p-4 shrink-0">
                <div className="text-xs text-gray-500 capitalize">{s}</div>
                <div className="text-2xl font-bold">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        // Skeleton table
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b">
            <div className="h-4 w-36 bg-gray-200 animate-pulse rounded" />
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b">
              <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
              <div className="h-4 w-40 bg-gray-200 animate-pulse rounded" />
              <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
              <div className="h-6 w-24 bg-gray-200 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-600 shadow-sm">
          <div className="text-3xl mb-2">🗂️</div>
          <div className="font-semibold mb-1">No orders found</div>
          <div className="text-sm mb-4">Try adjusting filters or clearing the date range.</div>
          <div className="flex items-center justify-center gap-2">
            <button
              className="px-3 py-2 rounded-xl border hover:bg-gray-50"
              onClick={() => {
                setFilter('all');
                setQuery('');
                setPreset('clear');
              }}
            >
              Clear filters
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-black"
              onClick={fetchOrders}
            >
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TABLE (≥ md) */}
          <div className="hidden md:block bg-white border rounded-2xl overflow-hidden shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 sticky top-0">
                <tr>
                  <th className="text-left p-3">Order</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Items</th>
                  <th className="text-left p-3">Total</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Created</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-gray-50/40">
                {pageRows.map(o => (
                  <tr
                    key={o._id}
                    className="border-t hover:bg-indigo-50/40 cursor-pointer transition"
                    onClick={e => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button')) return;
                      openDetails(o._id);
                    }}
                  >
                    <td className="p-3 align-top">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900">
                          #{(o.orderNumber || o._id.slice(-8)).toUpperCase()}
                        </div>
                        <button
                          className="text-gray-400 hover:text-gray-700"
                          title="Copy"
                          onClick={e => {
                            e.stopPropagation();
                            copyText(o.orderNumber || o._id);
                          }}
                        >
                          <DocumentDuplicateIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-[12px] text-gray-500 mt-0.5 uppercase tracking-wide">
                        {o.paymentMethod} • {o.paymentStatus || '-'}
                        {(o as any).gst?.wantInvoice || (o as any).gst?.gstin ? ' • GST' : ''}
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 border flex items-center justify-center text-[11px] font-semibold text-gray-700">
                          {getInitials(o.userId?.name, o.userId?.email)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{o.userId?.name || '—'}</div>
                          <div className="text-gray-500 text-xs">{o.userId?.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex -space-x-2 items-center">
                        {o.items.slice(0, 5).map((it, idx) => {
                          const src =
                            (typeof it.productId === 'object' && it.productId?.image) ||
                            it.image;
                          return src ? (
                            <img
                              key={idx}
                              src={src}
                              alt=""
                              title={(typeof it.productId === 'object' && it.productId?.name) || it.name || ''}
                              className="w-8 h-8 rounded object-cover border bg-white"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div
                              key={idx}
                              className="w-8 h-8 rounded bg-gray-100 border flex items-center justify-center text-[10px] text-gray-500"
                              title={(typeof it.productId === 'object' && it.productId?.name) || it.name || 'Item'}
                            >
                              {(typeof it.productId === 'object' && it.productId?.name) ||
                                it.name ||
                                'Item'}
                            </div>
                          );
                        })}
                        {o.items.length > 5 && (
                          <div className="w-8 h-8 rounded bg-gray-100 border flex items-center justify-center text-xs text-gray-600">
                            +{o.items.length - 5}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-semibold align-top">{currency(o.total)}</td>
                    <td className="p-3 align-top">
                      <span className={pill(o.status)}>
                        {iconFor(o.status)}
                        <span>{o.status}</span>
                      </span>
                    </td>
                    <td className="p-3 align-top">{dt(o.createdAt)}</td>
                    <td className="p-3 text-right align-top">
                      <div className="inline-flex gap-2">
                        <button
                          className="px-3 py-1.5 rounded-xl border hover:bg-gray-50 inline-flex items-center gap-1"
                          onClick={e => {
                            e.stopPropagation();
                            openDetails(o._id);
                          }}
                          title="View details"
                        >
                          <EyeIcon className="w-4 h-4" />
                          View
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                          onClick={e => {
                            e.stopPropagation();
                            acceptOrder(o._id);
                          }}
                          disabled={busyId === o._id || o.status !== 'pending'}
                          title={o.status !== 'pending' ? 'Only pending orders can be accepted' : 'Accept order'}
                        >
                          {busyId === o._id ? 'Accepting…' : 'Accept'}
                        </button>
                        {nextStatus(o.status) && (
                          <button
                            className="px-3 py-1.5 rounded-xl border hover:bg-gray-50"
                            onClick={e => {
                              e.stopPropagation();
                              advance(o._id, o.status);
                            }}
                          >
                            Next: {nextStatus(o.status)}
                          </button>
                        )}
                        {o.status !== 'cancelled' && (
                          <button
                            className="px-3 py-1.5 rounded-xl border hover:bg-rose-50 text-rose-700 border-rose-200"
                            onClick={e => {
                              e.stopPropagation();
                              cancelOrder(o._id);
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t text-sm sticky bottom-0 bg-white">
              <div className="text-gray-600">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="border rounded-xl px-2 py-1"
                  value={pageSize}
                  onChange={e => setPageSize(+e.target.value)}
                >
                  {[10, 25, 50, 100].map(n => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
                <button
                  className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <div className="px-2">{page} / {totalPages}</div>
                <button
                  className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* MOBILE CARDS (< md) */}
          <div className="md:hidden space-y-3">
            {pageRows.map(o => (
              <div
                key={o._id}
                className="bg-white border rounded-2xl p-3 shadow-sm"
                onClick={() => openDetails(o._id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      #{(o.orderNumber || o._id.slice(-8)).toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {dt(o.createdAt)}
                    </div>
                  </div>
                  <span className={pill(o.status)}>{o.status}</span>
                </div>

                <div className="mt-3 flex items-center gap-2 overflow-x-auto -mx-1 px-1">
                  {o.items.slice(0, 6).map((it, idx) => {
                    const src =
                      (typeof it.productId === 'object' && it.productId?.image) ||
                      it.image;
                    return src ? (
                      <img
                        key={idx}
                        src={src}
                        alt=""
                        className="w-10 h-10 rounded object-cover border bg-white shrink-0"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div
                        key={idx}
                        className="w-10 h-10 rounded bg-gray-100 border flex items-center justify-center text-[10px] text-gray-500 shrink-0"
                      >
                        {(typeof it.productId === 'object' && it.productId?.name) ||
                          it.name ||
                          'Item'}
                      </div>
                    );
                  })}
                  {o.items.length > 6 && (
                    <div className="w-10 h-10 rounded bg-gray-100 border flex items-center justify-center text-xs text-gray-600 shrink-0">
                      +{o.items.length - 6}
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 border flex items-center justify-center text-[11px] font-semibold text-gray-700">
                      {getInitials(o.userId?.name, o.userId?.email)}
                    </div>
                    <div>
                      <div className="text-gray-900 font-medium truncate">{o.userId?.name || '—'}</div>
                      <div className="text-gray-500 text-xs truncate">{o.userId?.email || '—'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500">Total</div>
                    <div className="font-semibold">{currency(o.total)}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-600">
                  <div className="uppercase">{o.paymentMethod} • {o.paymentStatus || '-'}{(o as any).gst?.wantInvoice || (o as any).gst?.gstin ? ' • GST' : ''}</div>
                  <button
                    className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 hover:bg-gray-50"
                    onClick={e => {
                      e.stopPropagation();
                      openDetails(o._id);
                    }}
                  >
                    <EyeIcon className="w-4 h-4" /> View
                  </button>
                </div>
              </div>
            ))}

            {/* Mobile pagination */}
            <div className="flex items-center justify-between pt-2 text-sm">
              <div className="text-gray-600">
                {page} / {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Drawer – Order Details */}
      <div
        className={
          'fixed inset-0 z-50 transition ' +
          (openDrawer ? 'pointer-events-auto' : 'pointer-events-none')
        }
        aria-hidden={!openDrawer}
      >
        {/* Scrim */}
        <div
          className={
            'absolute inset-0 bg-black/30 transition-opacity ' +
            (openDrawer ? 'opacity-100' : 'opacity-0')
          }
          onClick={() => setOpenDrawer(false)}
        />
        {/* Panel */}
        <div
          className={
            'absolute right-0 top-0 h-full w-full sm:w-[560px] bg-white shadow-2xl border-l transform transition-transform ' +
            (openDrawer ? 'translate-x-0' : 'translate-x-full')
          }
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
            <div className="min-w-0">
              <div className="text-sm text-gray-500 truncate">
                Order {selected?.orderNumber || selectedId}
              </div>
              <div className="text-lg font-semibold text-gray-900 truncate">
                {selected?.userId?.name || selected?.userId?.email || 'Customer'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="border rounded-xl px-2.5 py-2 hover:bg-gray-50"
                onClick={() => window.print()}
                title="Print"
              >
                <PrinterIcon className="w-4 h-4" />
              </button>
              <button
                className="border rounded-xl px-2.5 py-2 hover:bg-gray-50"
                onClick={() => setOpenDrawer(false)}
                title="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto h-[calc(100%-56px)] p-4 space-y-4">
            {drawerLoading || !selected ? (
              <div className="p-6 text-center text-gray-600">
                <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                Loading details…
              </div>
            ) : (
              <>
                {/* Status row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={pill(selected.status)}>
                    {iconFor(selected.status)}
                    <span>{selected.status}</span>
                  </span>
                  {selected.paymentStatus && (
                    <span className={pill(selected.paymentStatus)}>
                      {iconFor(selected.paymentStatus)}
                      <span>{selected.paymentStatus.replace('_', ' ')}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border bg-gray-50 text-gray-700">
                    {selected.paymentMethod?.toUpperCase()}
                  </span>
                  {/* Shiprocket chip */}
                  {selected.shiprocketStatus && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border bg-indigo-50 text-indigo-700">
                      SR: {selected.shiprocketStatus.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {/* Progress */}
                {selected.status !== 'cancelled' && (
                  <div className="flex items-center gap-2">
                    {ORDER_FLOW.map((s, i) => {
                      const done = ORDER_FLOW.indexOf(selected.status) >= i;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <div
                            className={
                              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ' +
                              (done ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600')
                            }
                            title={s}
                          >
                            {i + 1}
                          </div>
                          {i < ORDER_FLOW.length - 1 && (
                            <div className={'h-0.5 w-8 rounded ' + (done ? 'bg-gray-900' : 'bg-gray-200')} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Money + meta */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="border rounded-2xl p-3">
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="text-lg font-semibold">{currency(selected.total)}</div>
                  </div>
                  <div className="border rounded-2xl p-3">
                    <div className="text-xs text-gray-500">Placed</div>
                    <div className="text-sm">{dt(selected.createdAt)}</div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="font-semibold text-gray-900 mb-2">Items</div>
                  <div className="space-y-2">
                    {selected.items.map((it, idx) => {
                      const src =
                        (typeof it.productId === 'object' && it.productId?.image) || it.image;
                      const name =
                        (typeof it.productId === 'object' && it.productId?.name) ||
                        it.name ||
                        'Item';
                      return (
                        <div key={idx} className="flex items-center gap-3 border rounded-2xl p-2">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 border overflow-hidden flex items-center justify-center">
                            {src ? (
                              <img src={src} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-gray-500 px-1 text-center">{name}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                            <div className="text-xs text-gray-600">
                              Qty {it.quantity} × {currency(it.price)}
                            </div>
                          </div>
                          <div className="text-sm font-semibold">
                            {currency(it.quantity * it.price)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>{money(selected.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>
                        GST
                        {selected.gst?.taxPercent ? ` (${selected.gst.taxPercent}%)` : ''}
                      </span>
                      <span>{money(toNum(selected.gst?.taxAmount ?? selected.tax))}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping</span>
                      <span>{money(selected.shipping)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total</span>
                      <span>{money(selected.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="border rounded-2xl p-3">
                    <div className="font-semibold text-gray-900 mb-1">Shipping address</div>
                    <div className="text-sm text-gray-700 space-y-0.5">
                      <div>{selected.shippingAddress?.fullName}</div>
                      <div>{selected.shippingAddress?.addressLine1}</div>
                      {selected.shippingAddress?.addressLine2 && <div>{selected.shippingAddress?.addressLine2}</div>}
                      <div>
                        {selected.shippingAddress?.city}, {selected.shippingAddress?.state}{' '}
                        {selected.shippingAddress?.pincode}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        📞 {selected.shippingAddress?.phoneNumber} • 📧 {selected.shippingAddress?.email}
                      </div>
                    </div>
                  </div>
                  <div className="border rounded-2xl p-3">
                    <div className="font-semibold text-gray-900 mb-1">Billing address</div>
                    <div className="text-sm text-gray-700 space-y-0.5">
                      <div>{selected.billingAddress?.fullName}</div>
                      <div>{selected.billingAddress?.addressLine1}</div>
                      {selected.billingAddress?.addressLine2 && <div>{selected.billingAddress?.addressLine2}</div>}
                      <div>
                        {selected.billingAddress?.city}, {selected.billingAddress?.state}{' '}
                        {selected.billingAddress?.pincode}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment + Tracking */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="border rounded-2xl p-3">
                    <div className="font-semibold text-gray-900 mb-1">Payment</div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Method</span>
                        <span className="font-medium uppercase">{selected.paymentMethod}</span>
                      </div>
                      {selected.paymentStatus && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status</span>
                          <span className={pill(selected.paymentStatus)}>
                            {selected.paymentStatus.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                      {selected.paymentId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment ID</span>
                          <span className="font-mono text-xs">{selected.paymentId}</span>
                        </div>
                      )}
                      {selected.paidAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Paid at</span>
                          <span>{dt(selected.paidAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border rounded-2xl p-3">
                    <div className="font-semibold text-gray-900 mb-1">Shipping</div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Carrier</span>
                        <span>{selected.courierName || selected.carrierName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tracking</span>
                        <span className="font-mono text-xs">{selected.awbCode || selected.trackingNumber || '-'}</span>
                      </div>
                      {selected.estimatedDelivery && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">ETA</span>
                          <span>{dt(selected.estimatedDelivery)}</span>
                        </div>
                      )}
                      {(selected.labelUrl || selected.invoiceUrl || selected.manifestUrl) && (
                        <div className="pt-1 flex flex-wrap gap-2">
                          {selected.labelUrl && (
                            <a className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl hover:bg-gray-50"
                               href={selected.labelUrl} target="_blank" rel="noreferrer">
                              Label
                            </a>
                          )}
                          {selected.invoiceUrl && (
                            <a className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl hover:bg-gray-50"
                               href={selected.invoiceUrl} target="_blank" rel="noreferrer">
                              Invoice
                            </a>
                          )}
                          {selected.manifestUrl && (
                            <a className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl hover:bg-gray-50"
                               href={selected.manifestUrl} target="_blank" rel="noreferrer">
                              Manifest
                            </a>
                          )}
                        </div>
                      )}
                      {(selected?.trackingUrl || selected?.trackingNumber || selected?.awbCode) && (
                        <div className="pt-1">
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl hover:bg-gray-50"
                            onClick={() => {
                              const url = trackingHref(selected!);
                              if (url) {
                                window.open(url, '_blank', 'noopener,noreferrer');
                              } else {
                                alert('No tracking details available yet.');
                              }
                            }}
                          >
                            <TruckIcon className="w-4 h-4" />
                            Track package
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shipping package & payment */}
                {selected && (() => {
                  const sp: any = selected.shippingPayment || {};
                  const shortUrl: string | undefined = sp.shortUrl || sp.short_url; // support both shapes

                  return (
                    <div className="w-full border rounded-2xl p-3 space-y-2">
                      <div className="font-semibold text-gray-900">Shipping package & payment</div>

                      {/* Status row */}
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <div>Payment:</div>
                        <span className={pill(sp.status || 'pending')}>
                          {sp.status || 'pending'}
                        </span>
                        {shortUrl && (
                          <a className="underline" href={shortUrl} target="_blank" rel="noreferrer">
                            Open link
                          </a>
                        )}
                        {sp.amount != null && (
                          <span className="ml-2 text-gray-700">Amount: {currency(sp.amount)}</span>
                        )}
                        {sp.amountPaid ? (
                          <span className="ml-2 text-emerald-700">Paid: {currency(sp.amountPaid)}</span>
                        ) : null}
                      </div>

                      {/* Package dims */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <input className="border rounded-xl px-3 py-2" placeholder="L (cm)" defaultValue={selected.shippingPackage?.lengthCm ?? ''} id="pkgL" />
                        <input className="border rounded-xl px-3 py-2" placeholder="B (cm)" defaultValue={selected.shippingPackage?.breadthCm ?? ''} id="pkgB" />
                        <input className="border rounded-xl px-3 py-2" placeholder="H (cm)" defaultValue={selected.shippingPackage?.heightCm ?? ''} id="pkgH" />
                        <input className="border rounded-xl px-3 py-2" placeholder="Wt (kg)" defaultValue={selected.shippingPackage?.weightKg ?? ''} id="pkgW" />
                      </div>

                      {/* Images */}
                      {/* Images */}
<div className="text-sm">
  <div className="text-gray-600 mb-1 flex items-center justify-between">
    <span>Pack photos (max 5)</span>
    <span className="text-xs text-gray-400">{(selected.shippingPackage?.images || []).length}/5</span>
  </div>

  <div className="flex gap-2 flex-wrap">
    {(selected.shippingPackage?.images || []).map((u, i) => (
      <div key={i} className="relative">
        <img src={u} className="w-20 h-20 object-cover rounded border" />
        <button
          className="absolute -top-2 -right-2 bg-white/90 border rounded-full px-1 text-xs"
          title="Remove"
          onClick={async (e) => {
            e.stopPropagation();
            if (!confirm("Remove this photo?")) return;
            try {
              await deleteS3(u); // optional: ignore if you prefer to keep on S3
            } catch {}
            await savePackAndLink(selected._id, {
              images: (selected.shippingPackage?.images || []).filter((x: string) => x !== u),
            });
          }}
        >✕</button>
      </div>
    ))}
  </div>

  <button
    className="mt-2 px-3 py-1.5 rounded-xl border hover:bg-gray-50"
    onClick={async () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      inp.onchange = async () => {
        const existing = selected.shippingPackage?.images || [];
        const files = Array.from(inp.files || []);
        const allowed = Math.max(0, 5 - existing.length);
        const toUpload = files.slice(0, allowed);

        if (!toUpload.length) { alert("Limit reached (5)"); return; }

        const newUrls: string[] = [];
        // lightweight modal/progress; here we just alert at the end
        for (const f of toUpload) {
          if (f.size > 10 * 1024 * 1024) { alert(`${f.name}: too large (>10MB)`); continue; }
          if (!/^image\//.test(f.type)) { alert(`${f.name}: not an image`); continue; }

          const { uploadUrl, publicUrl } = await presign(f);
          await putWithProgress(uploadUrl, f, (pct) => {
            // optional: show pct in UI; for brevity we skip rendering a bar here
            // console.log(`${f.name}: ${pct}%`);
          });
          newUrls.push(publicUrl);
        }

        if (newUrls.length) {
          await savePackAndLink(selected._id, { images: [...existing, ...newUrls] });
        }
      };
      inp.click();
    }}
  >Upload photos</button>
</div>


                      {/* Save + link */}
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                          disabled={busyId === selected._id}
                          onClick={() => {
                            const body = {
                              lengthCm: (document.getElementById('pkgL') as HTMLInputElement).value,
                              breadthCm: (document.getElementById('pkgB') as HTMLInputElement).value,
                              heightCm: (document.getElementById('pkgH') as HTMLInputElement).value,
                              weightKg: (document.getElementById('pkgW') as HTMLInputElement).value,
                            };
                            savePackAndLink(selected._id, body);
                          }}
                        >Save package</button>

                        <button
                          className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                          disabled={busyId === selected._id}
                          onClick={async () => {
                            const amount = Number(prompt('Shipping amount (INR)?') || 0);
                            if (amount > 0) {
                              const body = {
                                lengthCm: (document.getElementById('pkgL') as HTMLInputElement).value,
                                breadthCm: (document.getElementById('pkgB') as HTMLInputElement).value,
                                heightCm: (document.getElementById('pkgH') as HTMLInputElement).value,
                                weightKg: (document.getElementById('pkgW') as HTMLInputElement).value,
                                createPaymentLink: true,
                                amount,
                              };
                              await savePackAndLink(selected._id, body);
                            }
                          }}
                        >Save + Create payment link</button>

                        {sp.status !== 'paid' && (
                          <button
                            className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                            disabled={busyId === selected._id}
                            onClick={async () => {
                              const amount = Number(prompt('Shipping amount (INR)?') || 0);
                              if (amount > 0) await createShipPayLink(selected._id, amount);
                            }}
                          >Create/Refresh link</button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* GST / Tax Details */}
                {(() => {
                  const g = getGstView(selected);
                  const hasSplit = g.cgst != null || g.sgst != null || g.igst != null;
                  const isSR = !!selected?.invoiceUrl && !selected?.gst?.invoiceUrl;

                  return (
                    <div className="border rounded-2xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-gray-900">GST / Tax Details</div>
                        {g.invoiceUrl ? (
                          <a
                            href={g.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900 text-white hover:bg-black text-sm"
                          >
                            {isSR ? 'View Shipping Invoice' : 'View GST Invoice'}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {g.wantInvoice ? 'Invoice not generated yet' : 'Customer did not request GST invoice'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="space-y-1">
                          <div className="flex justify-between"><span className="text-gray-600">Requested</span><span className={g.wantInvoice ? 'text-emerald-700 font-medium' : 'text-gray-500'}>{g.wantInvoice ? 'Yes' : 'No'}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">GSTIN</span><span className="font-mono text-xs">{g.gstin || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">Legal Name</span><span className="font-medium truncate">{g.legalName || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">Place of Supply</span><span className="font-medium">{g.pos || '—'}</span></div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between"><span className="text-gray-600">Taxable Value</span><span className="font-medium">{money(toNum(g.taxBase))}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">GST %</span><span className="font-medium">{g.taxPercent || 0}%</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">GST Amount</span><span className="font-semibold text-gray-900">{money(toNum(g.taxAmount))}</span></div>

                          {hasSplit && (
                            <>
                              {g.cgst != null && <div className="flex justify-between"><span className="text-gray-600">CGST</span><span>{money(toNum(g.cgst))}</span></div>}
                              {g.sgst != null && <div className="flex justify-between"><span className="text-gray-600">SGST</span><span>{money(toNum(g.sgst))}</span></div>}
                              {g.igst != null && <div className="flex justify-between"><span className="text-gray-600">IGST</span><span>{money(toNum(g.igst))}</span></div>}
                            </>
                          )}

                          {g.invoiceNumber && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Invoice #</span>
                              <span className="font-mono text-xs">{g.invoiceNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                    onClick={() => selected && acceptOrder(selected._id)}
                    disabled={selected.status !== 'pending' || busyId === selected._id}
                  >
                    {busyId === selected?._id ? 'Accepting…' : 'Accept'}
                  </button>
                  {selected.status !== 'cancelled' && nextStatus(selected.status) && (
                    <button
                      className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                      onClick={() => selected && advance(selected._id, selected.status)}
                      disabled={busyId === selected._id}
                    >
                      Next: {nextStatus(selected.status)}
                    </button>
                  )}
                  {selected.status !== 'cancelled' && (
                    <button
                      className="px-3 py-2 rounded-xl border hover:bg-rose-50 text-rose-700 border-rose-200"
                      onClick={() => selected && cancelOrder(selected._id)}
                      disabled={busyId === selected._id}
                    >
                      Cancel
                    </button>
                  )}

                  {/* ---- Shiprocket Actions ---- */}
                  <div className="w-full h-0" />
                  <button
                    className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                    onClick={() => selected && srCreate(selected._id)}
                    disabled={busyId === selected?._id || !!selected.shipmentId}
                    title={selected?.shipmentId ? 'Shipment already created' : 'Create Shiprocket order'}
                  >
                    {selected?.shipmentId ? `Shipment: ${selected.shipmentId}` : 'SR: Create Order'}
                  </button>

                  <button
                    className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                    onClick={() => selected && srAssignAwb(selected._id)}
                    disabled={busyId === selected?._id || !selected.shipmentId || !!selected.awbCode}
                    title={!selected?.shipmentId ? 'Create Shiprocket order first' : (selected?.awbCode ? 'AWB already assigned' : 'Assign AWB')}
                  >
                    {selected?.awbCode ? `AWB: ${selected.awbCode}` : 'SR: Assign AWB'}
                  </button>

                  <button
                    className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                    onClick={() => selected && srPickup(selected._id)}
                    disabled={busyId === selected?._id || !selected.shipmentId || !selected.awbCode}
                    title={!selected?.awbCode ? 'Assign AWB first' : 'Generate pickup'}
                  >
                    SR: Pickup
                  </button>

                  <button
                    className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                    onClick={() => selected && srLabel(selected._id)}
                    disabled={busyId === selected?._id || !selected.shipmentId}
                  >
                    SR: Label
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                    onClick={() => selected && srInvoice(selected._id)}
                    disabled={busyId === selected?._id || !selected.shipmentId}
                  >
                    SR: Invoice
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                    onClick={() => selected && srManifest(selected._id)}
                    disabled={busyId === selected?._id || !selected.shipmentId}
                  >
                    SR: Manifest
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersTab;
