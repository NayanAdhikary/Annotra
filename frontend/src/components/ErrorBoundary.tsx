import React from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface State {
  error: Error | null;
  eventId: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, eventId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const title = this.props.fallbackTitle ?? 'Something went wrong';
    const description = this.props.fallbackDescription
      ?? "The page crashed. Your work is saved. Reload to continue.";

    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
          <div className="text-5xl mb-4">⚠</div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">{title}</h1>
          <p className="text-sm text-slate-600 mb-6">{description}</p>

          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
            >
              Reload the page
            </button>
            <a
              href="/"
              className="px-4 py-2 border border-slate-300 text-sm rounded-md hover:bg-slate-50"
            >
              Go home
            </a>
          </div>

          {this.state.eventId && (
            <p className="text-[10px] text-slate-400 mt-4 font-mono">
              Ref: {this.state.eventId}
            </p>
          )}
        </div>
      </div>
    );
  }
}