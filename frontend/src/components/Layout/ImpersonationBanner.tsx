import React from 'react';
import { useAuthStore } from '../../store/authStore';

export const ImpersonationBanner: React.FC = () => {
  const backup = localStorage.getItem('annotra.impersonationBackup');
  if (!backup) return null;

  const stop = () => {
    try {
      const b = JSON.parse(backup);
      useAuthStore.getState().setSession(b.user, b.access, b.refresh);
      localStorage.removeItem('annotra.impersonationBackup');
      window.location.href = '/admin/users';
    } catch {
      localStorage.removeItem('annotra.impersonationBackup');
    }
  };

  return (
    <div className="bg-purple-600 text-white text-sm px-4 py-2 flex items-center gap-3">
      <span className="font-medium">Impersonating a user</span>
      <span className="opacity-80 flex-1">All actions are logged as the admin who started the session.</span>
      <button onClick={stop}
              className="bg-white text-purple-700 px-3 py-1 rounded text-xs font-medium hover:bg-purple-50">
        Stop impersonating
      </button>
    </div>
  );
};
