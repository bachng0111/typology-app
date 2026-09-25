/**
 * Pure board operations. Each takes the current content and returns a new object,
 * sharing untouched structure so undo snapshots stay cheap.
 */
import { boundsOf, packCards, rectsOverlap, shuffle, type Rng } from '../lib/layout';
import { cardSize } from '../lib/measure';
import { newId } from '../lib/id';
import { BUCKET_COLORS } from '../lib/colors';
import { cleanItem, MAX_ITEM_LENGTH } from '../lib/parse';
import type { BoardContent, Bucket, Item, Note, Rect } from './types';

export const DEFAULT_BUCKET_W = 260;
export const DEFAULT_BUCKET_H = 220;
export const MIN_BUCKET_W = 160;
export const MIN_BUCKET_H = 100;
export const DEFAULT_NOTE_W = 200;
export const DEFAULT_NOTE_H = 150;
export const MIN_NOTE_W = 120;
export const MIN_NOTE_H = 80;
export const MAX_NOTE_LENGTH = 1000;

export function emptyContent(): BoardContent {
  return { items: {}, buckets: {}, bucketOrder: [], notes: {} };
}

/** Map of itemId -> bucketId for grouped items. */
export function membership(content: BoardContent): Map<string, string> {
  const map = new Map<string, string>();
  for (const bid of content.bucketOrder) {
    const b = content.buckets[bid];
    if (b) for (const iid of b.itemIds) map.set(iid, bid);
  }
  return map;
}

export function ungroupedIds(content: BoardContent): string[] {
  const grouped = membership(content);
  return Object.keys(content.items).filter((id) => !grouped.has(id));
}

export function itemRect(item: Item): Rect {
  const s = cardSize(item.text);
  return { x: item.x, y: item.y, w: s.w, h: s.h };
}

export function bucketRect(b: Bucket): Rect {
  return { x: b.x, y: b.y, w: b.w, h: b.h };
}

