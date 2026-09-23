import { useEffect, useState } from 'react';
import {
  disableLock, enableLock, getLock, lockSupported, regenerateRecoveryCode, setLockTimeout, verifyUser,
} from '../lib/lock';
import { showToast } from '../components/Toast';
import { Loading, PageHeader } from '../components/ui';

const timeouts = [
  { min: 0, label: 'Immediately' },
  { min: 1, label: 'After 1 minute' },
  { min: 5, label: 'After 5 minutes' },
  { min: 15, label: 'After 15 minutes' },
];

/** Route: /more/security */
export default function SecurityScreen() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [lock, setLock] = useState(getLock);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { lockSupported().then(setSupported); }, []);
  const refresh = () => setLock(getLock());

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).name === 'NotAllowedError' ? 'Cancelled.' : (e as Error).message || 'Something went wrong.');
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const turnOn = () => run(async () => { setNewCode(await enableLock(1)); });

  const turnOff = () => run(async () => {
    if (!(await verifyUser())) throw new Error('Not verified.');
    disableLock();
    showToast('Fingerprint lock turned off');
  });

  const replaceCode = () => run(async () => {
    if (!(await verifyUser())) throw new Error('Not verified.');
    setNewCode(await regenerateRecoveryCode());
  });

  if (supported === null) return <><PageHeader title="Security" back="/more" /><Loading /></>;

  // Show the recovery code once, right after it's created.
  if (newCode) {
    return (
      <>
        <PageHeader title="Your recovery code" />
        <section className="card">
          <p style={{ marginTop: 0 }}>
            If fingerprint unlock ever stops working, this code gets you back in. <b>It won't be shown again.</b>
          </p>
          <div className="recovery-code" aria-label="Recovery code">{newCode}</div>
          <button className="btn block ghost" onClick={async () => {
            try { await navigator.clipboard.writeText(newCode); showToast('Copied'); } catch { showToast('Copy failed: write it down instead'); }
          }}>Copy code</button>
          <p className="muted small">
            Keep it somewhere other than this app: written on paper, in your email, or in Google Keep.
          </p>
          <button className="btn block" onClick={() => setNewCode(null)}>I've saved it</button>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Security" back="/more" />

      {!supported ? (
        <section className="card">
          <p style={{ margin: 0 }}>
            Fingerprint lock isn't available here. It needs a phone with a screen lock (fingerprint, PIN or pattern) set up,
            and the app opened in Chrome or installed from Chrome.
          </p>
        </section>
      ) : !lock ? (
        <section className="card">
          <div className="label">Fingerprint lock</div>
          <p className="small" style={{ marginTop: 0 }}>
            Ask for your fingerprint (or your phone's PIN or pattern) when the app opens. Stops anyone who picks up your
            unlocked phone from seeing your finances.
          </p>
          <button className="btn block" onClick={turnOn} disabled={busy}>Turn on fingerprint lock</button>
          <p className="muted small" style={{ marginBottom: 0 }}>
            You'll get a recovery code in case fingerprint unlock ever fails. The lock applies to this phone only;
            it isn't included in backups.
          </p>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="label">Fingerprint lock is on</div>
            <label className="field">
              <span>Lock again when the app has been in the background</span>
              <select value={lock.timeoutMin} onChange={(e) => { setLockTimeout(Number(e.target.value)); refresh(); }}>
                {timeouts.map((t) => <option key={t.min} value={t.min}>{t.label}</option>)}
              </select>
            </label>
            <p className="muted small" style={{ marginBottom: 0 }}>It always asks when the app is opened fresh.</p>
          </section>
          <button className="btn block ghost" onClick={replaceCode} disabled={busy}>Get a new recovery code</button>
          <button className="btn block ghost danger" onClick={turnOff} disabled={busy}>Turn off fingerprint lock</button>
        </>
      )}

      {error && <p className="error">{error}</p>}
      <p className="muted small">
        This lock stops people opening the app on your phone. It doesn't encrypt your data, so still keep your phone
        locked and your backup files private.
      </p>
    </>
  );
}
