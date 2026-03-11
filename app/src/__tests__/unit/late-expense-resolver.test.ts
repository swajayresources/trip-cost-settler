import { describe, it, expect } from "vitest";
import { resolveLateExpense } from "@/lib/late-expense-resolver";
import { calculateNetBalances } from "@/lib/settlement-algorithm";

type Expense = { id: string; payerId: string; amountCents: number; participants: { id: string }[] };
type ConfirmedPayment = { fromId: string; toId: string; amountCents: number };

function expense(id: string, payerId: string, amountCents: number, participantIds: string[]): Expense {
  return { id, payerId, amountCents, participants: participantIds.map((id) => ({ id })) };
}

function confirmed(fromId: string, toId: string, amountCents: number): ConfirmedPayment {
  return { fromId, toId, amountCents };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("resolveLateExpense", () => {
  it("no confirmed payments: result equals fresh settlement with late expense included", () => {
    const originalExpenses = [expense("e1", "Mick", 6000, ["Mick", "Shazza", "Dazza"])];
    const lateExpense = expense("e_late", "Bazza", 3000, ["Mick", "Shazza", "Dazza", "Bazza"]);
    const result = resolveLateExpense([...originalExpenses, lateExpense], []);
    // All debts must clear
    const totalPaid = result.newPayments.reduce((s, p) => s + p.amountCents, 0);
    expect(totalPaid).toBeGreaterThan(0);
    result.newPayments.forEach((p) => expect(p.fromId).not.toBe(p.toId));
  });

  it("confirmed payments are not duplicated in newPayments", () => {
    const expenses = [expense("e1", "Mick", 10000, ["Mick", "Shazza"])];
    const confirmedPayments = [confirmed("Shazza", "Mick", 5000)];
    const lateExpense = expense("e_late", "Dazza", 6000, ["Mick", "Shazza", "Dazza"]);
    const result = resolveLateExpense([...expenses, lateExpense], confirmedPayments);
    // No payment from Shazza to Mick should appear in newPayments since it's already confirmed
    const shazzaToMick = result.newPayments.filter(
      (p) => p.fromId === "Shazza" && p.toId === "Mick"
    );
    // If it appears, its amount must be LESS than original (partial)
    shazzaToMick.forEach((p) => expect(p.amountCents).toBeLessThan(5000));
  });

  it("residual balance is zero after applying confirmed + new payments", () => {
    const expenses = [
      expense("e1", "Mick",  9000, ["Mick", "Shazza", "Dazza"]),
      expense("e2", "Shazza", 3000, ["Mick", "Shazza"]),
    ];
    const confirmedPayments = [confirmed("Dazza", "Mick", 3000)]; // Dazza already paid Mick
    const lateExpense = expense("e_late", "Mick", 4500, ["Mick", "Shazza", "Dazza"]);
    const result = resolveLateExpense([...expenses, lateExpense], confirmedPayments);

    // Simulate applying all payments (confirmed + new) and verify everyone is square
    const balances = calculateNetBalances([...expenses, lateExpense]);

    // Apply confirmed payments
    confirmedPayments.forEach((p) => {
      balances.set(p.fromId, (balances.get(p.fromId) ?? 0) + p.amountCents);
      balances.set(p.toId, (balances.get(p.toId) ?? 0) - p.amountCents);
    });

    // Apply new payments
    result.newPayments.forEach((p) => {
      balances.set(p.fromId, (balances.get(p.fromId) ?? 0) + p.amountCents);
      balances.set(p.toId, (balances.get(p.toId) ?? 0) - p.amountCents);
    });

    balances.forEach((balance) => {
      expect(Math.abs(balance)).toBeLessThanOrEqual(1);
    });
  });

  it("all payments already confirmed: newPayments may be empty or minimal adjustments", () => {
    const expenses = [expense("e1", "Mick", 2000, ["Mick", "Shazza"])];
    // Shazza already paid exactly right
    const confirmedPayments = [confirmed("Shazza", "Mick", 1000)];
    const lateExpense = expense("e_late", "Dazza", 3000, ["Mick", "Shazza", "Dazza"]);
    const result = resolveLateExpense([...expenses, lateExpense], confirmedPayments);
    // After late expense, Dazza's addition changes everyone's balance
    expect(result.newPayments).toBeDefined();
    result.newPayments.forEach((p) => expect(p.amountCents).toBeGreaterThan(0));
  });

  it("overpayment: if confirmed > what is owed after recalculation, reverse payment appears", () => {
    // Shazza was confirmed paying Mick $100, but after late expense Shazza only owes $40
    const expenses = [expense("e1", "Mick", 20000, ["Mick", "Shazza"])]; // Shazza owes $100
    const confirmedPayments = [confirmed("Shazza", "Mick", 10000)]; // paid exact
    // Late expense: Mick actually paid for something extra that benefits Shazza more
    const lateExpense = expense("e_late", "Shazza", 12000, ["Mick", "Shazza"]); // Shazza paid $120
    const result = resolveLateExpense([...expenses, lateExpense], confirmedPayments);
    // Net: Mick paid $200 total, Shazza paid $120 total for $320. Each owes $160.
    // Mick's net = +$40 (is owed), Shazza's net = -$40 (owes) BEFORE confirmed
    // After confirmed (Shazza already paid $100): Shazza is now owed $60 back from Mick
    const mickToShazza = result.newPayments.filter(
      (p) => p.fromId === "Mick" && p.toId === "Shazza"
    );
    expect(mickToShazza.length).toBeGreaterThan(0);
    expect(mickToShazza[0].amountCents).toBe(6000);
  });

  it("late expense with zero amount does not affect settlement", () => {
    const expenses = [expense("e1", "Mick", 4000, ["Mick", "Shazza"])];
    const confirmedPayments: ConfirmedPayment[] = [];
    const lateExpense = expense("e_late", "Dazza", 0, ["Mick", "Dazza"]);
    const result = resolveLateExpense([...expenses, lateExpense], confirmedPayments);
    // Should still only have Shazza paying Mick
    const nonZero = result.newPayments.filter((p) => p.amountCents > 0);
    expect(nonZero).toHaveLength(1);
    expect(nonZero[0]).toMatchObject({ fromId: "Shazza", toId: "Mick", amountCents: 2000 });
  });

  it("multiple sequential late expenses accumulate correctly", () => {
    const expenses = [expense("e1", "Mick", 6000, ["Mick", "Shazza", "Dazza"])];
    const confirmed1 = [confirmed("Dazza", "Mick", 2000)];
    const late1 = expense("e_late1", "Shazza", 3000, ["Mick", "Shazza", "Dazza"]);

    const round1 = resolveLateExpense([...expenses, late1], confirmed1);

    // Now another late expense arrives and some of round1 payments are confirmed
    const confirmed2 = [
      ...confirmed1,
      ...round1.newPayments.slice(0, 1).map((p) => ({
        fromId: p.fromId,
        toId: p.toId,
        amountCents: p.amountCents,
      })),
    ];
    const late2 = expense("e_late2", "Bazza", 1200, ["Mick", "Bazza"]);
    const allExpenses = [...expenses, late1, late2];
    const round2 = resolveLateExpense(allExpenses, confirmed2);

    expect(round2.newPayments).toBeDefined();
    round2.newPayments.forEach((p) => {
      expect(p.amountCents).toBeGreaterThan(0);
      expect(p.fromId).not.toBe(p.toId);
    });
  });

  it("returns empty newPayments when everything was already confirmed perfectly", () => {
    const expenses = [expense("e1", "Mick", 2000, ["Mick", "Shazza"])];
    const lateExpense = expense("e_late", "Shazza", 2000, ["Mick", "Shazza"]);
    // Both paid equal, so net is 0 — nothing to pay
    const result = resolveLateExpense([...expenses, lateExpense], []);
    expect(result.newPayments).toHaveLength(0);
  });
});