export function noteRect(n: Note): Rect {
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

/** Buckets and notes: things loose cards and new objects should not be placed under. */
function fixedRects(content: BoardContent): Rect[] {
  return [
    ...content.bucketOrder.map((id) => bucketRect(content.buckets[id])),
    ...Object.values(content.notes).map(noteRect),
  ];
}

function ungroupedRects(content: BoardContent, exclude?: Set<string>): Rect[] {
  return ungroupedIds(content)
    .filter((id) => !exclude?.has(id))
    .map((id) => itemRect(content.items[id]));
}

export function contentBounds(content: BoardContent): Rect | null {
  return boundsOf([...fixedRects(content), ...ungroupedRects(content)]);
}

function sanitizeText(text: string): string {
  return cleanItem(text).slice(0, MAX_ITEM_LENGTH);
}

/** Place `ids` (which must already exist in content.items) at fresh positions. */
function placeItems(
  content: BoardContent,
  ids: string[],
  origin: { x: number; y: number },
  obstacles: Rect[],
  rng?: Rng,
): BoardContent {
  if (ids.length === 0) return content;
  const order = shuffle(ids, rng);
  const positions = packCards(
    order.map((id) => cardSize(content.items[id].text)),
    { origin, obstacles, rng },
  );
  const items = { ...content.items };
  order.forEach((id, i) => {
    items[id] = { ...items[id], x: Math.round(positions[i].x), y: Math.round(positions[i].y) };
  });
  return { ...content, items };
}

export function createContent(texts: string[], rng?: Rng): BoardContent {
  const items: Record<string, Item> = {};
  const ids: string[] = [];
  for (const t of texts) {
    const text = sanitizeText(t);
    if (!text) continue;
    const id = newId('i');
    items[id] = { id, text, x: 0, y: 0 };
    ids.push(id);
  }
  return placeItems({ ...emptyContent(), items }, ids, { x: 0, y: 0 }, [], rng);
}

/** Add new items, scattered in free space starting at `near` (defaults to below existing content). */
export function addItems(
  content: BoardContent,
  texts: string[],
  near?: { x: number; y: number },
  rng?: Rng,
): { content: BoardContent; ids: string[] } {
  const items = { ...content.items };
  const ids: string[] = [];
  for (const t of texts) {
    const text = sanitizeText(t);
    if (!text) continue;
    const id = newId('i');
    items[id] = { id, text, x: 0, y: 0 };
    ids.push(id);
  }
  if (ids.length === 0) return { content, ids };
  const bounds = contentBounds(content);
  const origin = near ?? (bounds ? { x: bounds.x, y: bounds.y + bounds.h + 40 } : { x: 0, y: 0 });
  const obstacles = [...fixedRects(content), ...ungroupedRects(content)];
  return { content: placeItems({ ...content, items }, ids, origin, obstacles, rng), ids };
}

export function editItem(content: BoardContent, id: string, text: string): BoardContent {
  const item = content.items[id];
  const clean = sanitizeText(text);
  if (!item || !clean || clean === item.text) return content;
  return { ...content, items: { ...content.items, [id]: { ...item, text: clean } } };
}

export function deleteItems(content: BoardContent, ids: string[]): BoardContent {
  const remove = new Set(ids.filter((id) => content.items[id]));
  if (remove.size === 0) return content;
  const items = { ...content.items };
  for (const id of remove) delete items[id];
  const buckets = { ...content.buckets };
  for (const bid of content.bucketOrder) {
    const b = buckets[bid];
    if (b.itemIds.some((id) => remove.has(id))) {
      buckets[bid] = { ...b, itemIds: b.itemIds.filter((id) => !remove.has(id)) };
    }
  }
  return { ...content, items, buckets };
}

function removeFromBuckets(buckets: Record<string, Bucket>, order: string[], itemId: string) {
  for (const bid of order) {
    const b = buckets[bid];
    if (b.itemIds.includes(itemId)) buckets[bid] = { ...b, itemIds: b.itemIds.filter((i) => i !== itemId) };
  }
}

/** Put an item loose on the board at (x, y), removing it from any bucket. */
export function placeItemOnBoard(content: BoardContent, id: string, x: number, y: number): BoardContent {
  const item = content.items[id];
  if (!item) return content;
  const buckets = { ...content.buckets };
  removeFromBuckets(buckets, content.bucketOrder, id);
  return {
    ...content,
    buckets,
    items: { ...content.items, [id]: { ...item, x: Math.round(x), y: Math.round(y) } },
  };
}

/** Take an item out of its bucket and put it in free space beside the bucket. */
export function returnToBoard(content: BoardContent, id: string): BoardContent {
  const bid = membership(content).get(id);
  if (!bid) return content;
  const b = content.buckets[bid];
  const [pos] = packCards([cardSize(content.items[id].text)], {
    origin: { x: b.x + b.w + 24, y: b.y },
    obstacles: [...fixedRects(content), ...ungroupedRects(content)],
    jitterX: 0,
    jitterY: 0,
    aspect: 0.5,
  });
  return placeItemOnBoard(content, id, pos.x, pos.y);
}

/**
 * Move an item into a bucket. `index` is the insertion position in the bucket's list
 * *without* the item (end by default), so moves within and between buckets work the same.
 */
export function assignItem(content: BoardContent, id: string, bucketId: string, index?: number): BoardContent {
  if (!content.items[id] || !content.buckets[bucketId]) return content;
  const buckets = { ...content.buckets };
  removeFromBuckets(buckets, content.bucketOrder, id);
  const list = buckets[bucketId].itemIds.slice();
  const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
  list.splice(at, 0, id);
  const before = content.buckets[bucketId].itemIds;
  if (before.length === list.length && before.every((v, i) => v === list[i])) return content;
  buckets[bucketId] = { ...buckets[bucketId], itemIds: list };
  return { ...content, buckets };
}

/** Where a new bucket goes: see findFreeSpot. */
export function findBucketSpot(content: BoardContent, visible: Rect): { x: number; y: number } {
  return findFreeSpot(content, visible, { w: DEFAULT_BUCKET_W, h: DEFAULT_BUCKET_H });
}

/**
 * Choose a spot for a new object of `size`: free space inside `visible` (closest to its centre) if there is
 * any, otherwise the first free cell of a grid to the right of the existing content.
 */
export function findFreeSpot(content: BoardContent, visible: Rect, size: { w: number; h: number }): { x: number; y: number } {
  const { w, h } = size;
  const gap = 16;
  const all = [...fixedRects(content), ...ungroupedRects(content)];
  const free = (r: Rect, obstacles: Rect[]) => !obstacles.some((o) => rectsOverlap(r, o, gap));

  const inset = 16;
  const region = { x: visible.x + inset, y: visible.y + inset, w: visible.w - 2 * inset - w, h: visible.h - 2 * inset - h };
  if (region.w >= 0 && region.h >= 0) {
    const nearby = all.filter((o) => rectsOverlap(o, visible, gap));
    const step = Math.max(12, Math.min(region.w, region.h) / 30);
    const cx = region.x + region.w / 2;
    const cy = region.y + region.h / 2;
    const candidates: { x: number; y: number; d: number }[] = [];
    for (let x = region.x; x <= region.x + region.w; x += step)
      for (let y = region.y; y <= region.y + region.h; y += step) candidates.push({ x, y, d: (x - cx) ** 2 + (y - cy) ** 2 });
    candidates.sort((a, b) => a.d - b.d);
    for (const c of candidates) if (free({ x: c.x, y: c.y, w, h }, nearby)) return { x: c.x, y: c.y };
  }

  const bounds = contentBounds(content) ?? { x: visible.x, y: visible.y, w: 0, h: 0 };
  const cellW = w + 32;
  const cellH = h + 32;
  const rows = Math.max(2, Math.floor(bounds.h / cellH));
  const origin = { x: bounds.x + bounds.w + 64, y: bounds.y };
  for (let col = 0; ; col++) {
    for (let row = 0; row < rows; row++) {
      const r = { x: origin.x + col * cellW, y: origin.y + row * cellH, w, h };
      if (free(r, all)) return { x: r.x, y: r.y };
    }
  }
}

function nextColorIndex(content: BoardContent): number {
  const counts = new Array(BUCKET_COLORS.length).fill(0);
  for (const bid of content.bucketOrder) counts[content.buckets[bid].colorIndex % counts.length]++;
  const min = Math.min(...counts);
  return counts.indexOf(min);
}

/**
 * Create a bucket. With `exact`, it is placed at (x, y); otherwise the nearest free
 * spot around (x, y) is used so it doesn't cover loose cards or other buckets.
 */
export function createBucket(
  content: BoardContent,
  at: { x: number; y: number },
  name = '',
  exact = false,
): { content: BoardContent; id: string } {
  const id = newId('b');
  let { x, y } = at;
  if (!exact) {
    const [pos] = packCards([{ w: DEFAULT_BUCKET_W, h: DEFAULT_BUCKET_H }], {
      origin: at,
      obstacles: [...fixedRects(content), ...ungroupedRects(content)],
      gap: 24,
      jitterX: 0,
      jitterY: 0,
      aspect: 3,
    });
    ({ x, y } = pos);
  }
  const bucket: Bucket = {
    id,
    name: name.trim(),
    x: Math.round(x),
    y: Math.round(y),
    w: DEFAULT_BUCKET_W,
    h: DEFAULT_BUCKET_H,
    colorIndex: nextColorIndex(content),
    itemIds: [],
  };
  return {
    id,
    content: { ...content, buckets: { ...content.buckets, [id]: bucket }, bucketOrder: [...content.bucketOrder, id] },
  };
}

function updateBucket(content: BoardContent, id: string, patch: Partial<Bucket>): BoardContent {
  const b = content.buckets[id];
  if (!b) return content;
  const next = { ...b, ...patch };
  if (next.x === b.x && next.y === b.y && next.w === b.w && next.h === b.h && next.name === b.name) return content;
  return { ...content, buckets: { ...content.buckets, [id]: next } };
}

export function renameBucket(content: BoardContent, id: string, name: string): BoardContent {
  return updateBucket(content, id, { name: name.replace(/\s+/g, ' ').trim().slice(0, 80) });
}

export function moveBucket(content: BoardContent, id: string, x: number, y: number): BoardContent {
  return updateBucket(content, id, { x: Math.round(x), y: Math.round(y) });
}

export function resizeBucket(content: BoardContent, id: string, w: number, h: number): BoardContent {
  return updateBucket(content, id, {
    w: Math.round(Math.max(MIN_BUCKET_W, w)),
    h: Math.round(Math.max(MIN_BUCKET_H, h)),
  });
}

/** Delete a bucket; its items return to the board near where the bucket was. */
export function deleteBucket(content: BoardContent, id: string, rng?: Rng): BoardContent {
  const b = content.buckets[id];
  if (!b) return content;
  const buckets = { ...content.buckets };
  delete buckets[id];
  const without: BoardContent = { ...content, buckets, bucketOrder: content.bucketOrder.filter((x) => x !== id) };
  const obstacles = [...fixedRects(without), ...ungroupedRects(without, new Set(b.itemIds))];
  return placeItems(without, b.itemIds, { x: b.x, y: b.y }, obstacles, rng);
}

/** Re-scatter all loose items, avoiding buckets. */
export function rerandomizeUngrouped(content: BoardContent, rng?: Rng): BoardContent {
  const ids = ungroupedIds(content);
  if (ids.length === 0) return content;
  const b = boundsOf(ids.map((id) => itemRect(content.items[id])));
  const origin = b ? { x: b.x, y: b.y } : { x: 0, y: 0 };
  return placeItems(content, ids, origin, fixedRects(content), rng);
}

/** Return every item to the board (optionally deleting buckets) and re-scatter them. */
export function resetGrouping(content: BoardContent, deleteBuckets: boolean, rng?: Rng): BoardContent {
  const buckets: Record<string, Bucket> = {};
  const bucketOrder = deleteBuckets ? [] : content.bucketOrder;
  for (const bid of bucketOrder) buckets[bid] = { ...content.buckets[bid], itemIds: [] };
  const next: BoardContent = { ...content, buckets, bucketOrder };
  const ids = Object.keys(content.items);
  const b = contentBounds(content);
  const origin = deleteBuckets || !b ? { x: 0, y: 0 } : { x: b.x, y: b.y };
  return placeItems(next, ids, origin, fixedRects(next), rng);
}

/* ---------- Sticky notes ---------- */

function cleanNoteText(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTE_LENGTH);
}

