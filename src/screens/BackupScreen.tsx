import { useRef, useState, type ChangeEvent } from 'react';
import { useLocation } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../db/db';
import { useLookups } from '../db/hooks';
import { BackupError, exportBackup, parseBackup, restoreBackup, shareOrDownload, type Backup } from '../lib/backup';
import { transactionsToCsv } from '../lib/csv';
import { today } from '../lib/dates';
import { showToast } from '../components/Toast';
import { PageHeader } from '../components/ui';

/** Route: /more/backup */
export default function BackupScreen() {
  const lastBackupAt = useLiveQuery(() => getSetting<number | null>('lastBackupAt', null), []);
  const txCount = useLiveQuery(() => db.transactions.count(), []);
  const lookups = useLookups();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState('');

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }

  const backupJson = () => run(async () => { if (await exportBackup()) showToast('Backup exported'); });

  const exportCsv = () => run(async () => {
    if (!lookups) return;
    const txs = (await db.transactions.toArray()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
    const file = new File([transactionsToCsv(txs, lookups)], `finance-transactions-${today()}.csv`, { type: 'text/csv' });
    if (await shareOrDownload(file)) showToast('CSV exported');
  });

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setError('');
    try {
      setPending(parseBackup(await file.text()));
    } catch (err) {
      setError(err instanceof BackupError ? err.message : 'Could not read that file.');
    }
  }

  return (
    <>
      <PageHeader title="Backup & restore" back="/more" />

      <section className="card">
        <div className="label">Back up</div>
        <p className="small" style={{ marginTop: 0 }}>
          Your data lives only on this phone. If the phone is lost or the app is cleared, a backup is the only way to get it back.
          Save it to Google Drive, or send it to yourself on WhatsApp or email.
        </p>
        <button className="btn block" onClick={backupJson} disabled={busy}>Export backup (JSON)</button>
        <div className="muted small">
          {lastBackupAt ? `Last backup: ${new Date(lastBackupAt).toLocaleString()}` : 'No backup yet.'}
        </div>
      </section>

      <section className="card">
        <div className="label">Spreadsheet</div>
        <p className="small" style={{ marginTop: 0 }}>All transactions as a CSV file for Excel or Google Sheets. (This is not a backup; it can't be restored.)</p>
        <button className="btn block ghost" onClick={exportCsv} disabled={busy || !lookups}>
          Export transactions (CSV){txCount ? ` · ${txCount}` : ''}
        </button>
      </section>

      <section className="card">
        <div className="label">Restore</div>
        <p className="small" style={{ marginTop: 0 }}>
          Load a backup file. <b>This replaces everything on this phone</b> with what's in the backup. You'll see what's in the file and confirm first.
        </p>
        <button className="btn block ghost" onClick={() => fileInput.current?.click()} disabled={busy}>Choose backup file…</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={pickFile} />
      </section>

      {error && <p className="error">{error}</p>}

      {pending && (
        <RestoreSheet backup={pending} currentTxCount={txCount ?? 0} onClose={() => setPending(null)} />
      )}
    </>
  );
}

function RestoreSheet({ backup, currentTxCount, onClose }: { backup: Backup; currentTxCount: number; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const d = backup.data;
  const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString() : 'unknown date';

  async function backupFirst() {
    setBusy(true);
    try { if (await exportBackup()) showToast('Current data backed up'); } finally { setBusy(false); }
  }

  async function replace() {
    setBusy(true);
    setError('');
    try {
      await restoreBackup(backup);
      showToast('Backup restored');
      navigate('/');
    } catch {
      // The restore runs in one database transaction, so a failure changes nothing.
      setError('Restore failed. Your existing data has not been changed.');
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={busy ? undefined : onClose}>
      <div className="sheet form" role="alertdialog" aria-label="Replace all data?" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, color: 'var(--expense)' }}>Replace all your data?</h2>
        <div className="notice small">
          <div><b>Backup from:</b> {when}</div>
          <div>{d.accounts.length} accounts · {d.transactions.length} transactions · {d.budgets.length} budget limits</div>
          <div>{d.recurring.length} recurring · {d.goals.length} goals · {d.loans.length} loans</div>
        </div>
        <p className="small" style={{ margin: 0 }}>
          Everything currently on this phone, including <b>{currentTxCount} transactions</b>, will be permanently replaced.
          This can't be undone unless you back up first.
        </p>
        <button className="btn block ghost" onClick={backupFirst} disabled={busy}>Back up current data first</button>
        <label className="check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>I understand my current data will be replaced</span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn block danger-fill" onClick={replace} disabled={!understood || busy}>Replace my data</button>
        <button className="btn block ghost" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
