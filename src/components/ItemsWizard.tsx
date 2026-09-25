import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import DelimiterPicker from './DelimiterPicker';
import ItemReview, { draftKey, type DraftItem } from './ItemReview';
import { confirmAction } from './ConfirmDialog';
import { ACCEPTED_FILE_TYPES, FileInputError, readTextFile } from '../lib/fileInput';
import {
  cleanItem,
  describeDelimiter,
  MAX_ITEMS,
  MAX_ITEM_LENGTH,
  NEWLINE_DELIMITER,
  parseItems,
  validateDelimiter,
} from '../lib/parse';

type Source = 'paste' | 'upload' | 'empty';

interface Props {
  initialDelimiter: string;
  /** Offer the "Start empty" option (new boards only). */
  allowEmpty?: boolean;
  /** Content shown above the steps (e.g. board name field). */
  header?: ReactNode;
  confirmLabel(count: number): string;
  onConfirm(texts: string[], delimiter: string): void;
  onCancel(): void;
}

const EXAMPLE = 'doctor/nurse/pharmacist/customer service/product quality/apple/orange/banana';

/** Suggest a delimiter that would split the text when the current one finds only a single item. */
function suggestDelimiter(text: string, current: string): string | null {
  for (const d of [NEWLINE_DELIMITER, ',', ';', '|', '/', '\t']) {
    if (d !== current && parseItems(text, d).items.length > 1) return d;
  }
  return null;
}

