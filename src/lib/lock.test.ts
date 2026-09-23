import { beforeEach, describe, expect, it } from 'vitest';
import {
  disableLock, getLock, newRecoveryCode, normaliseCode, sha256, shouldRelock, unlockWithRecoveryCode, userVerified,
} from './lock';

// Minimal localStorage for Node.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage;

beforeEach(() => store.clear());

describe('recovery codes', () => {
  it('look like XXXX-XXXX-XXXX with no confusable characters', () => {
    for (let i = 0; i < 50; i++) {
      const c = newRecoveryCode();
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });

  it('accept lowercase and missing dashes when typed back', () => {
    expect(normaliseCode(' k7qm 3xra-9pte ')).toBe('K7QM-3XRA-9PTE');
  });

  it('unlock with the right code switches the lock off; the wrong code does nothing', async () => {
    const code = 'K7QM-3XRA-9PTE';
    localStorage.setItem('appLock', JSON.stringify({ credentialId: 'x', recoveryHash: await sha256(code), timeoutMin: 1 }));
    expect(await unlockWithRecoveryCode('AAAA-BBBB-CCCC')).toBe(false);
    expect(getLock()).not.toBeNull();
    expect(await unlockWithRecoveryCode('k7qm3xra9pte')).toBe(true);
    expect(getLock()).toBeNull();
  });
});

describe('lock timing', () => {
  it('relocks only after the chosen time in the background', () => {
    expect(shouldRelock(null, 1_000_000, 1)).toBe(false);
    expect(shouldRelock(0, 59_999, 1)).toBe(false);
    expect(shouldRelock(0, 60_000, 1)).toBe(true);
    expect(shouldRelock(0, 1, 0)).toBe(true);
  });
});

describe('WebAuthn user-verified flag', () => {
  const authData = (flags: number) => { const b = new Uint8Array(37); b[32] = flags; return b.buffer; };
  it('requires both user-present and user-verified bits', () => {
    expect(userVerified(authData(0x05))).toBe(true);  // UP + UV
    expect(userVerified(authData(0x01))).toBe(false); // present but not verified
    expect(userVerified(authData(0x04))).toBe(false);
  });
});

describe('lock is per-device', () => {
  it('lives outside the database, so backups never carry it', () => {
    localStorage.setItem('appLock', JSON.stringify({ credentialId: 'x', recoveryHash: 'y', timeoutMin: 1 }));
    expect(getLock()?.credentialId).toBe('x');
    disableLock();
    expect(getLock()).toBeNull();
  });
});
