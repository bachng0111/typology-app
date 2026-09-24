import { useEffect } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { saveNow } from '../../store/persist';
import { addBucket, deleteSelectedItem } from './boardActions';
import { fitToContent, zoomAt } from './viewport';

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function useShortcuts(opts: { onHelp(): void; disabled: boolean }) {
  const { onHelp, disabled } = opts;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled || document.querySelector('dialog[open]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const s = useBoardStore.getState();
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNow();
        s.showToast('Board saved');
        return;
      }
      if (isTyping(e.target)) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod || e.altKey) return;
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (s.selectedItemId) {
            e.preventDefault();
            void deleteSelectedItem();
          }
          break;
        case 'Escape':
          s.select(null);
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          addBucket();
          break;
        case 'f':
        case 'F':
          fitToContent();
          break;
        case '+':
        case '=':
          zoomAt(1.2);
          break;
        case '-':
        case '_':
          zoomAt(1 / 1.2);
          break;
        case '?':
          onHelp();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHelp, disabled]);
}
