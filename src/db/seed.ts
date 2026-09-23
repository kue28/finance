import type { Transaction as DexieTx } from 'dexie';
import type { Account, AccountType, Category, SystemKey } from './types';

// Default data written the first time the app opens on a device.

const defaultAccounts: [string, AccountType][] = [
  ['EcoCash', 'mobile_wallet'],
  ['InnBucks', 'mobile_wallet'],
  ['Cash', 'cash'],
  ['Bank', 'bank'],
];

// Subcategory names followed by an optional system key (see types.ts).
type Sub = string | [string, SystemKey];

const expenseCategories: [string, Sub[]][] = [
  ['Food', ['Groceries', 'Eating out', 'Snacks', 'Meat/butchery', 'Other']],
  ['Transport', ['Kombi', 'Fuel', 'Taxi/Ride-hailing', 'Vehicle maintenance', 'Other']],
  ['Housing', ['Rent', 'ZESA', 'Water/Council rates', 'Gas', 'Repairs', 'Other']],
  ['Communication', ['Airtime', 'Data bundles', 'WiFi/Internet', 'Other']],
  ['Family & Giving', ['Family support', 'Tithe/Church', 'Gifts', 'Funerals and events', 'Other']],
  ['Personal', ['Clothing', 'Grooming/Salon', 'Health/Pharmacy', 'Medical aid', 'Other']],
  ['Education', ['School fees', 'Books and stationery', 'Courses', 'Other']],
  ['Entertainment', ['Subscriptions', 'Outings', 'Hobbies', 'Other']],
  ['Charges', [['Mobile money fees', 'fee_mobile'], ['IMTT', 'fee_imtt'], ['Bank charges', 'fee_bank'], 'Other']],
  ['Other', ['Miscellaneous', ['Bad debts', 'bad_debt']]],
];

const incomeCategories = ['Salary', 'Side business', 'Freelance', 'Gifts received', 'Other'];

let counter = 0;
/** Deterministic IDs for seed data make support/debugging easier. */
const sid = (prefix: string) => `${prefix}-${++counter}`;

export async function seed(tx: DexieTx) {
  const now = Date.now();
  const stamp = { createdAt: now, updatedAt: now };

  const accounts: Account[] = defaultAccounts.map(([name, type], i) => ({
    id: sid('acc'), name, type, openingBalance: 0, archived: false, sortOrder: i, ...stamp,
  }));

  const categories: Category[] = [];
  expenseCategories.forEach(([mainName, subs], i) => {
    const main: Category = {
      id: sid('cat'), name: mainName, kind: 'expense', parentId: null,
      archived: false, sortOrder: i, ...stamp,
    };
    categories.push(main);
    subs.forEach((sub, j) => {
      const [name, systemKey] = typeof sub === 'string' ? [sub, undefined] : sub;
      categories.push({
        id: sid('cat'), name, kind: 'expense', parentId: main.id,
        archived: false, sortOrder: j, ...(systemKey ? { systemKey } : {}), ...stamp,
      });
    });
  });
  incomeCategories.forEach((name, i) => {
    categories.push({
      id: sid('cat'), name, kind: 'income', parentId: null, archived: false, sortOrder: i, ...stamp,
    });
  });

  await tx.table('accounts').bulkAdd(accounts);
  await tx.table('categories').bulkAdd(categories);
  await tx.table('settings').put({ key: 'defaultAccountId', value: accounts[0].id });
}