export default function ItemsWizard({ initialDelimiter, allowEmpty, header, confirmLabel, onConfirm, onCancel }: Props) {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [source, setSource] = useState<Source>('paste');
  const [text, setText] = useState('');
  const [delimiter, setDelimiter] = useState(initialDelimiter);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [edited, setEdited] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const delimiterError = validateDelimiter(delimiter);
  const parsed = useMemo(() => parseItems(text, delimiter), [text, delimiter]);
  const suggestion = parsed.items.length === 1 && text.length > 0 ? suggestDelimiter(text, delimiter) : null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    try {
      const content = await readTextFile(file);
      setText(content);
      setFileName(file.name);
      if (parseItems(content, delimiter).items.length <= 1) {
        const s = suggestDelimiter(content, delimiter);
        if (s) setDelimiter(s);
      }
    } catch (err) {
      setFileError(err instanceof FileInputError ? err.message : 'Could not read that file.');
    }
  };

  const goReview = () => {
    setDraft(parsed.items.map((t) => ({ key: draftKey(), text: t })));
    setEdited(false);
    setStep('review');
  };

  const goBack = async () => {
    if (edited) {
      const { ok } = await confirmAction({
        title: 'Discard your edits?',
        message: 'Going back re-parses the original text, so changes made in the review list will be lost.',
        confirmLabel: 'Go back',
        danger: true,
      });
      if (!ok) return;
    }
    setStep('input');
  };

  const onDraftChange = useCallback((items: DraftItem[]) => {
    setDraft(items);
    setEdited(true);
  }, []);

  const finalTexts = draft.map((d) => cleanItem(d.text)).filter(Boolean);

  if (step === 'review') {
    return (
      <div className="wizard">
        {header}
        <ol className="steps" aria-label="Progress">
          <li className="done">1. Add text</li>
          <li className="current" aria-current="step">
            2. Review items
          </li>
          <li>3. Sort on the board</li>
        </ol>
        <p className="muted">
          Edit, remove or add items. Parsed with {describeDelimiter(delimiter)} as the delimiter.
        </p>
        <ItemReview items={draft} onChange={onDraftChange} />
        <div className="wizard-actions">
          <button type="button" className="btn" onClick={goBack}>
            ← Back
          </button>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-primary"
            disabled={finalTexts.length === 0}
            onClick={() => onConfirm(finalTexts, delimiter)}
          >
            {confirmLabel(finalTexts.length)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard">
      {header}
      <ol className="steps" aria-label="Progress">
        <li className="current" aria-current="step">
          1. Add text
        </li>
        <li>2. Review items</li>
        <li>3. Sort on the board</li>
      </ol>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={source === 'paste'} className={`tab ${source === 'paste' ? 'active' : ''}`} onClick={() => setSource('paste')}>
          Paste text
        </button>
        <button type="button" role="tab" aria-selected={source === 'upload'} className={`tab ${source === 'upload' ? 'active' : ''}`} onClick={() => setSource('upload')}>
          Upload file
        </button>
        {allowEmpty && (
          <button type="button" role="tab" aria-selected={source === 'empty'} className={`tab ${source === 'empty' ? 'active' : ''}`} onClick={() => setSource('empty')}>
            Start empty
          </button>
        )}
      </div>

      {source === 'empty' ? (
        <div className="panel empty-panel">
          <p>Start with an empty board and add items later with <strong>Add items</strong> on the board.</p>
        </div>
      ) : (
        <div className="panel">
          {source === 'upload' && (
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
                <strong>Drop a text file here</strong> or{' '}
                <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
                  choose a file
                </button>
              </p>
              <p className="muted small">.txt, .csv, .md and other plain-text files up to 5 MB</p>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                hidden
                data-testid="file-input"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {fileName && !fileError && <p className="file-loaded">Loaded “{fileName}”. You can edit the text below.</p>}
              {fileError && <p className="field-error">{fileError}</p>}
            </div>
          )}

          {(source === 'paste' || fileName) && (
            <label className="field">
              <span className="field-label">{source === 'paste' ? 'Paste your items' : 'File contents'}</span>
              <textarea
                className="textarea"
                rows={source === 'paste' ? 8 : 6}
                placeholder={`e.g. ${EXAMPLE}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus={source === 'paste'}
              />
            </label>
          )}

          <DelimiterPicker value={delimiter} onChange={setDelimiter} />

          <div className="parse-preview" aria-live="polite">
            {delimiterError ? (
              <p className="field-error">{delimiterError}</p>
            ) : text.trim() === '' ? (
              <p className="muted">
                {source === 'paste' ? 'Paste text above.' : 'Choose a file.'} Each piece of text between{' '}
                {describeDelimiter(delimiter)} becomes one card.{' '}
                {source === 'paste' && (
                  <button type="button" className="link-btn" onClick={() => setText(EXAMPLE)}>
                    Try an example
                  </button>
                )}
              </p>
            ) : parsed.items.length === 0 ? (
              <p className="field-error">No items found. The text only contains delimiters or spaces.</p>
            ) : (
              <>
                <p>
                  <strong>{parsed.items.length}</strong> item{parsed.items.length === 1 ? '' : 's'} found
                  {parsed.duplicates.size > 0 && <span className="badge badge-warn">{parsed.duplicates.size} duplicate</span>}
                </p>
                <div className="chip-preview">
                  {parsed.items.slice(0, 30).map((t, i) => (
                    <span key={i} className="preview-chip">
                      {t}
                    </span>
                  ))}
                  {parsed.items.length > 30 && <span className="muted small">+{parsed.items.length - 30} more</span>}
                </div>
                {suggestion && (
                  <p className="hint">
                    Only one item found. Did you mean to split on {describeDelimiter(suggestion)}?{' '}
                    <button type="button" className="link-btn" onClick={() => setDelimiter(suggestion)}>
                      Use {describeDelimiter(suggestion)}
                    </button>
                  </p>
                )}
                {parsed.truncated > 0 && (
                  <p className="hint">
                    {parsed.truncated} item(s) longer than {MAX_ITEM_LENGTH} characters will be shortened.
                  </p>
                )}
                {parsed.dropped > 0 && (
                  <p className="hint">
                    Only the first {MAX_ITEMS} items will be used ({parsed.dropped} ignored).
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="wizard-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <span className="spacer" />
        {source === 'empty' ? (
          <button type="button" className="btn btn-primary" onClick={() => onConfirm([], delimiter)}>
            Create empty board
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!delimiterError || parsed.items.length === 0}
            onClick={goReview}
          >
            Review {parsed.items.length || ''} items →
          </button>
        )}
      </div>
    </div>
  );
}
