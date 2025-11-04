"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";

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

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const account = await db.account.findUnique({
      where: {
        id: data.accountId,
        userId: user.id,
      },
    });

    if (!account) {
      throw new Error("Account not found");
    }

    // Calculate new balance
    const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
    const newBalance = account.balance.toNumber() + balanceChange;

    // Create transaction and update account balance
    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          ...data,
          userId: user.id,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: newBalance },
      });

      return newTransaction;
    });

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

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const transaction = await db.transaction.findUnique({
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

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Get original transaction to calculate balance change
    const originalTransaction = await db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) throw new Error("Transaction not found");

    // Calculate balance changes
    const oldBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? -originalTransaction.amount.toNumber()
        : originalTransaction.amount.toNumber();

    const newBalanceChange =
      data.type === "EXPENSE" ? -data.amount : data.amount;

    const netBalanceChange = newBalanceChange - oldBalanceChange;

    // Update transaction and account balance in a transaction
    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: {
          id,
          userId: user.id,
        },
        data: {
          ...data,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      // Update account balance
      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance: {
            increment: netBalanceChange,
          },
        },
      });

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

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

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const transactions = await db.transaction.findMany({
      where: {
        userId: user.id,
        ...query,
      },
      include: {
        account: true,
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

// Scan Receipt
export const scanReceipt = async (formData) => {
  console.log("Scanned receipt...");
  const { userId } = await auth();

  if (!userId) {
    return { error: "User not found" };
  }

  const file = formData.get("file");
  console.log("File received:", file.name, "size:", file.size, "type:", file.type);

  if (!file || file.size === 0) {
    return { error: "Image not found" };
  }

  try {
    console.log("Checking Arcjet rate limit...");
    const decision = await aj.protect(request, {
      key: "scan-receipt-rate-limit",
      requested: 10, 
    });

    if (decision.isDenied()) {
      console.warn("Arcjet rate limit exceeded. Remaining:", decision.remaining);
      return { error: "Rate limit exceeded. Please try again later." };
    }
    console.log("Arcjet rate limit check passed. Remaining:", decision.remaining);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log("Image converted to buffer, size:", buffer.length);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("GoogleGenerativeAI initialized.");

    const imagePart = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: file.type,
      },
    };
    console.log("Image part created for Gemini API.");

    const allModels = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-flash-latest",
      "gemini-pro-latest",
    ];
    let result;
    let selectedModel;

    for (const modelName of allModels) {
      try {
        console.log(`Attempting to use model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        console.log(`Model ${modelName} loaded.`);
        
        const prompt = `
          You are an intelligent receipt scanner. Your task is to extract the following information from the receipt image:
          - Merchant Name
          - Transaction Date (in YYYY-MM-DD format)
          - Total Amount
          - Category (e.g., Groceries, Dining, Gas, etc.)

          Provide the output in a clean, machine-readable JSON format. For example:
          {
            "merchant": "Example Store",
            "date": "2024-07-29",
            "amount": 75.50,
            "category": "Groceries"
          }

          If any information is not available, set its value to null. Do not add any extra text or explanations outside of the JSON object.
        `;
        console.log(`Prompt created for model ${modelName}.`);

        const apiResult = await model.generateContent([prompt, imagePart]);
        console.log(`API call to ${modelName} successful.`);
        
        const response = apiResult.response;
        const text = response.text();
        console.log(`Raw response from ${modelName}:`, text);

        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        console.log(`Cleaned response from ${modelName}:`, cleanedText);

        result = JSON.parse(cleanedText);
        
        // Normalize and validate the result
        if (result) {
          // Ensure amount is a number
          if (result.amount) {
            result.amount = parseFloat(result.amount);
            if (isNaN(result.amount)) {
              result.amount = null;
            }
          }
          
          // Ensure date is in correct format
          if (result.date) {
            const dateObj = new Date(result.date);
            if (isNaN(dateObj.getTime())) {
              result.date = null;
            }
          }
          
          // Set defaults for missing fields
          result.merchant = result.merchant || null;
          result.category = result.category || null;
          result.description = result.description || result.merchant || null;
        }
        
        selectedModel = modelName;
        console.log(`Successfully parsed JSON from ${modelName}.`);
        console.log(`Normalized result:`, result);
        break; 
      } catch (error) {
        console.error(`Error with model ${modelName}:`, error.message);
        if (error.message.includes("API key not valid")) {
          console.error("Terminating attempts due to invalid API key.");
          return { error: "Invalid Gemini API key. Please check your credentials." };
        }
      }
    }

    if (!result) {
      console.error("All Gemini models failed to process the receipt.");
      return { error: "Unable to process receipt with any available model." };
    }

    console.log(`Receipt processed successfully with model: ${selectedModel}`);
    console.log("Parsed data:", result);
    return { data: result };

  } catch (error) {
    console.error("An unexpected error occurred during receipt scanning:", error);
    return { error: "An unexpected error occurred. Please try again." };
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
