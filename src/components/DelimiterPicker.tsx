import { useId, useState } from 'react';
import { MAX_DELIMITER_LENGTH, NEWLINE_DELIMITER, validateDelimiter } from '../lib/parse';

const PRESETS: { value: string; label: string; title: string }[] = [
  { value: '/', label: '/', title: 'Slash' },
  { value: ',', label: ',', title: 'Comma' },
  { value: ';', label: ';', title: 'Semicolon' },
  { value: '|', label: '|', title: 'Pipe' },
  { value: NEWLINE_DELIMITER, label: '↵ New line', title: 'One item per line' },
];

interface Props {
  value: string;
  onChange(value: string): void;
}

export default function DelimiterPicker({ value, onChange }: Props) {
  const isPreset = PRESETS.some((p) => p.value === value);
  const [custom, setCustom] = useState(isPreset ? '' : value);
  const id = useId();
  const customError = custom ? validateDelimiter(custom) : null;

  return (
    <fieldset className="delimiter-picker">
      <legend>Delimiter between items</legend>
      <div className="segmented" role="radiogroup" aria-label="Delimiter">
        {PRESETS.map((p) => (
          <button
            key={p.title}
            type="button"
            role="radio"
            aria-checked={value === p.value}
            title={p.title}
            className={`segment ${value === p.value ? 'active' : ''}`}
            onClick={() => onChange(p.value)}
          >
            {p.label}
          </button>
        ))}
        <label className={`segment custom ${!isPreset ? 'active' : ''}`} htmlFor={id}>
          <span>Custom</span>
          <input
            id={id}
            value={custom}
            maxLength={MAX_DELIMITER_LENGTH}
            placeholder="e.g. ::"
            aria-invalid={!!customError}
            onChange={(e) => {
              setCustom(e.target.value);
              if (!validateDelimiter(e.target.value)) onChange(e.target.value);
            }}
            onFocus={() => {
              if (custom && !validateDelimiter(custom)) onChange(custom);
            }}
          />
        </label>
      </div>
      {customError && <p className="field-error">{customError}</p>}
    </fieldset>
  );
}
