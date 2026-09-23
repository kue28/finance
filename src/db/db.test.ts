import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, getSetting } from './db';
import { addAccount, addCategory, move, updateAccount } from './ops';

beforeEach(async () => {
  // Fresh database for every test (triggers the seed again).
  await db.delete();
  await db.open();
});

describe('seed data', () => {
  it('creates the four default accounts in order, EcoCash as default', async () => {
    const accounts = await db.accounts.orderBy('sortOrder').toArray();
    expect(accounts.map((a) => a.name)).toEqual(['EcoCash', 'InnBucks', 'Cash', 'Bank']);
    expect(await getSetting('defaultAccountId', null)).toBe(accounts[0].id);
  });

  it('creates every main expense category with its subcategories', async () => {
    const cats = await db.categories.where('kind').equals('expense').toArray();
    const mains = cats.filter((c) => c.parentId === null);
    expect(mains).toHaveLength(10);
    const subsOf = (name: string) => {
      const main = mains.find((m) => m.name === name)!;
      return cats.filter((c) => c.parentId === main.id).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.name);
    };
    expect(subsOf('Food')).toEqual(['Groceries', 'Eating out', 'Snacks', 'Meat/butchery', 'Other']);
    expect(subsOf('Other')).toEqual(['Miscellaneous', 'Bad debts']);
    // Every main category except "Other" has an "Other" subcategory.
    for (const m of mains.filter((m) => m.name !== 'Other')) expect(subsOf(m.name)).toContain('Other');
  });

  it('tags the system subcategories', async () => {
    const keyed = await db.categories.filter((c) => !!c.systemKey).toArray();
    expect(Object.fromEntries(keyed.map((c) => [c.systemKey, c.name]))).toEqual({
      fee_mobile: 'Mobile money fees', fee_imtt: 'IMTT', fee_bank: 'Bank charges', bad_debt: 'Bad debts',
    });
  });

  it('creates income categories', async () => {
    const inc = await db.categories.where('kind').equals('income').sortBy('sortOrder');
    expect(inc.map((c) => c.name)).toEqual(['Salary', 'Side business', 'Freelance', 'Gifts received', 'Other']);
  });
});

describe('ops', () => {
  it('adds an account at the end of the list', async () => {
    await addAccount('OneMoney', 'mobile_wallet', 1234);
    const last = await db.accounts.orderBy('sortOrder').last();
    expect(last).toMatchObject({ name: 'OneMoney', openingBalance: 1234, archived: false, sortOrder: 4 });
  });

  it('reorders accounts', async () => {
    const list = await db.accounts.orderBy('sortOrder').toArray();
    await move('accounts', list, list[2].id, -1); // move Cash up
    const names = (await db.accounts.orderBy('sortOrder').toArray()).map((a) => a.name);
    expect(names).toEqual(['EcoCash', 'Cash', 'InnBucks', 'Bank']);
  });

  it('archives without deleting', async () => {
    const [eco] = await db.accounts.orderBy('sortOrder').toArray();
    await updateAccount(eco.id, { archived: true });
    expect(await db.accounts.get(eco.id)).toMatchObject({ archived: true, name: 'EcoCash' });
  });

  it('new main expense category gets an "Other" subcategory', async () => {
    const id = await addCategory('Pets', 'expense', null);
    const subs = await db.categories.where('parentId').equals(id).toArray();
    expect(subs.map((s) => s.name)).toEqual(['Other']);
  });

  it('new income category has no subcategories', async () => {
    const id = await addCategory('Rental income', 'income', null);
    expect(await db.categories.where('parentId').equals(id).count()).toBe(0);
  });
});
