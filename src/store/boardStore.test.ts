import { beforeEach, describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, useBoardStore } from './boardStore';
import { createContent } from './operations';
import type { Board } from './types';

function open(texts: string[]) {
  const board: Board = {
    version: 1,
    id: 'b1',
    name: 'Test',
    delimiter: '/',
    createdAt: 0,
    updatedAt: 0,
    viewport: { x: 0, y: 0, zoom: 1 },
    ...createContent(texts),
  };
  useBoardStore.getState().openBoard(board);
}

const s = () => useBoardStore.getState();

describe('board store undo/redo', () => {
  beforeEach(() => open(['a', 'b', 'c']));

  it('undoes and redoes grouping', () => {
    const [a] = Object.keys(s().board!.items);
    const bid = s().createBucket({ x: 0, y: 0 })!;
    s().assignItem(a, bid);
    expect(s().board!.buckets[bid].itemIds).toEqual([a]);
    s().undo();
    expect(s().board!.buckets[bid].itemIds).toEqual([]);
    s().undo();
    expect(s().board!.buckets[bid]).toBeUndefined();
    s().redo();
    s().redo();
    expect(s().board!.buckets[bid].itemIds).toEqual([a]);
  });

  it('new actions clear the redo stack', () => {
    const [a, b] = Object.keys(s().board!.items);
    s().editItem(a, 'x');
    s().undo();
    s().editItem(b, 'y');
    expect(s().future).toHaveLength(0);
  });

  it('does not record no-op changes', () => {
    const [a] = Object.keys(s().board!.items);
    s().editItem(a, s().board!.items[a].text);
    expect(s().past).toHaveLength(0);
  });

  it('deleting a bucket can be undone with membership intact', () => {
    const ids = Object.keys(s().board!.items);
    const bid = s().createBucket({ x: 0, y: 0 })!;
    ids.forEach((id) => s().assignItem(id, bid));
    s().deleteBucket(bid);
    expect(s().board!.buckets[bid]).toBeUndefined();
    s().undo();
    expect(s().board!.buckets[bid].itemIds).toEqual(ids);
  });

  it('undoes and redoes note changes', () => {
    const id = s().createNote({ x: 0, y: 0 })!;
    expect(s().editingNoteId).toBe(id);
    s().editNote(id, 'hello');
    expect(s().board!.notes[id].text).toBe('hello');
    s().undo();
    expect(s().board!.notes[id].text).toBe('');
    s().undo();
    expect(s().board!.notes[id]).toBeUndefined();
    s().redo();
    s().redo();
    expect(s().board!.notes[id].text).toBe('hello');
    s().deleteNote(id);
    s().undo();
    expect(s().board!.notes[id].text).toBe('hello');
  });

  it('caps history length', () => {
    const [a] = Object.keys(s().board!.items);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s().placeItemOnBoard(a, i * 3, 0);
    expect(s().past.length).toBe(HISTORY_LIMIT);
  });
});
