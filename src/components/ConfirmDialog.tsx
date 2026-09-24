import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Optional checkbox, e.g. "Also delete buckets". */
  checkbox?: string;
}

export interface ConfirmResult {
  ok: boolean;
  checked: boolean;
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (r: ConfirmResult) => void }) | null;
}

const useConfirmStore = create<ConfirmState>(() => ({ request: null }));

/** Ask the user to confirm an action. Resolves when the dialog closes. */
export function confirmAction(opts: ConfirmOptions): Promise<ConfirmResult> {
  return new Promise((resolve) => {
    useConfirmStore.getState().request?.resolve({ ok: false, checked: false });
    useConfirmStore.setState({ request: { ...opts, resolve } });
  });
}

export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  const ref = useRef<HTMLDialogElement>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (request && !dlg.open) {
      setChecked(false);
      dlg.showModal();
    } else if (!request && dlg.open) dlg.close();
  }, [request]);

  const finish = (ok: boolean) => {
    request?.resolve({ ok, checked: ok && checked });
    useConfirmStore.setState({ request: null });
  };

  return (
    <dialog
      ref={ref}
      className="dialog confirm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) finish(false);
      }}
      aria-labelledby="confirm-title"
    >
      {request && (
        <form
          method="dialog"
          className="dialog-body"
          onSubmit={(e) => {
            e.preventDefault();
            finish(true);
          }}
        >
          <h2 id="confirm-title">{request.title}</h2>
          {request.message && <p className="muted">{request.message}</p>}
          {request.checkbox && (
            <label className="checkbox">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              {request.checkbox}
            </label>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={() => finish(false)}>
              {request.cancelLabel ?? 'Cancel'}
            </button>
            <button type="submit" className={`btn ${request.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus>
              {request.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
