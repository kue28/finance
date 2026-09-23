// All money is stored as integer cents (e.g. $12.50 -> 1250) so that adding
// many amounts never produces floating-point errors like 0.1 + 0.2 = 0.30000000000000004.

/** Format cents as "$1,234.56" (negative as "-$1,234.56"). */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = String(abs % 100).padStart(2, '0');
  return `${sign}$${dollars}.${rest}`;
}

/**
 * Parse user input like "12", "12.5", "$1,200.75" into cents.
 * Returns null for anything that isn't a valid non-negative amount
 * with at most 2 decimal places.
 */
export function parseToCents(input: string): number | null {
  const s = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
}
