import type { Board, BoardSummary, Bucket, Item } from '../store/types';
import { newId } from './id';
import { DEFAULT_DELIMITER, MAX_ITEM_LENGTH, validateDelimiter } from './parse';

export const SCHEMA_VERSION = 1;
const INDEX_KEY = 'clusterly:index';
const BOARD_PREFIX = 'clusterly:board:';

export class StorageError extends Error {}

/** Minimal Storage interface so tests can inject an in-memory implementation. */
export type KVStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): KVStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

let store: KVStore | null = defaultStore();

export function setStorageBackend(backend: KVStore | null) {
  store = backend;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validate and repair a board from untrusted JSON (storage or an imported file).
 * Invalid items/buckets are dropped; membership is made consistent. Returns null if unusable.
 */
export function sanitizeBoard(raw: unknown): Board | null {
  if (!isObj(raw)) return null;
  const itemsIn = isObj(raw.items) ? raw.items : {};
  const bucketsIn = isObj(raw.buckets) ? raw.buckets : {};

  const items: Record<string, Item> = {};
  for (const [key, v] of Object.entries(itemsIn)) {
    if (!isObj(v) || !isStr(v.text)) continue;
    const text = v.text.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_LENGTH);
    if (!text) continue;
    items[key] = { id: key, text, x: isNum(v.x) ? v.x : 0, y: isNum(v.y) ? v.y : 0 };
  }

  const buckets: Record<string, Bucket> = {};
  const claimed = new Set<string>();
  const orderIn = Array.isArray(raw.bucketOrder) ? raw.bucketOrder.filter(isStr) : [];
  const order = [...new Set([...orderIn, ...Object.keys(bucketsIn)])];
  const bucketOrder: string[] = [];
  for (const key of order) {
    const v = bucketsIn[key];
    if (!isObj(v)) continue;
    const itemIds: string[] = [];
    for (const id of Array.isArray(v.itemIds) ? v.itemIds : []) {
      if (!isStr(id) || !items[id] || claimed.has(id)) continue;
      claimed.add(id);
      itemIds.push(id);
    }
    buckets[key] = {
      id: key,
      name: isStr(v.name) ? v.name.slice(0, 80) : '',
      x: isNum(v.x) ? v.x : 0,
      y: isNum(v.y) ? v.y : 0,
      w: isNum(v.w) && v.w > 0 ? v.w : 260,
      h: isNum(v.h) && v.h > 0 ? v.h : 220,
      colorIndex: isNum(v.colorIndex) ? Math.abs(Math.floor(v.colorIndex)) : bucketOrder.length,
      itemIds,
    };
    bucketOrder.push(key);
  }

  const vp = isObj(raw.viewport) ? raw.viewport : {};
  const delimiter = isStr(raw.delimiter) && validateDelimiter(raw.delimiter) === null ? raw.delimiter : DEFAULT_DELIMITER;
  const now = Date.now();
  return {
    version: SCHEMA_VERSION,
    id: isStr(raw.id) && raw.id ? raw.id : newId('board_'),
    name: isStr(raw.name) && raw.name.trim() ? raw.name.trim().slice(0, 120) : 'Untitled board',
    delimiter,
    createdAt: isNum(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now,
    items,
    buckets,
    bucketOrder,
    viewport: {
      x: isNum(vp.x) ? vp.x : 0,
      y: isNum(vp.y) ? vp.y : 0,
      zoom: isNum(vp.zoom) && vp.zoom > 0 ? vp.zoom : 1,
    },
  };
}

export function summarize(board: Board): BoardSummary {
  let grouped = 0;
  for (const id of board.bucketOrder) grouped += board.buckets[id].itemIds.length;
  return {
    id: board.id,
    name: board.name,
    itemCount: Object.keys(board.items).length,
    bucketCount: board.bucketOrder.length,
    groupedCount: grouped,
    updatedAt: board.updatedAt,
  };
}

function readIndex(): BoardSummary[] {
  if (!store) return [];
  try {
    const raw = JSON.parse(store.getItem(INDEX_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((s): s is BoardSummary => isObj(s) && isStr(s.id) && isStr(s.name));
  } catch {
    return [];
  }
}

function writeIndex(index: BoardSummary[]) {
  store?.setItem(INDEX_KEY, JSON.stringify(index));
}

export function listBoards(): BoardSummary[] {
  // Only list boards whose data still exists.
  return readIndex()
    .filter((s) => store?.getItem(BOARD_PREFIX + s.id) != null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadBoard(id: string): Board | null {
  if (!store) return null;
  try {
    const raw = store.getItem(BOARD_PREFIX + id);
    if (raw == null) return null;
    const board = sanitizeBoard(JSON.parse(raw));
    return board ? { ...board, id } : null;
  } catch {
    return null;
  }
}

export function saveBoard(board: Board): void {
  if (!store) throw new StorageError('Browser storage is unavailable, so changes cannot be saved.');
  try {
    store.setItem(BOARD_PREFIX + board.id, JSON.stringify(board));
    const index = readIndex().filter((s) => s.id !== board.id);
    index.push(summarize(board));
    writeIndex(index);
  } catch (err) {
    const quota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
    throw new StorageError(
      quota
        ? 'Browser storage is full. Export a backup and delete old boards to free space.'
        : 'Could not save the board to browser storage.',
    );
  }
}

export function deleteBoard(id: string): void {
  if (!store) return;
  store.removeItem(BOARD_PREFIX + id);
  writeIndex(readIndex().filter((s) => s.id !== id));
}

export function renameStoredBoard(id: string, name: string): void {
  const board = loadBoard(id);
  if (!board) return;
  saveBoard({ ...board, name: name.trim() || board.name, updatedAt: Date.now() });
}

export function boardToJSON(board: Board): string {
  return JSON.stringify({ app: 'clusterly', ...board }, null, 2);
}

/** Parse a backup file into a new board (with a fresh id so it never overwrites). */
export function boardFromJSON(json: string): Board {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new StorageError('That file is not a valid board backup (invalid JSON).');
  }
  const board = sanitizeBoard(raw);
  if (!board || (!isObj((raw as Record<string, unknown>).items) && !isObj((raw as Record<string, unknown>).buckets))) {
    throw new StorageError('That file is not a board backup.');
  }
  return { ...board, id: newId('board_'), updatedAt: Date.now() };
}
