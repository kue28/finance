import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, FinanceDB } from '../db/db';
import { copyBudgets, setBudget } from '../db/budgetOps';
import { saveSimple, saveTransfer } from '../db/txOps';
import type { Transaction } from '../db/types';
import { budgetState, spentByMainCategory } from './budget';

const cat = async (name: string) => (await db.categories.filter((c) => c.name === name).first())!;

describe('budgetState thresholds', () => {
  it('ok below 80%, warn 80–100%, over above 100%', () => {
    expect(budgetState(7999, 10000)).toBe('ok');
    expect(budgetState(8000, 10000)).toBe('warn');
    expect(budgetState(10000, 10000)).toBe('warn');
    expect(budgetState(10001, 10000)).toBe('over');
  });
});

describe('spentByMainCategory', () => {
  beforeEach(async () => { await db.delete(); await db.open(); });

  it('counts expenses, fees and write-offs by main category, within the month only', async () => {
    const [eco, , cash] = await db.accounts.orderBy('sortOrder').toArray();
    const groceries = await cat('Groceries');
    const snacks = await cat('Snacks');
    const badDebts = await cat('Bad debts');
    await saveSimple({ kind: 'expense', date: '2026-09-02', amount: 1000, accountId: eco.id, categoryId: groceries.id });
    await saveSimple({ kind: 'expense', date: '2026-09-30', amount: 250, accountId: eco.id, categoryId: snacks.id });
    await saveSimple({ kind: 'expense', date: '2026-10-01', amount: 9999, accountId: eco.id, categoryId: groceries.id }); // next month
    await saveSimple({ kind: 'expense', date: '2026-08-31', amount: 9999, accountId: eco.id, categoryId: groceries.id }); // last month
    await saveSimple({ kind: 'income', date: '2026-09-05', amount: 50000, accountId: eco.id, categoryId: (await cat('Salary')).id });
    await saveTransfer({ date: '2026-09-10', amount: 5000, accountId: eco.id, toAccountId: cash.id, fee: 120, feeKey: 'fee_mobile' });
    // A write-off (added directly here; loans come in Phase 6).
    const writeoff: Transaction = { id: 'w1', kind: 'writeoff', date: '2026-09-15', amount: 700, accountId: cash.id,
      categoryId: badDebts.id, createdAt: 0, updatedAt: 0 };
    const lend: Transaction = { id: 'l1', kind: 'lend', date: '2026-09-15', amount: 3000, accountId: cash.id, createdAt: 0, updatedAt: 0 };
    await db.transactions.bulkAdd([writeoff, lend]);

    const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
    const spent = spentByMainCategory(await db.transactions.toArray(), cats, '2026-09');
    expect(spent.get(groceries.parentId!)).toBe(1250);        // Food: groceries + snacks
    expect(spent.get((await cat('Mobile money fees')).parentId!)).toBe(120); // Charges: only the fee
    expect(spent.get(badDebts.parentId!)).toBe(700);          // Other: the write-off
    expect([...spent.values()].reduce((a, b) => a + b)).toBe(1250 + 120 + 700); // no transfer, lend or income
  });
});

describe('budget ops', () => {
  beforeEach(async () => { await db.delete(); await db.open(); });

  it('sets, updates and removes a limit', async () => {
    const food = await cat('Food');
    await setBudget('2026-09', food.id, 20000);
    await setBudget('2026-09', food.id, 25000);
    expect(await db.budgets.where('month').equals('2026-09').toArray()).toMatchObject([{ limit: 25000 }]);
    await setBudget('2026-09', food.id, null);
    expect(await db.budgets.count()).toBe(0);
  });

  it('copies last month without overwriting or copying archived categories', async () => {
    const food = await cat('Food');
    const transport = await cat('Transport');
    const education = await cat('Education');
    await setBudget('2026-09', food.id, 20000);
    await setBudget('2026-09', transport.id, 5000);
    await setBudget('2026-09', education.id, 1000);
    await db.categories.update(education.id, { archived: true });
    await setBudget('2026-10', transport.id, 7000); // already set in October

    expect(await copyBudgets('2026-09', '2026-10')).toBe(1);
    const oct = new Map((await db.budgets.where('month').equals('2026-10').toArray()).map((b) => [b.categoryId, b.limit]));
    expect(oct.get(food.id)).toBe(20000);
    expect(oct.get(transport.id)).toBe(7000);
    expect(oct.has(education.id)).toBe(false);
    // September untouched: no rollovers, months are independent.
    expect(await db.budgets.where('month').equals('2026-09').count()).toBe(3);
  });
});

describe('upgrading an existing phone database', () => {
  it('keeps v1 data through every upgrade (budgets … loans, icons)', async () => {
    db.close();
    await Dexie.delete('finance');
    // Simulate the Phase 1/2 database already on the phone.
    const old = new Dexie('finance');
    old.version(1).stores({
      accounts: 'id, sortOrder', categories: 'id, kind, parentId, sortOrder',
      transactions: 'id, date, accountId, toAccountId, categoryId, kind, feeForTransferId, goalId, loanId',
      settings: 'key',
    });
    await old.table('accounts').add({ id: 'a1', name: 'EcoCash', type: 'mobile_wallet', openingBalance: 500, archived: false, sortOrder: 0 });
    await old.table('transactions').add({ id: 't1', kind: 'expense', date: '2026-09-01', amount: 100, accountId: 'a1' });
    await old.table('categories').bulkAdd([
      { id: 'c1', name: 'Groceries', kind: 'expense', parentId: 'c0', archived: false, sortOrder: 0 },
      { id: 'c2', name: 'My own thing', kind: 'expense', parentId: 'c0', archived: false, sortOrder: 1 },
    ]);
    old.close();

    const upgraded = new FinanceDB();
    await upgraded.open();
    expect(await upgraded.accounts.get('a1')).toMatchObject({ name: 'EcoCash', openingBalance: 500 });
    expect(await upgraded.transactions.count()).toBe(1);
    expect(await upgraded.budgets.count()).toBe(0);
    // v6: known categories get their default icon; the user's own ones are left alone.
    expect((await upgraded.categories.get('c1'))?.icon).toBe('shopping-cart');
    expect((await upgraded.categories.get('c2'))?.icon).toBeUndefined();
    upgraded.close();
    await db.open();
  });
});
