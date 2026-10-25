import { describe, it, expect } from "vitest";
import { accountSchema, transactionSchema } from "@/app/lib/schema";

describe("Financial Data Validation Schemas (Zod)", () => {
  describe("accountSchema", () => {
    it("accepts valid CURRENT account", () => {
      const result = accountSchema.safeParse({
        name: "Primary Checking",
        type: "CURRENT",
        balance: "1500.50",
        isDefault: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid SAVINGS account with 0 balance", () => {
      const result = accountSchema.safeParse({
        name: "Emergency Fund",
        type: "SAVINGS",
        balance: "0",
        isDefault: false,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative initial balances", () => {
      const result = accountSchema.safeParse({
        name: "Invalid",
        type: "CURRENT",
        balance: "-50.00",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("non-negative");
    });

    it("rejects missing account name", () => {
      const result = accountSchema.safeParse({
        name: "",
        type: "CURRENT",
        balance: "100",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid account types", () => {
      const result = accountSchema.safeParse({
        name: "Crypto Wallet",
        type: "CRYPTO",
        balance: "100",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("transactionSchema", () => {
    const validBaseTransaction = {
      type: "EXPENSE",
      amount: "45.99",
      description: "Supermarket Groceries",
      date: new Date("2026-10-24"),
      accountId: "acc-12345",
      category: "Groceries",
      isRecurring: false,
    };

    it("accepts a valid standard expense", () => {
      const result = transactionSchema.safeParse(validBaseTransaction);
      expect(result.success).toBe(true);
    });

    it("accepts a valid recurring income transaction", () => {
      const result = transactionSchema.safeParse({
        ...validBaseTransaction,
        type: "INCOME",
        amount: "5000",
        category: "Salary",
        isRecurring: true,
        recurringInterval: "MONTHLY",
      });
      expect(result.success).toBe(true);
    });

    it("fails when recurring is true but recurringInterval is omitted", () => {
      const result = transactionSchema.safeParse({
        ...validBaseTransaction,
        isRecurring: true,
        recurringInterval: undefined,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toContain("recurringInterval");
    });

    it("rejects zero or negative transaction amounts", () => {
      const zeroResult = transactionSchema.safeParse({
        ...validBaseTransaction,
        amount: "0",
      });
      expect(zeroResult.success).toBe(false);

      const negResult = transactionSchema.safeParse({
        ...validBaseTransaction,
        amount: "-25.00",
      });
      expect(negResult.success).toBe(false);
    });

    it("rejects non-numeric transaction amounts", () => {
      const result = transactionSchema.safeParse({
        ...validBaseTransaction,
        amount: "forty-five",
      });
      expect(result.success).toBe(false);
    });
  });
});
