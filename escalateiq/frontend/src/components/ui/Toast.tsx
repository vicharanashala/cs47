'use client';

import { useNotificationStore, Toast } from '@/store/notificationStore';

export function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const colors = {
    success: 'bg-emerald-900/90 border-emerald-700 text-emerald-100',
    error: 'bg-red-900/90 border-red-700 text-red-100',
    warning: 'bg-amber-900/90 border-amber-700 text-amber-100',
    info: 'bg-slate-800/90 border-slate-700 text-slate-100',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-2xl animate-slide-in max-w-sm ${colors[toast.type]}`}
      onClick={onDismiss}
    >
      <span className="font-bold text-sm mt-0.5">{icons[toast.type]}</span>
      <p className="text-sm flex-1">{toast.message}</p>
    </div>
  );
}
