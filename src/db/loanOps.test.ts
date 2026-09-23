import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { addRepayment, createLoan, deleteLoan, deleteLoanEntry, updateLoan, writeOff } from './loanOps';
import { computeBalances, isIncome, isSpending } from '../lib/rules';
import { spentByMainCategory } from '../lib/budget';
import { personKey, summarizeLoan } from '../lib/loans';
import type { Account } from './types';

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 23, 10)); });
afterAll(() => { vi.useRealTimers(); });

let eco: Account, cash: Account;
const balances = async () => computeBalances(await db.accounts.toArray(), await db.transactions.toArray());
const summary = async (id: string) =>
  summarizeLoan((await db.loans.get(id))!, await db.transactions.where('loanId').equals(id).toArray(), '2026-09-23');

beforeEach(async () => {
  await db.delete();
  await db.open();
  [eco, , cash] = await db.accounts.orderBy('sortOrder').toArray();
  await db.accounts.update(eco.id, { openingBalance: 20000 });
});

describe('lending', () => {
  it('lending moves money out but is not spending', async () => {
    const id = await createLoan({ person: ' Tendai ', amount: 5000, dateLent: '2026-09-10', fromAccountId: eco.id });
    expect((await db.loans.get(id))!.person).toBe('Tendai');
    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ kind: 'lend', amount: 5000, loanId: id });
    expect(txs.some(isSpending)).toBe(false);
    expect((await balances()).get(eco.id)).toBe(15000);
    expect(await summary(id)).toMatchObject({ outstanding: 5000, status: 'open' });
  });

  it('partial repayments into any account are not income', async () => {
    const id = await createLoan({ person: 'Tendai', amount: 5000, dateLent: '2026-09-10', fromAccountId: eco.id });
    await addRepayment(id, { amount: 2000, accountId: cash.id, date: '2026-09-15' });
    await addRepayment(id, { amount: 1000, accountId: eco.id, date: '2026-09-20' });
    const txs = await db.transactions.toArray();
    expect(txs.some(isIncome) || txs.some(isSpending)).toBe(false);
    const b = await balances();
    expect(b.get(eco.id)).toBe(16000);
    expect(b.get(cash.id)).toBe(2000);
    expect(await summary(id)).toMatchObject({ repaid: 3000, outstanding: 2000, status: 'open' });
    await expect(addRepayment(id, { amount: 2001, accountId: eco.id, date: '2026-09-21' })).rejects.toThrow();
    await addRepayment(id, { amount: 2000, accountId: eco.id, date: '2026-09-21' });
    expect(await summary(id)).toMatchObject({ outstanding: 0, status: 'repaid' });
  });

  it('write-off is spending (Bad debts) but does not change balances', async () => {
    const id = await createLoan({ person: 'Farai', amount: 5000, dateLent: '2026-09-10', fromAccountId: eco.id });
    await addRepayment(id, { amount: 1000, accountId: eco.id, date: '2026-09-15' });
    const before = await balances();
    await writeOff(id, { amount: 4000, date: '2026-09-22' });
    expect(await balances()).toEqual(before);

    const wo = (await db.transactions.where('kind').equals('writeoff').toArray())[0];
    const badDebts = (await db.categories.filter((c) => c.systemKey === 'bad_debt').first())!;
    expect(wo).toMatchObject({ amount: 4000, categoryId: badDebts.id });
    expect(isSpending(wo)).toBe(true);

    const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
    const spent = spentByMainCategory(await db.transactions.toArray(), cats, '2026-09');
    expect(spent.get(badDebts.parentId!)).toBe(4000); // counts against the "Other" budget
    expect([...spent.values()].reduce((a, b) => a + b, 0)).toBe(4000); // lend/repay don't
    expect(await summary(id)).toMatchObject({ outstanding: 0, writtenOff: 4000, status: 'written_off' });
  });

  it('overdue only when the expected date has passed and money is still owed', async () => {
    const late = await createLoan({ person: 'A', amount: 1000, dateLent: '2026-09-01', fromAccountId: eco.id, expectedRepayDate: '2026-09-20' });
    const onTime = await createLoan({ person: 'B', amount: 1000, dateLent: '2026-09-01', fromAccountId: eco.id, expectedRepayDate: '2026-09-23' });
    expect((await summary(late)).overdue).toBe(true);
    expect((await summary(onTime)).overdue).toBe(false);
    await addRepayment(late, { amount: 1000, accountId: eco.id, date: '2026-09-23' });
    expect((await summary(late)).overdue).toBe(false);
  });

  it('editing a loan updates its lend transaction; cannot go below what was repaid', async () => {
    const id = await createLoan({ person: 'Tendai', amount: 5000, dateLent: '2026-09-10', fromAccountId: eco.id });
    await addRepayment(id, { amount: 3000, accountId: eco.id, date: '2026-09-15' });
    await updateLoan(id, { person: 'Tendai', amount: 6000, dateLent: '2026-09-11', fromAccountId: cash.id });
    const lend = (await db.transactions.where('kind').equals('lend').toArray())[0];
    expect(lend).toMatchObject({ amount: 6000, date: '2026-09-11', accountId: cash.id });
    await expect(updateLoan(id, { person: 'Tendai', amount: 2000, dateLent: '2026-09-11', fromAccountId: cash.id })).rejects.toThrow();
  });

  it('deleting entries and loans', async () => {
    const id = await createLoan({ person: 'Tendai', amount: 5000, dateLent: '2026-09-10', fromAccountId: eco.id });
    await addRepayment(id, { amount: 1000, accountId: eco.id, date: '2026-09-15' });
    const rep = (await db.transactions.where('kind').equals('repayment').toArray())[0];
    await deleteLoanEntry(rep.id);
    expect((await summary(id)).outstanding).toBe(5000);
    await deleteLoan(id);
    expect(await db.transactions.count()).toBe(0);
    expect((await balances()).get(eco.id)).toBe(20000);
  });

  it('matches people ignoring case and spaces', () => {
    expect(personKey('  tendai   Moyo ')).toBe(personKey('Tendai Moyo'));
  });
});
