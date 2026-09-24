export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = '.txt,.text,.csv,.tsv,.md,.json,text/plain,text/csv,text/markdown';

export class FileInputError extends Error {}

/** Heuristic binary check: NUL bytes essentially never appear in text files. */
export function looksBinary(sample: string): boolean {
  return sample.slice(0, 8000).includes('\u0000');
}

export async function readTextFile(file: File): Promise<string> {
  if (file.size === 0) throw new FileInputError(`“${file.name}” is empty.`);
  if (file.size > MAX_FILE_BYTES) {
    throw new FileInputError(`“${file.name}” is larger than 5 MB. Please use a smaller text file.`);
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new FileInputError(`Could not read “${file.name}”.`);
  }
  if (looksBinary(text)) {
    throw new FileInputError(
      `“${file.name}” doesn't look like a plain text file. Save it as .txt and try again.`,
    );
  }
  return text;
}
