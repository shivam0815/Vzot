// src/components/Layout/SlideBar.tsx
import React, { memo, useState } from 'react';
import clsx from 'clsx';

type SidebarProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminData?: { name?: string } | null;
  onLogout?: () => void;
};

const NAV_ITEMS: { key: string; label: string }[] = [
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
  const [open, setOpen] = useState(true);

  return (
    <aside className={clsx('sidebar', open ? 'w-64' : 'w-[72px]')}>
      <div className="sb-top">
        <button
          className="sb-toggle"
          aria-label="Toggle sidebar"
          onClick={() => setOpen(v => !v)}
          title="Toggle sidebar"
        >
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
              onClick={() => setActiveTab(it.key)}
              className={clsx('sb-item', active && 'active')}
              title={it.label}
            >
              <span className="sb-icon">{icon}</span>
              {open && <span className="sb-text">{rest.join(' ')}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sb-bottom">
        {onLogout && (
          <button className="sb-logout" onClick={onLogout} title="Logout">
            <span className="sb-icon">🚪</span>
            {open && <span className="sb-text">Logout</span>}
          </button>
        )}
      </div>

      <style>{`
  .sidebar{
    position: sticky; top: 0; height: 100vh;
    background: #ffffff; color: #000000; flex: 0 0 auto;
    transition: width .2s ease; border-right: 1px solid rgba(0,0,0,0.1);
    display: flex; flex-direction: column; gap: 8px;
  }
  .sb-top{display:flex; align-items:center; gap:10px; padding:12px}
  .sb-toggle{
    width:40px; height:40px; border-radius:10px; border:1px solid rgba(0,0,0,0.2);
    background: #ffffff; color:#000000; cursor:pointer;
  }
  .sb-brand{display:flex; align-items:center; gap:10px}
  .sb-logo{width:36px; height:36px; display:grid; place-items:center; background:#f1f1f1; border-radius:10px}
  .sb-meta .sb-title{font-weight:700; line-height:1; color:#111}
  .sb-meta .sb-sub{font-size:12px; color:#555}

  .sb-nav{display:flex; flex-direction:column; gap:6px; padding:8px}
  .sb-item{
    display:flex; align-items:center; gap:12px;
    padding:10px 12px; border-radius:10px; border:1px solid transparent;
    color:#111; background: transparent; text-align:left; cursor:pointer;
  }
  .sb-item:hover{ background:#f3f3f3; border-color:#ccc; color:#000 }
  .sb-item.active{ background: linear-gradient(135deg,#637bff 0%, #6a45a7 100%); color:#fff; border-color: transparent }
  .sb-icon{width:22px; text-align:center}
  .sb-text{white-space:nowrap; overflow:hidden; text-overflow:ellipsis}

  .sb-bottom{margin-top:auto; padding:8px}
  .sb-logout{
    width:100%; display:flex; align-items:center; gap:12px; padding:10px 12px;
    border-radius:10px; border:1px solid #ccc; color:#000;
    background:#fff; cursor:pointer;
  }
  .sb-logout:hover{ background:#b91c1c; color:#fff; border-color:transparent }
`}</style>

    </aside>
  );
});

export default SlideBar;
