import { describe, expect, it } from 'vitest';
import * as ops from './operations';
import { rectsOverlap } from '../lib/layout';

const texts = ['doctor', 'nurse', 'pharmacist', 'customer service', 'product quality'];

describe('board operations', () => {
  it('creates non-overlapping items', () => {
    const c = ops.createContent(texts);
    const rects = Object.values(c.items).map(ops.itemRect);
    expect(rects).toHaveLength(5);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i], rects[j])).toBe(false);
  });

  it('moves items into, between and out of buckets', () => {
    let c = ops.createContent(texts);
    const [a, b] = Object.keys(c.items);
    const b1 = ops.createBucket(c, { x: 0, y: 0 });
    const b2 = ops.createBucket(b1.content, { x: 500, y: 0 });
    c = b2.content;

    c = ops.assignItem(c, a, b1.id);
    c = ops.assignItem(c, b, b1.id, 0);
    expect(c.buckets[b1.id].itemIds).toEqual([b, a]);
    expect(ops.ungroupedIds(c)).not.toContain(a);

    c = ops.assignItem(c, a, b2.id);
    expect(c.buckets[b1.id].itemIds).toEqual([b]);
    expect(c.buckets[b2.id].itemIds).toEqual([a]);

    c = ops.placeItemOnBoard(c, a, 123, 456);
    expect(c.buckets[b2.id].itemIds).toEqual([]);
    expect(c.items[a]).toMatchObject({ x: 123, y: 456 });

    c = ops.returnToBoard(c, b);
    expect(c.buckets[b1.id].itemIds).toEqual([]);
    expect(ops.ungroupedIds(c)).toHaveLength(5);
  });

  it('reorders within a bucket', () => {
    let c = ops.createContent(['a', 'b', 'c']);
    const [a, b, cc] = Object.keys(c.items);
    const bk = ops.createBucket(c, { x: 0, y: 0 });
    c = bk.content;
    [a, b, cc].forEach((id) => (c = ops.assignItem(c, id, bk.id)));
    c = ops.assignItem(c, cc, bk.id, 0);
    expect(c.buckets[bk.id].itemIds).toEqual([cc, a, b]);
    c = ops.assignItem(c, cc, bk.id, 2);
    expect(c.buckets[bk.id].itemIds).toEqual([a, b, cc]);
  });

  it('deleting a bucket returns its items to the board', () => {
    let c = ops.createContent(texts);
    const ids = Object.keys(c.items);
    const bk = ops.createBucket(c, { x: 1000, y: 1000 }, 'X', true);
    c = bk.content;
    ids.forEach((id) => (c = ops.assignItem(c, id, bk.id)));
    c = ops.deleteBucket(c, bk.id);
    expect(c.buckets[bk.id]).toBeUndefined();
    expect(c.bucketOrder).toEqual([]);
    expect(Object.keys(c.items)).toHaveLength(5);
    expect(ops.ungroupedIds(c)).toHaveLength(5);
  });

  it('deleting an item removes it from its bucket', () => {
    let c = ops.createContent(texts);
    const [a] = Object.keys(c.items);
    const bk = ops.createBucket(c, { x: 0, y: 0 });
    c = ops.assignItem(bk.content, a, bk.id);
    c = ops.deleteItems(c, [a]);
    expect(c.items[a]).toBeUndefined();
    expect(c.buckets[bk.id].itemIds).toEqual([]);
  });

  it('edits text, ignoring empty edits', () => {
    let c = ops.createContent(['old']);
    const [a] = Object.keys(c.items);
    c = ops.editItem(c, a, '  new  text ');
    expect(c.items[a].text).toBe('new text');
    expect(ops.editItem(c, a, '   ')).toBe(c);
  });

  it('new buckets avoid loose cards', () => {
    const c = ops.createContent(texts);
    const { content, id } = ops.createBucket(c, { x: 0, y: 0 });
    const br = ops.bucketRect(content.buckets[id]);
    for (const item of Object.values(content.items)) expect(rectsOverlap(ops.itemRect(item), br)).toBe(false);
  });

  it('rerandomize only moves ungrouped items and avoids buckets', () => {
    let c = ops.createContent(texts);
    const [a] = Object.keys(c.items);
    const bk = ops.createBucket(c, { x: 0, y: 0 }, 'B', true);
    c = ops.assignItem(bk.content, a, bk.id);
    const next = ops.rerandomizeUngrouped(c);
    expect(next.buckets).toBe(c.buckets);
    const br = ops.bucketRect(next.buckets[bk.id]);
    for (const id of ops.ungroupedIds(next)) expect(rectsOverlap(ops.itemRect(next.items[id]), br)).toBe(false);
  });

  it('resetGrouping empties or deletes buckets', () => {
    let c = ops.createContent(texts);
    const bk = ops.createBucket(c, { x: 0, y: 0 });
    c = bk.content;
    Object.keys(c.items).forEach((id) => (c = ops.assignItem(c, id, bk.id)));
    const kept = ops.resetGrouping(c, false);
    expect(kept.buckets[bk.id].itemIds).toEqual([]);
    expect(ops.ungroupedIds(kept)).toHaveLength(5);
    const gone = ops.resetGrouping(c, true);
    expect(gone.bucketOrder).toEqual([]);
    expect(ops.ungroupedIds(gone)).toHaveLength(5);
  });

  it('enforces minimum bucket size', () => {
    const bk = ops.createBucket(ops.emptyContent(), { x: 0, y: 0 });
    const c = ops.resizeBucket(bk.content, bk.id, 10, 10);
    expect(c.buckets[bk.id]).toMatchObject({ w: ops.MIN_BUCKET_W, h: ops.MIN_BUCKET_H });
  });
});

