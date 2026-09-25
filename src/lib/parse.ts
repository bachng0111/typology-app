export const DEFAULT_DELIMITER = '/';
export const NEWLINE_DELIMITER = '\n';
export const MAX_DELIMITER_LENGTH = 5;
export const MAX_ITEM_LENGTH = 200;
export const MAX_ITEMS = 5000;

export interface ParseResult {
  items: string[];
  /** Normalised (case-insensitive) texts that occur more than once. */
  duplicates: Set<string>;
  /** Number of items shortened to MAX_ITEM_LENGTH. */
  truncated: number;
  /** Number of items dropped because MAX_ITEMS was exceeded. */
  dropped: number;
}

export function validateDelimiter(delimiter: string): string | null {
  if (delimiter.length === 0) return 'Enter a delimiter.';
  if (delimiter.length > MAX_DELIMITER_LENGTH) {
    return `Delimiter must be at most ${MAX_DELIMITER_LENGTH} characters.`;
  }
  if (delimiter !== NEWLINE_DELIMITER && delimiter.trim().length === 0) {
    return 'Delimiter cannot be only spaces.';
  }
  return null;
}

/** Trim and collapse any internal whitespace (including newlines) to single spaces. */
export function cleanItem(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizeKey(text: string): string {
  return cleanItem(text).toLocaleLowerCase();
}

export function findDuplicates(items: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const item of items) {
    const key = normalizeKey(item);
    if (seen.has(key)) dupes.add(key);
    else seen.add(key);
  }
  return dupes;
}

/**
 * Split `text` into items using a literal delimiter.
 * Whitespace around items is removed and empty items are ignored.
 * Invalid input (non-string, invalid delimiter) yields an empty result rather than throwing.
 */
export function parseItems(text: unknown, delimiter: string = DEFAULT_DELIMITER): ParseResult {
  const empty: ParseResult = { items: [], duplicates: new Set(), truncated: 0, dropped: 0 };
  if (typeof text !== 'string' || validateDelimiter(delimiter) !== null) return empty;

  // Normalise line endings and strip a leading BOM from uploaded files.
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const parts = normalized.split(delimiter);

  const items: string[] = [];
  let truncated = 0;
  let dropped = 0;
  for (const part of parts) {
    let item = cleanItem(part);
    if (!item) continue;
    if (items.length >= MAX_ITEMS) {
      dropped++;
      continue;
    }
    if (item.length > MAX_ITEM_LENGTH) {
      item = item.slice(0, MAX_ITEM_LENGTH).trim();
      truncated++;
    }
    items.push(item);
  }
  return { items, duplicates: findDuplicates(items), truncated, dropped };
}

export function describeDelimiter(delimiter: string): string {
  if (delimiter === NEWLINE_DELIMITER) return 'new line';
  return `“${delimiter}”`;
}
