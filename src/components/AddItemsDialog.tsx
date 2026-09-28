import { useEffect, useRef } from 'react';
import ItemsWizard from './ItemsWizard';
import { useBoardStore } from '../store/boardStore';
import { ensureVisible, fitRect, visibleCenter, visibleRect } from './board/viewport';
import { boundsOf } from '../lib/layout';
import { itemRect } from '../store/operations';

interface Props {
  open: boolean;
  onClose(): void;
}

export default function AddItemsDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const delimiter = useBoardStore((s) => s.board?.delimiter ?? '/');

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog add-items-dialog" onClose={onClose} aria-label="Add items">
      {open && (
        <div className="dialog-body">
          <h2>Add items</h2>
          <ItemsWizard
            initialDelimiter={delimiter}
            confirmLabel={(n) => `Add ${n} item${n === 1 ? '' : 's'} to board`}
            onCancel={onClose}
            onConfirm={(texts) => {
              const s = useBoardStore.getState();
              const c = visibleCenter();
              const ids = s.addItems(texts, { x: c.x - 200, y: c.y - 100 });
              const board = useBoardStore.getState().board;
              const added = board ? boundsOf(ids.map((id) => itemRect(board.items[id]))) : null;
              if (added) {
                const vis = visibleRect();
                if (added.w > vis.w || added.h > vis.h) fitRect(added);
                else ensureVisible(added);
              }
              s.showToast(`Added ${ids.length} item${ids.length === 1 ? '' : 's'}`, { undo: true });
              onClose();
            }}
          />
        </div>
      )}
    </dialog>
  );
}
