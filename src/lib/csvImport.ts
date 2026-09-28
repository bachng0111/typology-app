import { parseCSV } from './csv';
import { cleanItem, MAX_ITEM_LENGTH, MAX_ITEMS } from './parse';
import { UNGROUPED_LABEL } from './export';

export const MAX_IMPORT_BUCKETS = 200;

export interface ImportedBucket {
  name: string;
  items: string[];
}

export interface BucketImport {
  buckets: ImportedBucket[];
  /** Items that go on the board outside any bucket. */
  ungrouped: string[];
  warnings: string[];
}

export class CsvImportError extends Error {}

const keyOf = (name: string) => cleanItem(name).toLocaleLowerCase();
const isUngrouped = (name: string) => keyOf(name) === UNGROUPED_LABEL.toLowerCase();

/** Undo the exporter's spreadsheet-formula guard ('=SUM → =SUM). */
function unguard(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

function cleanCell(value: string): string {
  return cleanItem(unguard(value.trim())).slice(0, MAX_ITEM_LENGTH);
}

/** Collects items per bucket, merging buckets whose names match (ignoring case and spaces). */
class Collector {
  private byKey = new Map<string, ImportedBucket>();
  readonly buckets: ImportedBucket[] = [];
  readonly ungrouped: string[] = [];
  private count = 0;
  droppedItems = 0;
  droppedBuckets = 0;

  /** Returns the bucket for a (non-Ungrouped) name, creating it if needed. Blank names never merge. */
  bucket(name: string): ImportedBucket | null {
    const clean = cleanItem(name).slice(0, 80);
    const key = clean ? keyOf(clean) : null;
    const existing = key ? this.byKey.get(key) : undefined;
    if (existing) return existing;
    if (this.buckets.length >= MAX_IMPORT_BUCKETS) {
      this.droppedBuckets++;
      return null;
    }
    const b: ImportedBucket = { name: clean, items: [] };
    this.buckets.push(b);
    if (key) this.byKey.set(key, b);
    return b;
  }

  add(target: ImportedBucket | 'ungrouped' | null, raw: string) {
    const text = cleanCell(raw);
    if (!text) return;
    if (this.count >= MAX_ITEMS) {
      this.droppedItems++;
      return;
    }
    if (target === 'ungrouped') this.ungrouped.push(text);
    else if (target) target.items.push(text);
    else {
      this.droppedItems++;
      return;
    }
    this.count++;
  }
}

/**
 * Interpret CSV text as buckets:
 * - Wide format: each column header is a bucket and the cells below are its items.
 *   A column named "Ungrouped" holds items that stay loose on the board.
 * - Long format (this app's export): a `bucket,item` header, one row per item.
 */
export function parseBucketCSV(text: string): BucketImport {
  if (!text.trim()) throw new CsvImportError('The CSV is empty.');
  const rows = parseCSV(text);
  if (rows.length === 0) throw new CsvImportError('The CSV is empty.');

  const header = rows[0];
  const body = rows.slice(1);
  const c = new Collector();
  const warnings: string[] = [];

  const isLong =
    header.length === 2 && keyOf(header[0]) === 'bucket' && keyOf(header[1]) === 'item';

  if (isLong) {
    for (const [bucket = '', item = ''] of body) {
      if (!cleanCell(bucket) && !cleanCell(item)) continue;
      const name = unguard(bucket.trim());
      const target = isUngrouped(name) ? 'ungrouped' : c.bucket(name);
      // An empty item cell still creates the (empty) bucket, matching the export of empty buckets.
      c.add(target, item);
    }
  } else {
    if (header.every((h) => !cleanItem(h))) {
      throw new CsvImportError('The first row should contain bucket names (column headers), but it is empty.');
    }
    const width = Math.max(header.length, ...body.map((r) => r.length));
    const targets: (ImportedBucket | 'ungrouped' | null)[] = [];
    let blankHeaders = 0;
    let extraColumns = 0;
    for (let col = 0; col < width; col++) {
      const name = header[col] ?? '';
      const hasValues = body.some((r) => cleanCell(r[col] ?? ''));
      if (col >= header.length) {
        if (hasValues) extraColumns++;
      } else if (!cleanItem(name) && hasValues) blankHeaders++;
      // Skip columns with no header and no values (e.g. trailing delimiters).
      if (!cleanItem(name) && !hasValues) {
        targets.push(null);
        continue;
      }
      targets.push(isUngrouped(name) ? 'ungrouped' : c.bucket(name));
    }
    for (const r of body) r.forEach((cell, col) => c.add(targets[col] ?? null, cell));
    if (blankHeaders) {
      warnings.push(`${blankHeaders} column${blankHeaders === 1 ? ' has' : 's have'} no header and became unnamed buckets.`);
    }
    if (extraColumns) {
      warnings.push(`${extraColumns} column${extraColumns === 1 ? '' : 's'} beyond the header row became unnamed buckets.`);
    }
  }

  if (c.droppedItems) warnings.push(`Only the first ${MAX_ITEMS} items were imported (${c.droppedItems} skipped).`);
  if (c.droppedBuckets) warnings.push(`Only the first ${MAX_IMPORT_BUCKETS} buckets were imported.`);

  const itemCount = c.ungrouped.length + c.buckets.reduce((n, b) => n + b.items.length, 0);
  if (itemCount === 0 && c.buckets.length === 0) {
    throw new CsvImportError('No buckets or items found. Put bucket names in the first row and items below them.');
  }
  return { buckets: c.buckets, ungrouped: c.ungrouped, warnings };
}
