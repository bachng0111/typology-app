import { useCallback, useEffect, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { flushSave } from '../store/persist';
import { loadBoard } from '../lib/storage';
import Canvas from '../components/board/Canvas';
import Toolbar from '../components/board/Toolbar';
import HintBar from '../components/board/HintBar';
import AddItemsDialog from '../components/AddItemsDialog';
import ExportDialog, { type ExportFormat } from '../components/ExportDialog';
import HelpDialog from '../components/HelpDialog';
import { useShortcuts } from '../components/board/useShortcuts';

export default function BoardPage({ id }: { id: string }) {
  const loaded = useBoardStore((s) => s.board?.id === id);
  const [missing, setMissing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const board = loadBoard(id);
    if (board) useBoardStore.getState().openBoard(board);
    else setMissing(true);
    return () => {
      flushSave();
      useBoardStore.getState().closeBoard();
    };
  }, [id]);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const openAdd = useCallback(() => setAddOpen(true), []);
  useShortcuts({ onHelp: openHelp, disabled: !loaded });

  if (missing) {
    return (
      <div className="page page-narrow">
        <h1>Board not found</h1>
        <p className="muted">It may have been deleted, or it was created in a different browser.</p>
        <a className="btn btn-primary" href="#/">
          Back to boards
        </a>
      </div>
    );
  }
  if (!loaded) return null;

  return (
    <div className="board-page">
      <Toolbar onAddItems={openAdd} onExport={setExportFormat} onHelp={openHelp} />
      <HintBar onAddItems={openAdd} />
      <Canvas />
      <AddItemsDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <ExportDialog format={exportFormat} onClose={() => setExportFormat(null)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
