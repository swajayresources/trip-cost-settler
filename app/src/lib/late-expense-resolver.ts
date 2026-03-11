/**
 * Late Expense Resolver
 *
 * Recalculates settlement when a new expense is added after partial settlement.
 * Confirmed payments are immutable — real money moved, cannot be undone.
 * Produces only the incremental new payments needed to make everyone square.
 */

import {
  calculateNetBalances,
  calculateSettlementsFromBalances,
  type SettlementPayment,
} from "./settlement-algorithm";

type Participant = { id: string };

type Expense = {
  id: string;
  payerId: string;
  amountCents: number;
  participants: Participant[];
};

type ConfirmedPayment = {
  fromId: string;
  toId: string;
  amountCents: number;
};

export type LateExpenseResolution = {
  /** Incremental payments needed on top of already-confirmed ones */
  newPayments: SettlementPayment[];
};

/**
 * Given all expenses (including the new late one) and the set of already-confirmed
 * payments, compute the minimal set of new payments to settle remaining balances.
 *
 * Algorithm:
 * 1. Compute ideal net balances from ALL expenses (as if starting fresh)
 * 2. Subtract the effect of confirmed payments (they already happened)
 * 3. Run min-cash-flow on the residual balances
 */
export function resolveLateExpense(
  allExpenses: Expense[],
  confirmedPayments: ConfirmedPayment[]
): LateExpenseResolution {
  // Step 1: ideal balances from scratch — clone so we never mutate the returned map
  const residualBalances = new Map(calculateNetBalances(allExpenses));

  // Step 2: reverse the effect of confirmed payments
  // A confirmed "from→to" payment means:
  //   - from already paid, so add back to their balance (reduce their debt)
  //   - to already received, so subtract from their balance (reduce their credit)
  for (const payment of confirmedPayments) {
    residualBalances.set(
      payment.fromId,
      (residualBalances.get(payment.fromId) ?? 0) + payment.amountCents
    );
    residualBalances.set(
      payment.toId,
      (residualBalances.get(payment.toId) ?? 0) - payment.amountCents
    );
  }

  // Step 3: run settlement on residual balances
  const newPayments = calculateSettlementsFromBalances(residualBalances);

  return { newPayments };
}
