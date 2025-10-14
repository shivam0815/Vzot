import React, { memo, useState, useEffect } from 'react';
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

  // auto-open on desktop first render
  useEffect(() => {
    if (window.matchMedia('(min-width:1024px)').matches) setOpen(true);
  }, []);

  return (
    <>
      {/* Mobile open FAB */}
      <button className="sb-fab" aria-label="Open menu" onClick={() => setOpen(true)}>☰</button>

      {/* Backdrop for mobile */}
      {open && <div className="sb-overlay" onClick={() => setOpen(false)} />}

      <aside className={clsx('sidebar', open ? 'open' : 'closed')}>
        <div className="sb-top">
          <button className="sb-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle Sidebar">☰</button>
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
                onClick={() => { setActiveTab(it.key); if (window.innerWidth < 1024) setOpen(false); }}
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
        .sidebar{
          position:fixed; top:0; left:0; height:100vh; width:240px;
          background:#fff; color:#000; border-right:1px solid rgba(0,0,0,.1);
          display:flex; flex-direction:column; gap:8px;
          transform:translateX(-100%); transition:transform .3s ease; z-index:2000;
        }
        .sidebar.open{ transform:translateX(0) }
        @media (min-width:1024px){
          .sidebar{ position:sticky; transform:translateX(0) }
        }

        .sb-top{display:flex; align-items:center; gap:10px; padding:12px; border-bottom:1px solid #eee}
        .sb-toggle{width:40px;height:40px;border-radius:10px;border:1px solid rgba(0,0,0,.2);background:#fff;cursor:pointer}
        .sb-brand{display:flex;align-items:center;gap:10px}
        .sb-logo{width:36px;height:36px;display:grid;place-items:center;background:#f1f1f1;border-radius:10px}
        .sb-meta .sb-title{font-weight:700;color:#111}
        .sb-meta .sb-sub{font-size:12px;color:#555}

        .sb-nav{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:8px}
        .sb-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid transparent;background:transparent;color:#111;cursor:pointer}
        .sb-item:hover{background:#f3f3f3;border-color:#ccc}
        .sb-item.active{background:linear-gradient(135deg,#637bff 0%, #6a45a7 100%);color:#fff}
        .sb-icon{width:22px;text-align:center}
        .sb-bottom{padding:8px;border-top:1px solid #eee}
        .sb-logout{width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid #ccc;background:#fff;cursor:pointer}
        .sb-logout:hover{background:#b91c1c;color:#fff;border-color:transparent}

        .sb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(2px);z-index:1500}
        .sb-fab{
          position:fixed; left:12px; bottom:16px; z-index:2100;
          width:44px;height:44px;border-radius:12px;border:1px solid rgba(0,0,0,.15);
          background:#fff;color:#000; box-shadow:0 6px 20px rgba(0,0,0,.15); cursor:pointer;
        }
        @media (min-width:1024px){ .sb-fab{ display:none } }
      `}</style>
    </>
  );
});

export default SlideBar;
