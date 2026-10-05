import React, { useEffect, useState } from 'react';

export const OfflineBanner: React.FC = () => {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs px-4 py-1.5 text-center font-medium">
      You're offline. Changes will sync when you reconnect.
    </div>
  );
};
