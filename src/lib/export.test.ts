import { describe, expect, it } from 'vitest';
import { toCSV, toText } from './export';
import { assignItem, createBucket, createContent, renameBucket } from '../store/operations';
import type { BoardContent } from '../store/types';

function build(): BoardContent {
  let c = createContent(['doctor', 'nurse', 'pharmacist', 'apple', 'orange', 'banana', 'rock']);
  const ids = Object.keys(c.items);
  const h = createBucket(c, { x: 0, y: 0 });
  c = renameBucket(h.content, h.id, 'Healthcare');
  const f = createBucket(c, { x: 400, y: 0 });
  c = renameBucket(f.content, f.id, 'Fruit');
  ids.slice(0, 3).forEach((id) => (c = assignItem(c, id, h.id)));
  ids.slice(3, 6).forEach((id) => (c = assignItem(c, id, f.id)));
  return c;
}

describe('toText', () => {
  it('lists each bucket followed by its items, separated by blank lines', () => {
    expect(toText(build(), false)).toBe('Healthcare\ndoctor\nnurse\npharmacist\n\nFruit\napple\norange\nbanana');
  });
  it('can append ungrouped items', () => {
    expect(toText(build(), true).endsWith('\n\nUngrouped\nrock')).toBe(true);
  });
});

describe('toCSV', () => {
  it('writes bucket,item rows', () => {
    const lines = toCSV(build(), true).trim().split('\r\n');
    expect(lines[0]).toBe('bucket,item');
    expect(lines).toContain('Healthcare,doctor');
    expect(lines).toContain('Fruit,banana');
    expect(lines).toContain('Ungrouped,rock');
  });
  it('quotes and neutralises dangerous cells', () => {
    let c = createContent(['say "hi", friend', '=SUM(A1)']);
    const b = createBucket(c, { x: 0, y: 0 });
    c = renameBucket(b.content, b.id, 'A, B');
    const csv = toCSV(c, true);
    expect(csv).toContain('"say ""hi"", friend"');
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('"A, B",');
  });
});
