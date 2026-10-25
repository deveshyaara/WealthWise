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
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    budgets: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    budget_categories: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    receipt_attachments: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  };
  mockDb.$transaction = vi.fn((callback) => callback(mockDb));
  return { mockAuth, mockDb };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  db: mockDb,
}));

import { createAccount } from "@/actions/dashboard";
import { createTransaction, updateTransaction, getReceiptForTransaction, deleteReceiptForTransaction } from "@/actions/transaction";
import { getCategoryBudgets, upsertCategoryBudget } from "@/actions/budget";

describe("End-to-End User Journey Integration Tests", () => {
  const primaryUser = { id: "user_primary", clerkUserId: "clerk_primary" };
  const attackerUser = { id: "user_attacker", clerkUserId: "clerk_attacker" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes full lifecycle: Multi-Currency Account -> Transaction with Receipt -> Category Budget Alerts -> Security Isolation", async () => {
    // 1. Authenticate as Primary User
    mockAuth.mockResolvedValue({ userId: primaryUser.clerkUserId });
    mockDb.users.findUnique.mockResolvedValue(primaryUser);

    // 2. Step 1: Create a EUR Account
    mockDb.accounts.findMany.mockResolvedValue([]); // First account
    mockDb.accounts.create.mockResolvedValue({
      id: "acc_eur_1",
      name: "Euro Travel",
      type: "CURRENT",
      currency: "EUR",
      balance: { toNumber: () => 1000.0 },
      isDefault: true,
      userId: primaryUser.id,
    });

    const accountRes = await createAccount({
      name: "Euro Travel",
      type: "CURRENT",
      currency: "EUR",
      balance: "1000.00",
      isDefault: true,
    });

    expect(accountRes.success).toBe(true);
    expect(accountRes.data.currency).toBe("EUR");
    expect(mockDb.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currency: "EUR",
          balance: 1000.0,
        }),
      })
    );

    // 3. Step 2: Set up a Category Budget for 'dining' with 200 EUR limit
    mockDb.accounts.findFirst.mockResolvedValue({
      id: "acc_eur_1",
      userId: primaryUser.id,
    });
    mockDb.budget_categories.findFirst.mockResolvedValue(null);
    mockDb.budget_categories.create.mockResolvedValue({
      id: "b_cat_dining",
      category: "dining",
      amount: { toNumber: () => 200.0 },
      accountId: "acc_eur_1",
      userId: primaryUser.id,
    });

    const budgetRes = await upsertCategoryBudget({
      category: "dining",
      amount: 200.0,
      accountId: "acc_eur_1",
    });

    expect(budgetRes.success).toBe(true);
    expect(budgetRes.data.amount).toBe(200.0);

    // 4. Step 3: Create a Transaction with an Attached Receipt
    // Real JPEG magic bytes encoded in base64: FF D8 FF E0
    const validJpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).toString("base64");

    mockDb.accounts.findFirst.mockResolvedValue({
      id: "acc_eur_1",
      userId: primaryUser.id,
      balance: { toNumber: () => 1000.0 },
    });

    mockDb.transactions.create.mockResolvedValue({
      id: "tx_restaurant_1",
      type: "EXPENSE",
      amount: { toNumber: () => 170.0 }, // 170 / 200 = 85% -> Triggers 80% threshold warning!
      description: "Paris Bistro Dinner",
      category: "dining",
      accountId: "acc_eur_1",
      userId: primaryUser.id,
      date: new Date(),
    });

    mockDb.receipt_attachments.upsert.mockResolvedValue({
      id: "att_paris_1",
      transactionId: "tx_restaurant_1",
      fileName: "bistro_bill.jpg",
      fileSize: 8,
    });

    const txRes = await createTransaction({
      type: "EXPENSE",
      amount: "170.00",
      description: "Paris Bistro Dinner",
      category: "dining",
      accountId: "acc_eur_1",
      date: new Date(),
      receipt: {
        base64: validJpegBase64,
        name: "bistro_bill.jpg",
        type: "image/jpeg",
      },
    });

    expect(txRes.success).toBe(true);
    expect(txRes.data.amount).toBe(170.0);

    // Verify account balance was decremented by 170 EUR atomically
    expect(mockDb.accounts.update).toHaveBeenCalledWith({
      where: { id: "acc_eur_1" },
      data: {
        balance: {
          increment: -170.0,
        },
      },
    });

    // Verify receipt was saved and attached
    expect(mockDb.receipt_attachments.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transactionId: "tx_restaurant_1" },
        create: expect.objectContaining({
          transactionId: "tx_restaurant_1",
          userId: primaryUser.id,
          fileName: "bistro_bill.jpg",
        }),
      })
    );

    // 5. Step 4: Verify Category Budget Threshold reflects 85% spending warning
    mockDb.budget_categories.findMany.mockResolvedValue([
      {
        id: "b_cat_dining",
        category: "dining",
        amount: { toNumber: () => 200.0 },
        accountId: "acc_eur_1",
        accounts: { id: "acc_eur_1", name: "Euro Travel", currency: "EUR" },
        createdAt: new Date(),
      },
    ]);

    mockDb.transactions.groupBy.mockResolvedValue([
      {
        category: "dining",
        _sum: { amount: { toNumber: () => 170.0 } },
      },
    ]);

    const budgetsCheck = await getCategoryBudgets("acc_eur_1");
    expect(budgetsCheck.success).toBe(true);
    const diningBudget = budgetsCheck.data[0];
    expect(diningBudget.spent).toBe(170.0);
    expect(diningBudget.remaining).toBe(30.0);
    expect(diningBudget.percentUsed).toBe(85);
    expect(diningBudget.isWarning80).toBe(true); // 85% >= 80%
    expect(diningBudget.isExceeded).toBe(false);

    // 6. Step 5: Verify Authorized Receipt Retrieval
    mockDb.transactions.findFirst.mockResolvedValue({
      id: "tx_restaurant_1",
      userId: primaryUser.id,
      receipt_attachments: {
        id: "att_paris_1",
        fileName: "bistro_bill.jpg",
        fileType: "image/jpeg",
        fileSize: 8,
      },
    });

    const receiptUrlRes = await getReceiptForTransaction("tx_restaurant_1");
    expect(receiptUrlRes.url).toBe("/api/receipts/tx_restaurant_1");
    expect(receiptUrlRes.fileName).toBe("bistro_bill.jpg");

    // 7. Step 6: Adversarial Security Test - Attacker tries to view or delete Primary User's receipt
    mockAuth.mockResolvedValue({ userId: attackerUser.clerkUserId });
    mockDb.users.findUnique.mockResolvedValue(attackerUser);
    mockDb.transactions.findFirst.mockResolvedValue(null); // Not found under attacker user ID

    const attackerReceiptUrl = await getReceiptForTransaction("tx_restaurant_1");
    expect(attackerReceiptUrl).toBeNull();

    mockDb.receipt_attachments.findFirst.mockResolvedValue(null);
    const attackerDeleteRes = await deleteReceiptForTransaction("tx_restaurant_1");
    expect(attackerDeleteRes.success).toBe(false);
    expect(attackerDeleteRes.error).toBe("Receipt not found.");

    // 8. Step 7: Authorized Owner Deletes Receipt
    mockAuth.mockResolvedValue({ userId: primaryUser.clerkUserId });
    mockDb.users.findUnique.mockResolvedValue(primaryUser);
    mockDb.receipt_attachments.findFirst.mockResolvedValue({
      id: "att_paris_1",
      transactionId: "tx_restaurant_1",
      userId: primaryUser.id,
    });
    mockDb.receipt_attachments.delete.mockResolvedValue({});
    mockDb.transactions.update.mockResolvedValue({});

    const ownerDeleteRes = await deleteReceiptForTransaction("tx_restaurant_1");
    expect(ownerDeleteRes.success).toBe(true);
    expect(mockDb.receipt_attachments.delete).toHaveBeenCalledWith({
      where: { id: "att_paris_1" },
    });

    // 9. Step 8: Update Transaction amount and verify delta calculation
    mockDb.transactions.findFirst.mockResolvedValue({
      id: "tx_restaurant_1",
      userId: primaryUser.id,
      accountId: "acc_eur_1",
      amount: { toNumber: () => 170.0 },
      type: "EXPENSE",
    });
    mockDb.transactions.update.mockResolvedValue({
      id: "tx_restaurant_1",
      type: "EXPENSE",
      amount: { toNumber: () => 180.0 },
      description: "Paris Bistro Dinner (Updated)",
    });

    const updateRes = await updateTransaction("tx_restaurant_1", {
      amount: "180.00",
      type: "EXPENSE",
      description: "Paris Bistro Dinner (Updated)",
      accountId: "acc_eur_1",
      date: new Date(),
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.data.amount).toBe(180.0);
    // Delta: new is -180, old was -170 => net balance change is -10
    expect(mockDb.accounts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acc_eur_1" },
        data: {
          balance: {
            increment: -10,
          },
        },
      })
    );
  });
});
