import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import {
  confirmOccurrence, saveRecurring, setRecurringActive, skipOccurrence, snooze, type RecurringInput,
} from './recurringOps';
import { dueOccurrences } from '../lib/recurring';
import { computeBalances, isSpending } from '../lib/rules';

// Freeze "today" at 23 Sep 2026 (only Date is faked, so IndexedDB timers still run).
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 23, 10)); });
afterAll(() => { vi.useRealTimers(); });

let input: RecurringInput;
beforeEach(async () => {
  await db.delete();
  await db.open();
  const [eco] = await db.accounts.orderBy('sortOrder').toArray();
  const rent = (await db.categories.filter((c) => c.name === 'Rent').first())!;
  input = { kind: 'expense', amount: 15000, categoryId: rent.id, accountId: eco.id, note: 'Rent',
    every: 1, unit: 'week', startDate: '2026-09-02' };
});

describe('recurring ops', () => {
  it('a new item starts from today, never auto-creating transactions', async () => {
    const id = await saveRecurring(input);
    expect((await db.recurring.get(id))!.nextDueDate).toBe('2026-09-23'); // 2, 9, 16, 23 Sep → 23rd is today
    expect(await db.transactions.count()).toBe(0);
  });

  it('confirm records a real expense and moves to the next occurrence', async () => {
    const id = await saveRecurring(input);
    await confirmOccurrence(id, '2026-09-23');
    const [tx] = await db.transactions.toArray();
    expect(tx).toMatchObject({ kind: 'expense', amount: 15000, date: '2026-09-23', recurringId: id, note: 'Rent' });
    expect(isSpending(tx)).toBe(true);
    const r = (await db.recurring.get(id))!;
    expect(r.nextDueDate).toBe('2026-09-30');
    expect(dueOccurrences(r, '2026-09-23')).toEqual([]);
  });

  it('confirm with a different amount/account only changes this occurrence', async () => {
    const id = await saveRecurring(input);
    const cash = (await db.accounts.filter((a) => a.name === 'Cash').first())!;
    await confirmOccurrence(id, '2026-09-23', { amount: 16000, accountId: cash.id });
    const [tx] = await db.transactions.toArray();
    expect(tx).toMatchObject({ amount: 16000, accountId: cash.id });
    expect((await db.recurring.get(id))!.amount).toBe(15000);
    const b = computeBalances(await db.accounts.toArray(), await db.transactions.toArray());
    expect(b.get(cash.id)).toBe(-16000);
  });

  it('skip records nothing', async () => {
    const id = await saveRecurring(input);
    await skipOccurrence(id, '2026-09-23');
    expect(await db.transactions.count()).toBe(0);
    expect((await db.recurring.get(id))!.nextDueDate).toBe('2026-09-30');
  });

  it('snooze hides it until the snooze ends', async () => {
    const id = await saveRecurring(input);
    await snooze(id, 3);
    const r = (await db.recurring.get(id))!;
    expect(r.snoozedUntil).toBe('2026-09-26');
    expect(dueOccurrences(r, '2026-09-23')).toEqual([]);
    expect(dueOccurrences(r, '2026-09-26')).toEqual(['2026-09-23']);
  });

  it('resuming after a pause does not pile up missed occurrences', async () => {
    const id = await saveRecurring(input);
    await db.recurring.update(id, { nextDueDate: '2026-08-05' }); // pretend it was paused since August
    await setRecurringActive(id, false);
    await setRecurringActive(id, true);
    expect((await db.recurring.get(id))!.nextDueDate).toBe('2026-09-23');
  });

  it('changing only the amount keeps pending occurrences; changing the schedule restarts', async () => {
    const id = await saveRecurring(input);
    await db.recurring.update(id, { nextDueDate: '2026-09-09' }); // two missed ones pending
    await saveRecurring({ ...input, amount: 17000 }, id);
    expect((await db.recurring.get(id))!.nextDueDate).toBe('2026-09-09');
    await saveRecurring({ ...input, unit: 'month' }, id);
    expect((await db.recurring.get(id))!.nextDueDate).toBe('2026-10-02');
  });
});
