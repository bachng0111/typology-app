import { beforeEach, describe, expect, it } from 'vitest';
import {
  boardFromJSON,
  boardToJSON,
  deleteBoard,
  listBoards,
  loadBoard,
  sanitizeBoard,
  saveBoard,
  setStorageBackend,
  StorageError,
  type KVStore,
} from './storage';
import { assignItem, createBucket, createContent, createNote, renameBucket } from '../store/operations';
import type { Board } from '../store/types';

class MemoryStore implements KVStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

function makeBoard(): Board {
  let c = createContent(['doctor', 'nurse', 'apple']);
  const [a, b] = Object.keys(c.items);
  const bk = createBucket(c, { x: 10, y: 20 }, '', true);
  c = renameBucket(bk.content, bk.id, 'Healthcare');
  c = assignItem(c, a, bk.id);
  c = assignItem(c, b, bk.id);
  c = createNote(c, { x: 400, y: 50 }, 'Remember:\ncheck these').content;
  return { version: 1, id: 'board_x', name: 'My board', delimiter: ',', createdAt: 1, updatedAt: 2, viewport: { x: 5, y: 6, zoom: 0.5 }, ...c };
}

let mem: MemoryStore;
beforeEach(() => {
  mem = new MemoryStore();
  setStorageBackend(mem);
});

describe('storage', () => {
  it('round-trips items, positions, buckets and membership', () => {
    const board = makeBoard();
    saveBoard(board);
    expect(loadBoard(board.id)).toEqual(board);
    expect(listBoards()).toMatchObject([{ id: 'board_x', name: 'My board', itemCount: 3, bucketCount: 1, groupedCount: 2 }]);
  });

  it('deletes boards', () => {
    saveBoard(makeBoard());
    deleteBoard('board_x');
    expect(loadBoard('board_x')).toBeNull();
    expect(listBoards()).toEqual([]);
  });

  it('survives corrupt entries', () => {
    mem.setItem('clusterly:index', '{not json');
    mem.setItem('clusterly:board:bad', 'garbage');
    expect(listBoards()).toEqual([]);
    expect(loadBoard('bad')).toBeNull();
  });

  it('repairs inconsistent data', () => {
    const b = sanitizeBoard({
      name: '',
      items: { a: { text: ' A ', x: 'nope' }, b: { text: '' }, c: { text: 'C', x: 1, y: 2 } },
      buckets: {
        k1: { name: 'K1', itemIds: ['a', 'missing', 'a'] },
        k2: { name: 'K2', itemIds: ['a', 'c'] },
      },
      bucketOrder: ['k1', 'k2', 'ghost'],
      viewport: { zoom: -1 },
    })!;
    expect(b.name).toBe('Untitled board');
    expect(Object.keys(b.items)).toEqual(['a', 'c']);
    expect(b.items.a).toMatchObject({ text: 'A', x: 0 });
    expect(b.buckets.k1.itemIds).toEqual(['a']);
    expect(b.buckets.k2.itemIds).toEqual(['c']);
    expect(b.bucketOrder).toEqual(['k1', 'k2']);
    expect(b.viewport.zoom).toBe(1);
  });

  it('loads boards saved before notes existed', () => {
    const b = sanitizeBoard({ items: { a: { text: 'A', x: 0, y: 0 } } })!;
    expect(b.notes).toEqual({});
  });

  it('drops invalid notes and clamps sizes', () => {
    const b = sanitizeBoard({
      items: {},
      notes: {
        ok: { text: 'hi', x: 1, y: 2, w: 5, h: 99999 },
        noPos: { text: 'x' },
        bad: 'nope',
        noText: { x: 0, y: 0 },
      },
    })!;
    expect(Object.keys(b.notes).sort()).toEqual(['noText', 'ok']);
    expect(b.notes.ok).toMatchObject({ text: 'hi', w: 120, h: 2000 });
    expect(b.notes.noText.text).toBe('');
  });

  it('imports backups with a fresh id', () => {
    const board = makeBoard();
    const imported = boardFromJSON(boardToJSON(board));
    expect(imported.id).not.toBe(board.id);
    expect(imported.buckets).toEqual(board.buckets);
    expect(() => boardFromJSON('nope')).toThrow(StorageError);
    expect(() => boardFromJSON('{"hello":1}')).toThrow(StorageError);
  });

  it('reports quota errors', () => {
    mem.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    expect(() => saveBoard(makeBoard())).toThrow(/storage is full/);
  });
});
