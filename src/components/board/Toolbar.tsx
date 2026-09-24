import { useEffect, useRef, useState } from 'react';
import { canRedo, canUndo, useBoardStore } from '../../store/boardStore';
import { saveNow } from '../../store/persist';
import { addBucket, exportBackup, exportPNG, resetGrouping, shuffleUngrouped } from './boardActions';
import { fitToContent, zoomAt } from './viewport';
import type { ExportFormat } from '../ExportDialog';

interface Props {
  onAddItems(): void;
  onExport(format: ExportFormat): void;
  onHelp(): void;
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

function BoardName() {
  const name = useBoardStore((s) => s.board?.name ?? '');
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  const commit = () => {
    if (value.trim()) useBoardStore.getState().setName(value);
    else setValue(name);
  };
  return (
    <input
      className="board-title"
      value={value}
      aria-label="Board name"
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setValue(name);
          requestAnimationFrame(() => (document.activeElement as HTMLElement | null)?.blur());
        }
      }}
    />
  );
}

function SaveStatus() {
  const status = useBoardStore((s) => s.saveStatus);
  const error = useBoardStore((s) => s.saveError);
  const label = status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved' : 'Saved';
  return (
    <button
      className={`save-status is-${status}`}
      onClick={saveNow}
      title={error ?? 'Changes are saved automatically in this browser. Click to save now.'}
      aria-label={`${label}. Save now`}
    >
      <span className="dot" aria-hidden />
      {label}
    </button>
  );
}

export default function Toolbar({ onAddItems, onExport, onHelp }: Props) {
  const undoable = useBoardStore(canUndo);
  const redoable = useBoardStore(canRedo);
  const zoom = useBoardStore((s) => s.board?.viewport.zoom ?? 1);
  const hasItems = useBoardStore((s) => Object.keys(s.board?.items ?? {}).length > 0);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useOutsideClose(exportOpen, () => setExportOpen(false));
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <a href="#/" className="btn btn-ghost" title="All boards" aria-label="Back to all boards">
          ← Boards
        </a>
        <BoardName />
        <SaveStatus />
      </div>

      <div className="toolbar-group">
        <button className="btn btn-primary" onClick={addBucket} title="Create a bucket (B)">
          + Bucket
        </button>
        <button className="btn" onClick={onAddItems} title="Paste or upload more items">
          + Items
        </button>
        <button className="btn" onClick={shuffleUngrouped} disabled={!hasItems} title="Randomly re-scatter the ungrouped items">
          ⤮ Shuffle
        </button>
        <button className="btn" onClick={resetGrouping} disabled={!hasItems} title="Ungroup everything and start again">
          Reset…
        </button>
      </div>

      <div className="toolbar-group">
        <button className="btn btn-icon" onClick={undo} disabled={!undoable} title="Undo (Ctrl/⌘+Z)" aria-label="Undo">
          ↶
        </button>
        <button className="btn btn-icon" onClick={redo} disabled={!redoable} title="Redo (Ctrl/⌘+Shift+Z)" aria-label="Redo">
          ↷
        </button>
      </div>

      <div className="toolbar-group zoom-controls">
        <button className="btn btn-icon" onClick={() => zoomAt(1 / 1.2)} aria-label="Zoom out" title="Zoom out (−)">
          −
        </button>
        <button className="btn btn-zoom" onClick={fitToContent} title="Fit everything in view (F)">
          {Math.round(zoom * 100)}%
        </button>
        <button className="btn btn-icon" onClick={() => zoomAt(1.2)} aria-label="Zoom in" title="Zoom in (+)">
          +
        </button>
      </div>

      <div className="toolbar-group toolbar-end">
        <div className="dropdown" ref={exportRef}>
          <button className="btn" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen((o) => !o)}>
            Export ▾
          </button>
          {exportOpen && (
            <div className="menu menu-right" role="menu">
              <button role="menuitem" onClick={() => (setExportOpen(false), void exportPNG())}>
                Image (.png)
              </button>
              <button role="menuitem" onClick={() => (setExportOpen(false), onExport('text'))}>
                Buckets as text…
              </button>
              <button role="menuitem" onClick={() => (setExportOpen(false), onExport('csv'))}>
                Buckets as CSV…
              </button>
              <hr />
              <button role="menuitem" onClick={() => (setExportOpen(false), exportBackup())}>
                Board backup (.json)
              </button>
            </div>
          )}
        </div>
        <button className="btn btn-icon" onClick={onHelp} aria-label="Keyboard shortcuts and help" title="Help (?)">
          ?
        </button>
      </div>
    </header>
  );
}