export function createNote(content: BoardContent, at: { x: number; y: number }, text = ''): { content: BoardContent; id: string } {
  const id = newId('n');
  const note: Note = {
    id,
    text: cleanNoteText(text),
    x: Math.round(at.x),
    y: Math.round(at.y),
    w: DEFAULT_NOTE_W,
    h: DEFAULT_NOTE_H,
  };
  return { id, content: { ...content, notes: { ...content.notes, [id]: note } } };
}

function updateNote(content: BoardContent, id: string, patch: Partial<Note>): BoardContent {
  const n = content.notes[id];
  if (!n) return content;
  const next = { ...n, ...patch };
  if (next.x === n.x && next.y === n.y && next.w === n.w && next.h === n.h && next.text === n.text) return content;
  return { ...content, notes: { ...content.notes, [id]: next } };
}

/** Set a note's text. Newlines are kept; only surrounding whitespace is trimmed. */
export function editNote(content: BoardContent, id: string, text: string): BoardContent {
  return updateNote(content, id, { text: cleanNoteText(text) });
}

export function moveNote(content: BoardContent, id: string, x: number, y: number): BoardContent {
  return updateNote(content, id, { x: Math.round(x), y: Math.round(y) });
}

export function resizeNote(content: BoardContent, id: string, w: number, h: number): BoardContent {
  return updateNote(content, id, {
    w: Math.round(Math.max(MIN_NOTE_W, w)),
    h: Math.round(Math.max(MIN_NOTE_H, h)),
  });
}

export function deleteNote(content: BoardContent, id: string): BoardContent {
  if (!content.notes[id]) return content;
  const notes = { ...content.notes };
  delete notes[id];
  return { ...content, notes };
}
