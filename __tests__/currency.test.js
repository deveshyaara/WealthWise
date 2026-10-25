import { describe, it, expect } from "vitest";
import {
  roundFinancial,
  safeAdd,
  safeSubtract,
  safeMultiply,
  toCents,
  fromCents,
  formatCurrency,
  getCurrencySymbol,
  SUPPORTED_CURRENCIES,
} from "@/lib/currency";

describe("Financial Currency & Arithmetic Utilities", () => {
  describe("Decimal Precision & Rounding", () => {
    it("eliminates floating-point addition drift (0.1 + 0.2 === 0.30)", () => {
      // Standard JS: 0.1 + 0.2 === 0.30000000000000004
      expect(0.1 + 0.2).not.toBe(0.3);
      // Safe financial addition:
      expect(safeAdd(0.1, 0.2)).toBe(0.3);
    });

    it("safely subtracts decimal monetary amounts", () => {
      expect(safeSubtract(100.55, 50.25)).toBe(50.3);
      expect(safeSubtract(1.03, 0.42)).toBe(0.61);
    });

    it("safely multiplies amounts with tax/percentages", () => {
      expect(safeMultiply(19.99, 3)).toBe(59.97);
      expect(safeMultiply(100, 0.18)).toBe(18);
    });

    it("converts to and from integer cents without drift", () => {
      expect(toCents(45.99)).toBe(4599);
      expect(fromCents(4599)).toBe(45.99);
      expect(toCents(0.05)).toBe(5);
      expect(fromCents(5)).toBe(0.05);
    });

    it("handles negative amounts correctly", () => {
      expect(safeAdd(-50, 20)).toBe(-30);
      expect(safeSubtract(-50, 20)).toBe(-70);
    });

    it("handles zero and invalid inputs safely", () => {
      expect(roundFinancial(null)).toBe(0);
      expect(roundFinancial("abc")).toBe(0);
      expect(safeAdd("12.50", 7.5)).toBe(20);
    });
  });

  describe("Locale-Aware Currency Formatting", () => {
    it("formats INR correctly with standard rupee symbol", () => {
      const formatted = formatCurrency(125000.5, "INR");
      expect(formatted).toContain("1,25,000.50");
      expect(formatted).toMatch(/₹/);
    });

    it("formats USD correctly", () => {
      const formatted = formatCurrency(1250.75, "USD");
      expect(formatted).toContain("1,250.75");
      expect(formatted).toMatch(/\$/);
    });

    it("formats EUR correctly", () => {
      const formatted = formatCurrency(99.9, "EUR");
      expect(formatted).toContain("99,90");
      expect(formatted).toMatch(/€/);
    });

    it("formats GBP correctly", () => {
      const formatted = formatCurrency(500, "GBP");
      expect(formatted).toContain("500.00");
      expect(formatted).toMatch(/£/);
    });

    it("formats JPY with 0 decimal places", () => {
      const formatted = formatCurrency(1500, "JPY");
      expect(formatted).toMatch(/1,500/);
      expect(formatted).not.toContain(".00");
    });

    it("provides correct currency symbols", () => {
      expect(getCurrencySymbol("INR")).toBe("₹");
      expect(getCurrencySymbol("USD")).toBe("$");
      expect(getCurrencySymbol("EUR")).toBe("€");
      expect(getCurrencySymbol("GBP")).toBe("£");
    });

    it("supports all declared currencies", () => {
      for (const code of Object.keys(SUPPORTED_CURRENCIES)) {
        expect(formatCurrency(100, code)).toBeTruthy();
      }
    });
  });
});
