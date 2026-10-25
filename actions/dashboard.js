"use server";

import aj from "@/lib/arcjet";
import { db } from "@/lib/prisma";
import { request } from "@arcjet/next";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { roundFinancial } from "@/lib/currency";

const serializeTransaction = (obj) => {
  const serialized = { ...obj };
  if (obj.balance) {
    serialized.balance = obj.balance.toNumber();
  }
  if (obj.amount) {
    serialized.amount = obj.amount.toNumber();
  }
  return serialized;
};

export async function getUserAccounts() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.users.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  try {
    const accounts = await db.accounts.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    // Serialize accounts before sending to client
    const serializedAccounts = accounts.map(serializeTransaction);

    return serializedAccounts;
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function createAccount(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Get request data for ArcJet
    const req = await request();

    // Check rate limit
    const decision = await aj.protect(req, {
      userId,
      requested: 1, // Specify how many tokens to consume
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        console.error({
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            remaining,
            resetInSeconds: reset,
          },
        });

        throw new Error("Too many requests. Please try again later.");
      }

      throw new Error("Request blocked");
    }

    const user = await db.users.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Convert balance to valid float before saving
    const balanceFloat = roundFinancial(data.balance);
    if (isNaN(balanceFloat) || balanceFloat < 0) {
      throw new Error("Invalid balance amount");
    }

    // Check if this is the user's first account
    const existingAccounts = await db.accounts.findMany({
      where: { userId: user.id },
    });

    const shouldBeDefault =
      existingAccounts.length === 0 ? true : data.isDefault;

    // Validate and assign ISO 4217 currency
    const supportedCurrencies = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY"];
    const currency =
      data.currency && supportedCurrencies.includes(data.currency.toUpperCase())
        ? data.currency.toUpperCase()
        : "USD";

    // Create new account and update default status atomically
    const account = await db.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.accounts.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      return await tx.accounts.create({
        data: {
          id: crypto.randomUUID(),
          ...data,
          currency,
          balance: balanceFloat,
          userId: user.id,
          isDefault: shouldBeDefault,
          updatedAt: new Date(),
        },
      });
    });

    // Serialize the account before returning
    const serializedAccount = serializeTransaction(account);

    revalidatePath("/dashboard");
    return { success: true, data: serializedAccount };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getDashboardData() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.users.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get user transactions (limited for performance)
  const transactions = await db.transactions.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 500,
  });

  return transactions.map(serializeTransaction);
}

