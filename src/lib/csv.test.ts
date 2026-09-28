import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCSV } from './csv';

describe('parseCSV', () => {
  it('parses plain rows', () => {
    expect(parseCSV('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles quotes, escaped quotes and newlines inside quotes', () => {
    expect(parseCSV('name,note\n"Smith, J","said ""hi""\nthen left"\n')).toEqual([
      ['name', 'note'],
      ['Smith, J', 'said "hi"\nthen left'],
    ]);
  });

  it('keeps a quote inside an unquoted cell literally', () => {
    expect(parseCSV('size\n5" nails')).toEqual([['size'], ['5" nails']]);
  });

  it('handles CRLF, a BOM and trailing blank lines', () => {
    expect(parseCSV('﻿a,b\r\n1,2\r\n\r\n,\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps ragged rows and empty cells', () => {
    expect(parseCSV('a,b,c\n1\n,,3')).toEqual([['a', 'b', 'c'], ['1'], ['', '', '3']]);
  });

  it('detects semicolon and tab delimiters from the header line', () => {
    expect(detectDelimiter('a;b;c\n1,2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('"x;y",b\n')).toBe(',');
    expect(parseCSV('Fruit\tVeg\napple\tkale')).toEqual([
      ['Fruit', 'Veg'],
      ['apple', 'kale'],
    ]);
  });
});
