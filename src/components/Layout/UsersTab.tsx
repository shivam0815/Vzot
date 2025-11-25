// src/components/Layout/UsersTab.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { generateResponsiveImageUrl } from '../../utils/cloudinaryBrowser';
import {
  getUsers,
  updateUser,
  deleteUser,
  getUserAnalytics,
  toggleUserStatus,
  sendPasswordResetEmail
} from '../../config/adminApi';

type Props = {
  showNotification: (msg: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
};

type UserRole = 'customer' | 'admin' | 'seller';
type UserStatus = 'active' | 'inactive' | 'banned';

type UserRow = {
  _id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  phone?: string;
  avatar?: string;
  role?: UserRole;        // may be missing from backend
  status?: UserStatus;    // may be missing from backend
  city?: string;
  country?: string;
  device?: string;
  createdAt: string;
  lastLoginAt?: string;
  ordersCount?: number;
  lifetimeValue?: number;
  sessions7d?: number[];
  avgSessionMins?: number;
  totalMins30d?: number;
  // Possible legacy flags
  isAdmin?: boolean;
  isActive?: boolean;
};

type Analytics = {
  dau: number;
  wau: number;
  mau: number;
  avgSessionMins: number;
  returning7d: number;
  trend7?: number[];
};

const rangeToLabel: Record<string, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

// ---------- helpers ----------
const upper = (v: unknown, fallback = '') => String(v ?? fallback).toUpperCase();

// Normalize backend variability into safe, typed UI shape
// Normalize backend variability into safe, typed UI shape
const normalizeUser = (u: UserRow & {
  lastCity?: string;
  lastCountry?: string;
  lastDeviceType?: string;
  lastLogin?: string | Date;
}): Required<UserRow> => {
  // Derive status if missing
  const normStatus: UserStatus =
    (u.status as UserStatus) ??
    (u.isActive === false ? 'inactive' : 'active');

  // Derive role if missing or legacy
  let normRole: UserRole =
    (u.role as UserRole) ??
    (u.isAdmin ? 'admin' : 'customer');

  // Map any unexpected 'user' to 'customer'
  if ((normRole as string) === 'user') normRole = 'customer';

  const orders = Number.isFinite(u.ordersCount as number) ? (u.ordersCount as number) : 0;
  const ltv = Number.isFinite(u.lifetimeValue as number) ? (u.lifetimeValue as number) : 0;

  const sessions = Array.isArray(u.sessions7d)
    ? u.sessions7d!.map(n => (Number.isFinite(n) ? Number(n) : 0))
    : [];

  // 🔁 Map auth analytics fields -> UI fields
  const city = u.city || (u as any).lastCity || '';
  const country = u.country || (u as any).lastCountry || '';
  const device = u.device || (u as any).lastDeviceType || '';
  const lastLoginAtRaw = u.lastLoginAt || (u as any).lastLogin || '';
  const lastLoginAt =
    lastLoginAtRaw instanceof Date ? lastLoginAtRaw.toISOString() : String(lastLoginAtRaw || '');

  return {
    ...u,
    role: normRole,
    status: normStatus,
    ordersCount: orders,
    lifetimeValue: ltv,
    sessions7d: sessions,
    emailVerified: !!u.emailVerified,
    name: u.name || '',
    email: u.email || '',
    phone: u.phone || '',
    avatar: u.avatar || '',
    city,
    country,
    device,
    lastLoginAt,
    avgSessionMins: Number.isFinite(u.avgSessionMins as number) ? (u.avgSessionMins as number) : 0,
    totalMins30d: Number.isFinite(u.totalMins30d as number) ? (u.totalMins30d as number) : 0,
    isAdmin: !!u.isAdmin,
    isActive: u.isActive ?? (normStatus !== 'inactive'),
  };
};


// tiny inline sparkline
const TinySpark: React.FC<{ vals?: number[] }> = ({ vals }) => {
  const data = vals && vals.length ? vals : [0, 2, 3, 2, 4, 3, 5];
  const w = 60, h = 18, pad = 2;
  const max = Math.max(...data, 1);
  const step = (w - pad * 2) / (data.length - 1 || 1);
  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} aria-hidden>
      <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={pts} />
    </svg>
  );
};

