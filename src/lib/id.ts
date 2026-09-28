let counter = 0;

export function newId(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${rand}${counter.toString(36)}`;
}
