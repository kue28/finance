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

export interface Setting {
  key: string;
  value: unknown;
}