const UsersTab: React.FC<Props> = ({ showNotification, checkNetworkStatus }) => {
  // ------- list state -------
  const [users, setUsers] = useState<Required<UserRow>[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | UserRole>('');
  const [status, setStatus] = useState<'' | UserStatus>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastLoginAt' | 'ordersCount' | 'lifetimeValue' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ------- analytics header -------
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');

  // ------- detail drawer -------
  const [detail, setDetail] = useState<Required<UserRow> | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    try {
      setAnalyticsLoading(true);
      const res = await getUserAnalytics({ range });
      if (res.success) {
        setAnalytics(res.analytics);
      }
    } catch (e: any) {
      showNotification(e?.message || 'Failed to load analytics', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [range, checkNetworkStatus, showNotification]);

  const fetchUsers = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    try {
      setLoading(true);
      const res = await getUsers({
        page, limit, q, role, status, sortBy, sortOrder,
      });
      if (res.success) {
        const list: Required<UserRow>[] = (res.users || []).map(normalizeUser);
        setUsers(list);
        setTotalUsers(res.totalUsers || list.length || 0);
        setTotalPages(res.totalPages || 1);
      } else {
        throw new Error(res.message || 'Failed to load users');
      }
    } catch (e: any) {
      showNotification(e?.message || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, role, status, sortBy, sortOrder, checkNetworkStatus, showNotification]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // reset to page 1 when filters/search change
  useEffect(() => {
    setPage(1);
  }, [q, role, status, limit, sortBy, sortOrder]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('asc'); }
  };

  const editField = async (user: Required<UserRow>, patch: Partial<UserRow>) => {
    if (!checkNetworkStatus()) return;
    try {
      setUpdating(true);
      const res = await updateUser(user._id, patch);
      if (res.success) {
        setUsers(prev => prev.map(u => u._id === user._id ? normalizeUser({ ...u, ...patch } as UserRow) : u));
        showNotification('User updated', 'success');
        if (detail && detail._id === user._id) setDetail(normalizeUser({ ...detail, ...patch } as UserRow));
      } else {
        throw new Error(res.message || 'Update failed');
      }
    } catch (e: any) {
      showNotification(e?.message || 'Update failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const performStatusToggle = async (u: Required<UserRow>, next: UserStatus) => {
    if (!checkNetworkStatus()) return;
    try {
      setUpdating(true);
      const res = await toggleUserStatus(u._id, next);
      if (res.success) {
        setUsers(prev => prev.map(x => x._id === u._id ? { ...x, status: next } : x));
        if (detail && detail._id === u._id) setDetail({ ...detail, status: next });
        showNotification(`User ${next}`, 'success');
      } else {
        throw new Error(res.message || 'Action failed');
      }
    } catch (e: any) {
      showNotification(e?.message || 'Action failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const removeUser = async (u: Required<UserRow>) => {
    if (!window.confirm(`Delete ${u.name || u.email}? This cannot be undone.`)) return;
    if (!checkNetworkStatus()) return;
    try {
      setUpdating(true);
      const res = await deleteUser(u._id);
      if (res.success) {
        setUsers(prev => prev.filter(x => x._id !== u._id));
        setDetail(null);
        showNotification('User deleted', 'success');
      } else {
        throw new Error(res.message || 'Delete failed');
      }
    } catch (e: any) {
      showNotification(e?.message || 'Delete failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const resetPassword = async (u: Required<UserRow>) => {
    if (!checkNetworkStatus()) return;
    try {
      setUpdating(true);
      const res = await sendPasswordResetEmail(u._id);
      if (res.success) showNotification('Password reset email sent', 'success');
      else throw new Error(res.message || 'Failed to send reset email');
    } catch (e: any) {
      showNotification(e?.message || 'Failed to send reset email', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const verifiedBadge = (ok?: boolean) => (
    <span className={`badge ${ok ? 'verified' : 'unverified'}`}>
      {ok ? 'Verified' : 'Unverified'}
    </span>
  );

  // client-side computed label values to avoid crashes
  const rows = users;

  return (
    <div className="users-admin">
      {/* Analytics Header */}
      <div className="users-analytics" style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>👤 Users</h2>
          <select value={range} onChange={(e) => setRange(e.target.value as any)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <small style={{ color: '#666' }}>{rangeToLabel[range]}</small>
        </div>

        {analyticsLoading ? (
          <div className="loading-state"><div className="spinner">⏳</div><p>Loading analytics…</p></div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-title">DAU</div>
              <div className="stat-number">{analytics?.dau ?? '—'}</div>
              {analytics?.trend7 && <div className="stat-spark"><TinySpark vals={analytics.trend7} /></div>}
            </div>
            <div className="stat-card">
              <div className="stat-title">WAU</div>
              <div className="stat-number">{analytics?.wau ?? '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">MAU</div>
              <div className="stat-number">{analytics?.mau ?? '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Avg Session</div>
              <div className="stat-number">{analytics?.avgSessionMins ? `${analytics.avgSessionMins}m` : '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Returning (7d)</div>
              <div className="stat-number">{analytics?.returning7d ?? '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="users-header">
        <input
          placeholder="Search name/email/phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
        />
        <div className="filters-row">
          <select value={role} onChange={(e) => setRole(e.target.value as any)}>
            <option value="">All roles</option>
            <option value="customer">Customer</option>
            <option value="seller">Seller</option>
            <option value="admin">Admin</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="banned">Banned</option>
          </select>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button onClick={fetchUsers} className="refresh-btn">🔄 Refresh</button>
        </div>
      </div>

      {/* Table / Cards */}
      <div className="users-table-wrap">
        {loading ? (
          <div className="loading-state"><div className="spinner">⏳</div><p>Loading users…</p></div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p>🗒 No users found</p></div>
        ) : (
          <>
            {/* Desktop/Tablet Table */}
            <div className="inventory-table-container table-scroll">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th onClick={() => handleSort('name')} className="sortable">
                      Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th onClick={() => handleSort('ordersCount')} className="sortable">
                      Orders {sortBy === 'ordersCount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => handleSort('lifetimeValue')} className="sortable">
                      LTV {sortBy === 'lifetimeValue' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>7d Activity</th>
                    <th onClick={() => handleSort('lastLoginAt')} className="sortable">
                      Last Login {sortBy === 'lastLoginAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(u => {
                    const safeStatus: UserStatus = u.status ?? 'active';
                    const safeRole: UserRole = (u.role as UserRole) ?? 'customer';
                    return (
                      <tr key={u._id}>
                        <td>
                          <div className="user-cell">
                            {u.avatar ? (
                              <img
                                src={generateResponsiveImageUrl(u.avatar, { width: 44, height: 44, crop: 'fill' })}
                                alt={u.name || u.email}
                                className="user-avatar"
                              />
                            ) : (
                              <div className="no-image avatar-fallback">👤</div>
                            )}
                            <div>
                              <div className="user-name">{u.name || '—'}</div>
                              <small className="muted">
                                {u.city ? `${u.city}${u.country ? ', ' + u.country : ''}` : (u.country || '—')}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>{u.name || '—'}</td>
                        <td>
                          <div className="email-cell">
                            <span>{u.email}</span>{verifiedBadge(u.emailVerified)}
                          </div>
                        </td>
                        <td>{u.phone || '—'}</td>
                        <td>
                          <select
                            value={safeRole}
                            onChange={(e) => editField(u, { role: e.target.value as UserRole })}
                            disabled={updating}
                          >
                            <option value="customer">Customer</option>
                            <option value="seller">Seller</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>{u.ordersCount ?? 0}</td>
                        <td>{u.lifetimeValue ? `₹${u.lifetimeValue.toLocaleString()}` : '₹0'}</td>
                        <td>
                          <div className="spark-wrap">
                            <TinySpark vals={u.sessions7d} />
                            <small className="muted">{u.avgSessionMins ? `${u.avgSessionMins}m avg` : '—'}</small>
                          </div>
                        </td>
                        <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
                        <td>
                          <span className={`status ${safeStatus}`}>{upper(safeStatus)}</span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="edit-btn" title="View details" onClick={() => setDetail(u)}>👁️</button>
                            {safeStatus !== 'banned' ? (
                              <button className="delete-btn" title="Ban user" onClick={() => performStatusToggle(u, 'banned')}>🚫</button>
                            ) : (
                              <button className="edit-btn" title="Unban user" onClick={() => performStatusToggle(u, 'active')}>♻️</button>
                            )}
                            <button className="edit-btn" title="Send password reset" onClick={() => resetPassword(u)}>🔑</button>
                            <button className="delete-btn" title="Delete user" onClick={() => removeUser(u)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards (very small screens) */}
            <div className="users-cards">
              {rows.map(u => {
                const safeStatus: UserStatus = u.status ?? 'active';
                const safeRole: UserRole = (u.role as UserRole) ?? 'customer';
                return (
                  <div key={u._id} className="user-card">
                    <div className="user-card-head">
                      {u.avatar ? (
                        <img
                          src={generateResponsiveImageUrl(u.avatar, { width: 56, height: 56, crop: 'fill' })}
                          alt={u.name || u.email}
                          className="user-avatar-lg"
                        />
                      ) : <div className="no-image avatar-lg-fallback">👤</div>}
                      <div className="user-card-id">
                        <div className="user-name-lg">{u.name || '—'}</div>
                        <div className="muted small">{u.email} {verifiedBadge(u.emailVerified)}</div>
                      </div>
                      <span className={`status chip ${safeStatus}`}>{upper(safeStatus)}</span>
                    </div>

                    <div className="user-card-body">
                      <div><strong>Phone:</strong> {u.phone || '—'}</div>
                      <div><strong>Role:</strong>{' '}
                        <select
                          value={safeRole}
                          onChange={(e) => editField(u, { role: e.target.value as UserRole })}
                          disabled={updating}
                        >
                          <option value="customer">Customer</option>
                          <option value="seller">Seller</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div><strong>Orders:</strong> {u.ordersCount ?? 0}</div>
                      <div><strong>LTV:</strong> {u.lifetimeValue ? `₹${u.lifetimeValue.toLocaleString()}` : '₹0'}</div>
                      <div><strong>Last Login:</strong> {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</div>
                      <div className="spark-wrap mt8">
                        <TinySpark vals={u.sessions7d} />
                        <small className="muted">{u.avgSessionMins ? `${u.avgSessionMins}m avg` : '—'}</small>
                      </div>
                    </div>

                    <div className="user-card-actions">
                      {safeStatus !== 'banned' ? (
                        <button className="chip-btn danger" onClick={() => performStatusToggle(u, 'banned')}>🚫 Ban</button>
                      ) : (
                        <button className="chip-btn" onClick={() => performStatusToggle(u, 'active')}>♻️ Unban</button>
                      )}
                      <button className="chip-btn" onClick={() => setDetail(u)}>👁️ View</button>
                      <button className="chip-btn" onClick={() => resetPassword(u)}>🔑 Reset</button>
                      <button className="chip-btn danger" onClick={() => removeUser(u)}>🗑️ Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-controls">
            <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(1)}>⏮️ First</button>
            <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>⬅️ Prev</button>
            <span className="page-indicator">Page {page} / {totalPages}</span>
            <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ➡️</button>
            <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last ⏭️</button>
          </div>
        </div>
      )}

      {/* Details Drawer */}
      {detail && (
        <div className="drawer-backdrop" onClick={() => setDetail(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>👤 User Details</h3>
              <button onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="drawer-id">
                {detail.avatar ? (
                  <img
                    src={generateResponsiveImageUrl(detail.avatar, { width: 72, height: 72, crop: 'fill' })}
                    alt={detail.name || detail.email}
                    className="user-avatar-xl"
                  />
                ) : <div className="no-image avatar-xl-fallback">👤</div>}
                <div>
                  <div className="drawer-name">{detail.name || '—'}</div>
                  <div className="muted">{detail.email} {verifiedBadge(detail.emailVerified)}</div>
                </div>
              </div>

              <div className="detail-grid">
                <div><strong>Phone:</strong> {detail.phone || '—'}</div>
                <div><strong>Role:</strong> {detail.role}</div>
                <div><strong>Status:</strong> {detail.status}</div>
                <div><strong>Location:</strong> {detail.city || '—'}{detail.country ? `, ${detail.country}` : ''}</div>
                <div><strong>Device:</strong> {detail.device || '—'}</div>
                <div><strong>Joined:</strong> {new Date(detail.createdAt).toLocaleString()}</div>
                <div><strong>Last Login:</strong> {detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString() : '—'}</div>
                <div><strong>Orders:</strong> {detail.ordersCount ?? 0}</div>
                <div><strong>Lifetime Value:</strong> {detail.lifetimeValue ? `₹${detail.lifetimeValue.toLocaleString()}` : '₹0'}</div>
                <div><strong>Avg Session:</strong> {detail.avgSessionMins ? `${detail.avgSessionMins}m` : '—'}</div>
                <div><strong>Total Time (30d):</strong> {detail.totalMins30d ? `${detail.totalMins30d}m` : '—'}</div>
              </div>

              <div className="mt12">
                <div className="strong mb6">Last 7 days activity</div>
                <TinySpark vals={detail.sessions7d} />
              </div>
            </div>

            <div className="drawer-footer">
              <select
                value={detail.role}
                onChange={(e) => editField(detail, { role: e.target.value as UserRole })}
                disabled={updating}
              >
                <option value="customer">Customer</option>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={detail.status}
                onChange={(e) => performStatusToggle(detail, e.target.value as UserStatus)}
                disabled={updating}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="banned">Banned</option>
              </select>
              <button className="edit-btn" onClick={() => resetPassword(detail)} disabled={updating}>🔑 Reset Password</button>
              <button className="delete-btn" onClick={() => removeUser(detail)} disabled={updating}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .muted { color: #666; }
        .small { font-size: 12px; }
        .strong { font-weight: 600; }
        .mb6 { margin-bottom: 6px; }
        .mt8 { margin-top: 8px; }
        .mt12 { margin-top: 12px; }

        .users-admin .badge { font-size: 11px; padding: 2px 6px; border-radius: 999px; border: 1px solid #ddd; }
        .users-admin .badge.verified { color: #065f46; background: #d1fae5; border-color: #a7f3d0; }
        .users-admin .badge.unverified { color: #92400e; background: #fef3c7; border-color: #fde68a; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .stats-grid { grid-template-columns: 1fr; }
        }

        .users-admin .stat-card { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 12px; }
        .users-admin .stat-title { color: #666; font-size: 12px; }
        .users-admin .stat-number { font-weight: 700; font-size: 20px; }

        .users-header {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }
        .users-header input {
          padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px;
        }
        .filters-row {
          display: flex; gap: 8px; flex-wrap: wrap;
        }
        .filters-row select, .filters-row .refresh-btn {
          padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; background: white;
        }

        .table-scroll { overflow-x: auto; }
        .inventory-table { min-width: 1000px; }

        .user-cell { display: flex; align-items: center; gap: 8px; }
        .user-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
        .avatar-fallback { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: #f5f5f5; }

        .email-cell { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .spark-wrap { display: flex; flex-direction: column; gap: 2px; }

        .status { padding: 2px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #ddd; }
        .status.active { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
        .status.inactive { color: #92400e; background: #fffbeb; border-color: #fde68a; }
        .status.banned { color: #991b1b; background: #fee2e2; border-color: #fecaca; }

        .action-buttons { display: flex; gap: 6px; }
        .edit-btn, .delete-btn { border: none; background: #f5f5f5; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
        .delete-btn { background: #fee2e2; }

        .pagination { margin-top: 12px; display: flex; justify-content: center; }
        .pagination-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pagination-btn { padding: 6px 10px; border: 1px solid #ddd; background: white; border-radius: 6px; }
        .page-indicator { padding: 6px 10px; }

        /* Drawer */
        .drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex; justify-content: flex-end; z-index: 1000; }
        .drawer { width: 480px; max-width: 100%; height: 100%; background: #fff; display: flex; flex-direction: column; }
        .drawer-header { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
        .drawer-body { padding: 14px; overflow: auto; flex: 1; }
        .drawer-footer { padding: 12px 14px; border-top: 1px solid #eee; display: flex; gap: 8px; flex-wrap: wrap; }
        .drawer-id { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
        .drawer-name { font-weight: 700; font-size: 18px; }
        .user-avatar-xl { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; }
        .avatar-xl-fallback { width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; background: #f5f5f5; }

        .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        @media (max-width: 520px) {
          .detail-grid { grid-template-columns: 1fr; }
        }

        /* Mobile Cards (shown under 720px) */
        .users-cards { display: none; }
        @media (max-width: 720px) {
          .inventory-table-container { display: none; }
          .users-cards { display: grid; gap: 10px; }
          .user-card { background: #fff; border: 1px solid #eee; border-radius: 10px; overflow: hidden; }
          .user-card-head { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 12px; border-bottom: 1px solid #f2f2f2; }
          .user-avatar-lg { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
          .avatar-lg-fallback { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: #f5f5f5; }
          .user-card-id { min-width: 0; }
          .user-name-lg { font-weight: 700; }
          .chip { padding: 4px 10px; font-size: 12px; }
          .user-card-body { padding: 12px; display: grid; gap: 6px; }
          .user-card-actions { padding: 12px; display: flex; flex-wrap: wrap; gap: 8px; border-top: 1px solid #f2f2f2; }
          .chip-btn { border: 1px solid #ddd; background: #fafafa; padding: 6px 10px; border-radius: 999px; cursor: pointer; }
          .chip-btn.danger { background: #fee2e2; border-color: #fecaca; }
        }
      `}</style>
    </div>
  );
};

export default UsersTab;
