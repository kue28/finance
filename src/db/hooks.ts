import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from './db';
import type { CategoryKind, ID } from './types';
import { computeBalances } from '../lib/rules';

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
