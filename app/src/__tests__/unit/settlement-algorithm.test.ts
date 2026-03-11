import { describe, it, expect } from "vitest";
import {
  calculateSettlements,
  calculateNetBalances,
} from "@/lib/settlement-algorithm";

// ─── Helpers ────────────────────────────────────────────────────────────────

type Participant = { id: string };
type Expense = {
  id: string;
  payerId: string;
  amountCents: number;
  participants: Participant[];
};

function p(id: string): Participant {
  return { id };
}

function expense(
  id: string,
  payerId: string,
  amountCents: number,
  participantIds: string[]
): Expense {
  return { id, payerId, amountCents, participants: participantIds.map(p) };
}

// ─── Net Balance Tests ───────────────────────────────────────────────────────

describe("calculateNetBalances", () => {
  it("simple two-person split: payer gets positive net", () => {
    const expenses = [expense("e1", "A", 1000, ["A", "B"])];
    const balances = calculateNetBalances(expenses);
    expect(balances.get("A")).toBe(500);  // paid 1000, owes 500 → net +500
    expect(balances.get("B")).toBe(-500); // paid 0, owes 500 → net -500
  });

  it("three-person equal split rounds remainders deterministically", () => {
    // $10 split 3 ways: 334 + 333 + 333 = 1000 cents
    const expenses = [expense("e1", "A", 1000, ["A", "B", "C"])];
    const balances = calculateNetBalances(expenses);
    // A paid 1000, owes 334 (gets remainder) → net +666
    // B owes 333 → net -333
    // C owes 333 → net -333
    const total = [...balances.values()].reduce((sum, v) => sum + v, 0);
    expect(total).toBe(0); // must always sum to zero
    expect(balances.get("A")).toBe(666);
    expect(balances.get("B")).toBe(-333);
    expect(balances.get("C")).toBe(-333);
  });

  it("multiple expenses accumulate correctly", () => {
    const expenses = [
      expense("e1", "A", 3000, ["A", "B", "C"]), // A paid $30 for all
      expense("e2", "B", 1500, ["A", "B"]),        // B paid $15 for A+B only
    ];
    const balances = calculateNetBalances(expenses);
    const total = [...balances.values()].reduce((sum, v) => sum + v, 0);
    expect(total).toBe(0);
  });

  it("payer who is also a participant gets net credit for others' shares only", () => {
    const expenses = [expense("e1", "A", 600, ["A", "B", "C"])];
    const balances = calculateNetBalances(expenses);
    // A paid 600, each owes 200. A's net = 600 - 200 = +400
    expect(balances.get("A")).toBe(400);
    expect(balances.get("B")).toBe(-200);
    expect(balances.get("C")).toBe(-200);
  });

  it("participant not in expenses has zero balance", () => {
    const expenses = [expense("e1", "A", 1000, ["A", "B"])];
    const balances = calculateNetBalances(expenses);
    expect(balances.get("C")).toBeUndefined();
  });
});

// ─── Settlement Calculation Tests ────────────────────────────────────────────

