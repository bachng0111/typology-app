import { memo, useMemo, useRef, useState } from 'react';
import { cleanItem, findDuplicates, MAX_ITEM_LENGTH, normalizeKey } from '../lib/parse';

export interface DraftItem {
  key: string;
  text: string;
}

interface Props {
  items: DraftItem[];
  onChange(items: DraftItem[]): void;
}

let keySeq = 0;
export const draftKey = () => `d${++keySeq}`;

const Row = memo(function Row({
  item,
  index,
  duplicate,
  onEdit,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  duplicate: boolean;
  onEdit(key: string, text: string): void;
  onRemove(key: string): void;
}) {
  const empty = cleanItem(item.text) === '';
  return (
    <li className={`review-row ${empty ? 'is-empty' : ''}`}>
      <span className="review-index">{index + 1}</span>
      <input
        className="review-input"
        value={item.text}
        maxLength={MAX_ITEM_LENGTH}
        aria-label={`Item ${index + 1}`}
        onChange={(e) => onEdit(item.key, e.target.value)}
      />
      {duplicate && (
        <span className="badge badge-warn" title="This item appears more than once">
          duplicate
        </span>
      )}
      {empty && <span className="badge badge-muted">empty – will be skipped</span>}
      <button type="button" className="icon-btn" aria-label={`Remove item ${index + 1}`} title="Remove" onClick={() => onRemove(item.key)}>
        ×
      </button>
    </li>
  );
});

export default function ItemReview({ items, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('');
  const addRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const duplicates = useMemo(() => findDuplicates(items.map((i) => i.text).filter((t) => cleanItem(t))), [items]);
  const validCount = items.filter((i) => cleanItem(i.text)).length;

  const onEdit = useMemo(
    () => (key: string, text: string) => onChange(itemsRef.current.map((i) => (i.key === key ? { ...i, text } : i))),
    [onChange],
  );
  const onRemove = useMemo(
    () => (key: string) => onChange(itemsRef.current.filter((i) => i.key !== key)),
    [onChange],
  );

  const add = () => {
    const text = cleanItem(draft);
    if (!text) return;
    onChange([...items, { key: draftKey(), text }]);
    setDraft('');
    addRef.current?.focus();
  };

  const q = normalizeKey(filter);
  const visible = q ? items.filter((i) => normalizeKey(i.text).includes(q)) : items;
  const positions = useMemo(() => new Map(items.map((i, idx) => [i.key, idx])), [items]);

  return (
    <div className="review">
      <div className="review-toolbar">
        <strong>
          {validCount} item{validCount === 1 ? '' : 's'}
        </strong>
        {duplicates.size > 0 && (
          <span className="badge badge-warn">
            {duplicates.size} duplicate{duplicates.size === 1 ? '' : 's'}
          </span>
        )}
        {duplicates.size > 0 && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              const seen = new Set<string>();
              onChange(
                items.filter((i) => {
                  const k = normalizeKey(i.text);
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                }),
              );
            }}
          >
            Remove duplicates
          </button>
        )}
        {items.length > 12 && (
          <input
            className="input input-small review-filter"
            type="search"
            placeholder="Filter…"
            aria-label="Filter items"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
      </div>

      {items.length === 0 ? (
        <p className="empty-note">No items yet. Add some below.</p>
      ) : (
        <ol className="review-list">
          {visible.map((item) => (
            <Row
              key={item.key}
              item={item}
              index={positions.get(item.key) ?? 0}
              duplicate={duplicates.has(normalizeKey(item.text))}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </ol>
      )}

      <form
        className="review-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          ref={addRef}
          className="input"
          placeholder="Add an item…"
          aria-label="New item"
          maxLength={MAX_ITEM_LENGTH}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn" disabled={!cleanItem(draft)}>
          + Add item
        </button>
      </form>
    </div>
  );
}
