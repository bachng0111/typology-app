import type { BoardContent } from '../store/types';
import { ungroupedIds } from '../store/operations';

export const UNGROUPED_LABEL = 'Ungrouped';
export const COMMENTS_LABEL = 'Comments';

export interface ExportOptions {
  includeUngrouped?: boolean;
  /** Append sticky-note comments as a final "Comments" group. */
  includeComments?: boolean;
}

function noteTexts(content: BoardContent): string[] {
  return Object.values(content.notes ?? {})
    .map((n) => n.text.trim())
    .filter(Boolean);
}

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
 * Comments (if included) follow in a final section, one comment per paragraph.
 */
export function toText(content: BoardContent, opts: ExportOptions = {}): string {
  const { includeUngrouped = true, includeComments = false } = opts;
  const sections = groupsOf(content, includeUngrouped).map((g) => [g.name, ...g.items].join('\n'));
  const comments = includeComments ? noteTexts(content) : [];
  if (comments.length) sections.push([COMMENTS_LABEL, ...comments].join('\n\n'));
  return sections.join('\n\n');
}

function csvCell(value: string): string {
  // Neutralise spreadsheet formulas (CSV injection).
  let v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Two-column CSV (bucket,item), RFC 4180 quoting, CRLF line endings. */
export function toCSV(content: BoardContent, opts: ExportOptions = {}): string {
  const { includeUngrouped = true, includeComments = false } = opts;
  const rows = [['bucket', 'item']];
  for (const g of groupsOf(content, includeUngrouped)) {
    if (g.items.length === 0) rows.push([g.name, '']);
    for (const item of g.items) rows.push([g.name, item]);
  }
  if (includeComments) for (const text of noteTexts(content)) rows.push([COMMENTS_LABEL, text]);
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
