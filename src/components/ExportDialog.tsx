import { useEffect, useMemo, useRef, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { safeFileName, toCSV, toText } from '../lib/export';
import { downloadText } from '../lib/download';

export type ExportFormat = 'text' | 'csv';

interface Props {
  format: ExportFormat | null;
  onClose(): void;
}

export default function ExportDialog({ format, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const board = useBoardStore((s) => s.board);
  const [tab, setTab] = useState<ExportFormat>('text');
  const [includeUngrouped, setIncludeUngrouped] = useState(true);
  const [includeComments, setIncludeComments] = useState(false);
  const hasComments = useBoardStore((s) => Object.values(s.board?.notes ?? {}).some((n) => n.text.trim()));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (format) {
      setTab(format);
      setCopied(false);
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) dlg.close();
  }, [format]);

  const output = useMemo(() => {
    if (!board || !format) return '';
    const opts = { includeUngrouped, includeComments };
    return tab === 'csv' ? toCSV(board, opts) : toText(board, opts);
  }, [board, tab, includeUngrouped, includeComments, format]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    if (!board) return;
    const base = safeFileName(board.name);
    if (tab === 'csv') downloadText(output, `${base}.csv`, 'text/csv');
    else downloadText(output, `${base}.txt`);
  };

  return (
    <dialog
      ref={ref}
      className="dialog export-dialog"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="export-title"
    >
      <div className="dialog-body">
        <h2 id="export-title">Export buckets</h2>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'text'} className={`tab ${tab === 'text' ? 'active' : ''}`} onClick={() => setTab('text')}>
            Text
          </button>
          <button role="tab" aria-selected={tab === 'csv'} className={`tab ${tab === 'csv' ? 'active' : ''}`} onClick={() => setTab('csv')}>
            CSV
          </button>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={includeUngrouped} onChange={(e) => setIncludeUngrouped(e.target.checked)} />
          Include ungrouped items
        </label>
        {hasComments && (
          <label className="checkbox checkbox-spaced">
            <input type="checkbox" checked={includeComments} onChange={(e) => setIncludeComments(e.target.checked)} />
            Include comments (sticky notes)
          </label>
        )}
        <textarea className="textarea export-preview" readOnly value={output} aria-label="Export preview" rows={14} />
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <span className="spacer" />
          <button className="btn" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <button className="btn btn-primary" onClick={download}>
            Download .{tab === 'csv' ? 'csv' : 'txt'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
