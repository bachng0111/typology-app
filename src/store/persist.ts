import { saveBoard, StorageError } from '../lib/storage';
import { useBoardStore } from './boardStore';
import type { Board } from './types';

const DEBOUNCE_MS = 400;

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Board | null = null;
let lastSaved: Board | null = null;

function write(board: Board) {
  const { setSaveStatus, showToast, saveError } = useBoardStore.getState();
  try {
    saveBoard(board);
    lastSaved = board;
    setSaveStatus('saved');
  } catch (err) {
    const message = err instanceof StorageError ? err.message : 'Could not save the board.';
    setSaveStatus('error', message);
    if (saveError !== message) showToast(message, { kind: 'error' });
  }
}

/** Write any pending change immediately. */
export function flushSave() {
  if (timer) clearTimeout(timer);
  timer = null;
  const board = pending;
  pending = null;
  if (board && board !== lastSaved) write(board);
}

/** Explicit save action: flush pending changes, or re-save the current board. */
export function saveNow() {
  const { board } = useBoardStore.getState();
  if (!board) return;
  pending = board;
  lastSaved = null;
  flushSave();
}

let started = false;

/** Autosave: persist the open board shortly after every change, and when the page is hidden/closed. */
export function startAutosave() {
  if (started) return;
  started = true;
  useBoardStore.subscribe((state, prev) => {
    if (state.board === prev.board) return;
    if (!state.board) {
      flushSave();
      lastSaved = null;
      return;
    }
    if (prev.board?.id !== state.board.id) {
      // A board was just opened: it is already in storage.
      flushSave();
      lastSaved = state.board;
      return;
    }
    pending = state.board;
    if (state.saveStatus !== 'saving') useBoardStore.getState().setSaveStatus('saving');
    if (timer) clearTimeout(timer);
    timer = setTimeout(flushSave, DEBOUNCE_MS);
  });
  const flushIfHidden = () => {
    if (document.visibilityState === 'hidden') flushSave();
  };
  window.addEventListener('pagehide', flushSave);
  window.addEventListener('beforeunload', flushSave);
  document.addEventListener('visibilitychange', flushIfHidden);
}
