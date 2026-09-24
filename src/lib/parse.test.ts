import { describe, expect, it } from 'vitest';
import { NEWLINE_DELIMITER, MAX_ITEM_LENGTH, parseItems, validateDelimiter } from './parse';

describe('parseItems', () => {
  it('splits the example on the default slash delimiter', () => {
    expect(parseItems('doctor/nurse/pharmacist/customer service/product quality').items).toEqual([
      'doctor',
      'nurse',
      'pharmacist',
      'customer service',
      'product quality',
    ]);
  });

  it('trims whitespace and ignores empty items', () => {
    expect(parseItems('  a  / / b//  c d  /  ').items).toEqual(['a', 'b', 'c d']);
  });

  it('collapses internal whitespace and newlines', () => {
    expect(parseItems('customer\n  service/ product\tquality').items).toEqual(['customer service', 'product quality']);
  });

  it('uses custom delimiters literally (no regex semantics)', () => {
    expect(parseItems('a,b,c', ',').items).toEqual(['a', 'b', 'c']);
    expect(parseItems('a|b|c', '|').items).toEqual(['a', 'b', 'c']);
    expect(parseItems('a.b.c', '.').items).toEqual(['a', 'b', 'c']);
    expect(parseItems('a::b::c:d', '::').items).toEqual(['a', 'b', 'c:d']);
    expect(parseItems('x/y,z', ',').items).toEqual(['x/y', 'z']);
  });

  it('supports newline delimiter with CRLF input', () => {
    expect(parseItems('one\r\ntwo\r\n\r\nthree\n', NEWLINE_DELIMITER).items).toEqual(['one', 'two', 'three']);
  });

  it('strips a byte order mark', () => {
    expect(parseItems('﻿a/b').items).toEqual(['a', 'b']);
  });

  it('handles empty and malformed input gracefully', () => {
    expect(parseItems('').items).toEqual([]);
    expect(parseItems('////  / ').items).toEqual([]);
    expect(parseItems(null).items).toEqual([]);
    expect(parseItems(42).items).toEqual([]);
    expect(parseItems('a/b', '').items).toEqual([]);
  });

  it('reports case-insensitive duplicates without removing them', () => {
    const r = parseItems('Apple/apple/pear');
    expect(r.items).toEqual(['Apple', 'apple', 'pear']);
    expect([...r.duplicates]).toEqual(['apple']);
  });

  it('truncates overly long items', () => {
    const r = parseItems('x'.repeat(MAX_ITEM_LENGTH + 50) + '/short');
    expect(r.items[0]).toHaveLength(MAX_ITEM_LENGTH);
    expect(r.truncated).toBe(1);
  });
});

describe('validateDelimiter', () => {
  it('accepts short strings and newline', () => {
    expect(validateDelimiter('/')).toBeNull();
    expect(validateDelimiter(';;')).toBeNull();
    expect(validateDelimiter(NEWLINE_DELIMITER)).toBeNull();
  });
  it('rejects empty, blank and long delimiters', () => {
    expect(validateDelimiter('')).not.toBeNull();
    expect(validateDelimiter('  ')).not.toBeNull();
    expect(validateDelimiter('abcdef')).not.toBeNull();
  });
});
