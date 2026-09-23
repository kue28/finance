import Dexie, { type EntityTable } from 'dexie';
import type { Account, Budget, Category, Goal, Loan, Recurring, Setting, Transaction } from './types';
import { seed } from './seed';

// IndexedDB database. Tables for budgets, recurring items, goals and loans are
// added in later phases by bumping the version number (Dexie migrates in place,
// existing data is kept).
export class FinanceDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  budgets!: EntityTable<Budget, 'id'>;
  recurring!: EntityTable<Recurring, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  loans!: EntityTable<Loan, 'id'>;

  constructor() {
    super('finance');
    // Only indexed fields are listed here; all other fields are still stored.
    this.version(1).stores({
      accounts: 'id, sortOrder',
      categories: 'id, kind, parentId, sortOrder',
      transactions: 'id, date, accountId, toAccountId, categoryId, kind, feeForTransferId, goalId, loanId',
      settings: 'key',
    });
    // v2 (Phase 3): monthly budgets. Existing data is untouched.
    this.version(2).stores({
      budgets: 'id, month, [month+categoryId]',
    });
    // v3 (Phase 4): recurring income/expenses.
    this.version(3).stores({
      recurring: 'id, nextDueDate',
    });
    // v4 (Phase 5): savings goals.
    this.version(4).stores({
      goals: 'id, sortOrder',
    });
    // v5 (Phase 6): money lent out.
    this.version(5).stores({
      loans: 'id, person',
    });
    // Runs once, only when the database is first created on this device.
    this.on('populate', (tx) => seed(tx));
  }
}

export const db = new FinanceDB();

/** Short random ID. crypto.randomUUID needs HTTPS, so fall back for LAN testing. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---- Settings helpers ----

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value });
}
