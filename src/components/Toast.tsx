import { useEffect } from 'react';
import { useBoardStore } from '../store/boardStore';

export default function Toast() {
  const toast = useBoardStore((s) => s.toast);
  const dismiss = useBoardStore((s) => s.dismissToast);
  const undo = useBoardStore((s) => s.undo);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, toast.kind === 'error' ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind === 'error' ? 'toast-error' : ''}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          className="toast-action"
          onClick={() => {
            undo();
            dismiss();
          }}
        >
          Undo
        </button>
      )}
      <button className="toast-close" aria-label="Dismiss" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
