import { useRef, useState } from 'react';
import { FileInputError, readTextFile } from '../lib/fileInput';
import { CsvImportError, parseBucketCSV, type BucketImport } from '../lib/csvImport';
import { downloadText } from '../lib/download';

export type CsvParse = { ok: true; result: BucketImport } | { ok: false; error: string } | null;

const TEMPLATE = 'Healthcare,Fruit,Ungrouped\ndoctor,apple,rock\nnurse,orange,chair\npharmacist,,\n';

export function parseCsvSafely(text: string): CsvParse {
  if (!text.trim()) return null;
  try {
    return { ok: true, result: parseBucketCSV(text) };
  } catch (err) {
    return { ok: false, error: err instanceof CsvImportError ? err.message : 'Could not read that CSV.' };
  }
}

interface Props {
  text: string;
  onText(text: string): void;
  fileName: string | null;
  onFileName(name: string | null): void;
  parsed: CsvParse;
}

/** Upload or paste a CSV whose columns are buckets; shows a preview of what will be created. */
export default function CsvImportPanel({ text, onText, fileName, onFileName, parsed }: Props) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    try {
      onText(await readTextFile(file));
      onFileName(file.name);
    } catch (err) {
      setFileError(err instanceof FileInputError ? err.message : 'Could not read that file.');
    }
  };

  const result = parsed?.ok ? parsed.result : null;
  const total = result ? result.ungrouped.length + result.buckets.reduce((n, b) => n + b.items.length, 0) : 0;

  return (
    <div className="panel">
      <p className="csv-help">
        Each <strong>column header</strong> becomes a bucket and the cells below it become its items. A column named{' '}
        <strong>Ungrouped</strong> puts its items on the board outside any bucket. Buckets are sized to fit their items.{' '}
        <button type="button" className="link-btn" onClick={() => downloadText(TEMPLATE, 'buckets-template.csv', 'text/csv')}>
          Download a template
        </button>
      </p>
      <table className="csv-example" aria-label="Example CSV layout">
        <thead>
          <tr>
            <th>Healthcare</th>
            <th>Fruit</th>
            <th>Ungrouped</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>doctor</td>
            <td>apple</td>
            <td>rock</td>
          </tr>
          <tr>
            <td>nurse</td>
            <td>orange</td>
            <td>chair</td>
          </tr>
        </tbody>
      </table>

      <div
        className={`dropzone ${dragOver ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
      >
        <p>
          <strong>Drop a CSV file here</strong> or{' '}
          <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
            choose a file
          </button>
        </p>
        <p className="muted small">.csv or .tsv, up to 5 MB. You can also paste cells copied from a spreadsheet below.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          hidden
          data-testid="csv-file-input"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {fileName && !fileError && <p className="file-loaded">Loaded “{fileName}”.</p>}
        {fileError && <p className="field-error">{fileError}</p>}
      </div>

      <label className="field">
        <span className="field-label">CSV contents</span>
        <textarea
          className="textarea"
          rows={6}
          placeholder={'Healthcare,Fruit,Ungrouped\ndoctor,apple,rock'}
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
      </label>

      <div className="parse-preview" aria-live="polite">
        {!parsed ? (
          <p className="muted">Choose or paste a CSV to see the buckets it will create.</p>
        ) : !parsed.ok ? (
          <p className="field-error">{parsed.error}</p>
        ) : (
          <>
            <p>
              <strong>{result!.buckets.length}</strong> bucket{result!.buckets.length === 1 ? '' : 's'} and{' '}
              <strong>{total}</strong> item{total === 1 ? '' : 's'} found
            </p>
            <ul className="csv-preview">
              {result!.buckets.map((b, i) => (
                <li key={i}>
                  <span className="csv-bucket-name">{b.name || <em>Unnamed bucket</em>}</span>
                  <span className="muted">
                    {b.items.length} item{b.items.length === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
              {result!.ungrouped.length > 0 && (
                <li className="csv-ungrouped">
                  <span className="csv-bucket-name">Ungrouped</span>
                  <span className="muted">
                    {result!.ungrouped.length} item{result!.ungrouped.length === 1 ? '' : 's'} (placed on the board)
                  </span>
                </li>
              )}
            </ul>
            {result!.warnings.map((w) => (
              <p key={w} className="hint">
                {w}
              </p>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
