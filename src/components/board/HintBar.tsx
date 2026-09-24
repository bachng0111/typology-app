import type { ReactNode } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { addBucket } from './boardActions';

/** Shows the next step of the workflow and grouping progress. */
export default function HintBar({ onAddItems }: { onAddItems(): void }) {
  const stats = useBoardStore((s) => {
    const b = s.board;
    if (!b) return '0|0|0|0';
    let grouped = 0;
    let unnamed = 0;
    for (const id of b.bucketOrder) {
      grouped += b.buckets[id].itemIds.length;
      if (!b.buckets[id].name.trim()) unnamed++;
    }
    return `${Object.keys(b.items).length}|${b.bucketOrder.length}|${grouped}|${unnamed}`;
  });
  const [total, buckets, grouped, unnamed] = stats.split('|').map(Number);

  let step: ReactNode;
  if (total === 0) {
    step = (
      <>
        <strong>Start by adding items.</strong>{' '}
        <button className="link-btn" onClick={onAddItems}>
          Paste or upload a list
        </button>
      </>
    );
  } else if (buckets === 0) {
    step = (
      <>
        <strong>Next: create a bucket</strong> for a group.{' '}
        <button className="link-btn" onClick={addBucket}>
          + Bucket
        </button>{' '}
        or double-click empty space.
      </>
    );
  } else if (grouped === 0) {
    step = (
      <>
        <strong>Drag items into a bucket.</strong> Items light up the bucket they will drop into.
      </>
    );
  } else if (unnamed > 0) {
    step = (
      <>
        <strong>Name your buckets.</strong> Double-click a bucket title to rename it.
      </>
    );
  } else if (grouped < total) {
    step = (
      <>
        <strong>Keep sorting.</strong> Drag chips between buckets, or out to the board to ungroup them.
      </>
    );
  } else {
    step = (
      <>
        <strong>All items are grouped!</strong> Use Export to save an image, text or CSV.
      </>
    );
  }

  return (
    <div className="hint-bar" role="status">
      <span className="hint-step">{step}</span>
      {total > 0 && (
        <span className="hint-progress" title="Items in buckets">
          <span className="progress" aria-hidden>
            <span style={{ width: `${(100 * grouped) / total}%` }} />
          </span>
          {grouped}/{total} grouped · {total - grouped} ungrouped · {buckets} bucket{buckets === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
