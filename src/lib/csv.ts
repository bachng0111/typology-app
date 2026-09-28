/** Delimiters recognised when reading CSV/TSV. Tab covers cells copied from a spreadsheet. */
const CANDIDATES = [',', ';', '\t'] as const;

/** Guess the delimiter from the first line, counting only characters outside quotes. */
export function detectDelimiter(text: string): string {
  const counts = new Map<string, number>(CANDIDATES.map((d) => [d, 0]));
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  let best = ',';
  let bestCount = 0;
  for (const [d, n] of counts) {
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

/**
 * Parse CSV text into rows of cells (RFC 4180): quoted fields, "" escapes and
 * newlines inside quotes. Handles CRLF and a leading BOM; drops trailing blank lines.
 */
export function parseCSV(input: string, delimiter = detectDelimiter(input.replace(/^\uFEFF/, ''))): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        cell += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && cell === '') inQuotes = true;
    else if (text.startsWith(delimiter, i)) {
      endCell();
      i += delimiter.length;
      continue;
    } else if (ch === '\r' || ch === '\n') {
      endRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else cell += ch;
    i++;
  }
  if (cell !== '' || row.length > 0) endRow();

  // Drop trailing rows that are entirely empty.
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === '')) rows.pop();
  return rows;
}
