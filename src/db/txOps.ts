import { db, newId } from './db';
import type { Cents, DateStr, ID, SystemKey, Transaction } from './types';

// Creating, editing and deleting transactions.
//
// Transfer fees: a transfer with a fee is stored as TWO rows —
//   1. the transfer itself (kind 'transfer'), which moves money between accounts
//      and never counts as spending, and
//   2. a separate 'expense' from the SOURCE account under a Charges
//      subcategory, with feeForTransferId pointing at the transfer.
// Both are always written/deleted together inside one database transaction so
// they can't get out of step.

export type FeeKey = Extract<SystemKey, 'fee_mobile' | 'fee_bank' | 'fee_imtt'>;

interface Common {
  date: DateStr;
  amount: Cents;
  accountId: ID;
  note?: string;
}

export interface SimpleInput extends Common {
  kind: 'expense' | 'income';
  categoryId: ID;
  recurringId?: ID;
}

export interface TransferInput extends Common {
  toAccountId: ID;
  fee: Cents; // 0 = no fee
  feeKey: FeeKey;
  /** Set when this transfer is a savings goal contribution or withdrawal. */
  goalId?: ID;
}

const clean = (note?: string) => note?.trim() || undefined;

/** Add (no id) or update (with id) an income or expense. */
export async function saveSimple(input: SimpleInput, id?: ID): Promise<ID> {
  const t = Date.now();
  const fields = { ...input, note: clean(input.note), updatedAt: t };
  if (id) {
    await db.transactions.update(id, fields);
    return id;
  }
  const newTx: Transaction = { id: newId(), createdAt: t, ...fields };
  await db.transactions.add(newTx);
  return newTx.id;
}

/** Add or update a transfer, and add/update/remove its linked fee expense. */
export async function saveTransfer(input: TransferInput, id?: ID): Promise<ID> {
  if (input.accountId === input.toAccountId) throw new Error('Choose two different accounts.');
  const feeCategory = await db.categories.filter((c) => c.systemKey === input.feeKey).first();
  if (input.fee > 0 && !feeCategory) throw new Error('Fee category is missing.');

  const t = Date.now();
  const transferId = id ?? newId();
  const note = clean(input.note);

  await db.transaction('rw', db.transactions, async () => {
    const transfer = {
      kind: 'transfer' as const, date: input.date, amount: input.amount,
      accountId: input.accountId, toAccountId: input.toAccountId, note, updatedAt: t,
      // Only set goalId when given, so editing a goal transfer in the normal editor keeps its tag.
      ...(input.goalId ? { goalId: input.goalId } : {}),
    };
    if (id) await db.transactions.update(id, transfer);
    else await db.transactions.add({ id: transferId, createdAt: t, ...transfer });

    const existingFee = await db.transactions.where('feeForTransferId').equals(transferId).first();
    if (input.fee > 0) {
      const fee = {
        kind: 'expense' as const, date: input.date, amount: input.fee,
        accountId: input.accountId, categoryId: feeCategory!.id,
        feeForTransferId: transferId, note, updatedAt: t,
      };
      if (existingFee) await db.transactions.update(existingFee.id, fee);
      else await db.transactions.add({ id: newId(), createdAt: t, ...fee });
    } else if (existingFee) {
      await db.transactions.delete(existingFee.id);
    }
  });
  return transferId;
}

/** Delete a transaction. Deleting a transfer also deletes its fee. */
export async function deleteTransaction(id: ID) {
  await db.transaction('rw', db.transactions, async () => {
    await db.transactions.where('feeForTransferId').equals(id).delete();
    await db.transactions.delete(id);
  });
}

/** The fee expense attached to a transfer, if any. */
export function getTransferFee(transferId: ID) {
  return db.transactions.where('feeForTransferId').equals(transferId).first();
}
