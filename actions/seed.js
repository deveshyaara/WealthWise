"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { subDays } from "date-fns";
import crypto from "crypto";
import { roundFinancial, safeAdd } from "@/lib/currency";

// Categories with typical amount ranges
const CATEGORIES = {
  INCOME: [
    { name: "salary", range: [4000, 7500] },
    { name: "freelance", range: [800, 2500] },
    { name: "investments", range: [300, 1500] },
    { name: "other-income", range: [100, 800] },
  ],
  EXPENSE: [
    { name: "housing", range: [800, 1800] },
    { name: "transportation", range: [80, 400] },
    { name: "groceries", range: [150, 500] },
    { name: "utilities", range: [80, 250] },
    { name: "entertainment", range: [40, 180] },
    { name: "food", range: [40, 120] },
    { name: "shopping", range: [80, 400] },
    { name: "healthcare", range: [50, 600] },
    { name: "education", range: [100, 800] },
    { name: "travel", range: [300, 1500] },
  ],
};

function getRandomAmount(min, max) {
  return roundFinancial(Math.random() * (max - min) + min);
}

function getRandomCategory(type) {
  const categories = CATEGORIES[type];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = getRandomAmount(category.range[0], category.range[1]);
  return { category: category.name, amount };
}

export async function seedTransactions(targetAccountId = null) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("Unauthorized. Seeding requires an authenticated user session.");
    }

    // Safety guard for production environments
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PRODUCTION_SEED) {
      throw new Error("Database seeding is disabled in production environments.");
    }

    const user = await db.users.findUnique({
      where: { clerkUserId: userId },
      include: { accounts: true },
    });

    if (!user) {
      throw new Error("User record not found in database. Please log in first.");
    }

    // Determine target account
    let account = null;
    if (targetAccountId) {
      account = user.accounts.find((a) => a.id === targetAccountId);
    }
    if (!account) {
      account = user.accounts.find((a) => a.isDefault) || user.accounts[0];
    }

    // If user has no account, create one for demonstration
    if (!account) {
      account = await db.accounts.create({
        data: {
          id: crypto.randomUUID(),
          name: "Main Checking",
          type: "CURRENT",
          balance: 0,
          isDefault: true,
          userId: user.id,
          updatedAt: new Date(),
        },
      });
    }

    // Generate 90 days of transactions
    const transactions = [];
    let netBalance = 0;

    for (let i = 90; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const count = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < count; j++) {
        const type = Math.random() < 0.35 ? "INCOME" : "EXPENSE";
        const { category, amount } = getRandomCategory(type);

        transactions.push({
          id: crypto.randomUUID(),
          type,
          amount,
          description: `${type === "INCOME" ? "Received" : "Paid for"} ${category}`,
          date,
          category,
          status: "COMPLETED",
          userId: user.id,
          accountId: account.id,
          createdAt: date,
          updatedAt: date,
        });

        const delta = type === "INCOME" ? amount : -amount;
        netBalance = safeAdd(netBalance, delta);
      }
    }

    // Replace account transactions and set balance atomically
    await db.$transaction(async (tx) => {
      await tx.transactions.deleteMany({
        where: { accountId: account.id, userId: user.id },
      });

      await tx.transactions.createMany({
        data: transactions,
      });

      await tx.accounts.update({
        where: { id: account.id },
        data: { balance: Math.max(0, netBalance) },
      });
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${account.id}`);

    return {
      success: true,
      message: `Successfully seeded ${transactions.length} transactions for account '${account.name}'.`,
      accountId: account.id,
    };
  } catch (error) {
    console.error("Error seeding transactions:", error.message);
    return { success: false, error: error.message };
  }
}