describe('sticky notes', () => {
  it('creates, edits, moves, resizes and deletes notes', () => {
    const { content, id } = ops.createNote(ops.emptyContent(), { x: 10.4, y: 20.6 });
    expect(content.notes[id]).toMatchObject({ text: '', x: 10, y: 21, w: ops.DEFAULT_NOTE_W, h: ops.DEFAULT_NOTE_H });

    let c = ops.editNote(content, id, '  first line\n  second line  ');
    expect(c.notes[id].text).toBe('first line\n  second line');
    expect(ops.editNote(c, id, c.notes[id].text)).toBe(c);
    expect(ops.editNote(c, id, 'x'.repeat(ops.MAX_NOTE_LENGTH + 10)).notes[id].text).toHaveLength(ops.MAX_NOTE_LENGTH);

    c = ops.moveNote(c, id, 300, 400);
    expect(c.notes[id]).toMatchObject({ x: 300, y: 400 });
    c = ops.resizeNote(c, id, 10, 10);
    expect(c.notes[id]).toMatchObject({ w: ops.MIN_NOTE_W, h: ops.MIN_NOTE_H });

    c = ops.deleteNote(c, id);
    expect(c.notes[id]).toBeUndefined();
    expect(ops.deleteNote(c, id)).toBe(c);
  });

  it('notes survive reset grouping and count toward content bounds', () => {
    const n = ops.createNote(ops.createContent(texts), { x: 5000, y: 5000 });
    const reset = ops.resetGrouping(n.content, true);
    expect(reset.notes[n.id]).toBeDefined();
    const b = ops.contentBounds(n.content)!;
    expect(b.x + b.w).toBeGreaterThanOrEqual(5000 + ops.DEFAULT_NOTE_W);
  });

  it('new objects are placed away from notes', () => {
    const visible = { x: 0, y: 0, w: 800, h: 600 };
    const n = ops.createNote(ops.emptyContent(), { x: 300, y: 225 });
    const spot = ops.findBucketSpot(n.content, visible);
    const rect = { ...spot, w: ops.DEFAULT_BUCKET_W, h: ops.DEFAULT_BUCKET_H };
    expect(rectsOverlap(rect, ops.noteRect(n.content.notes[n.id]))).toBe(false);
  });
});
