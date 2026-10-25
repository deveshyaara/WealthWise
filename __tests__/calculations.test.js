import { describe, it, expect } from "vitest";
import { safeAdd, safeSubtract, roundFinancial } from "@/lib/currency";

describe("Financial Calculation Integrity & Business Logic", () => {
  describe("Transaction Balance Delta Calculations", () => {
    it("correctly increases account balance on INCOME creation", () => {
      const initialBalance = 1000.0;
      const transactionAmount = 250.5;
      const type = "INCOME";

      const balanceChange = type === "EXPENSE" ? -transactionAmount : transactionAmount;
      const newBalance = safeAdd(initialBalance, balanceChange);

      expect(newBalance).toBe(1250.5);
    });

    it("correctly decreases account balance on EXPENSE creation", () => {
      const initialBalance = 1000.0;
      const transactionAmount = 149.99;
      const type = "EXPENSE";

      const balanceChange = type === "EXPENSE" ? -transactionAmount : transactionAmount;
      const newBalance = safeAdd(initialBalance, balanceChange);

      expect(newBalance).toBe(850.01);
    });

    it("calculates exact net balance change when editing from EXPENSE to INCOME", () => {
      // Original: Expense of $100 (-$100 impact)
      // New: Income of $150 (+$150 impact)
      // Net change applied to balance: +$150 - (-$100) = +$250
      const oldType = "EXPENSE";
      const oldAmount = 100.0;
      const newType = "INCOME";
      const newAmount = 150.0;

      const oldBalanceChange = oldType === "EXPENSE" ? -oldAmount : oldAmount;
      const newBalanceChange = newType === "EXPENSE" ? -newAmount : newAmount;
      const netDelta = safeSubtract(newBalanceChange, oldBalanceChange);

      expect(netDelta).toBe(250.0);
    });

    it("calculates exact net balance change when editing EXPENSE amount (e.g. $50 -> $80)", () => {
      // Original: Expense of $50 (-$50 impact)
      // New: Expense of $80 (-$80 impact)
      // Net change applied to balance: -$80 - (-$50) = -$30
      const oldType = "EXPENSE";
      const oldAmount = 50.0;
      const newType = "EXPENSE";
      const newAmount = 80.0;

      const oldBalanceChange = oldType === "EXPENSE" ? -oldAmount : oldAmount;
      const newBalanceChange = newType === "EXPENSE" ? -newAmount : newAmount;
      const netDelta = safeSubtract(newBalanceChange, oldBalanceChange);

      expect(netDelta).toBe(-30.0);
    });

    it("correctly reverses balance on bulk transaction deletion", () => {
      // Deleting:
      // 1. Expense $100 (reversal: +$100)
      // 2. Expense $50 (reversal: +$50)
      // 3. Income $200 (reversal: -$200)
      // Net reversal: +100 + 50 - 200 = -50
      const transactions = [
        { type: "EXPENSE", amount: 100 },
        { type: "EXPENSE", amount: 50 },
        { type: "INCOME", amount: 200 },
      ];

      const totalReversal = transactions.reduce((acc, t) => {
        const change = t.type === "EXPENSE" ? t.amount : -t.amount;
        return safeAdd(acc, change);
      }, 0);

      expect(totalReversal).toBe(-50);
    });
  });

  describe("Budget Thresholds & Utilization", () => {
    function computeBudgetStatus(expenses, budgetLimit) {
      if (!budgetLimit || budgetLimit <= 0) return { percentUsed: 0, alertRequired: false };
      const percentUsed = roundFinancial((expenses / budgetLimit) * 100, 1);
      const alertRequired = percentUsed >= 80;
      return { percentUsed, alertRequired };
    }

    it("accurately identifies budget under 80% threshold", () => {
      const status = computeBudgetStatus(750, 1000);
      expect(status.percentUsed).toBe(75.0);
      expect(status.alertRequired).toBe(false);
    });

    it("triggers alert at exact 80% threshold", () => {
      const status = computeBudgetStatus(800, 1000);
      expect(status.percentUsed).toBe(80.0);
      expect(status.alertRequired).toBe(true);
    });

    it("accurately identifies budget overrun above 100%", () => {
      const status = computeBudgetStatus(1250, 1000);
      expect(status.percentUsed).toBe(125.0);
      expect(status.alertRequired).toBe(true);
    });
  });

  describe("Precision & Adversarial Monetary Calculations", () => {
    it("handles 0.10 + 0.20 IEEE-754 floating point precision without binary drift", () => {
      const result = safeAdd(0.10, 0.20);
      expect(result).toBe(0.30);
      expect(result).not.toBe(0.30000000000000004);
    });

    it("handles repeated sequential increments of 10.99 without rounding accumulation error", () => {
      let balance = 0.0;
      for (let i = 0; i < 100; i++) {
        balance = safeAdd(balance, 10.99);
      }
      // 100 * 10.99 = 1099.00
      expect(balance).toBe(1099.00);
    });

    it("handles large amounts (999,999,999.99) accurately", () => {
      const largeBalance = 999999999.99;
      const expense = 0.99;
      const result = safeSubtract(largeBalance, expense);
      expect(result).toBe(999999999.00);
    });

    it("correctly handles negative balance adjustments (overdraft states)", () => {
      const currentBalance = 50.00;
      const largeExpense = 150.50;
      // Balance goes to -100.50
      const newBalance = safeSubtract(currentBalance, largeExpense);
      expect(newBalance).toBe(-100.50);

      // Refund of 20.25 to the overdrawn account
      const refundedBalance = safeAdd(newBalance, 20.25);
      expect(refundedBalance).toBe(-80.25);
    });
  });

  describe("CSV Formula Injection Protection (OWASP Mitigation)", () => {
    const sanitizeCSVField = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    it("neutralizes formula injection characters (=, +, -, @, \\t, \\r)", () => {
      expect(sanitizeCSVField("=cmd|'/C calc'!A0")).toBe("\"'=cmd|'/C calc'!A0\"");
      expect(sanitizeCSVField("+1+2")).toBe("\"'+1+2\"");
      expect(sanitizeCSVField("-50")).toBe("\"'-50\"");
      expect(sanitizeCSVField("@SUM(1,2)")).toBe("\"'@SUM(1,2)\"");
      expect(sanitizeCSVField("\tDDE")).toBe("\"'\tDDE\"");
    });

    it("preserves legitimate text and properly escapes embedded quotes", () => {
      expect(sanitizeCSVField("Coffee & Grocery")).toBe('"Coffee & Grocery"');
      expect(sanitizeCSVField('Dinner with "Friends"')).toBe('"Dinner with ""Friends"""');
      expect(sanitizeCSVField(null)).toBe('""');
    });
  });
});
