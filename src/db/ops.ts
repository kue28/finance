import { db, newId, setSetting } from './db';
import type { Account, AccountType, Category, CategoryKind, Cents, ID } from './types';

// Write operations for accounts and categories. Nothing is ever hard-deleted
// here: archiving hides an item from pickers but keeps past transactions intact.

const now = () => Date.now();

// ---------------------------------------------------------------- accounts

export async function addAccount(name: string, type: AccountType, openingBalance: Cents) {
  const last = await db.accounts.orderBy('sortOrder').last();
  const id = newId();
  await db.accounts.add({
    id, name: name.trim(), type, openingBalance, archived: false,
    sortOrder: (last?.sortOrder ?? -1) + 1, createdAt: now(), updatedAt: now(),
  });
  return id;
}

export function updateAccount(id: ID, changes: Partial<Pick<Account, 'name' | 'type' | 'openingBalance' | 'archived'>>) {
  if (changes.name !== undefined) changes.name = changes.name.trim();
  return db.accounts.update(id, { ...changes, updatedAt: now() });
}

export function setDefaultAccount(id: ID) {
  return setSetting('defaultAccountId', id);
}

// ---------------------------------------------------------------- categories

export async function addCategory(name: string, kind: CategoryKind, parentId: ID | null) {
  const siblings = await siblingsOf(kind, parentId);
  const t = now();
  const id = newId();
  const maxOrder = siblings.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  await db.transaction('rw', db.categories, async () => {
    await db.categories.add({
      id, name: name.trim(), kind, parentId, archived: false,
      sortOrder: maxOrder + 1, createdAt: t, updatedAt: t,
    });
    // Every new main expense category gets an "Other" subcategory, so there is
    // always somewhere to put a spend.
    if (kind === 'expense' && parentId === null) {
      await db.categories.add({
        id: newId(), name: 'Other', kind, parentId: id, archived: false,
        sortOrder: 0, createdAt: t, updatedAt: t,
      });
    }
  });
  return id;
}

export function updateCategory(id: ID, changes: Partial<Pick<Category, 'name' | 'archived' | 'icon'>>) {
  if (changes.name !== undefined) changes.name = changes.name.trim();
  return db.categories.update(id, { ...changes, updatedAt: now() });
}

function siblingsOf(kind: CategoryKind, parentId: ID | null) {
  // Dexie can't index null, so filter main categories in memory (the list is small).
  return db.categories
    .where('kind').equals(kind)
    .filter((c) => c.parentId === parentId)
    .toArray();
}

// ---------------------------------------------------------------- ordering

/**
 * Move an item one place up (-1) or down (+1) within `list` (already sorted
 * and filtered to what the user sees), then renumber the whole list 0..n so
 * sortOrder values stay clean even after archives/unarchives.
 */
export async function move<T extends { id: ID }>(
  table: 'accounts' | 'categories', list: T[], id: ID, dir: -1 | 1,
) {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const ids = list.map((x) => x.id);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const t = now();
  await db.transaction('rw', db[table], async () => {
    for (let k = 0; k < ids.length; k++) {
      await db[table].update(ids[k], { sortOrder: k, updatedAt: t });
    }
  });
}
