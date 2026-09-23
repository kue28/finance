import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getLock, shouldRelock, unlockWithRecoveryCode, verifyUser } from '../lib/lock';

/**
 * Shows the lock screen when the app lock is on: at start-up, and after the
 * app has been in the background longer than the chosen time. The app stays
 * mounted (just hidden) behind the lock, so a half-typed entry isn't lost.
 */
export default function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => getLock() !== null);
  const [everUnlocked, setEverUnlocked] = useState(!locked);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    function onVisibility() {
      const lock = getLock();
      if (!lock) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        // "Immediately": lock now, so the app switcher doesn't show your data next time.
        if (lock.timeoutMin === 0) setLocked(true);
      } else if (shouldRelock(hiddenAt.current, Date.now(), lock.timeoutMin)) {
        setLocked(true);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const unlocked = useCallback(() => {
    hiddenAt.current = null;
    setLocked(false);
    setEverUnlocked(true);
  }, []);

  return (
    <>
      {everUnlocked && <div hidden={locked}>{children}</div>}
      {locked && <LockScreen onUnlocked={unlocked} />}
    </>
  );
}

function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [code, setCode] = useState('');
  const asking = useRef(false); // only one fingerprint prompt at a time

  const tryUnlock = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    setBusy(true);
    setError('');
    try {
      if (await verifyUser()) onUnlocked();
      else setError('Not verified. Try again.');
    } catch (e) {
      // NotAllowedError = cancelled or timed out; anything else is unexpected.
      setError((e as Error).name === 'NotAllowedError'
        ? 'Cancelled. Tap Unlock to try again.'
        : 'Fingerprint unlock isn\'t working. You can use your recovery code.');
    } finally {
      asking.current = false;
      setBusy(false);
    }
  }, [onUnlocked]);

  // Ask straight away when the lock screen appears.
  useEffect(() => { void tryUnlock(); }, [tryUnlock]);

  async function useCode() {
    if (await unlockWithRecoveryCode(code)) {
      onUnlocked();
      alert('Unlocked with your recovery code. The fingerprint lock is now off. Turn it on again in More → Security.');
    } else {
      setError('That recovery code doesn\'t match.');
    }
  }

  return (
    <div className="lock-screen" role="dialog" aria-label="App locked">
      <div className="lock-inner">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <h1>Finance is locked</h1>
        {!recovering ? (
          <>
            <button className="btn block" onClick={tryUnlock} disabled={busy}>Unlock</button>
            <p className="muted small">Use your fingerprint, or your phone's PIN or pattern.</p>
            <button className="link-btn" onClick={() => { setRecovering(true); setError(''); }}>Use recovery code</button>
          </>
        ) : (
          <>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX"
              autoCapitalize="characters" autoComplete="off" autoFocus className="code-input" />
            <button className="btn block" onClick={useCode} disabled={code.trim().length < 12}>Unlock with code</button>
            <button className="link-btn" onClick={() => { setRecovering(false); setError(''); }}>Back to fingerprint</button>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
