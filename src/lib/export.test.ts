import { describe, expect, it } from 'vitest';
import { toCSV, toText } from './export';
import { assignItem, createBucket, createContent, createNote, editNote, renameBucket } from '../store/operations';
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
    expect(toText(build(), { includeUngrouped: false })).toBe('Healthcare\ndoctor\nnurse\npharmacist\n\nFruit\napple\norange\nbanana');
  });
  it('can append ungrouped items', () => {
    expect(toText(build()).endsWith('\n\nUngrouped\nrock')).toBe(true);
  });
});

describe('toCSV', () => {
  it('writes bucket,item rows', () => {
    const lines = toCSV(build()).trim().split('\r\n');
    expect(lines[0]).toBe('bucket,item');
    expect(lines).toContain('Healthcare,doctor');
    expect(lines).toContain('Fruit,banana');
    expect(lines).toContain('Ungrouped,rock');
  });
  it('quotes and neutralises dangerous cells', () => {
    let c = createContent(['say "hi", friend', '=SUM(A1)']);
    const b = createBucket(c, { x: 0, y: 0 });
    c = renameBucket(b.content, b.id, 'A, B');
    const csv = toCSV(c);
    expect(csv).toContain('"say ""hi"", friend"');
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('"A, B",');
  });
});

describe('comments export', () => {
  function withNotes(): BoardContent {
    let c = build();
    const a = createNote(c, { x: 0, y: 0 }, 'Check with team');
    const b = createNote(a.content, { x: 0, y: 200 });
    c = editNote(b.content, b.id, 'line one\nline two');
    return createNote(c, { x: 0, y: 400 }).content; // empty note is skipped
  }

  it('leaves comments out by default', () => {
    expect(toText(withNotes())).not.toContain('Comments');
    expect(toCSV(withNotes())).not.toContain('Comments');
  });

  it('appends a Comments section when requested', () => {
    const text = toText(withNotes(), { includeUngrouped: false, includeComments: true });
    expect(text.endsWith('\n\nComments\n\nCheck with team\n\nline one\nline two')).toBe(true);
    const csv = toCSV(withNotes(), { includeComments: true });
    expect(csv).toContain('Comments,Check with team\r\n');
    expect(csv).toContain('Comments,"line one\nline two"');
  });
});
