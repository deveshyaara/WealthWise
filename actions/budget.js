"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { roundFinancial } from "@/lib/currency";

export async function getCurrentBudget(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.users.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const budget = await db.budgets.findFirst({
      where: {
        userId: user.id,
      },
    });

    // Get current month's expenses
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    if (accountId) {
      const account = await db.accounts.findFirst({
        where: { id: accountId, userId: user.id },
      });
      if (!account) {
        throw new Error("Account not found or access denied");
      }
    }

    const expenses = await db.transactions.aggregate({
      where: {
        userId: user.id,
        type: "EXPENSE",
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        accountId,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      budget: budget ? { ...budget, amount: budget.amount.toNumber() } : null,
      currentExpenses: expenses._sum.amount
        ? expenses._sum.amount.toNumber()
        : 0,
    };
  } catch (error) {
    if (error.message !== "Unauthorized" && !error.message.includes("access denied")) {
      console.error("Error fetching budget:", error.message);
    }
    throw error;
  }
}

export async function updateBudget(amount) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.users.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const validAmount = roundFinancial(amount);
    if (isNaN(validAmount) || validAmount <= 0) {
      throw new Error("Budget amount must be a positive number.");
    }

    // Update or create budget
    const budget = await db.budgets.upsert({
      where: {
        userId: user.id,
      },
      update: {
        amount: validAmount,
        updatedAt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        amount: validAmount,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      data: { ...budget, amount: budget.amount.toNumber() },
    };
  } catch (error) {
    console.error("Error updating budget:", error);
    return { success: false, error: error.message };
  }
}

export async function getCategoryBudgets(accountId = null) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.users.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    if (accountId) {
      const account = await db.accounts.findFirst({
        where: { id: accountId, userId: user.id },
      });
      if (!account) throw new Error("Account not found or access denied");
    }

    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    // Fetch user's category budgets
    const categoryBudgets = await db.budget_categories.findMany({
      where: {
        userId: user.id,
        ...(accountId ? { accountId } : {}),
      },
      include: {
        accounts: {
          select: { id: true, name: true, currency: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Aggregate expenses for the month grouped by category
    const expenseAggregations = await db.transactions.groupBy({
      by: ["category"],
      where: {
        userId: user.id,
        type: "EXPENSE",
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        ...(accountId ? { accountId } : {}),
      },
      _sum: {
        amount: true,
      },
    });

    const expenseMap = new Map();
    for (const exp of expenseAggregations) {
      expenseMap.set(exp.category, exp._sum.amount ? exp._sum.amount.toNumber() : 0);
    }

    const enrichedBudgets = categoryBudgets.map((b) => {
      const budgetAmount = b.amount.toNumber();
      const spent = roundFinancial(expenseMap.get(b.category) || 0);
      const remaining = roundFinancial(budgetAmount - spent);
      const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

      return {
        id: b.id,
        category: b.category,
        amount: budgetAmount,
        accountId: b.accountId,
        accountName: b.accounts?.name || "All Accounts",
        currency: b.accounts?.currency || "USD",
        spent,
        remaining,
        percentUsed,
        isWarning80: percentUsed >= 80 && percentUsed < 100,
        isExceeded: percentUsed >= 100,
        createdAt: b.createdAt,
      };
    });

    return { success: true, data: enrichedBudgets };
  } catch (error) {
    console.error("Error fetching category budgets:", error.message);
    return { success: false, error: error.message };
  }
}

export async function upsertCategoryBudget({ category, amount, accountId = null }) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.users.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    if (!category || typeof category !== "string") {
      throw new Error("Valid category name is required.");
    }

    const validAmount = roundFinancial(amount);
    if (isNaN(validAmount) || validAmount <= 0) {
      throw new Error("Budget amount must be a positive number.");
    }

    if (accountId) {
      const account = await db.accounts.findFirst({
        where: { id: accountId, userId: user.id },
      });
      if (!account) throw new Error("Account not found or access denied");
    }

    // Check if category budget already exists for this user + category + accountId
    const existing = await db.budget_categories.findFirst({
      where: {
        userId: user.id,
        category,
        accountId: accountId || null,
      },
    });

    let savedBudget;
    if (existing) {
      savedBudget = await db.budget_categories.update({
        where: { id: existing.id },
        data: {
          amount: validAmount,
          updatedAt: new Date(),
        },
      });
    } else {
      savedBudget = await db.budget_categories.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          category,
          amount: validAmount,
          accountId: accountId || null,
          updatedAt: new Date(),
        },
      });
    }

    revalidatePath("/dashboard");
    return {
      success: true,
      data: {
        ...savedBudget,
        amount: savedBudget.amount.toNumber(),
      },
    };
  } catch (error) {
    console.error("Error upserting category budget:", error.message);
    return { success: false, error: error.message };
  }
}

export async function deleteCategoryBudget(budgetId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.users.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const existing = await db.budget_categories.findFirst({
      where: {
        id: budgetId,
        userId: user.id,
      },
    });

    if (!existing) {
      throw new Error("Category budget not found or access denied.");
    }

    await db.budget_categories.delete({
      where: { id: budgetId },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting category budget:", error.message);
    return { success: false, error: error.message };
  }
}

