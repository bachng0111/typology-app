import { useEffect, useRef } from 'react';

const SHORTCUTS: [string, string][] = [
  ['Drag an item', 'Move it, or drop it into a bucket'],
  ['Double-click an item', 'Edit its text'],
  ['Double-click empty space', 'Create a bucket there'],
  ['Double-click a bucket title', 'Rename the bucket'],
  ['Drag empty space / Space + drag', 'Pan the board'],
  ['Scroll / Ctrl or ⌘ + scroll', 'Pan / zoom'],
  ['B', 'New bucket'],
  ['F', 'Fit everything in view'],
  ['+ / −', 'Zoom in / out'],
  ['Delete / Backspace', 'Delete the selected item'],
  ['Ctrl/⌘ + Z', 'Undo'],
  ['Ctrl/⌘ + Shift + Z, Ctrl + Y', 'Redo'],
  ['Ctrl/⌘ + S', 'Save now'],
  ['Esc', 'Cancel a drag or edit, clear selection'],
];

export default function HelpDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="help-title"
    >
      <div className="dialog-body">
        <h2 id="help-title">How it works</h2>
        <ol className="flow flow-compact">
          <li><span>1</span>Add text</li>
          <li><span>2</span>Parse items</li>
          <li><span>3</span>Randomize</li>
          <li><span>4</span>Create buckets</li>
          <li><span>5</span>Drag items</li>
          <li><span>6</span>Name buckets</li>
        </ol>
        <table className="shortcuts">
          <tbody>
            {SHORTCUTS.map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">Your board is saved automatically in this browser. Use Export → Board backup to keep a copy elsewhere.</p>
        <div className="dialog-actions">
          <span className="spacer" />
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </dialog>
  );
}
