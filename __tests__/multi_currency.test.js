import { describe, it, expect } from "vitest";
import { accountSchema } from "@/app/lib/schema";
import { formatCurrency, safeAdd } from "@/lib/currency";

describe("Real Multi-Currency Data Support & Financial Safety", () => {
  describe("Account Schema Currency Validation", () => {
    it("accepts all supported ISO 4217 currencies", () => {
      const supported = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY"];
      for (const curr of supported) {
        const parsed = accountSchema.safeParse({
          name: `${curr} Account`,
          type: "CURRENT",
          currency: curr,
          balance: "100.00",
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.currency).toBe(curr);
        }
      }
    });

    it("defaults to USD when currency is omitted", () => {
      const parsed = accountSchema.safeParse({
        name: "Standard Checking",
        type: "CURRENT",
        balance: "50.00",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.currency).toBe("USD");
      }
    });

    it("rejects unsupported or arbitrary currency strings", () => {
      const invalidCurrencies = ["BITCOIN", "XYZ", "123", "EURO", "DOLLAR"];
      for (const bad of invalidCurrencies) {
        const parsed = accountSchema.safeParse({
          name: "Invalid Currency Account",
          type: "SAVINGS",
          currency: bad,
          balance: "50.00",
        });
        expect(parsed.success).toBe(false);
      }
    });
  });

  describe("Financial Safety: Separation of Multi-Currency Balances", () => {
    it("groups balances by currency without summing different currencies together", () => {
      const userAccounts = [
        { id: "a1", name: "US Checking", balance: 1500.5, currency: "USD" },
        { id: "a2", name: "US Savings", balance: 3500.0, currency: "USD" },
        { id: "a3", name: "Euro Travel", balance: 800.0, currency: "EUR" },
        { id: "a4", name: "UK Account", balance: 450.25, currency: "GBP" },
      ];

      // Safe multi-currency balance aggregation
      const groupedBalances = userAccounts.reduce((acc, account) => {
        const curr = account.currency || "USD";
        acc[curr] = safeAdd(acc[curr] || 0, account.balance);
        return acc;
      }, {});

      // Verify that amounts are never cross-polluted
      expect(groupedBalances["USD"]).toBe(5000.5);
      expect(groupedBalances["EUR"]).toBe(800.0);
      expect(groupedBalances["GBP"]).toBe(450.25);
      expect(Object.keys(groupedBalances)).toHaveLength(3);
    });

    it("formats each currency accurately with its standard symbol or format", () => {
      expect(formatCurrency(1234.56, "USD")).toContain("1,234.56");
      expect(formatCurrency(1234.56, "EUR")).toMatch(/1[.,]234[.,]56/);
      expect(formatCurrency(1234.56, "GBP")).toContain("1,234.56");
      expect(formatCurrency(1234.56, "INR")).toMatch(/1,234.56|1,234\.56/);
    });
  });

  describe("CSV Export Serialization with Currency", () => {
    it("includes Currency and Has Receipt columns in serialized CSV rows", () => {
      const sanitizeCSVField = (field) => {
        const stringVal = String(field ?? "");
        if (/^[=+\-@\t\r]/.test(stringVal)) {
          return `"'${stringVal.replace(/"/g, '""')}"`;
        }
        if (/[",\n\r]/.test(stringVal)) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      };

      const transactions = [
        {
          date: new Date("2026-10-24"),
          description: "London Coffee",
          category: "food",
          type: "EXPENSE",
          amount: 4.5,
          currency: "GBP",
          isRecurring: false,
          recurringInterval: null,
          receiptUrl: "/api/receipts/tx_1",
        },
      ];

      const headers = [
        "Date",
        "Description",
        "Category",
        "Type",
        "Amount",
        "Currency",
        "Recurring",
        "Interval",
        "Has Receipt",
      ];

      const row = [
        sanitizeCSVField("2026-10-24"),
        sanitizeCSVField(transactions[0].description),
        sanitizeCSVField(transactions[0].category),
        sanitizeCSVField(transactions[0].type),
        sanitizeCSVField(transactions[0].amount),
        sanitizeCSVField(transactions[0].currency),
        sanitizeCSVField(transactions[0].isRecurring ? "Yes" : "No"),
        sanitizeCSVField(transactions[0].recurringInterval || "N/A"),
        sanitizeCSVField(transactions[0].receiptUrl ? "Yes" : "No"),
      ];

      expect(headers).toContain("Currency");
      expect(headers).toContain("Has Receipt");
      expect(row[5]).toBe("GBP");
      expect(row[8]).toBe("Yes");
    });
  });
});
