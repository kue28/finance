import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteTransaction, saveSimple, saveTransfer } from './txOps';
import { computeBalances, isSpending } from '../lib/rules';
import type { Account } from './types';

let eco: Account, cash: Account;
const catId = async (name: string) => (await db.categories.filter((c) => c.name === name).first())!.id;
const balances = async () => computeBalances(await db.accounts.toArray(), await db.transactions.toArray());

beforeEach(async () => {
  await db.delete();
  await db.open();
  [eco, , cash] = await db.accounts.orderBy('sortOrder').toArray();
  await db.accounts.update(eco.id, { openingBalance: 10000 }); // $100 on EcoCash
});

describe('expenses and income', () => {
  it('adds and edits an expense', async () => {
    const id = await saveSimple({ kind: 'expense', date: '2026-09-23', amount: 350, accountId: eco.id, categoryId: await catId('Groceries'), note: '  bread ' });
    expect(await db.transactions.get(id)).toMatchObject({ amount: 350, note: 'bread' });
    await saveSimple({ kind: 'expense', date: '2026-09-23', amount: 500, accountId: eco.id, categoryId: await catId('Groceries'), note: '' }, id);
    const tx = await db.transactions.get(id);
    expect(tx?.amount).toBe(500);
    expect(tx?.note).toBeUndefined();
    expect((await balances()).get(eco.id)).toBe(9500);
  });
});

describe('transfers with fees', () => {
  it('creates a transfer plus a separate fee expense from the source account', async () => {
    const id = await saveTransfer({ date: '2026-09-23', amount: 5000, accountId: eco.id, toAccountId: cash.id, fee: 150, feeKey: 'fee_mobile' });
    const rows = await db.transactions.toArray();
    expect(rows).toHaveLength(2);
    const fee = rows.find((r) => r.feeForTransferId === id)!;
    expect(fee).toMatchObject({ kind: 'expense', amount: 150, accountId: eco.id, categoryId: await catId('Mobile money fees') });

    const b = await balances();
    expect(b.get(eco.id)).toBe(10000 - 5000 - 150);
    expect(b.get(cash.id)).toBe(5000);
    // Only the fee counts as spending.
    expect(rows.filter(isSpending).map((r) => r.amount)).toEqual([150]);
  });

  it('editing updates, switches or removes the fee', async () => {
    const id = await saveTransfer({ date: '2026-09-23', amount: 5000, accountId: eco.id, toAccountId: cash.id, fee: 150, feeKey: 'fee_mobile' });
    await saveTransfer({ date: '2026-09-24', amount: 4000, accountId: eco.id, toAccountId: cash.id, fee: 200, feeKey: 'fee_imtt' }, id);
    let fees = await db.transactions.where('feeForTransferId').equals(id).toArray();
    expect(fees).toHaveLength(1);
    expect(fees[0]).toMatchObject({ amount: 200, date: '2026-09-24', categoryId: await catId('IMTT') });

    await saveTransfer({ date: '2026-09-24', amount: 4000, accountId: eco.id, toAccountId: cash.id, fee: 0, feeKey: 'fee_imtt' }, id);
    fees = await db.transactions.where('feeForTransferId').equals(id).toArray();
    expect(fees).toHaveLength(0);
    expect((await balances()).get(eco.id)).toBe(6000);
  });

  it('rejects a transfer to the same account', async () => {
    await expect(saveTransfer({ date: '2026-09-23', amount: 100, accountId: eco.id, toAccountId: eco.id, fee: 0, feeKey: 'fee_mobile' }))
      .rejects.toThrow();
  });

  it('deleting a transfer deletes its fee too', async () => {
    const id = await saveTransfer({ date: '2026-09-23', amount: 5000, accountId: eco.id, toAccountId: cash.id, fee: 150, feeKey: 'fee_bank' });
    await deleteTransaction(id);
    expect(await db.transactions.count()).toBe(0);
    expect((await balances()).get(eco.id)).toBe(10000);
  });
});
