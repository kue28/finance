import { describe, expect, it } from 'vitest';
import type { Account, Transaction, TransactionKind } from '../db/types';
import { computeBalances, isIncome, isSpending } from './rules';

const acc = (id: string, openingBalance = 0): Account => ({
  id, name: id, type: 'cash', openingBalance, archived: false, sortOrder: 0, createdAt: 0, updatedAt: 0,
});
const tx = (kind: TransactionKind, amount: number, accountId: string, toAccountId?: string): Transaction => ({
  id: Math.random().toString(), kind, amount, accountId, toAccountId, date: '2026-09-23', createdAt: 0, updatedAt: 0,
});

describe('computeBalances', () => {
  const accounts = [acc('eco', 10000), acc('cash', 500)];

  it('starts from opening balances', () => {
    const b = computeBalances(accounts, []);
    expect(b.get('eco')).toBe(10000);
    expect(b.get('cash')).toBe(500);
  });

  it('applies every kind correctly', () => {
    const b = computeBalances(accounts, [
      tx('income', 2000, 'eco'),          // eco +20
      tx('expense', 300, 'eco'),          // eco -3
      tx('transfer', 5000, 'eco', 'cash'),// eco -50, cash +50
      tx('expense', 100, 'eco'),          // fee on that transfer: eco -1
      tx('lend', 1000, 'cash'),           // cash -10
      tx('repayment', 400, 'eco'),        // eco +4
      tx('writeoff', 600, 'cash'),        // no balance change!
    ]);
    expect(b.get('eco')).toBe(10000 + 2000 - 300 - 5000 - 100 + 400);
    expect(b.get('cash')).toBe(500 + 5000 - 1000);
  });

  it('transfers never change total net worth', () => {
    const b = computeBalances(accounts, [tx('transfer', 777, 'eco', 'cash')]);
    expect(b.get('eco')! + b.get('cash')!).toBe(10500);
  });
});

describe('what counts as spending / income', () => {
  it('only expenses and write-offs are spending', () => {
    const kinds: TransactionKind[] = ['income', 'expense', 'transfer', 'lend', 'repayment', 'writeoff'];
    expect(kinds.filter((k) => isSpending(tx(k, 1, 'a')))).toEqual(['expense', 'writeoff']);
    expect(kinds.filter((k) => isIncome(tx(k, 1, 'a')))).toEqual(['income']);
  });
});
