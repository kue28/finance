import { db, newId } from './db';
import type { Cents, DateStr, ID, Recurring, RepeatUnit } from './types';
import { saveSimple } from './txOps';
import { initialNextDue, markHandled } from '../lib/recurring';
import { addDays, today } from '../lib/dates';

export interface RecurringInput {
  kind: 'income' | 'expense';
  amount: Cents;
  categoryId: ID;
  accountId: ID;
  note?: string;
  every: number;
  unit: RepeatUnit;
  startDate: DateStr;
  endDate?: DateStr;
}

/**
 * Create or update a recurring item. If the schedule itself changes (start,
 * frequency or end), tracking restarts from the first occurrence on/after
 * today. Changing only amount/category/account/note keeps pending due items.
 */
export async function saveRecurring(input: RecurringInput, id?: ID): Promise<ID> {
  const t = Date.now();
  const fields = { ...input, note: input.note?.trim() || undefined, endDate: input.endDate || undefined };
  if (id) {
    const old = await db.recurring.get(id);
    if (!old) throw new Error('Recurring item not found.');
    const scheduleChanged = old.startDate !== fields.startDate || old.every !== fields.every
      || old.unit !== fields.unit || old.endDate !== fields.endDate;
    await db.recurring.update(id, {
      ...fields, updatedAt: t,
      ...(scheduleChanged ? { nextDueDate: initialNextDue(fields, today()), handledAhead: [] } : {}),
    });
    return id;
  }
  const rec: Recurring = {
    id: newId(), ...fields, nextDueDate: initialNextDue(fields, today()), handledAhead: [],
    active: true, createdAt: t, updatedAt: t,
  };
  await db.recurring.add(rec);
  return rec.id;
}

/**
 * Confirm one due occurrence: records the real transaction (optionally with
 * a different amount/account/date) and marks the occurrence handled.
 */
export async function confirmOccurrence(
  id: ID, occurrenceDate: DateStr, overrides: { amount?: Cents; accountId?: ID; date?: DateStr; note?: string } = {},
) {
  await db.transaction('rw', db.recurring, db.transactions, db.categories, async () => {
    const r = await db.recurring.get(id);
    if (!r) throw new Error('Recurring item not found.');
    await saveSimple({
      kind: r.kind, categoryId: r.categoryId, recurringId: r.id,
      amount: overrides.amount ?? r.amount,
      accountId: overrides.accountId ?? r.accountId,
      date: overrides.date ?? occurrenceDate,
      note: overrides.note ?? r.note,
    });
    await db.recurring.update(id, { ...markHandled(r, occurrenceDate), updatedAt: Date.now() });
  });
}

/** Skip one occurrence: nothing is recorded, it just stops being due. */
export async function skipOccurrence(id: ID, occurrenceDate: DateStr) {
  await db.transaction('rw', db.recurring, async () => {
    const r = await db.recurring.get(id);
    if (!r) return;
    await db.recurring.update(id, { ...markHandled(r, occurrenceDate), updatedAt: Date.now() });
  });
}

/** Hide this item's due occurrences for `days` days. */
export function snooze(id: ID, days: number) {
  return db.recurring.update(id, { snoozedUntil: addDays(today(), days), updatedAt: Date.now() });
}

/** Pause or resume. Resuming starts again from today: occurrences missed while paused don't pile up. */
export async function setRecurringActive(id: ID, active: boolean) {
  const r = await db.recurring.get(id);
  if (!r) return;
  await db.recurring.update(id, {
    active, snoozedUntil: undefined, updatedAt: Date.now(),
    ...(active ? { nextDueDate: initialNextDue(r, today()), handledAhead: [] } : {}),
  });
}

/** Delete the schedule. Transactions it already created are kept. */
export function deleteRecurring(id: ID) {
  return db.recurring.delete(id);
}
