// src/components/admin/LiveCartsWidget.tsx
import React, { useCallback, useEffect, useState } from 'react';

type LiveCartItem = {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
};

type LiveCart = {
  cartId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  totalAmount: number;
  itemCount: number;
  updatedAt: string;
  items: LiveCartItem[];
};

type LiveCartsResponse = {
  success: boolean;
  sinceMinutes: number;
  count: number;
  carts: LiveCart[];
};

const POLL_INTERVAL_MS = 20_000; // 20s

const LiveCartsWidget: React.FC = () => {
  const [sinceMinutes, setSinceMinutes] = useState<number>(60);
  const [data, setData] = useState<LiveCart[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCarts = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/admin/carts/live?sinceMinutes=${sinceMinutes}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed with status ${res.status}`);
      }

      const json = (await res.json()) as LiveCartsResponse;

      if (!json.success) {
        throw new Error('API responded with success=false');
      }

      setData(json.carts || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.message || 'Failed to load live carts');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [sinceMinutes]);

  // Initial load + refetch on sinceMinutes change
  useEffect(() => {
    fetchCarts();
  }, [fetchCarts]);

  // Polling
  useEffect(() => {
    const id = window.setInterval(() => {
      fetchCarts({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [fetchCarts]);

  const handleManualRefresh = () => {
    fetchCarts();
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return '-';
    return `₹${value.toFixed(2)}`;
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 sm:p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Live Carts (Last {sinceMinutes} min)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dekho kaun-kaun abhi cart me products add karke baitha hai.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            value={sinceMinutes}
            onChange={(e) => setSinceMinutes(Number(e.target.value) || 60)}
          >
            <option value={15}>Last 15 min</option>
            <option value={30}>Last 30 min</option>
            <option value={60}>Last 60 min</option>
            <option value={180}>Last 3 hours</option>
          </select>

          <button
            type="button"
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <span className={loading ? 'animate-spin' : ''}>⟳</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Status line */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div>
          Total carts:{' '}
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {data.length}
          </span>
        </div>
        <div>
          Last updated:{' '}
          {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center text-gray-500 dark:text-gray-400 text-sm">
          <div className="text-3xl mb-2">🛒</div>
          <div>Koi active cart nahi mila is time window me.</div>
          <div className="text-xs mt-1">
            Jaise hi customer cart me product add karega, yahan show hoga.
          </div>
        </div>
      )}

      {/* Table */}
      {data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Customer
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Contact
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Items
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Cart Value
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Updated
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {data.map((cart) => {
                const isExpanded = expandedId === cart.cartId;
                return (
                  <React.Fragment key={cart.cartId}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {cart.userName || 'Guest'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          #{cart.userId?.slice(-6)}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {cart.userEmail || '—'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {cart.userPhone || ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                          {cart.itemCount} items
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(cart.totalAmount)}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(cart.updatedAt)}
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : cart.cartId)
                          }
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                        >
                          <span>{isExpanded ? 'Hide' : 'View'}</span>
                          <span>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                      </td>
                    </tr>

                    {isExpanded && cart.items.length > 0 && (
                      <tr className="bg-gray-50/60 dark:bg-gray-900/60">
                        <td
                          colSpan={6}
                          className="px-3 py-3 text-xs text-gray-700 dark:text-gray-200"
                        >
                          <div className="font-semibold mb-2">
                            Cart items ({cart.items.length})
                          </div>
                          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                            {cart.items.map((item) => (
                              <div
                                key={item.productId + item.sku}
                                className="flex items-start justify-between gap-3 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-950/60"
                              >
                                <div>
                                  <div className="text-xs font-medium">
                                    {item.productName || 'Unnamed product'}
                                  </div>
                                  {item.sku && (
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                      SKU: {item.sku}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right text-[11px]">
                                  <div>Qty: {item.quantity}</div>
                                  <div>
                                    {formatCurrency(item.unitPrice)}{' '}
                                    <span className="text-gray-500">/ pc</span>
                                  </div>
                                  <div className="font-semibold">
                                    {formatCurrency(
                                      item.unitPrice * item.quantity
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LiveCartsWidget;
