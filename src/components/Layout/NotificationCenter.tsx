import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';
import { io } from 'socket.io-client';
import {
  BellIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import clsx from 'clsx';

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead?: boolean;
  type?: 'order' | 'promo' | 'system' | 'product' | 'announcement';
  cta?: { label: string; href: string };
  meta?: Record<string, any>;
}

const { VITE_API_URL } = (import.meta as any).env as { VITE_API_URL?: string };
const SOCKET_URL =
  (VITE_API_URL?.replace(/\/+$/, '')) ||
  ((api as any).defaults?.baseURL?.replace(/\/+$/, '')) ||
  window.location.origin;

const typeDot = (t?: AppNotification['type']) =>
  t === 'order'
    ? 'bg-indigo-500'
    : t === 'promo'
    ? 'bg-emerald-500'
    : t === 'product'
    ? 'bg-blue-500'
    : t === 'announcement'
    ? 'bg-fuchsia-500'
    : 'bg-gray-500';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const NotificationCenter: React.FC = () => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | AppNotification['type']>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const didWire = useRef(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user/notifications');
      const data: AppNotification[] = res?.data?.notifications ?? [];
      data.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  useEffect(() => {
    if (didWire.current) return;
    didWire.current = true;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket'],
    });
    socketRef.current = socket;

    const onNew = (n: AppNotification) => {
      setItems(prev => {
        if (prev.some(p => p._id === n._id)) return prev;
        return [n, ...prev].slice(0, 200);
      });
    };

    socket.on('notification:new', onNew);

    return () => {
      socket.off('notification:new', onNew);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const markOne = async (id: string) => {
    setItems(prev => prev.map(n => (n._id === id ? { ...n, isRead: true } : n)));
    try {
      await api.patch(`/user/notifications/${id}/read`);
    } catch {
      fetchNotifications();
    }
  };

  const markAll = async () => {
    const anyUnread = items.some(n => !n.isRead);
    if (!anyUnread) return;
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await api.patch('/user/notifications/mark-all-read');
    } catch {
      fetchNotifications();
    }
  };

  const remove = async (id: string) => {
    const stash = items;
    setItems(prev => prev.filter(n => n._id !== id));
    try {
      await api.delete(`/user/notifications/${id}`);
    } catch {
      setItems(stash);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== 'all') list = list.filter(n => n.type === typeFilter);
    if (showUnreadOnly) list = list.filter(n => !n.isRead);
    return list;
  }, [items, typeFilter, showUnreadOnly]);

  const unreadCount = useMemo(() => items.filter(n => !n.isRead).length, [items]);

  return (
    <div className="max-w-3xl space-y-6 text-white">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <div className="relative">
            <BellIcon className="w-5 h-5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold">Notification Center</h3>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="rounded-lg bg-white/10 border border-white/20 text-white px-2.5 py-1.5 backdrop-blur-md"
          >
            <option value="all">All types</option>
            <option value="product">Products</option>
            <option value="announcement">Announcements</option>
            <option value="order">Orders</option>
            <option value="promo">Promos</option>
            <option value="system">System</option>
          </select>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/30 bg-transparent"
              checked={showUnreadOnly}
              onChange={e => setShowUnreadOnly(e.target.checked)}
            />
            <span className="text-gray-300">Unread only</span>
          </label>

          {unreadCount > 0 && (
            <button
              onClick={markAll}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-white/10 border border-white/10 rounded-xl animate-pulse backdrop-blur-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-white/10 rounded-xl bg-white/5 backdrop-blur-md">
          <BellIcon className="w-8 h-8 text-white/40 mx-auto mb-3" />
          <div className="text-gray-300">
            No notifications{showUnreadOnly ? ' (unread)' : ''}.
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map(n => (
            <li
              key={n._id}
              className={clsx(
                'p-4 rounded-xl border flex items-start gap-3 backdrop-blur-md transition',
                n.isRead
                  ? 'bg-white/5 border-white/10'
                  : 'bg-white/10 border-white/20'
              )}
            >
              <span className={clsx('mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0', typeDot(n.type))} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{n.title}</h4>
                  {!n.isRead && <span className="text-[10px] uppercase tracking-wide text-gray-300">new</span>}
                </div>

                <p className="text-sm text-gray-200 mt-0.5">{n.message}</p>
                <div className="text-xs text-gray-400 mt-1">{formatDate(n.createdAt)}</div>

                {n.cta?.href && (
                  <a
                    href={n.cta.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-teal-300 mt-2 hover:underline"
                  >
                    {n.cta.label}
                  </a>
                )}
              </div>

              {!n.isRead ? (
                <button
                  onClick={() => markOne(n._id)}
                  className="p-2 rounded hover:bg-white/10"
                  title="Mark as read"
                >
                  <CheckCircleIcon className="w-5 h-5 text-teal-300" />
                </button>
              ) : (
                <button
                  onClick={() => remove(n._id)}
                  className="p-2 rounded hover:bg-white/10"
                  title="Dismiss"
                >
                  <XMarkIcon className="w-5 h-5 text-white/60" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationCenter;
