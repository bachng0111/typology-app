import { create } from 'zustand';
import type { Board, BoardContent, Viewport } from './types';
import * as ops from './operations';

export const HISTORY_LIMIT = 100;
const COALESCE_MS = 1000;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind?: 'info' | 'error';
  undo?: boolean;
}

interface State {
  board: Board | null;
  past: BoardContent[];
  future: BoardContent[];
  coalesceKey: string | null;
  coalesceAt: number;

  saveStatus: SaveStatus;
  saveError: string | null;

  // Transient UI state (never saved or recorded in history).
  selectedItemId: string | null;
  draggingItemId: string | null;
  hoverBucketId: string | null;
  dropIndex: number | null;
  renamingBucketId: string | null;
  /** Bucket shown above the others (last one moved/resized). */
  raisedBucketId: string | null;
  toast: Toast | null;
}

interface Actions {
  openBoard(board: Board): void;
  closeBoard(): void;
  /** Apply an undoable content change. Changes sharing `coalesceKey` within 1s form one undo step. */
  commit(update: (c: BoardContent) => BoardContent, coalesceKey?: string): void;
  undo(): void;
  redo(): void;
  setName(name: string): void;
  setViewport(v: Viewport): void;

  addItems(texts: string[], near?: { x: number; y: number }): string[];
  editItem(id: string, text: string): void;
  deleteItems(ids: string[]): void;
  placeItemOnBoard(id: string, x: number, y: number): void;
  returnToBoard(id: string): void;
  assignItem(id: string, bucketId: string, index?: number): void;
  createBucket(at: { x: number; y: number }, exact?: boolean): string | null;
  renameBucket(id: string, name: string): void;
  moveBucket(id: string, x: number, y: number): void;
  resizeBucket(id: string, w: number, h: number): void;
  raiseBucket(id: string): void;
  deleteBucket(id: string): void;
  rerandomizeUngrouped(): void;
  resetGrouping(deleteBuckets: boolean): void;

  select(id: string | null): void;
  setDrag(dragging: string | null, hoverBucket: string | null, dropIndex: number | null): void;
  setRenamingBucket(id: string | null): void;
  showToast(message: string, opts?: { kind?: Toast['kind']; undo?: boolean }): void;
  dismissToast(): void;
  setSaveStatus(status: SaveStatus, error?: string | null): void;
}

export type BoardStore = State & Actions;

const contentOf = (b: Board): BoardContent => ({ items: b.items, buckets: b.buckets, bucketOrder: b.bucketOrder });

const sameContent = (a: BoardContent, b: BoardContent) =>
  a.items === b.items && a.buckets === b.buckets && a.bucketOrder === b.bucketOrder;

let toastSeq = 0;

