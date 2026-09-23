import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { saveSimple, saveTransfer } from '../db/txOps';
import { contribute, saveGoal, withdraw } from '../db/goalOps';
import { addRepayment, createLoan, writeOff } from '../db/loanOps';
import { addAccount } from '../db/ops';
import { buildReport, monthlySummaries, monthsEnding, periodRange, spendingByMonth } from './reports';

describe('periodRange', () => {
  const t = '2026-09-23'; // a Wednesday
  it('covers each preset', () => {
    expect(periodRange('week', t)).toEqual(['2026-09-21', '2026-09-27']);
    expect(periodRange('week', '2026-09-27')).toEqual(['2026-09-21', '2026-09-27']); // Sunday
    expect(periodRange('month', t)).toEqual(['2026-09-01', '2026-09-30']);
    expect(periodRange('last_month', t)).toEqual(['2026-08-01', '2026-08-31']);
    expect(periodRange('last_3', t)).toEqual(['2026-07-01', '2026-09-30']);
    expect(periodRange('year', t)).toEqual(['2026-01-01', '2026-12-31']);
    expect(periodRange('custom', t, ['2026-09-10', '2026-09-01'])).toEqual(['2026-09-01', '2026-09-10']);
  });
  it('lists months', () => {
    expect(monthsEnding('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('buildReport', () => {
  beforeEach(async () => { await db.delete(); await db.open(); });

  it('only real expenses, fees and write-offs are spending; savings and lending reported separately', async () => {
    const [eco, , cash] = await db.accounts.orderBy('sortOrder').toArray();
    const cat = async (n: string) => (await db.categories.filter((c) => c.name === n).first())!;
    const groceries = await cat('Groceries'), kombi = await cat('Kombi'), salary = await cat('Salary');

    await saveSimple({ kind: 'expense', date: '2026-09-05', amount: 1000, accountId: eco.id, categoryId: groceries.id });
    await saveSimple({ kind: 'expense', date: '2026-09-06', amount: 200, accountId: eco.id, categoryId: kombi.id });
    await saveSimple({ kind: 'expense', date: '2026-08-06', amount: 700, accountId: eco.id, categoryId: kombi.id }); // August
    await saveSimple({ kind: 'income', date: '2026-09-01', amount: 50000, accountId: eco.id, categoryId: salary.id });
    await saveTransfer({ date: '2026-09-07', amount: 3000, accountId: eco.id, toAccountId: cash.id, fee: 90, feeKey: 'fee_mobile' });

    const sav = await addAccount('Savings', 'savings', 0);
    const goal = await saveGoal({ name: 'Laptop', target: 50000, accountId: sav });
    await contribute(goal, eco.id, { amount: 5000, date: '2026-09-10' });
    await withdraw(goal, eco.id, { amount: 1000, date: '2026-09-11' });

    const loan = await createLoan({ person: 'T', amount: 2500, dateLent: '2026-09-12', fromAccountId: eco.id });
    await addRepayment(loan, { amount: 500, accountId: eco.id, date: '2026-09-13' });
    await writeOff(loan, { amount: 2000, date: '2026-09-14' });

    const txs = await db.transactions.toArray();
    const categories = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
    const goals = new Map((await db.goals.toArray()).map((g) => [g.id, g]));
    const r = buildReport(txs, categories, goals, '2026-09-01', '2026-09-30');

    expect(r.income).toBe(50000);                       // repayment NOT income
    expect(r.spent).toBe(1000 + 200 + 90 + 2000);       // + fee + write-off; no transfer/goal/lend
    expect(r.savedToGoals).toBe(4000);                  // 5000 in − 1000 out
    expect(r.lentOut).toBe(2500);
    expect(r.spendByMain.get(groceries.parentId!)).toBe(1000);
    expect(r.spendBySub.get(kombi.id)).toBe(200);
    expect(r.incomeByCategory.get(salary.id)).toBe(50000);

    const kombiByMonth = spendingByMonth(txs, categories, kombi.parentId, ['2026-08', '2026-09']);
    expect(kombiByMonth).toEqual([700, 200]);
    const allByMonth = spendingByMonth(txs, categories, null, ['2026-08', '2026-09']);
    expect(allByMonth).toEqual([700, 3290]);

    const rows = monthlySummaries(txs, categories, goals, ['2026-09']);
    expect(rows[0]).toMatchObject({ income: 50000, spent: 3290, savedToGoals: 4000, lentOut: 2500 });
  });
});
