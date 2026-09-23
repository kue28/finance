import { db, getSetting, setSetting } from '../db/db';
import type { Account, Budget, Category, Goal, Loan, Recurring, Setting, Transaction } from '../db/types';
import { today } from './dates';

// ============================================================================
// BACKUP & RESTORE
// A backup is one JSON file holding every table. The format is versioned:
// tables added in later versions are optional when reading, so an older
// backup can always be restored into a newer app.
// Restore REPLACES everything, inside a single database transaction: if
// anything fails half-way, nothing is changed.
// ============================================================================

export const BACKUP_FORMAT = 'finance-backup';
export const BACKUP_VERSION = 1;

export interface BackupData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  settings: Setting[];
  budgets: Budget[];
  recurring: Recurring[];
  goals: Goal[];
  loans: Loan[];
}

export interface Backup {
  format: string;
  version: number;
  exportedAt: string;
  data: BackupData;
}

export async function buildBackup(): Promise<Backup> {
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
 * Export all data as a JSON file via the share sheet (Drive, WhatsApp,
 * Gmail…) or a download. Returns false if the user cancelled.
 */
export async function exportBackup(): Promise<boolean> {
  const backup = await buildBackup();
  const name = `finance-backup-${today()}.json`;
  const ok = await shareOrDownload(new File([JSON.stringify(backup)], name, { type: 'application/json' }));
  if (ok) await setSetting('lastBackupAt', Date.now());
  return ok;
}

/** Share a file on phones that support it, otherwise download it. False if cancelled. */
export async function shareOrDownload(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      // Some share targets fail; fall back to a normal download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// ---------------------------------------------------------------- reading a backup

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown) => typeof v === 'string' && v.length > 0;
const isCents = (v: unknown) => Number.isInteger(v);
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const txKinds = new Set(['income', 'expense', 'transfer', 'lend', 'repayment', 'writeoff']);

function table<T>(data: Record<string, unknown>, key: string, required: boolean, check: (r: Record<string, unknown>) => boolean): T[] {
  const rows = data[key];
  if (rows === undefined && !required) return [];
  if (!Array.isArray(rows)) throw new BackupError(`The backup is missing its ${key}.`);
  rows.forEach((r, i) => {
    if (!isObj(r) || !check(r)) throw new BackupError(`The backup looks damaged (${key}, item ${i + 1}).`);
  });
  return rows as T[];
}

/** Parse and check a backup file's text. Throws BackupError with a readable message. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new BackupError('This file isn\'t a valid backup (not JSON).'); }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError('This file isn\'t a backup from this app.');
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new BackupError('This backup is from a newer version of the app. Update the app first.');
  }
  if (!isObj(raw.data)) throw new BackupError('The backup has no data.');
  const d = raw.data;

  const data: BackupData = {
    accounts: table(d, 'accounts', true, (r) => isStr(r.id) && typeof r.name === 'string' && isCents(r.openingBalance)),
    categories: table(d, 'categories', true, (r) => isStr(r.id) && typeof r.name === 'string' && (r.kind === 'expense' || r.kind === 'income')),
    transactions: table(d, 'transactions', true, (r) =>
      isStr(r.id) && txKinds.has(r.kind as string) && isCents(r.amount) && (r.amount as number) >= 0
      && isDate(r.date) && isStr(r.accountId)),
    settings: table(d, 'settings', true, (r) => isStr(r.key)),
    budgets: table(d, 'budgets', false, (r) => isStr(r.id) && isStr(r.categoryId) && isCents(r.limit)),
    recurring: table(d, 'recurring', false, (r) => isStr(r.id) && isCents(r.amount) && isDate(r.startDate)),
    goals: table(d, 'goals', false, (r) => isStr(r.id) && isCents(r.target) && isStr(r.accountId)),
    loans: table(d, 'loans', false, (r) => isStr(r.id) && isCents(r.amount) && isStr(r.fromAccountId)),
  };
  if (data.accounts.length === 0) throw new BackupError('The backup has no accounts.');

  // Every transaction must point at an account that exists in the backup.
  const accountIds = new Set(data.accounts.map((a) => a.id));
  const orphan = data.transactions.find((t) => !accountIds.has(t.accountId) || (t.toAccountId && !accountIds.has(t.toAccountId)));
  if (orphan) throw new BackupError('The backup looks damaged (a transaction refers to a missing account).');

  return { format: BACKUP_FORMAT, version: raw.version, exportedAt: String(raw.exportedAt ?? ''), data };
}

/** Replace ALL data with the backup's, atomically. */
export async function restoreBackup(backup: Backup) {
  const { data } = backup;
  const tables = [db.accounts, db.categories, db.transactions, db.settings, db.budgets, db.recurring, db.goals, db.loans];
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await db.accounts.bulkAdd(data.accounts);
    await db.categories.bulkAdd(data.categories);
    await db.transactions.bulkAdd(data.transactions);
    await db.settings.bulkAdd(data.settings);
    await db.budgets.bulkAdd(data.budgets);
    await db.recurring.bulkAdd(data.recurring);
    await db.goals.bulkAdd(data.goals);
    await db.loans.bulkAdd(data.loans);
  });
}

// ---------------------------------------------------------------- reminder

export const REMIND_AFTER_DAYS = 7;
const DAY = 86_400_000;

/**
 * Days since the last backup, if a reminder is due (else null). With no
 * backup ever, it counts from the first transaction, so a brand-new install
 * isn't nagged. "Later" snoozes the reminder for a day.
 */
export function backupReminderDays(
  lastBackupAt: number | null, firstDataAt: number | null, snoozedUntil: number | null, now: number,
): number | null {
  if (snoozedUntil && now < snoozedUntil) return null;
  const since = lastBackupAt ?? firstDataAt;
  if (since === null) return null;
  const days = Math.floor((now - since) / DAY);
  return days >= REMIND_AFTER_DAYS ? days : null;
}

export function snoozeBackupReminder() {
  return setSetting('backupReminderSnoozedUntil', Date.now() + DAY);
}

export async function loadReminderInputs() {
  const [last, snoozed] = await Promise.all([
    getSetting<number | null>('lastBackupAt', null),
    getSetting<number | null>('backupReminderSnoozedUntil', null),
  ]);
  // When was the first transaction entered (not its date, which may be backdated)?
  let first: number | null = null;
  if (last === null) {
    await db.transactions.each((t) => { if (first === null || t.createdAt < first) first = t.createdAt; });
  }
  return { last, snoozed, first };
}