export const useBoardStore = create<BoardStore>()((set, get) => ({
  board: null,
  past: [],
  future: [],
  coalesceKey: null,
  coalesceAt: 0,
  saveStatus: 'idle',
  saveError: null,
  selectedItemId: null,
  draggingItemId: null,
  hoverBucketId: null,
  dropIndex: null,
  renamingBucketId: null,
  raisedBucketId: null,
  toast: null,

  openBoard(board) {
    set({
      board,
      past: [],
      future: [],
      coalesceKey: null,
      selectedItemId: null,
      draggingItemId: null,
      hoverBucketId: null,
      dropIndex: null,
      renamingBucketId: null,
      raisedBucketId: null,
      toast: null,
      saveStatus: 'saved',
      saveError: null,
    });
  },

  closeBoard() {
    set({ board: null, past: [], future: [], toast: null, selectedItemId: null });
  },

  commit(update, coalesceKey) {
    const { board, past, coalesceKey: lastKey, coalesceAt } = get();
    if (!board) return;
    const before = contentOf(board);
    const after = update(before);
    if (sameContent(before, after)) return;
    const now = Date.now();
    const coalesce = coalesceKey !== undefined && coalesceKey === lastKey && now - coalesceAt < COALESCE_MS;
    set({
      board: { ...board, ...after, updatedAt: now },
      past: coalesce ? past : [...past, before].slice(-HISTORY_LIMIT),
      future: [],
      coalesceKey: coalesceKey ?? null,
      coalesceAt: now,
    });
  },

  undo() {
    const { board, past, future } = get();
    if (!board || past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      board: { ...board, ...prev, updatedAt: Date.now() },
      past: past.slice(0, -1),
      future: [contentOf(board), ...future],
      coalesceKey: null,
      selectedItemId: null,
    });
  },

  redo() {
    const { board, past, future } = get();
    if (!board || future.length === 0) return;
    const [next, ...rest] = future;
    set({
      board: { ...board, ...next, updatedAt: Date.now() },
      past: [...past, contentOf(board)],
      future: rest,
      coalesceKey: null,
      selectedItemId: null,
    });
  },

  setName(name) {
    const { board } = get();
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!board || !clean || clean === board.name) return;
    set({ board: { ...board, name: clean, updatedAt: Date.now() } });
  },

  setViewport(viewport) {
    const { board } = get();
    if (!board) return;
    set({ board: { ...board, viewport } });
  },

  addItems(texts, near) {
    let ids: string[] = [];
    get().commit((c) => {
      const r = ops.addItems(c, texts, near);
      ids = r.ids;
      return r.content;
    });
    return ids;
  },

  editItem(id, text) {
    get().commit((c) => ops.editItem(c, id, text));
  },

  deleteItems(ids) {
    get().commit((c) => ops.deleteItems(c, ids));
    if (ids.includes(get().selectedItemId ?? '')) set({ selectedItemId: null });
  },

  placeItemOnBoard(id, x, y) {
    get().commit((c) => ops.placeItemOnBoard(c, id, x, y));
  },

  returnToBoard(id) {
    get().commit((c) => ops.returnToBoard(c, id));
  },

  assignItem(id, bucketId, index) {
    get().commit((c) => ops.assignItem(c, id, bucketId, index));
  },

  createBucket(at, exact) {
    let id: string | null = null;
    get().commit((c) => {
      const r = ops.createBucket(c, at, '', exact);
      id = r.id;
      return r.content;
    });
    if (id) set({ renamingBucketId: id });
    return id;
  },

  renameBucket(id, name) {
    get().commit((c) => ops.renameBucket(c, id, name));
  },

  moveBucket(id, x, y) {
    get().commit((c) => ops.moveBucket(c, id, x, y));
  },

  resizeBucket(id, w, h) {
    get().commit((c) => ops.resizeBucket(c, id, w, h));
  },

  raiseBucket(id) {
    if (get().raisedBucketId !== id) set({ raisedBucketId: id });
  },

  deleteBucket(id) {
    get().commit((c) => ops.deleteBucket(c, id));
  },

  rerandomizeUngrouped() {
    get().commit((c) => ops.rerandomizeUngrouped(c));
  },

  resetGrouping(deleteBuckets) {
    get().commit((c) => ops.resetGrouping(c, deleteBuckets));
  },

  select(id) {
    if (get().selectedItemId !== id) set({ selectedItemId: id });
  },

  setDrag(draggingItemId, hoverBucketId, dropIndex) {
    const s = get();
    if (s.draggingItemId === draggingItemId && s.hoverBucketId === hoverBucketId && s.dropIndex === dropIndex) return;
    set({ draggingItemId, hoverBucketId, dropIndex });
  },

  setRenamingBucket(id) {
    set({ renamingBucketId: id });
  },

  showToast(message, opts = {}) {
    set({ toast: { id: ++toastSeq, message, ...opts } });
  },

  dismissToast() {
    set({ toast: null });
  },

  setSaveStatus(saveStatus, saveError = null) {
    set({ saveStatus, saveError });
  },
}));

export const canUndo = (s: BoardStore) => s.past.length > 0;
export const canRedo = (s: BoardStore) => s.future.length > 0;
