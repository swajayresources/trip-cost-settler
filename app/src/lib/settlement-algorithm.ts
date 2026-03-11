/**
 * Settlement Algorithm — min-cash-flow greedy approach.
 * Pure functions: no side effects, no database access.
 * All amounts in integer cents to avoid floating-point drift.
 */

type Participant = { id: string };

type Expense = {
  id: string;
  payerId: string;
  amountCents: number;
  participants: Participant[];
};

export type SettlementPayment = {
  fromId: string;
  toId: string;
  amountCents: number;
};

/**
 * Compute net balance for each participant across all expenses.
 * Positive = is owed money. Negative = owes money.
 * Remainder cents distributed to first participants (deterministic).
 */
export function calculateNetBalances(expenses: Expense[]): Map<string, number> {
  const balances = new Map<string, number>();

  const add = (id: string, amount: number) =>
    balances.set(id, (balances.get(id) ?? 0) + amount);

  for (const expense of expenses) {
    const count = expense.participants.length;
    if (count === 0) continue;

    const baseShare = Math.floor(expense.amountCents / count);
    const remainder = expense.amountCents % count;

    // Payer gets credit for the full amount paid
    add(expense.payerId, expense.amountCents);

    // Each participant is debited their share
    expense.participants.forEach((participant, index) => {
      const extra = index < remainder ? 1 : 0;
      add(participant.id, -(baseShare + extra));
    });
  }

  return balances;
}

/**
 * Run the greedy min-cash-flow algorithm on pre-computed balances.
 * Produces the minimum number of directed payment transactions.
 */
export function calculateSettlementsFromBalances(
  balances: Map<string, number>
): SettlementPayment[] {
  // Separate into creditors (positive) and debtors (negative)
  const creditors: Array<{ id: string; amount: number }> = [];
  const debtors: Array<{ id: string; amount: number }> = [];

  for (const [id, balance] of balances.entries()) {
    if (balance > 0) creditors.push({ id, amount: balance });
    if (balance < 0) debtors.push({ id, amount: -balance });
  }

  // Sort descending by amount for greedy matching (stable sort by id for determinism)
  const sortDesc = (a: { id: string; amount: number }, b: { id: string; amount: number }) =>
    b.amount !== a.amount ? b.amount - a.amount : a.id.localeCompare(b.id);

  creditors.sort(sortDesc);
  debtors.sort(sortDesc);

  const payments: SettlementPayment[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const transfer = Math.min(creditor.amount, debtor.amount);

    if (transfer > 0) {
      payments.push({
        fromId: debtor.id,
        toId: creditor.id,
        amountCents: transfer,
      });
    }

    creditor.amount -= transfer;
    debtor.amount -= transfer;

    if (creditor.amount === 0) ci++;
    if (debtor.amount === 0) di++;
  }

  return payments;
}

/**
 * Main entry point: given expenses, produce minimal directed payments.
 */
export function calculateSettlements(expenses: Expense[]): SettlementPayment[] {
  if (expenses.length === 0) return [];
  const balances = calculateNetBalances(expenses);
  return calculateSettlementsFromBalances(balances);
}
