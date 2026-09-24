import type { BoardContent } from '../store/types';
import { ungroupedIds } from '../store/operations';

export const UNGROUPED_LABEL = 'Ungrouped';

export function bucketLabel(name: string, index: number): string {
  return name.trim() || `Untitled bucket ${index + 1}`;
}

export interface Group {
  name: string;
  items: string[];
}

export function groupsOf(content: BoardContent, includeUngrouped: boolean): Group[] {
  const groups: Group[] = content.bucketOrder.map((bid, i) => {
    const b = content.buckets[bid];
    return { name: bucketLabel(b.name, i), items: b.itemIds.map((id) => content.items[id]?.text).filter(Boolean) };
  });
  if (includeUngrouped) {
    const loose = ungroupedIds(content).map((id) => content.items[id].text);
    if (loose.length) groups.push({ name: UNGROUPED_LABEL, items: loose });
  }
  return groups;
}

/**
 * Bucket name followed by its items, one per line; groups separated by a blank line.
 */
export function toText(content: BoardContent, includeUngrouped = true): string {
  return groupsOf(content, includeUngrouped)
    .map((g) => [g.name, ...g.items].join('\n'))
    .join('\n\n');
}

function csvCell(value: string): string {
  // Neutralise spreadsheet formulas (CSV injection).
  let v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Two-column CSV (bucket,item), RFC 4180 quoting, CRLF line endings. */
export function toCSV(content: BoardContent, includeUngrouped = true): string {
  const rows = [['bucket', 'item']];
  for (const g of groupsOf(content, includeUngrouped)) {
    if (g.items.length === 0) rows.push([g.name, '']);
    for (const item of g.items) rows.push([g.name, item]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function safeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\p{L}\p{N}\-_ ]+/gu, '')
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'board'
  );
}
