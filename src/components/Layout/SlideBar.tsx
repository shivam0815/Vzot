// src/components/Layout/SlideBar.tsx
import React, { memo, useState } from 'react';
import clsx from 'clsx';

type SidebarProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminData?: { name?: string } | null;
  onLogout?: () => void;
};

const NAV_ITEMS = [
  { key: 'overview', label: '📊 Overview' },
  { key: 'products', label: '📦 Products' },
  { key: 'inventory', label: '📋 Inventory' },
  { key: 'orders', label: '🧾 Orders' },
  { key: 'returns', label: '🔄 Returns' },
  { key: 'reviews', label: '⭐ Reviews' },
  { key: 'payments', label: '💳 Payments' },
  { key: 'support', label: '🆘 Support' },
  { key: 'notifications', label: '🔔 Notifications' },
  { key: 'blog', label: '📝 Blog' },
  { key: 'users', label: '👤 Users' },
  { key: 'todaySales', label: '🗓️ Today’s Sales' },
  { key: 'lowStock', label: '⚠️ Low Stock' },
  { key: 'pendingOrders', label: '⏳ Pending Orders' },
];

const SlideBar = memo<SidebarProps>(({ activeTab, setActiveTab, adminData, onLogout }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Overlay for mobile */}
      {open && <div className="sb-overlay" onClick={() => setOpen(false)} />}

      <aside className={clsx('sidebar', open ? 'open' : 'closed')}>
        <div className="sb-top">
          <button className="sb-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle Sidebar">
            ☰
          </button>

          {open && (
            <div className="sb-brand">
              <div className="sb-logo">🚀</div>
              <div className="sb-meta">
                <div className="sb-title">Admin</div>
                {adminData?.name && <div className="sb-sub">Hi, {adminData.name}</div>}
              </div>
            </div>
          )}
        </div>

        <nav className="sb-nav">
          {NAV_ITEMS.map(it => {
            const active = activeTab === it.key;
            const [icon, ...rest] = it.label.split(' ');
            return (
              <button
                key={it.key}
                onClick={() => {
                  setActiveTab(it.key);
                  setOpen(false);
                }}
                className={clsx('sb-item', active && 'active')}
                title={it.label}
              >
                <span className="sb-icon">{icon}</span>
                <span className="sb-text">{rest.join(' ')}</span>
              </button>
            );
          })}
        </nav>

        <div className="sb-bottom">
          {onLogout && (
            <button className="sb-logout" onClick={onLogout} title="Logout">
              <span className="sb-icon">🚪</span>
              <span className="sb-text">Logout</span>
            </button>
          )}
        </div>
      </aside>

      <style>{`
        .sidebar {
          position: fixed;
          top: 0; left: 0;
          height: 100vh;
          background: #fff;
          color: #000;
          border-right: 1px solid rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: transform 0.3s ease, width 0.3s ease;
          z-index: 2000;
        }

        /* Desktop default open */
        @media (min-width: 1024px) {
          .sidebar {
            transform: translateX(0);
            width: 240px;
            position: sticky;
          }
        }

        /* Mobile collapsed */
        @media (max-width: 1023px) {
          .sidebar {
            width: 240px;
            transform: translateX(-100%);
          }
          .sidebar.open {
            transform: translateX(0);
          }
        }

        .sb-top {
          display: flex; align-items: center; gap: 10px;
          padding: 12px; border-bottom: 1px solid #eee;
        }
        .sb-toggle {
          width: 40px; height: 40px; border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.2);
          background: #fff; color: #000; cursor: pointer;
          flex-shrink: 0;
        }
        .sb-brand {
          display: flex; align-items: center; gap: 10px;
        }
        .sb-logo {
          width: 36px; height: 36px; display: grid; place-items: center;
          background: #f1f1f1; border-radius: 10px;
        }
        .sb-meta .sb-title {
          font-weight: 700; color: #111;
        }
        .sb-meta .sb-sub {
          font-size: 12px; color: #555;
        }

        .sb-nav {
          display: flex; flex-direction: column; gap: 6px; padding: 8px;
          overflow-y: auto; flex: 1;
        }
        .sb-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: 10px;
          color: #111; background: transparent; border: 1px solid transparent;
          cursor: pointer; text-align: left;
        }
        .sb-item:hover {
          background: #f3f3f3; border-color: #ccc; color: #000;
        }
        .sb-item.active {
          background: linear-gradient(135deg, #637bff 0%, #6a45a7 100%);
          color: #fff;
        }
        .sb-icon {
          width: 22px; text-align: center;
        }
        .sb-text {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .sb-bottom {
          padding: 8px; border-top: 1px solid #eee;
        }
        .sb-logout {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: 10px;
          border: 1px solid #ccc; color: #000;
          background: #fff; cursor: pointer;
        }
        .sb-logout:hover {
          background: #b91c1c; color: #fff; border-color: transparent;
        }

        /* Mobile overlay */
        .sb-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(2px);
          z-index: 1000;
        }
      `}</style>
    </>
  );
});

export default SlideBar;
