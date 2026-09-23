import { db, newId } from './db';
import type { Cents, DateStr, ID } from './types';
import { saveTransfer } from './txOps';
import { goalSaved } from '../lib/goals';

export interface GoalInput {
  name: string;
  target: Cents;
  deadline?: DateStr;
  accountId: ID;
}

export async function saveGoal(input: GoalInput, id?: ID): Promise<ID> {
  const t = Date.now();
  const fields = { ...input, name: input.name.trim(), deadline: input.deadline || undefined };
  if (id) {
    const old = await db.goals.get(id);
    if (!old) throw new Error('Goal not found.');
    // The saved amount is worked out from transfers into/out of the goal's
    // account, so the account can't change once money has moved.
    if (old.accountId !== fields.accountId && (await goalTxCount(id)) > 0) {
      throw new Error('This goal already has contributions, so its account can\'t be changed.');
    }
    await db.goals.update(id, { ...fields, updatedAt: t });
    return id;
  }
  const last = await db.goals.orderBy('sortOrder').last();
  const goal = { id: newId(), ...fields, completed: false, sortOrder: (last?.sortOrder ?? -1) + 1, createdAt: t, updatedAt: t };
  await db.goals.add(goal);
  return goal.id;
}

export function goalTxCount(goalId: ID) {
  return db.transactions.where('goalId').equals(goalId).count();
}

export async function currentSaved(goalId: ID): Promise<Cents> {
  const goal = await db.goals.get(goalId);
  if (!goal) return 0;
  return goalSaved(goal, await db.transactions.where('goalId').equals(goalId).toArray());
}

interface Move { amount: Cents; date: DateStr; note?: string }

/** Contribute: a transfer from `fromAccountId` into the goal's account. Not an expense. */
export async function contribute(goalId: ID, fromAccountId: ID, m: Move) {
  const goal = await db.goals.get(goalId);
  if (!goal) throw new Error('Goal not found.');
  if (fromAccountId === goal.accountId) throw new Error('Choose an account other than the goal\'s own account.');
  return saveTransfer({ ...m, accountId: fromAccountId, toAccountId: goal.accountId, fee: 0, feeKey: 'fee_mobile', goalId });
}

/** Withdraw: a transfer from the goal's account back into `toAccountId`. Not income. */
export async function withdraw(goalId: ID, toAccountId: ID, m: Move) {
  const goal = await db.goals.get(goalId);
  if (!goal) throw new Error('Goal not found.');
  if (toAccountId === goal.accountId) throw new Error('Choose an account other than the goal\'s own account.');
  const saved = await currentSaved(goalId);
  if (m.amount > saved) throw new Error('That is more than is saved for this goal.');
  return saveTransfer({ ...m, accountId: goal.accountId, toAccountId, fee: 0, feeKey: 'fee_mobile', goalId });
}

export function setGoalCompleted(id: ID, completed: boolean) {
  return db.goals.update(id, { completed, updatedAt: Date.now() });
}

/** Delete the goal. Its transfers stay (money doesn't vanish) but lose the goal tag. */
export async function deleteGoal(id: ID) {
  await db.transaction('rw', db.goals, db.transactions, async () => {
    await db.transactions.where('goalId').equals(id).modify((t) => { delete t.goalId; });
    await db.goals.delete(id);
  });
}
