import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { UserMenu } from '../Layout/UserMenu';
import { NotificationBell } from '../Layout/NotificationBell';
import { OfflineBanner } from '../OfflineBanner';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '▤', end: true },
  { to: '/admin/projects', label: 'Projects', icon: '◫' },
  { to: '/admin/tasks', label: 'Tasks', icon: '☰' },
  { to: '/admin/users', label: 'Users', icon: '◉' },
  { to: '/admin/audit', label: 'Audit log', icon: '≡' },
  // { to: '/admin/api-keys', label: 'API keys', icon: '🔑' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙' },
  { to: '/admin/tool-setup', label: 'Tool setup', icon: '🔧' },
  { to: '/admin/models', label: 'ML Models', icon: '🧠' },
  // { to: '/admin/notifications', label: 'Announcements', icon: '📢' },
  { to: '/admin/quality', label: 'Quality', icon: '★' },
  { to: '/admin/health', label: 'Health', icon: '✚' },
];

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex bg-slate-50">
    {/* Sidebar */}
    <aside className="w-56 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
      <Link to="/" className="h-14 flex items-center gap-2 px-4 border-b border-slate-800">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
          A
        </div>
        <div>
          <div className="text-white font-semibold text-sm leading-none">Annotra</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Admin</div>
        </div>
      </Link>

      <nav className="p-3 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 text-sm rounded-md transition ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-3 border-t border-slate-800">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-300"
        >
          ← Back to app
        </Link>
      </div>
    </aside>

    {/* Main */}
    <div className="flex-1 flex flex-col min-w-0">
      <OfflineBanner />
      <header className="h-14 bg-white border-b flex items-center px-6">
        <h1 className="font-medium text-slate-900">Admin console</h1>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  </div>
);
