import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { App } from './App.tsx'
import * as Sentry from '@sentry/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast/ToastProvider';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE || 'dev',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    // Never send PII by default
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)

if (import.meta.env.DEV) (window as any).__crash = () => { throw new Error('test'); };
