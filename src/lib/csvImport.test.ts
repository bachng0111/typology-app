import { describe, expect, it } from 'vitest';
import { CsvImportError, parseBucketCSV } from './csvImport';
import { toCSV } from './export';
import { assignItem, createBucket, createContent, renameBucket } from '../store/operations';

describe('parseBucketCSV (columns are buckets)', () => {
  it('turns headers into buckets and the Ungrouped column into loose items', () => {
    const r = parseBucketCSV('Healthcare,Fruit,Ungrouped\ndoctor,apple,rock\nnurse,orange,chair\npharmacist,,\n');
    expect(r.buckets).toEqual([
      { name: 'Healthcare', items: ['doctor', 'nurse', 'pharmacist'] },
      { name: 'Fruit', items: ['apple', 'orange'] },
    ]);
    expect(r.ungrouped).toEqual(['rock', 'chair']);
    expect(r.warnings).toEqual([]);
  });

  it('matches Ungrouped ignoring case and spaces', () => {
    expect(parseBucketCSV(' UNGROUPED ,A\nx,y').ungrouped).toEqual(['x']);
    expect(parseBucketCSV('ungrouped\nx').buckets).toEqual([]);
  });

  it('merges columns with the same name', () => {
    const r = parseBucketCSV('Fruit,Veg,fruit \napple,kale,pear\n,,plum');
    expect(r.buckets).toEqual([
      { name: 'Fruit', items: ['apple', 'pear', 'plum'] },
      { name: 'Veg', items: ['kale'] },
    ]);
  });

  it('trims cells and skips empty ones', () => {
    const r = parseBucketCSV('A\n  one  \n\n   \n"two\nlines"');
    expect(r.buckets[0].items).toEqual(['one', 'two lines']);
  });

  it('keeps empty buckets from header-only columns', () => {
    expect(parseBucketCSV('A,B').buckets).toEqual([
      { name: 'A', items: [] },
      { name: 'B', items: [] },
    ]);
  });

  it('puts columns without a header into unnamed buckets with a warning', () => {
    const r = parseBucketCSV('A,,\nx,y,\nz,,w');
    expect(r.buckets.map((b) => b.name)).toEqual(['A', '', '']);
    expect(r.buckets.map((b) => b.items)).toEqual([['x', 'z'], ['y'], ['w']]);
    expect(r.warnings[0]).toMatch(/no header/);
  });

  it('warns about values beyond the header row', () => {
    const r = parseBucketCSV('A\nx,extra');
    expect(r.buckets.map((b) => b.items)).toEqual([['x'], ['extra']]);
    expect(r.warnings[0]).toMatch(/beyond the header/);
  });

  it('rejects empty input', () => {
    expect(() => parseBucketCSV('')).toThrow(CsvImportError);
    expect(() => parseBucketCSV(' \n ')).toThrow(CsvImportError);
    expect(() => parseBucketCSV(',,\nx,y')).toThrow(/first row/);
    expect(() => parseBucketCSV('Ungrouped\n')).toThrow(/No buckets or items/);
  });
});

describe('parseBucketCSV (bucket,item export format)', () => {
  it('round-trips the app’s own CSV export', () => {
    let c = createContent(['doctor', 'nurse', '=SUM(A1)', 'rock']);
    const [a, b, f] = Object.keys(c.items);
    const h = createBucket(c, { x: 0, y: 0 });
    c = renameBucket(h.content, h.id, 'Health, care');
    const e = createBucket(c, { x: 400, y: 0 });
    c = renameBucket(e.content, e.id, 'Empty');
    [a, b, f].forEach((id) => (c = assignItem(c, id, h.id)));

    const r = parseBucketCSV(toCSV(c));
    expect(r.buckets).toEqual([
      { name: 'Health, care', items: ['doctor', 'nurse', '=SUM(A1)'] },
      { name: 'Empty', items: [] },
    ]);
    expect(r.ungrouped).toEqual(['rock']);
  });
});
