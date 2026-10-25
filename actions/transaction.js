"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";
import crypto from "crypto";
import { safeSubtract, roundFinancial } from "@/lib/currency";
import { parseReceiptWithAI } from "@/lib/gemini";
import { validateImageMagicBytes } from "@/lib/receipt-validator";
import {
  saveReceiptAttachment,
  getAuthorizedReceiptUrl,
  deleteReceiptAttachment,
} from "@/lib/receipt-storage";

const serializeAmount = (obj) => ({
  ...obj,
  amount: obj.amount.toNumber(),
});

// Create Transaction
export async function createTransaction(data) {
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

    const { receipt, ...cleanData } = data;

    const account = await db.accounts.findFirst({
      where: {
        id: cleanData.accountId,
        userId: user.id,
      },
    });

    if (!account) {
      throw new Error("Account not found");
    }

    // Calculate balance change with decimal-safe arithmetic
    const amountNum = roundFinancial(cleanData.amount);
    const balanceChange = cleanData.type === "EXPENSE" ? -amountNum : amountNum;

    // Create transaction and update account balance atomically
    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.transactions.create({
        data: {
          id: crypto.randomUUID(),
          ...cleanData,
          userId: user.id,
          updatedAt: new Date(),
          nextRecurringDate:
            cleanData.isRecurring && cleanData.recurringInterval
              ? calculateNextRecurringDate(cleanData.date, cleanData.recurringInterval)
              : null,
        },
      });

      await tx.accounts.update({
        where: { id: cleanData.accountId },
        data: {
          balance: {
            increment: balanceChange,
          },
        },
      });

      return newTransaction;
    });

    // If a receipt payload was submitted, persist it persistently
    if (receipt && receipt.base64) {
      try {
        const buffer = Buffer.from(receipt.base64, "base64");
        if (validateImageMagicBytes(buffer)) {
          await saveReceiptAttachment({
            transactionId: transaction.id,
            userId: user.id,
            buffer,
            fileName: receipt.name || "receipt.jpg",
            fileType: receipt.type || "image/jpeg",
          });
        }
      } catch (attachErr) {
        console.warn("[Transaction] Failed to attach receipt:", attachErr.message);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getTransaction(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.users.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const transaction = await db.transactions.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!transaction) throw new Error("Transaction not found");

  return serializeAmount(transaction);
}

export async function updateTransaction(id, data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.users.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Get original transaction to calculate balance change and verify ownership
    const originalTransaction = await db.transactions.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        accounts: true,
      },
    });

    if (!originalTransaction) throw new Error("Transaction not found");

    const { receipt, removeReceipt, ...cleanData } = data;
    const targetAccountId = cleanData.accountId || originalTransaction.accountId;
    const targetAccount = await db.accounts.findFirst({
      where: {
        id: targetAccountId,
        userId: user.id,
      },
    });

    if (!targetAccount) {
      throw new Error("Target account not found or access denied");
    }

    // Calculate balance changes using decimal-safe arithmetic
    const oldBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? -roundFinancial(originalTransaction.amount.toNumber())
        : roundFinancial(originalTransaction.amount.toNumber());

    const amountNum = roundFinancial(cleanData.amount);
    const newBalanceChange =
      cleanData.type === "EXPENSE" ? -amountNum : amountNum;

    const netBalanceChange = safeSubtract(newBalanceChange, oldBalanceChange);

    // Update transaction and account balance in a transaction
    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transactions.update({
        where: { id },
        data: {
          ...cleanData,
          userId: user.id, // Strictly protect against ownership tampering
          accountId: targetAccountId,
          nextRecurringDate:
            cleanData.isRecurring && cleanData.recurringInterval
              ? calculateNextRecurringDate(cleanData.date, cleanData.recurringInterval)
              : null,
        },
      });

      // Update account balance: handle cross-account transfer vs same-account update
      if (targetAccountId !== originalTransaction.accountId) {
        // Revert balance impact on original account
        await tx.accounts.update({
          where: { id: originalTransaction.accountId },
          data: {
            balance: {
              increment: -oldBalanceChange,
            },
          },
        });

        // Apply new balance impact to destination account
        await tx.accounts.update({
          where: { id: targetAccountId },
          data: {
            balance: {
              increment: newBalanceChange,
            },
          },
        });
      } else {
        // Same account: apply net change
        await tx.accounts.update({
          where: { id: targetAccountId },
          data: {
            balance: {
              increment: netBalanceChange,
            },
          },
        });
      }

      return updated;
    });

    if (removeReceipt) {
      await deleteReceiptAttachment(id, user.id);
    } else if (receipt && receipt.base64) {
      try {
        const buffer = Buffer.from(receipt.base64, "base64");
        if (validateImageMagicBytes(buffer)) {
          await saveReceiptAttachment({
            transactionId: id,
            userId: user.id,
            buffer,
            fileName: receipt.name || "receipt.jpg",
            fileType: receipt.type || "image/jpeg",
          });
        }
      } catch (attachErr) {
        console.warn("[Transaction] Failed to update receipt:", attachErr.message);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath(`/account/${originalTransaction.accountId}`);
    if (targetAccountId !== originalTransaction.accountId) {
      revalidatePath(`/account/${targetAccountId}`);
    }

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Get User Transactions
export async function getUserTransactions(query = {}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.users.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Sanitize query to only allow safe Prisma filter fields
    const allowedFields = ['type', 'accountId', 'category', 'status', 'isRecurring'];
    const safeQuery = {};
    for (const key of allowedFields) {
      if (query[key] !== undefined) {
        safeQuery[key] = query[key];
      }
    }

    const transactions = await db.transactions.findMany({
      where: {
        userId: user.id,
        ...safeQuery,
      },
      include: {
        accounts: true,
        receipt_attachments: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            fileType: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return { success: true, data: transactions };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getReceiptForTransaction(transactionId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.users.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  return await getAuthorizedReceiptUrl(transactionId, user.id);
}

export async function deleteReceiptForTransaction(transactionId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.users.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const result = await deleteReceiptAttachment(transactionId, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/account/[id]");
  return result;
}

// Scan Receipt
export const scanReceipt = async (formData) => {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Unauthorized. Please sign in to scan receipts." };
  }

  const file = formData.get("file");

  if (!file || file.size === 0) {
    return { error: "No receipt image was provided." };
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Receipt image size exceeds the 5MB limit." };
  }

  // Validate MIME type
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
    return { error: "Unsupported image format. Please upload a JPG, PNG, or WebP photo." };
  }

  try {
    const req = await request();
    const decision = await aj.protect(req, {
      userId,
      requested: 1,
    });

    if (decision.isDenied()) {
      return { error: "Rate limit reached. Please wait before scanning another receipt." };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate file magic bytes (signature) to prevent spoofed MIME types
    if (!validateImageMagicBytes(buffer)) {
      return {
        error: "Invalid image signature. The uploaded file is corrupted or not a valid image.",
      };
    }

    const { data, modelUsed } = await parseReceiptWithAI({
      buffer,
      mimeType: file.type || "image/jpeg",
    });

    return { data, model: modelUsed };
  } catch (error) {
    console.error("Receipt scanning error:", error.message);
    return {
      error: error.message || "Failed to extract receipt information. Please try again or enter manually.",
    };
  }
};

// Helper function to calculate next recurring date
function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date;
}

