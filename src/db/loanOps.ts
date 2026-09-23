import { db, newId } from './db';
import type { Cents, DateStr, ID, Loan, Transaction } from './types';
import { summarizeLoan } from '../lib/loans';
import { today } from '../lib/dates';

export interface LoanInput {
  person: string;
  amount: Cents;
  dateLent: DateStr;
  fromAccountId: ID;
  expectedRepayDate?: DateStr;
  note?: string;
}

const clean = (s?: string) => s?.trim().replace(/\s+/g, ' ') || undefined;

/** The 'lend' transaction that moved the money out when the loan was made. */
function lendTxFields(loan: Loan) {
  return {
    kind: 'lend' as const, date: loan.dateLent, amount: loan.amount,
    accountId: loan.fromAccountId, loanId: loan.id, note: loan.note,
  };
}

/** Create a loan and record the money leaving the account (not an expense). */
export async function createLoan(input: LoanInput): Promise<ID> {
  if (!clean(input.person)) throw new Error('Enter who you lent to.');
  const t = Date.now();
  const loan: Loan = {
    id: newId(), ...input, person: clean(input.person)!, note: clean(input.note),
    expectedRepayDate: input.expectedRepayDate || undefined, createdAt: t, updatedAt: t,
  };
  await db.transaction('rw', db.loans, db.transactions, async () => {
    await db.loans.add(loan);
    await db.transactions.add({ id: newId(), ...lendTxFields(loan), createdAt: t, updatedAt: t });
  });
  return loan.id;
}

/** Edit a loan; its 'lend' transaction is kept in step. */
export async function updateLoan(id: ID, input: LoanInput) {
  if (!clean(input.person)) throw new Error('Enter who you lent to.');
  await db.transaction('rw', db.loans, db.transactions, async () => {
    const old = await db.loans.get(id);
    if (!old) throw new Error('Loan not found.');
    const txs = await db.transactions.where('loanId').equals(id).toArray();
    const s = summarizeLoan(old, txs, today());
    if (input.amount < s.repaid + s.writtenOff) {
      throw new Error('The amount can\'t be less than what has already been repaid or written off.');
    }
    const t = Date.now();
    const loan: Loan = {
      ...old, ...input, person: clean(input.person)!, note: clean(input.note),
      expectedRepayDate: input.expectedRepayDate || undefined, updatedAt: t,
    };
    await db.loans.put(loan);
    const lend = txs.find((x) => x.kind === 'lend');
    if (lend) await db.transactions.update(lend.id, { ...lendTxFields(loan), updatedAt: t });
    else await db.transactions.add({ id: newId(), ...lendTxFields(loan), createdAt: t, updatedAt: t });
  });
}

async function loadOpen(loanId: ID, amount: Cents) {
  const loan = await db.loans.get(loanId);
  if (!loan) throw new Error('Loan not found.');
  const s = summarizeLoan(loan, await db.transactions.where('loanId').equals(loanId).toArray(), today());
  if (amount <= 0) throw new Error('Enter an amount.');
  if (amount > s.outstanding) throw new Error('That is more than is still owed.');
  return loan;
}

/** Record a (partial) repayment into any account. Not income. */
export async function addRepayment(loanId: ID, r: { amount: Cents; accountId: ID; date: DateStr; note?: string }) {
  await db.transaction('rw', db.loans, db.transactions, async () => {
    await loadOpen(loanId, r.amount);
    const t = Date.now();
    await db.transactions.add({
      id: newId(), kind: 'repayment', loanId, amount: r.amount, accountId: r.accountId,
      date: r.date, note: clean(r.note), createdAt: t, updatedAt: t,
    });
  });
}

/**
 * Write off some or all of what's still owed. This is the ONLY loan event
 * that is an expense (Other › Bad debts). It doesn't change any balance.
 */
export async function writeOff(loanId: ID, w: { amount: Cents; date: DateStr; note?: string }) {
  await db.transaction('rw', db.loans, db.transactions, db.categories, async () => {
    const loan = await loadOpen(loanId, w.amount);
    const badDebts = await db.categories.filter((c) => c.systemKey === 'bad_debt').first();
    if (!badDebts) throw new Error('The Bad debts category is missing.');
    const t = Date.now();
    const tx: Transaction = {
      id: newId(), kind: 'writeoff', loanId, amount: w.amount, accountId: loan.fromAccountId,
      categoryId: badDebts.id, date: w.date, note: clean(w.note), createdAt: t, updatedAt: t,
    };
    await db.transactions.add(tx);
  });
}

/** Remove one repayment or write-off (e.g. entered by mistake). */
export async function deleteLoanEntry(txId: ID) {
  const tx = await db.transactions.get(txId);
  if (!tx || (tx.kind !== 'repayment' && tx.kind !== 'writeoff')) throw new Error('Not a repayment or write-off.');
  await db.transactions.delete(txId);
}

/** Delete a loan and everything recorded against it (as if it never happened). */
export async function deleteLoan(id: ID) {
  await db.transaction('rw', db.loans, db.transactions, async () => {
    await db.transactions.where('loanId').equals(id).delete();
    await db.loans.delete(id);
  });
}
