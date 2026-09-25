import { useBoardStore } from '../../store/boardStore';
import {
  DEFAULT_BUCKET_H,
  DEFAULT_BUCKET_W,
  DEFAULT_NOTE_H,
  DEFAULT_NOTE_W,
  findBucketSpot,
  findFreeSpot,
  ungroupedIds,
} from '../../store/operations';
import { boundsOf } from '../../lib/layout';
import { confirmAction } from '../ConfirmDialog';
import { renderBoardPNG } from '../../lib/exportImage';
import { downloadBlob } from '../../lib/download';
import { safeFileName } from '../../lib/export';
import { boardToJSON } from '../../lib/storage';
import { currentViewport, fitRect, fitToContent, visibleRect } from './viewport';

/** Create a bucket in free space, keeping the current view (zooming out only if needed). */
export function addBucket() {
  const s = useBoardStore.getState();
  if (!s.board) return;
  const visible = visibleRect();
  const spot = findBucketSpot(s.board, visible);
  s.createBucket(spot, true);
  const b = { ...spot, w: DEFAULT_BUCKET_W, h: DEFAULT_BUCKET_H };
  const inView =
    b.x >= visible.x && b.y >= visible.y && b.x + b.w <= visible.x + visible.w && b.y + b.h <= visible.y + visible.h;
  if (!inView) fitRect(boundsOf([visible, b])!, currentViewport().zoom);
}

/** Add a sticky-note comment in free space and open it for typing. */
export function addNote() {
  const s = useBoardStore.getState();
  if (!s.board) return;
  const visible = visibleRect();
  const size = { w: DEFAULT_NOTE_W, h: DEFAULT_NOTE_H };
  const spot = findFreeSpot(s.board, visible, size);
  s.createNote(spot);
  const n = { ...spot, ...size };
  const inView =
    n.x >= visible.x && n.y >= visible.y && n.x + n.w <= visible.x + visible.w && n.y + n.h <= visible.y + visible.h;
  if (!inView) fitRect(boundsOf([visible, n])!, currentViewport().zoom);
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
  requestAnimationFrame(() => fitToContent());
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
