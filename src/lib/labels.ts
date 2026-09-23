import type { AccountType } from '../db/types';

export const accountTypeLabels: Record<AccountType, string> = {
  mobile_wallet: 'Mobile wallet',
  cash: 'Cash',
  bank: 'Bank',
  savings: 'Savings',
};

/** Case-insensitive name clash check, ignoring the item being edited. */
export function nameTaken<T extends { id: string; name: string; archived: boolean }>(
  list: T[], name: string, exceptId?: string,
) {
  const n = name.trim().toLowerCase();
  return list.some((x) => x.id !== exceptId && !x.archived && x.name.trim().toLowerCase() === n);
}
