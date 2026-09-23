import { describe, expect, it } from 'vitest';
import { applyKey, displayAmount, type Key } from './keypad';

const type = (keys: Key[]) => keys.reduce(applyKey, '');

describe('keypad', () => {
  it('builds amounts', () => {
    expect(type(['1', '2', '.', '5', '0'])).toBe('12.50');
    expect(type(['.', '5'])).toBe('0.5');
  });
  it('limits to two decimals and one dot', () => {
    expect(type(['1', '.', '2', '3', '4'])).toBe('1.23');
    expect(type(['1', '.', '.', '2'])).toBe('1.2');
  });
  it('drops leading zeros', () => {
    expect(type(['0', '0', '7'])).toBe('7');
  });
  it('backspace', () => {
    expect(type(['1', '2', 'back'])).toBe('1');
    expect(type(['back'])).toBe('');
  });
  it('caps the size', () => {
    expect(type(['9', '9', '9', '9', '9', '9', '9', '9'])).toBe('9999999');
  });
  it('displays with thousands separators', () => {
    expect(displayAmount('')).toBe('0');
    expect(displayAmount('1234.5')).toBe('1,234.5');
    expect(displayAmount('0.')).toBe('0.');
  });
});
