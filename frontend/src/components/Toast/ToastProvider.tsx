import React, { createContext, useCallback, useContext, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastCtx {
  push: (kind: ToastKind, message: string, action?: Toast['action']) => void;
}

const Ctx = createContext<ToastCtx>({ push: () => {} });

export const useToast = () => useContext(Ctx);

const STYLES: Record<ToastKind, string> = {
  success: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  error:   'bg-red-50 border-red-300 text-red-900',
  info:    'bg-sky-50 border-sky-300 text-sky-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
};

const ICONS: Record<ToastKind, string> = {
  success: '✓', error: '⚠', info: 'ℹ', warning: '⚠',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string, action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message, action }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, action ? 8000 : 4500);
  }, []);

  const dismiss = (id: number) =>
    setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`border rounded-lg shadow-lg px-4 py-3 text-sm flex items-start gap-3 ${STYLES[t.kind]}`}
            style={{ animation: 'slide-in 200ms ease-out' }}
          >
            <span className="text-lg leading-none">{ICONS[t.kind]}</span>
            <div className="flex-1">
              <div>{t.message}</div>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                  className="mt-1 text-xs font-medium underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-xs opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </Ctx.Provider>
  );
};
