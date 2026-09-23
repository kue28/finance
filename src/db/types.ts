// Data model. Money is always integer cents; dates are local 'YYYY-MM-DD'
// strings (no timezones, so a transaction never slips into the wrong day).

export type ID = string;
export type Cents = number;
export type DateStr = string; // 'YYYY-MM-DD'

interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

export type AccountType = 'mobile_wallet' | 'cash' | 'bank' | 'savings';

export interface Account extends Timestamps {
  id: ID;
  name: string;
  type: AccountType;
  /** Balance before the first recorded transaction. Current balance is never
   *  stored — it's always opening balance + transactions (see lib/rules.ts). */
  openingBalance: Cents;
  archived: boolean;
  sortOrder: number;
}

export type CategoryKind = 'expense' | 'income';

/** Categories the app itself needs to find, whatever the user renames them to. */
export type SystemKey = 'fee_mobile' | 'fee_bank' | 'fee_imtt' | 'bad_debt';

export interface Category extends Timestamps {
  id: ID;
  name: string;
  kind: CategoryKind;
  /** null = main category; otherwise the main category this subcategory belongs to.
   *  Expense transactions always use a subcategory; income categories have no subs. */
  parentId: ID | null;
  archived: boolean;
  sortOrder: number;
  systemKey?: SystemKey;
}

export type TransactionKind = 'income' | 'expense' | 'transfer' | 'lend' | 'repayment' | 'writeoff';

export interface Transaction extends Timestamps {
  id: ID;
  kind: TransactionKind;
  date: DateStr;
  /** Always positive; `kind` decides the direction. */
  amount: Cents;
  /** The account money leaves or enters. For transfers, the source account. */
  accountId: ID;
  /** Transfers only: the destination account. */
  toAccountId?: ID;
  /** Income: income category. Expense/writeoff: expense subcategory. */
  categoryId?: ID;
  note?: string;
  /** Set on the auto-created fee expense that belongs to a transfer. */
  feeForTransferId?: ID;
  goalId?: ID;
  loanId?: ID;
  recurringId?: ID;
}

/** A monthly spending limit on one MAIN expense category. No rollovers:
 *  each month is independent. Months without a row have no limit. */
export interface Budget {
  id: ID;
  month: string; // 'YYYY-MM'
  categoryId: ID; // main expense category
  limit: Cents;
}

export type RepeatUnit = 'day' | 'week' | 'month';

/**
 * A repeating income or expense (rent, salary, subscriptions…). Never recorded
 * automatically: each occurrence shows as "due" until you confirm or skip it.
 * Occurrence k falls on startDate + k × (every × unit).
 */
export interface Recurring extends Timestamps {
  id: ID;
  kind: 'income' | 'expense';
  amount: Cents;
  categoryId: ID;
  accountId: ID;
  /** Also used as the display name, e.g. "Rent" or "Netflix". */
  note?: string;
  every: number; // weekly = 1 week, monthly = 1 month, custom = anything
  unit: RepeatUnit;
  startDate: DateStr;
  endDate?: DateStr;
  /** Earliest occurrence not yet confirmed or skipped (null = schedule has ended). */
  nextDueDate: DateStr | null;
  /** Later occurrences already handled out of order (e.g. confirmed the 2nd missed one first). */
  handledAhead: DateStr[];
  /** Hidden from the due list until this date. */
  snoozedUntil?: DateStr;
  active: boolean;
}

/**
 * A savings goal. Money for it sits in a linked account (a savings account or
 * cash envelope). Contributions are transfers INTO that account tagged with
 * goalId; withdrawals are transfers OUT of it tagged with goalId. So saving is
 * never spending. Several goals may share one account.
 */
export interface Goal extends Timestamps {
  id: ID;
  name: string;
  target: Cents;
  deadline?: DateStr;
  accountId: ID;
  completed: boolean;
  sortOrder: number;
}

export interface Setting {
  key: string;
  value: unknown;
}
