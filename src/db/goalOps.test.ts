import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { contribute, currentSaved, deleteGoal, saveGoal, withdraw } from './goalOps';
import { addAccount } from './ops';
import { saveTransfer } from './txOps';
import { computeBalances, isIncome, isSpending } from '../lib/rules';
import { monthsLeft, perMonthNeeded } from '../lib/goals';
import type { Account } from './types';

describe('goal maths', () => {
  it('counts calendar months including this one and the deadline month', () => {
    expect(monthsLeft('2026-12-31', '2026-09-23')).toBe(4);
    expect(monthsLeft('2026-09-30', '2026-09-23')).toBe(1);
    expect(monthsLeft('2027-01-05', '2026-09-23')).toBe(5);
    expect(monthsLeft('2026-09-22', '2026-09-23')).toBe(0);
  });
  it('per-month amount, rounded up; null after the deadline; 0 when reached', () => {
    expect(perMonthNeeded(100000, 20000, '2026-12-31', '2026-09-23')).toBe(20000);
    expect(perMonthNeeded(10000, 0, '2026-11-30', '2026-09-23')).toBe(3334);
    expect(perMonthNeeded(10000, 0, '2026-09-01', '2026-09-23')).toBeNull();
    expect(perMonthNeeded(10000, 12000, '2026-12-31', '2026-09-23')).toBe(0);
  });
});

describe('goal ops', () => {
  let eco: Account, cash: Account, savingsId: string;
  beforeEach(async () => {
    await db.delete();
    await db.open();
    [eco, , cash] = await db.accounts.orderBy('sortOrder').toArray();
    await db.accounts.update(eco.id, { openingBalance: 50000 });
    savingsId = await addAccount('Savings envelope', 'savings', 0);
  });

  it('contributions are transfers: balances move, nothing counts as spending or income', async () => {
    const goalId = await saveGoal({ name: 'Laptop', target: 60000, accountId: savingsId });
    await contribute(goalId, eco.id, { amount: 10000, date: '2026-09-23' });
    await contribute(goalId, eco.id, { amount: 5000, date: '2026-09-24' });
    await withdraw(goalId, cash.id, { amount: 3000, date: '2026-09-25' });

    expect(await currentSaved(goalId)).toBe(12000);
    const txs = await db.transactions.toArray();
    expect(txs.every((t) => t.kind === 'transfer' && t.goalId === goalId)).toBe(true);
    expect(txs.some(isSpending) || txs.some(isIncome)).toBe(false);
    const b = computeBalances(await db.accounts.toArray(), txs);
    expect(b.get(eco.id)).toBe(35000);
    expect(b.get(savingsId)).toBe(12000);
    expect(b.get(cash.id)).toBe(3000);
  });

  it('two goals can share one account without mixing up their totals', async () => {
    const a = await saveGoal({ name: 'A', target: 10000, accountId: savingsId });
    const b = await saveGoal({ name: 'B', target: 10000, accountId: savingsId });
    await contribute(a, eco.id, { amount: 4000, date: '2026-09-23' });
    await contribute(b, eco.id, { amount: 1000, date: '2026-09-23' });
    // An ordinary untagged transfer into the same account doesn't count for either goal.
    await saveTransfer({ date: '2026-09-23', amount: 999, accountId: eco.id, toAccountId: savingsId, fee: 0, feeKey: 'fee_mobile' });
    expect(await currentSaved(a)).toBe(4000);
    expect(await currentSaved(b)).toBe(1000);
  });

  it('cannot withdraw more than saved, or use the goal account itself', async () => {
    const g = await saveGoal({ name: 'Trip', target: 10000, accountId: savingsId });
    await contribute(g, eco.id, { amount: 2000, date: '2026-09-23' });
    await expect(withdraw(g, eco.id, { amount: 2001, date: '2026-09-23' })).rejects.toThrow();
    await expect(contribute(g, savingsId, { amount: 100, date: '2026-09-23' })).rejects.toThrow();
  });

  it('editing a goal transfer in the normal editor keeps its goal tag', async () => {
    const g = await saveGoal({ name: 'Trip', target: 10000, accountId: savingsId });
    const id = await contribute(g, eco.id, { amount: 2000, date: '2026-09-23' });
    await saveTransfer({ date: '2026-09-23', amount: 2500, accountId: eco.id, toAccountId: savingsId, fee: 0, feeKey: 'fee_mobile' }, id);
    expect(await currentSaved(g)).toBe(2500);
  });

  it('locks the account once money has moved', async () => {
    const g = await saveGoal({ name: 'Trip', target: 10000, accountId: savingsId });
    await contribute(g, eco.id, { amount: 2000, date: '2026-09-23' });
    await expect(saveGoal({ name: 'Trip', target: 10000, accountId: cash.id }, g)).rejects.toThrow();
    await saveGoal({ name: 'Big trip', target: 20000, accountId: savingsId }, g); // other edits fine
    expect((await db.goals.get(g))!.name).toBe('Big trip');
  });

  it('deleting a goal keeps the money and the transfers', async () => {
    const g = await saveGoal({ name: 'Trip', target: 10000, accountId: savingsId });
    await contribute(g, eco.id, { amount: 2000, date: '2026-09-23' });
    await deleteGoal(g);
    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0].goalId).toBeUndefined();
    expect(computeBalances(await db.accounts.toArray(), txs).get(savingsId)).toBe(2000);
  });
});
