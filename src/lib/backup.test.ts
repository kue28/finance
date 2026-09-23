import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { saveSimple, saveTransfer } from '../db/txOps';
import { addAccount } from '../db/ops';
import { contribute, saveGoal } from '../db/goalOps';
import { createLoan } from '../db/loanOps';
import { setBudget } from '../db/budgetOps';
import { saveRecurring } from '../db/recurringOps';
import { computeBalances } from './rules';
import { backupReminderDays, buildBackup, parseBackup, restoreBackup, BackupError, type Backup } from './backup';
import { csvField, transactionsToCsv } from './csv';

const snapshot = async () => {
  const b = await buildBackup();
  return { ...b.data, exportedAt: undefined };
};

async function fillSampleData() {
  const [eco, , cash] = await db.accounts.orderBy('sortOrder').toArray();
  const cat = async (n: string) => (await db.categories.filter((c) => c.name === n).first())!;
  await db.accounts.update(eco.id, { openingBalance: 10000 });
  await saveSimple({ kind: 'expense', date: '2026-09-02', amount: 350, accountId: eco.id, categoryId: (await cat('Groceries')).id, note: 'bread, "fresh"' });
  await saveTransfer({ date: '2026-09-03', amount: 2000, accountId: eco.id, toAccountId: cash.id, fee: 50, feeKey: 'fee_mobile' });
  const sav = await addAccount('Savings', 'savings', 0);
  const g = await saveGoal({ name: 'Laptop', target: 50000, accountId: sav });
  await contribute(g, eco.id, { amount: 1000, date: '2026-09-04' });
  await createLoan({ person: 'Tendai', amount: 500, dateLent: '2026-09-05', fromAccountId: cash.id });
  await setBudget('2026-09', (await cat('Food')).id, 20000);
  await saveRecurring({ kind: 'expense', amount: 15000, categoryId: (await cat('Rent')).id, accountId: eco.id,
    every: 1, unit: 'month', startDate: '2026-10-01' });
}

beforeEach(async () => { await db.delete(); await db.open(); });

describe('backup round trip', () => {
  it('restoring a backup brings back exactly the same data and balances', async () => {
    await fillSampleData();
    const before = await snapshot();
    const balancesBefore = computeBalances(before.accounts, before.transactions);
    const text = JSON.stringify(await buildBackup());

    // Wipe and start fresh (as on a new phone), then restore.
    await db.delete(); await db.open();
    await restoreBackup(parseBackup(text));

    const after = await snapshot();
    const sortById = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id));
    for (const k of ['accounts', 'categories', 'transactions', 'budgets', 'recurring', 'goals', 'loans'] as const) {
      expect(sortById(after[k] as { id: string }[])).toEqual(sortById(before[k] as { id: string }[]));
    }
    expect(computeBalances(after.accounts, after.transactions)).toEqual(balancesBefore);
  });

  it('restore replaces existing data rather than merging', async () => {
    await fillSampleData();
    const backup = await buildBackup();
    const eco = (await db.accounts.orderBy('sortOrder').first())!;
    await saveSimple({ kind: 'expense', date: '2026-09-20', amount: 999, accountId: eco.id,
      categoryId: (await db.categories.filter((c) => c.name === 'Snacks').first())!.id });
    await restoreBackup(backup);
    expect(await db.transactions.filter((t) => t.amount === 999).count()).toBe(0);
  });

  it('an older backup without the newer tables still restores', async () => {
    const b = await buildBackup();
    const old = { ...b, data: { accounts: b.data.accounts, categories: b.data.categories, transactions: [], settings: [] } };
    const parsed = parseBackup(JSON.stringify(old));
    expect(parsed.data.goals).toEqual([]);
    await restoreBackup(parsed);
    expect(await db.accounts.count()).toBe(4);
  });
});

describe('rejecting bad files (existing data untouched)', () => {
  const bad = async (text: string, msg: RegExp) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(() => parseBackup(text)).toThrow(msg);
  };
  it('not JSON / wrong app / too new / damaged', async () => {
    const good = await buildBackup();
    await bad('hello', /not JSON/);
    await bad(JSON.stringify({ format: 'other' }), /isn't a backup from this app/);
    await bad(JSON.stringify({ ...good, version: 99 }), /newer version/);
    await bad(JSON.stringify({ ...good, data: { ...good.data, transactions: [{ id: 'x', kind: 'expense', amount: 1.5, date: '2026-09-01', accountId: 'a' }] } }), /damaged/);
    await bad(JSON.stringify({ ...good, data: { ...good.data, transactions: [{ id: 'x', kind: 'expense', amount: 100, date: '2026-09-01', accountId: 'missing' }] } }), /missing account/);
    await bad(JSON.stringify({ ...good, data: { ...good.data, accounts: [] } }), /no accounts/);
  });

  it('a restore that fails part-way changes nothing', async () => {
    await fillSampleData();
    const before = await snapshot();
    const broken = (await buildBackup()) as Backup;
    // Two transactions with the same id → the database rejects the second insert.
    broken.data.transactions = [broken.data.transactions[0], broken.data.transactions[0]];
    await expect(restoreBackup(broken)).rejects.toThrow();
    expect((await snapshot()).transactions.length).toBe(before.transactions.length);
  });
});

describe('backup reminder', () => {
  const day = 86_400_000, now = 100 * day;
  it('due after 7 days, counting from first use if never backed up', () => {
    expect(backupReminderDays(now - 6 * day, null, null, now)).toBeNull();
    expect(backupReminderDays(now - 7 * day, null, null, now)).toBe(7);
    expect(backupReminderDays(null, now - 10 * day, null, now)).toBe(10);
    expect(backupReminderDays(null, null, null, now)).toBeNull(); // no data yet
    expect(backupReminderDays(now - 9 * day, null, now + 1000, now)).toBeNull(); // snoozed
  });
});

describe('CSV', () => {
  it('escapes fields and writes one row per transaction', async () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    await fillSampleData();
    const txs = await db.transactions.toArray();
    const [accounts, categories, goals, loans] = await Promise.all([db.accounts.toArray(), db.categories.toArray(), db.goals.toArray(), db.loans.toArray()]);
    const csv = transactionsToCsv(txs, {
      accounts: new Map(accounts.map((a) => [a.id, a])), categories: new Map(categories.map((c) => [c.id, c])),
      goals: new Map(goals.map((g) => [g.id, g])), loans: new Map(loans.map((l) => [l.id, l])),
    });
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines).toHaveLength(txs.length + 1);
    expect(csv).toContain('2026-09-02,Expense,3.50,-3.50,EcoCash,,Food,Groceries,"bread, ""fresh"""');
    expect(csv).toContain('Money lent,5.00,-5.00,Cash');
    expect(csv).toMatch(/Mobile money fees,.*,Yes/);
  });
});
