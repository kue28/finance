import { db, newId } from './db';
import type { Cents, ID } from './types';

/** Set (or with null, remove) the limit for a main category in a month. */
export async function setBudget(month: string, categoryId: ID, limit: Cents | null) {
  const existing = await db.budgets.where('[month+categoryId]').equals([month, categoryId]).first();
  if (limit === null) {
    if (existing) await db.budgets.delete(existing.id);
  } else if (existing) {
    await db.budgets.update(existing.id, { limit });
  } else {
    await db.budgets.add({ id: newId(), month, categoryId, limit });
  }
}

/**
 * Copy limits from one month to another. Categories that already have a limit
 * in the target month are left alone, and archived categories are skipped.
 * Returns how many limits were copied.
 */
export async function copyBudgets(fromMonth: string, toMonth: string): Promise<number> {
  return db.transaction('rw', db.budgets, db.categories, async () => {
    const source = await db.budgets.where('month').equals(fromMonth).toArray();
    const already = new Set((await db.budgets.where('month').equals(toMonth).toArray()).map((b) => b.categoryId));
    let copied = 0;
    for (const b of source) {
      const cat = await db.categories.get(b.categoryId);
      if (!cat || cat.archived || already.has(b.categoryId)) continue;
      await db.budgets.add({ id: newId(), month: toMonth, categoryId: b.categoryId, limit: b.limit });
      copied++;
    }
    return copied;
  });
}
