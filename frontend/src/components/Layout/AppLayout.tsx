import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';
import { AnnouncementBanner } from './AnnouncementBanner';
import { ImpersonationBanner } from './ImpersonationBanner';
import { OfflineBanner } from '../OfflineBanner';
import { useAuthStore } from '../../store/authStore';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loc = useLocation();
  const isWorkspace = loc.pathname.startsWith('/tasks/') && !loc.pathname.endsWith('/setup');

  if (isWorkspace) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <OfflineBanner />
      <ImpersonationBanner />
      <header className="h-14 border-b bg-white flex items-center px-6 gap-6 sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
            A
          </div>
          Annotra
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link
            to="/"
            className={`hover:text-slate-900 ${
              loc.pathname === '/' ? 'text-slate-900 font-medium' : 'text-slate-500'
            }`}
          >
            Projects
          </Link>
          <Link
            to="/my-tasks"
            className={`hover:text-slate-900 ${
              loc.pathname === '/my-tasks' ? 'text-slate-900 font-medium' : 'text-slate-500'
            }`}
          >
            My tasks
          </Link>
          {useAuthStore.getState().user?.role === 'admin' && (
            <Link
              to="/admin"
              className="text-indigo-600 hover:text-indigo-700 font-medium ml-4"
            >
              Admin Console →
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      <AnnouncementBanner />
      <main className="flex-1">{children}</main>
    </div>
  );
};