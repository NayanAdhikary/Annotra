import React from 'react';
import type { ReviewStatus } from '../../api/review';

const STYLES: Record<ReviewStatus, { bg: string; text: string; label: string }> = {
  pending:  { bg: 'bg-slate-100',   text: 'text-slate-600',   label: 'Pending' },
  accepted: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Accepted' },
  rejected: { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Rejected' },
  fixed:    { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Fixed' },
};

export const ReviewBadge: React.FC<{ status: ReviewStatus | string | undefined }> = ({ status }) => {
  const s = (status ?? 'pending') as ReviewStatus;
  const style = STYLES[s] ?? STYLES.pending;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
};