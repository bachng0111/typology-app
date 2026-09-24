import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { MAX_ITEM_LENGTH } from '../../lib/parse';

interface Props {
  initial: string;
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
  onCommit(value: string): void;
  onCancel(): void;
}

/** Text editor that commits on Enter/blur and cancels on Escape. */
export default function InlineEditor({
  initial,
  maxLength = MAX_ITEM_LENGTH,
  multiline,
  placeholder,
  className,
  ariaLabel,
  onCommit,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !multiline) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, multiline]);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(value);
    else onCancel();
  };

  const common = {
    ref,
    value,
    maxLength,
    placeholder,
    className: `inline-editor ${className ?? ''}`,
    'aria-label': ariaLabel,
    'data-no-drag': true,
    onChange: (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setValue(e.target.value),
    onBlur: () => finish(true),
    onPointerDown: (e: PointerEvent) => e.stopPropagation(),
    onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    },
  };

  return multiline ? <textarea rows={1} {...common} /> : <input {...common} />;
}
