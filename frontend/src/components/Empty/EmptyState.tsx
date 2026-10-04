import React from 'react';

interface Props {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<Props> = ({ icon, title, description, action }) => (
  <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center bg-white">
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="text-lg font-medium text-slate-900 mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">{description}</p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
      >
        {action.label}
      </button>
    )}
  </div>
);
