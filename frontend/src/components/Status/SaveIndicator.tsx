import React from 'react';
import { useAnnotationStore } from '../../store/annotationStore';

const COPY: Record<string, string> = {
  idle: '',
  saving: 'Saving…',
  saved: '✓ Saved',
  error: '⚠ Save failed',
};

const COLOR: Record<string, string> = {
  idle: 'text-transparent',
  saving: 'text-gray-500',
  saved: 'text-green-600',
  error: 'text-red-600',
};

export const SaveIndicator: React.FC = () => {
  const status = useAnnotationStore((s) => s.saveStatus);
  return (
    <div className={`text-xs font-medium px-3 ${COLOR[status]}`} aria-live="polite">
      {COPY[status] || 'placeholder'}
    </div>
  );
};