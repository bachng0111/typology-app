import { useBoardStore } from '../../store/boardStore';
import { DEFAULT_BUCKET_H, DEFAULT_BUCKET_W, ungroupedIds } from '../../store/operations';
import { confirmAction } from '../ConfirmDialog';
import { renderBoardPNG } from '../../lib/exportImage';
import { downloadBlob } from '../../lib/download';
import { safeFileName } from '../../lib/export';
import { boardToJSON } from '../../lib/storage';
import { ensureVisible, fitToContent, visibleCenter } from './viewport';

export function addBucket() {
  const s = useBoardStore.getState();
  const c = visibleCenter();
  const id = s.createBucket({ x: c.x - DEFAULT_BUCKET_W / 2, y: c.y - DEFAULT_BUCKET_H / 2 });
  const b = id ? useBoardStore.getState().board?.buckets[id] : null;
  if (b) ensureVisible(b);
}

export function shuffleUngrouped() {
  const s = useBoardStore.getState();
  if (!s.board || ungroupedIds(s.board).length === 0) return;
  s.rerandomizeUngrouped();
  s.showToast('Shuffled ungrouped items', { undo: true });
}

export async function resetGrouping() {
  const s = useBoardStore.getState();
  if (!s.board) return;
  const { ok, checked } = await confirmAction({
    title: 'Start grouping again?',
    message: 'All items leave their buckets and are scattered on the board again. You can undo this.',
    checkbox: s.board.bucketOrder.length ? 'Also delete all buckets' : undefined,
    confirmLabel: 'Reset grouping',
    danger: true,
  });
  if (!ok) return;
  useBoardStore.getState().resetGrouping(checked);
  requestAnimationFrame(fitToContent);
  useBoardStore.getState().showToast('Board reset', { undo: true });
}

export async function deleteSelectedItem() {
  const s = useBoardStore.getState();
  const id = s.selectedItemId;
  const text = id ? s.board?.items[id]?.text : undefined;
  if (!id || text === undefined) return;
  s.deleteItems([id]);
  s.showToast(`Deleted “${text.length > 40 ? text.slice(0, 40) + '…' : text}”`, { undo: true });
}

export async function exportPNG() {
  const s = useBoardStore.getState();
  if (!s.board) return;
  try {
    const blob = await renderBoardPNG(s.board);
    downloadBlob(blob, `${safeFileName(s.board.name)}.png`);
  } catch (err) {
    s.showToast(err instanceof Error ? err.message : 'Could not export the image.', { kind: 'error' });
  }
}

export function exportBackup() {
  const board = useBoardStore.getState().board;
  if (!board) return;
  downloadBlob(new Blob([boardToJSON(board)], { type: 'application/json' }), `${safeFileName(board.name)}.clusterly.json`);
}
