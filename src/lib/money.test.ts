import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, parseSignedToCents, parseToCents } from './money';

describe('formatCents', () => {
  it('formats with $ and two decimals', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(1250)).toBe('$12.50');
    expect(formatCents(123456789)).toBe('$1,234,567.89');
    expect(formatCents(-1250)).toBe('-$12.50');
  });
});

describe('parseToCents', () => {
  it('parses valid amounts', () => {
    expect(parseToCents('12')).toBe(1200);
    expect(parseToCents('12.5')).toBe(1250);
    expect(parseToCents('12.05')).toBe(1205);
    expect(parseToCents('$1,200.75')).toBe(120075);
    expect(parseToCents('.5')).toBe(50);
    expect(parseToCents('0.1')).toBe(10);
  });
  it('rejects invalid input', () => {
    expect(parseToCents('')).toBeNull();
    expect(parseToCents('abc')).toBeNull();
    expect(parseToCents('1.234')).toBeNull();
    expect(parseToCents('-5')).toBeNull();
    expect(parseToCents('1.2.3')).toBeNull();
  });
  it('signed variant allows a minus', () => {
    expect(parseSignedToCents('-20.50')).toBe(-2050);
    expect(parseSignedToCents('20')).toBe(2000);
    expect(parseSignedToCents('-x')).toBeNull();
  });
  it('round-trips through centsToInput', () => {
    expect(centsToInput(0)).toBe('');
    expect(centsToInput(1250)).toBe('12.50');
    expect(parseSignedToCents(centsToInput(-99))).toBe(-99);
  });
});
