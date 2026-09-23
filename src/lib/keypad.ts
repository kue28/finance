// Logic for the on-screen amount keypad. The amount is kept as the typed
// string (e.g. "12.5") and only converted to cents on save.

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

const MAX_WHOLE_DIGITS = 7; // up to $9,999,999.99

export function applyKey(value: string, key: Key): string {
  if (key === 'back') return value.slice(0, -1);
  if (key === '.') {
    if (value.includes('.')) return value;
    return value === '' ? '0.' : value + '.';
  }
  const [whole, frac] = value.split('.');
  if (frac !== undefined) return frac.length >= 2 ? value : value + key;
  if (whole === '0') return key; // no leading zeros
  if (whole.length >= MAX_WHOLE_DIGITS) return value;
  return value + key;
}

/** "1234.5" -> "1,234.5" for display (keeps what the user typed after the dot). */
export function displayAmount(value: string): string {
  if (value === '') return '0';
  const [whole, frac] = value.split('.');
  const w = Number(whole || '0').toLocaleString('en-US');
  return frac === undefined ? w : `${w}.${frac}`;
}
