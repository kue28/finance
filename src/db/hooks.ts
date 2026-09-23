import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from './db';
import type { CategoryKind, ID } from './types';
import { computeBalances } from '../lib/rules';
import { addDays, today } from '../lib/dates';

// Live queries: components using these re-render automatically whenever the
// underlying data changes. They return undefined while the first load runs.

const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

/** All accounts (including archived), in the user's chosen order. */
export function useAccounts() {
  return useLiveQuery(() => db.accounts.orderBy('sortOrder').toArray(), []);
}

export function useAccount(id: ID | undefined) {
  return useLiveQuery(() => (id ? db.accounts.get(id) : undefined), [id]);
}

/** Current balance per account id (opening balance + all transactions). */
export function useBalances() {
  return useLiveQuery(async () => {
    const [accounts, txs] = await Promise.all([db.accounts.toArray(), db.transactions.toArray()]);
    return computeBalances(accounts, txs);
  }, []);
}

export function useDefaultAccountId() {
  return useLiveQuery(() => getSetting<ID | null>('defaultAccountId', null), []);
}

/** All categories of a kind (including archived), sorted. */
export function useCategories(kind: CategoryKind) {
  return useLiveQuery(
    async () => (await db.categories.where('kind').equals(kind).toArray()).sort(bySort),
    [kind],
  );
}

export function useCategory(id: ID | undefined) {
  return useLiveQuery(() => (id ? db.categories.get(id) : undefined), [id]);
}

/** Subcategories of one main category (including archived), sorted. */
export function useSubcategories(parentId: ID | undefined) {
  return useLiveQuery(
    async () => (parentId ? (await db.categories.where('parentId').equals(parentId).toArray()).sort(bySort) : []),
    [parentId],
  );
}

/** Lookup maps for showing names of accounts and categories in lists. */
export function useLookups() {
  return useLiveQuery(async () => {
    const [accounts, categories] = await Promise.all([db.accounts.toArray(), db.categories.toArray()]);
    return {
      accounts: new Map(accounts.map((a) => [a.id, a])),
      categories: new Map(categories.map((c) => [c.id, c])),
    };
  }, []);
}

/** Every transaction, newest first (same day: most recently entered first). */
export function useAllTransactions() {
  return useLiveQuery(async () => {
    const txs = await db.transactions.toArray();
    return txs.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  }, []);
}

export function useTransaction(id: ID | undefined) {
  return useLiveQuery(() => (id ? db.transactions.get(id) : undefined), [id]);
}

// Shown on a brand-new install before there is any history to learn from.
const starterSubs = ['Groceries', 'Kombi', 'Airtime', 'Data bundles', 'Eating out', 'Snacks', 'ZESA', 'Fuel'];

/**
 * The expense subcategories used most in the last 90 days (most used first),
 * topped up with common starters so there are always `limit` chips to tap.
 * Auto-created transfer fees are ignored so they don't crowd out real spending.
 */
export function useFrequentSubcategories(limit = 8) {
  return useLiveQuery(async () => {
    const since = addDays(today(), -90);
    const recent = await db.transactions.where('date').aboveOrEqual(since)
      .filter((t) => t.kind === 'expense' && !t.feeForTransferId && !!t.categoryId).toArray();
    const counts = new Map<ID, number>();
    for (const t of recent) counts.set(t.categoryId!, (counts.get(t.categoryId!) ?? 0) + 1);

    const cats = await db.categories.where('kind').equals('expense').toArray();
    const activeMainIds = new Set(cats.filter((c) => c.parentId === null && !c.archived).map((c) => c.id));
    // Active subcategories whose main category is also active.
    const usable = cats.filter((c) => c.parentId !== null && !c.archived && activeMainIds.has(c.parentId));

    const ranked = usable.filter((s) => counts.has(s.id)).sort((a, b) => counts.get(b.id)! - counts.get(a.id)!);
    for (const name of starterSubs) {
      if (ranked.length >= limit) break;
      const s = usable.find((u) => u.name === name && !ranked.includes(u));
      if (s) ranked.push(s);
    }
    return ranked.slice(0, limit).map((s) => s.id);
  }, []);
}
