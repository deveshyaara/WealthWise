import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockDb } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockDb = {
    users: {
      findUnique: vi.fn(),
    },
    accounts: {
      findFirst: vi.fn(),
    },
    budget_categories: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transactions: {
      groupBy: vi.fn(),
    },
  };
  return { mockAuth, mockDb };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  db: mockDb,
}));

import {
  getCategoryBudgets,
  upsertCategoryBudget,
  deleteCategoryBudget,
} from "@/actions/budget";

describe("Category Budget Management & Thresholds", () => {
  const testUser = { id: "user_1", clerkUserId: "clerk_1" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "clerk_1" });
    mockDb.users.findUnique.mockResolvedValue(testUser);
  });

  describe("getCategoryBudgets", () => {
    it("returns correctly enriched category budgets with 80% warning and exceeded alerts", async () => {
      // Mock category budgets
      mockDb.budget_categories.findMany.mockResolvedValue([
        {
          id: "b_groceries",
          category: "groceries",
          amount: { toNumber: () => 500 },
          accountId: null,
          accounts: null,
          createdAt: new Date(),
        },
        {
          id: "b_entertainment",
          category: "entertainment",
          amount: { toNumber: () => 200 },
          accountId: null,
          accounts: null,
          createdAt: new Date(),
        },
        {
          id: "b_dining",
          category: "dining",
          amount: { toNumber: () => 300 },
          accountId: null,
          accounts: null,
          createdAt: new Date(),
        },
      ]);

      // Mock aggregated expenses
      mockDb.transactions.groupBy.mockResolvedValue([
        {
          category: "groceries",
          _sum: { amount: { toNumber: () => 420.5 } }, // 420.50 / 500 = 84.1% -> 80% Warning!
        },
        {
          category: "entertainment",
          _sum: { amount: { toNumber: () => 230 } }, // 230 / 200 = 115% -> Exceeded!
        },
        {
          category: "dining",
          _sum: { amount: { toNumber: () => 90 } }, // 90 / 300 = 30% -> Normal
        },
      ]);

      const res = await getCategoryBudgets();
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(3);

      // Groceries (84% -> Warning 80%)
      const groceries = res.data.find((b) => b.category === "groceries");
      expect(groceries.amount).toBe(500);
      expect(groceries.spent).toBe(420.5);
      expect(groceries.remaining).toBe(79.5);
      expect(groceries.percentUsed).toBe(84);
      expect(groceries.isWarning80).toBe(true);
      expect(groceries.isExceeded).toBe(false);

      // Entertainment (115% -> Exceeded)
      const entertainment = res.data.find((b) => b.category === "entertainment");
      expect(entertainment.spent).toBe(230);
      expect(entertainment.remaining).toBe(-30);
      expect(entertainment.percentUsed).toBe(115);
      expect(entertainment.isWarning80).toBe(false);
      expect(entertainment.isExceeded).toBe(true);

      // Dining (30% -> Normal)
      const dining = res.data.find((b) => b.category === "dining");
      expect(dining.percentUsed).toBe(30);
      expect(dining.isWarning80).toBe(false);
      expect(dining.isExceeded).toBe(false);
    });

    it("handles zero spending safely without divide by zero errors", async () => {
      mockDb.budget_categories.findMany.mockResolvedValue([
        {
          id: "b_travel",
          category: "travel",
          amount: { toNumber: () => 1000 },
          accountId: null,
          accounts: null,
          createdAt: new Date(),
        },
      ]);
      mockDb.transactions.groupBy.mockResolvedValue([]);

      const res = await getCategoryBudgets();
      expect(res.success).toBe(true);
      expect(res.data[0].spent).toBe(0);
      expect(res.data[0].remaining).toBe(1000);
      expect(res.data[0].percentUsed).toBe(0);
      expect(res.data[0].isWarning80).toBe(false);
      expect(res.data[0].isExceeded).toBe(false);
    });

    it("verifies account ownership when accountId filter is provided", async () => {
      mockDb.accounts.findFirst.mockResolvedValue(null);

      const res = await getCategoryBudgets("unauthorized_account");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Account not found or access denied");
    });
  });

  describe("upsertCategoryBudget", () => {
    it("creates a new category budget when none exists", async () => {
      mockDb.budget_categories.findFirst.mockResolvedValue(null);
      mockDb.budget_categories.create.mockResolvedValue({
        id: "b_new",
        category: "utilities",
        amount: { toNumber: () => 150 },
      });

      const res = await upsertCategoryBudget({
        category: "utilities",
        amount: 150,
      });

      expect(res.success).toBe(true);
      expect(res.data.amount).toBe(150);
      expect(mockDb.budget_categories.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user_1",
            category: "utilities",
            amount: 150,
          }),
        })
      );
    });

    it("updates existing category budget when one already exists for category", async () => {
      mockDb.budget_categories.findFirst.mockResolvedValue({
        id: "b_existing",
        category: "utilities",
        amount: { toNumber: () => 150 },
      });
      mockDb.budget_categories.update.mockResolvedValue({
        id: "b_existing",
        category: "utilities",
        amount: { toNumber: () => 200 },
      });

      const res = await upsertCategoryBudget({
        category: "utilities",
        amount: 200,
      });

      expect(res.success).toBe(true);
      expect(res.data.amount).toBe(200);
      expect(mockDb.budget_categories.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "b_existing" },
          data: expect.objectContaining({
            amount: 200,
          }),
        })
      );
    });

    it("rejects non-positive budget limits", async () => {
      const resZero = await upsertCategoryBudget({ category: "food", amount: 0 });
      expect(resZero.success).toBe(false);
      expect(resZero.error).toContain("must be a positive number");

      const resNegative = await upsertCategoryBudget({ category: "food", amount: -25 });
      expect(resNegative.success).toBe(false);

      const resNaN = await upsertCategoryBudget({ category: "food", amount: "abc" });
      expect(resNaN.success).toBe(false);
    });

    it("rejects empty or missing category name", async () => {
      const res = await upsertCategoryBudget({ category: "", amount: 100 });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Valid category name is required");
    });
  });

  describe("deleteCategoryBudget", () => {
    it("deletes category budget for authorized owner", async () => {
      mockDb.budget_categories.findFirst.mockResolvedValue({
        id: "b_1",
        userId: "user_1",
      });
      mockDb.budget_categories.delete.mockResolvedValue({});

      const res = await deleteCategoryBudget("b_1");
      expect(res.success).toBe(true);
      expect(mockDb.budget_categories.delete).toHaveBeenCalledWith({
        where: { id: "b_1" },
      });
    });

    it("denies deletion when budget belongs to another user or does not exist", async () => {
      mockDb.budget_categories.findFirst.mockResolvedValue(null);

      const res = await deleteCategoryBudget("b_foreign");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Category budget not found or access denied");
      expect(mockDb.budget_categories.delete).not.toHaveBeenCalled();
    });
  });
});
