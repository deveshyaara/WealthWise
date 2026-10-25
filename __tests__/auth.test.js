import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockDb } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockDb = {
    users: {
      findUnique: vi.fn(),
    },
    accounts: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    transactions: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
    budgets: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  };
  mockDb.$transaction = vi.fn((callback) => callback(mockDb));

  return { mockAuth, mockDb };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

// Mock ArcJet
vi.mock("@arcjet/next", () => ({
  request: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/arcjet", () => ({
  default: {
    protect: vi.fn().mockResolvedValue({
      isDenied: () => false,
      reason: { isRateLimit: () => false },
    }),
  },
}));

// Mock Next.js cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  db: mockDb,
}));

// Import server actions after mocks
import {
  createTransaction,
  getTransaction,
  updateTransaction,
  getUserTransactions,
} from "@/actions/transaction";
import {
  getAccountWithTransactions,
  bulkDeleteTransactions,
  updateDefaultAccount,
} from "@/actions/account";
import { getCurrentBudget } from "@/actions/budget";

describe("Server-Side Authorization & Cross-User Security Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication Fail-Closed Guarantees", () => {
    it("createTransaction rejects unauthenticated caller", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      await expect(
        createTransaction({ accountId: "acc-1", amount: 100, type: "EXPENSE" })
      ).rejects.toThrow("Unauthorized");
    });

    it("getTransaction rejects unauthenticated caller", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      await expect(getTransaction("tx-123")).rejects.toThrow("Unauthorized");
    });

    it("updateTransaction rejects unauthenticated caller", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      await expect(
        updateTransaction("tx-123", { amount: 50, type: "EXPENSE" })
      ).rejects.toThrow("Unauthorized");
    });

    it("bulkDeleteTransactions rejects unauthenticated caller", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const result = await bulkDeleteTransactions(["tx-1", "tx-2"]);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
    });

    it("getAccountWithTransactions rejects unauthenticated caller", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      await expect(getAccountWithTransactions("acc-1")).rejects.toThrow("Unauthorized");
    });

    it("updateDefaultAccount rejects unauthenticated caller", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const result = await updateDefaultAccount("acc-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
    });

    it("getCurrentBudget rejects unauthenticated caller", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      await expect(getCurrentBudget("acc-1")).rejects.toThrow("Unauthorized");
    });
  });

  describe("Cross-User Isolation & Ownership Enforcement", () => {
    const userA = { id: "db-user-A", clerkUserId: "clerk-user-A" };
    const userB = { id: "db-user-B", clerkUserId: "clerk-user-B" };

    beforeEach(() => {
      // Authenticated as User A
      mockAuth.mockResolvedValue({ userId: userA.clerkUserId });
      mockDb.users.findUnique.mockResolvedValue(userA);
    });

    it("getAccountWithTransactions returns null when accessing User B's account", async () => {
      mockDb.accounts.findFirst.mockResolvedValue(null);

      const result = await getAccountWithTransactions("acc-of-user-B");
      expect(result).toBeNull();
      expect(mockDb.accounts.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "acc-of-user-B",
            userId: userA.id,
          },
        })
      );
    });

    it("createTransaction prevents creating a transaction on User B's account", async () => {
      // User B's account returns null when queried with userId = User A
      mockDb.accounts.findFirst.mockResolvedValue(null);

      await expect(
        createTransaction({
          accountId: `acc-owned-by-${userB.id}`,
          amount: 500,
          type: "EXPENSE",
          category: "Shopping",
          date: new Date(),
        })
      ).rejects.toThrow("Account not found");

      expect(mockDb.accounts.findFirst).toHaveBeenCalledWith({
        where: {
          id: `acc-owned-by-${userB.id}`,
          userId: userA.id,
        },
      });
    });

    it("getTransaction rejects accessing User B's transaction", async () => {
      // Searching for transaction with userId = User A returns null
      mockDb.transactions.findFirst.mockResolvedValue(null);

      await expect(getTransaction("tx-of-user-B")).rejects.toThrow(
        "Transaction not found"
      );

      expect(mockDb.transactions.findFirst).toHaveBeenCalledWith({
        where: {
          id: "tx-of-user-B",
          userId: userA.id,
        },
      });
    });

    it("updateTransaction prevents editing User B's transaction", async () => {
      mockDb.transactions.findFirst.mockResolvedValue(null);

      await expect(
        updateTransaction("tx-of-user-B", {
          amount: 999,
          type: "INCOME",
          accountId: "acc-A",
        })
      ).rejects.toThrow("Transaction not found");

      expect(mockDb.transactions.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "tx-of-user-B",
            userId: userA.id,
          },
        })
      );
    });

    it("updateTransaction prevents moving transaction to an account owned by User B", async () => {
      // User A owns the original transaction
      mockDb.transactions.findFirst.mockResolvedValue({
        id: "tx-1",
        userId: userA.id,
        accountId: "acc-owned-by-A",
        amount: { toNumber: () => 100 },
        type: "EXPENSE",
      });

      // Target account belongs to User B (so query with userId: userA.id returns null)
      mockDb.accounts.findFirst.mockResolvedValue(null);

      await expect(
        updateTransaction("tx-1", {
          amount: 100,
          type: "EXPENSE",
          accountId: "acc-owned-by-B",
        })
      ).rejects.toThrow(/Target account not found or access denied/i);
    });

    it("updateTransaction reconciles balances across both accounts when transferred", async () => {
      // Original: $100 expense on acc-1
      mockDb.transactions.findFirst.mockResolvedValue({
        id: "tx-1",
        userId: userA.id,
        accountId: "acc-1",
        amount: { toNumber: () => 100 },
        type: "EXPENSE",
      });

      // Destination: acc-2 also owned by User A
      mockDb.accounts.findFirst.mockResolvedValue({
        id: "acc-2",
        userId: userA.id,
      });

      mockDb.transactions.update.mockResolvedValue({
        id: "tx-1",
        amount: { toNumber: () => 150 },
      });

      // Edit: Move to acc-2 with amount $150
      await updateTransaction("tx-1", {
        amount: 150,
        type: "EXPENSE",
        accountId: "acc-2",
      });

      // acc-1 should be refunded +100
      expect(mockDb.accounts.update).toHaveBeenCalledWith({
        where: { id: "acc-1" },
        data: { balance: { increment: 100 } },
      });

      // acc-2 should be debited -150
      expect(mockDb.accounts.update).toHaveBeenCalledWith({
        where: { id: "acc-2" },
        data: { balance: { increment: -150 } },
      });
    });

    it("createTransaction strictly ignores client-tampered userId in data payload", async () => {
      mockDb.accounts.findFirst.mockResolvedValue({
        id: "acc-A",
        userId: userA.id,
        balance: { toNumber: () => 500 },
      });

      mockDb.transactions.create.mockResolvedValue({
        id: "new-tx",
        amount: { toNumber: () => 50 },
      });

      // Tampered data attempting to set userId to "attacker-id"
      await createTransaction({
        userId: "attacker-id",
        accountId: "acc-A",
        amount: 50,
        type: "EXPENSE",
        category: "Food",
        date: new Date(),
      });

      expect(mockDb.transactions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: userA.id, // Strictly server-derived userA.id
          }),
        })
      );
    });

    it("updateDefaultAccount fails closed if attempting to hijack User B's account", async () => {
      // Account does not belong to User A
      mockDb.accounts.findFirst.mockResolvedValue(null);

      const result = await updateDefaultAccount("account-of-user-B");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Account not found or access denied/i);
    });

    it("getCurrentBudget fails closed when queried with User B's accountId", async () => {
      mockDb.accounts.findFirst.mockResolvedValue(null);

      await expect(getCurrentBudget("account-of-user-B")).rejects.toThrow(
        /Account not found or access denied/i
      );
    });

    it("bulkDeleteTransactions cannot delete transactions belonging to another user", async () => {
      // Attempting to delete tx-1 (User A) and tx-foreign (User B)
      // Database query only returns transactions matching userId: userA.id
      mockDb.transactions.findMany.mockResolvedValue([
        {
          id: "tx-1",
          accountId: "acc-A",
          amount: { toNumber: () => 100 },
          type: "EXPENSE",
          userId: userA.id,
        },
      ]);

      const result = await bulkDeleteTransactions(["tx-1", "tx-foreign"]);
      expect(result.success).toBe(true);

      // Verify that deleteMany strictly scoped to userA.id
      expect(mockDb.transactions.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["tx-1", "tx-foreign"] },
          userId: userA.id,
        },
      });
    });

    it("getUserTransactions filters queries to the authenticated user ID", async () => {
      mockDb.transactions.findMany.mockResolvedValue([]);

      await getUserTransactions({ category: "Food" });

      expect(mockDb.transactions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: userA.id,
            category: "Food",
          }),
        })
      );
    });
  });
});
