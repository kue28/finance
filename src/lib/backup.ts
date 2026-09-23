import { db, setSetting } from '../db/db';
import { today } from './dates';

// Backup file format. Restoring from this file arrives in Phase 8; the format
// is versioned so older backups can still be read after the app grows.
export const BACKUP_FORMAT = 'finance-backup';
export const BACKUP_VERSION = 1;

export async function buildBackup() {
  const [accounts, categories, transactions, settings, budgets, recurring, goals, loans] = await Promise.all([
    db.accounts.toArray(), db.categories.toArray(), db.transactions.toArray(), db.settings.toArray(),
    db.budgets.toArray(), db.recurring.toArray(), db.goals.toArray(), db.loans.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { accounts, categories, transactions, settings, budgets, recurring, goals, loans },
  };
}

/**
 * Export all data as a JSON file. On Android this opens the share sheet
 * (Drive, WhatsApp, Gmail…); elsewhere it downloads the file.
 * Returns false if the user cancelled the share sheet.
 */
export async function exportBackup(): Promise<boolean> {
  const backup = await buildBackup();
  const name = `finance-backup-${today()}.json`;
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      download(file);
    }
  } else {
    download(file);
  }
  await setSetting('lastBackupAt', Date.now());
  return true;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
