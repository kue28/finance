// ============================================================================
// APP LOCK (fingerprint / phone screen lock)
//
// Uses WebAuthn with the phone's built-in authenticator: Android shows its
// normal fingerprint prompt, with the phone PIN/pattern as a fallback. There
// is no server, so this is a *gate*, not encryption: it stops someone who
// picks up your unlocked phone from opening the app, but the data itself is
// stored unencrypted as before.
//
// Settings live in localStorage (per device), deliberately NOT in the
// database, so they're never included in backups. Restoring a backup on a new
// phone must not switch on a lock tied to the old phone's fingerprint key.
// ============================================================================

const KEY = 'appLock';

export interface LockSettings {
  credentialId: string;   // base64url id of the passkey created for the lock
  recoveryHash: string;   // SHA-256 of the recovery code (the code itself is never stored)
  timeoutMin: number;     // lock again after this many minutes in the background (0 = immediately)
}

export function getLock(): LockSettings | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LockSettings) : null;
  } catch {
    return null;
  }
}

function saveLock(s: LockSettings | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
}

export function setLockTimeout(timeoutMin: number) {
  const s = getLock();
  if (s) saveLock({ ...s, timeoutMin });
}

export function disableLock() {
  saveLock(null);
}

/** Does this phone/browser have a fingerprint or screen-lock authenticator? */
export async function lockSupported(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- helpers

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return b64url(digest);
}

// No 0/O, 1/I/L: easy to read back from a note.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A recovery code like "K7QM-3XRA-9PTE". */
export function newRecoveryCode(bytes: Uint8Array = randomBytes(12)): string {
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Normalise what the user typed: case, spaces and dashes don't matter. */
export function normaliseCode(input: string): string {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 12 ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}` : c;
}

/**
 * WebAuthn authenticator data: byte 32 holds flags. Bit 0 = user present,
 * bit 2 = user verified (fingerprint/PIN actually checked).
 */
export function userVerified(authData: ArrayBuffer): boolean {
  const flags = new Uint8Array(authData)[32] ?? 0;
  return (flags & 0x01) !== 0 && (flags & 0x04) !== 0;
}

/** Should the app lock after being in the background since `hiddenAt`? */
export function shouldRelock(hiddenAt: number | null, now: number, timeoutMin: number): boolean {
  if (hiddenAt === null) return false;
  return now - hiddenAt >= timeoutMin * 60_000;
}

// ---------------------------------------------------------------- enable / unlock

/**
 * Turn the lock on: Android asks for your fingerprint (or PIN) to create a
 * passkey for this app. Returns the recovery code to show ONCE.
 */
export async function enableLock(timeoutMin = 1): Promise<string> {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'Finance' },
      user: { id: randomBytes(16), name: 'Finance app lock', displayName: 'Finance app lock' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('Fingerprint setup was cancelled.');
  const code = newRecoveryCode();
  saveLock({ credentialId: b64url(cred.rawId), recoveryHash: await sha256(code), timeoutMin });
  return code;
}

/** Ask for fingerprint/PIN. Resolves true only if the phone verified you. */
export async function verifyUser(): Promise<boolean> {
  const s = getLock();
  if (!s) return true;
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: fromB64url(s.credentialId) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  }) as PublicKeyCredential | null;
  if (!assertion) return false;
  return userVerified((assertion.response as AuthenticatorAssertionResponse).authenticatorData);
}

/** Unlock with the recovery code. On success the lock is switched off (set it up again after). */
export async function unlockWithRecoveryCode(input: string): Promise<boolean> {
  const s = getLock();
  if (!s) return true;
  if ((await sha256(normaliseCode(input))) !== s.recoveryHash) return false;
  disableLock();
  return true;
}

/** Replace the recovery code (after verifying the user). Returns the new code. */
export async function regenerateRecoveryCode(): Promise<string> {
  const s = getLock();
  if (!s) throw new Error('The lock is off.');
  const code = newRecoveryCode();
  saveLock({ ...s, recoveryHash: await sha256(code) });
  return code;
}