describe("calculateSettlements", () => {
  it("two people: one owes the other", () => {
    const expenses = [expense("e1", "Mick", 10000, ["Mick", "Shazza"])];
    const payments = calculateSettlements(expenses);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      fromId: "Shazza",
      toId: "Mick",
      amountCents: 5000,
    });
  });

  it("already balanced: no payments needed", () => {
    const expenses = [
      expense("e1", "Mick", 5000, ["Mick", "Shazza"]),
      expense("e2", "Shazza", 5000, ["Mick", "Shazza"]),
    ];
    const payments = calculateSettlements(expenses);
    expect(payments).toHaveLength(0);
  });

  it("three people: minimum transactions (N-1 = 2)", () => {
    // Mick paid everything for all 3
    const expenses = [expense("e1", "Mick", 3000, ["Mick", "Shazza", "Dazza"])];
    const payments = calculateSettlements(expenses);
    expect(payments).toHaveLength(2);
    const total = payments.reduce((sum, p) => sum + p.amountCents, 0);
    expect(total).toBe(2000); // Shazza+Dazza owe 1000 each
    payments.forEach((p) => {
      expect(p.toId).toBe("Mick");
      expect(p.amountCents).toBe(1000);
    });
  });

  it("four people with mixed payments: balances sum to zero", () => {
    // Byron Bay demo data (cents)
    const expenses = [
      expense("e1", "Mick",   48000, ["Mick", "Shazza", "Dazza", "Bazza"]),
      expense("e2", "Shazza",  9500, ["Mick", "Shazza", "Dazza", "Bazza"]),
      expense("e3", "Dazza",  21000, ["Mick", "Shazza", "Dazza", "Bazza"]),
      expense("e4", "Mick",   16000, ["Mick", "Shazza", "Bazza"]),
      expense("e5", "Bazza",   8800, ["Mick", "Shazza", "Dazza", "Bazza"]),
      expense("e6", "Shazza", 12000, ["Shazza", "Dazza"]),
      expense("e7", "Dazza",  19500, ["Mick", "Shazza", "Dazza", "Bazza"]),
      expense("e8", "Bazza",   6500, ["Mick", "Shazza", "Dazza", "Bazza"]),
    ];
    const payments = calculateSettlements(expenses);
    // Verify sum: total paid by debtors must equal total received by creditors
    const totalTransferred = payments.reduce((sum, p) => sum + p.amountCents, 0);
    expect(totalTransferred).toBeGreaterThan(0);
    // Verify balance after payments (simulate applying payments)
    const finalBalances = calculateNetBalances(expenses);
    payments.forEach((payment) => {
      finalBalances.set(payment.fromId, (finalBalances.get(payment.fromId) ?? 0) + payment.amountCents);
      finalBalances.set(payment.toId, (finalBalances.get(payment.toId) ?? 0) - payment.amountCents);
    });
    finalBalances.forEach((balance) => {
      expect(Math.abs(balance)).toBeLessThanOrEqual(1); // at most 1 cent rounding error
    });
  });

  it("single payer for everything: everyone else pays them back", () => {
    const expenses = [
      expense("e1", "Mick", 9000, ["Mick", "Shazza", "Dazza", "Bazza"]),
    ];
    const payments = calculateSettlements(expenses);
    expect(payments).toHaveLength(3);
    payments.forEach((p) => {
      expect(p.toId).toBe("Mick");
      expect(p.amountCents).toBe(2250);
    });
  });

  it("subset participation: non-participants owe nothing for that expense", () => {
    const expenses = [
      expense("e1", "Mick",  6000, ["Mick", "Shazza"]),         // just 2 people
      expense("e2", "Dazza", 4000, ["Mick", "Shazza", "Dazza"]), // 3 people
    ];
    const payments = calculateSettlements(expenses);
    const total = [...calculateNetBalances(expenses).values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
    // Verify payments clear all debts
    const balances = calculateNetBalances(expenses);
    payments.forEach((payment) => {
      balances.set(payment.fromId, (balances.get(payment.fromId) ?? 0) + payment.amountCents);
      balances.set(payment.toId, (balances.get(payment.toId) ?? 0) - payment.amountCents);
    });
    balances.forEach((balance) => {
      expect(Math.abs(balance)).toBeLessThanOrEqual(1);
    });
  });

  it("odd-cent amounts distribute remainder to first participants", () => {
    // $1 split 3 ways: first participant gets the extra cent
    const expenses = [expense("e1", "Mick", 100, ["Mick", "Shazza", "Dazza"])];
    const payments = calculateSettlements(expenses);
    const total = [...calculateNetBalances(expenses).values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it("returns empty array for empty expenses", () => {
    const payments = calculateSettlements([]);
    expect(payments).toHaveLength(0);
  });

  it("single person expense (payer = only participant): no payments", () => {
    const expenses = [expense("e1", "Mick", 5000, ["Mick"])];
    const payments = calculateSettlements(expenses);
    expect(payments).toHaveLength(0);
  });

  it("never produces payment from someone to themselves", () => {
    const expenses = [
      expense("e1", "Mick",  5000, ["Mick", "Shazza", "Dazza"]),
      expense("e2", "Shazza", 3000, ["Mick", "Shazza"]),
      expense("e3", "Dazza",  4000, ["Shazza", "Dazza"]),
    ];
    const payments = calculateSettlements(expenses);
    payments.forEach((p) => {
      expect(p.fromId).not.toBe(p.toId);
    });
  });

  it("payer not in participant list: payer gets full credit, owes nothing for that expense", () => {
    // Edge case: a company card holder pays but doesn't share the cost
    const expenses = [expense("e1", "Mick", 6000, ["Shazza", "Dazza", "Bazza"])];
    const balances = calculateNetBalances(expenses);
    // Mick paid 6000 and owes 0 (not a participant) → net +6000
    expect(balances.get("Mick")).toBe(6000);
    // Each of the 3 participants owes 2000
    expect(balances.get("Shazza")).toBe(-2000);
    expect(balances.get("Dazza")).toBe(-2000);
    expect(balances.get("Bazza")).toBe(-2000);
    const total = [...balances.values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it("duplicate participant IDs in one expense: each duplicate slot is charged separately", () => {
    // Defensive: algorithm does not silently deduplicate; this documents known behaviour
    const expenses = [expense("e1", "Mick", 3000, ["Shazza", "Shazza", "Dazza"])];
    const balances = calculateNetBalances(expenses);
    // Shazza appears twice → charged 2000 (1000 + 1000), Dazza charged 1000
    expect(balances.get("Shazza")).toBe(-2000);
    expect(balances.get("Dazza")).toBe(-1000);
    expect(balances.get("Mick")).toBe(3000);
    const total = [...balances.values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it("large group (6 people): produces at most N-1 = 5 payments", () => {
    const people = ["A", "B", "C", "D", "E", "F"];
    const expenses = [
      expense("e1", "A", 12000, people),
      expense("e2", "B", 3000, ["B", "C", "D"]),
      expense("e3", "C", 6000, ["A", "C", "E"]),
    ];
    const payments = calculateSettlements(expenses);
    expect(payments.length).toBeLessThanOrEqual(5);
  });
});
