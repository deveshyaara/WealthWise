import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Supported Gemini models ordered by priority and speed.
 */
export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-flash-latest",
  "gemini-pro-latest",
];

let genAIInstance = null;

function getGenAIClient() {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment configuration.");
    }
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

/**
 * Execute a generative AI prompt with fallback through candidate models.
 */
export async function executeWithFallback(promptOrParts, options = {}) {
  const client = getGenAIClient();
  const models = options.models || GEMINI_MODELS;
  let lastError = null;

  for (const modelName of models) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const apiResult = await model.generateContent(promptOrParts);
      const response = apiResult.response;
      const text = response.text();

      return {
        text,
        modelName,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini AI] Model ${modelName} failed: ${err.message}. Trying next candidate...`);
      if (err.message?.includes("API key not valid")) {
        throw new Error("Invalid Gemini API Key. Please verify your credentials.");
      }
    }
  }

  throw new Error(
    `All AI models failed to process request. Last error: ${lastError ? lastError.message : "Unknown error"}`
  );
}

/**
 * Receipt OCR Scanner with Multi-Model Fallback and JSON normalization.
 */
export async function parseReceiptWithAI({ buffer, mimeType }) {
  const imagePart = {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };

  const prompt = `
You are an expert AI financial document scanner.
Extract key transaction metadata from the attached receipt:
- Merchant Name
- Transaction Date (in YYYY-MM-DD format)
- Total Amount (numeric number only, e.g. 42.50)
- Currency (ISO code if visible e.g. INR, USD, EUR, or default to null)
- Category (one of: Housing, Transportation, Groceries, Utilities, Entertainment, Food, Shopping, Healthcare, Education, Travel, Personal Care, Miscellaneous)

Respond ONLY with a valid, clean JSON object with no markdown formatting and no extra text:
{
  "merchant": "Store Name",
  "date": "2026-10-24",
  "amount": 45.50,
  "currency": "INR",
  "category": "Groceries"
}

If any item is missing or unreadable, set its value to null.
`;

  const { text, modelName } = await executeWithFallback([prompt, imagePart]);

  // Clean Markdown JSON wrapping if present
  const cleanedText = text
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (err) {
    console.error("[Gemini AI] JSON parse error:", err.message);
    throw new Error("Failed to parse receipt output into valid JSON.");
  }

  // Validate and sanitize extracted fields
  const sanitized = {
    merchant: parsed.merchant ? String(parsed.merchant).trim() : null,
    amount: null,
    date: null,
    category: parsed.category ? String(parsed.category).trim() : null,
    currency: parsed.currency ? String(parsed.currency).trim().toUpperCase() : null,
    description: parsed.merchant ? String(parsed.merchant).trim() : "Receipt Expense",
  };

  if (parsed.amount !== null && parsed.amount !== undefined) {
    const rawAmt = typeof parsed.amount === "string" ? parsed.amount.replace(/[^0-9.]/g, "") : parsed.amount;
    const num = parseFloat(rawAmt);
    if (!isNaN(num) && num > 0) {
      sanitized.amount = Math.round((num + Number.EPSILON) * 100) / 100;
    }
  }

  if (parsed.date) {
    const dateObj = new Date(parsed.date);
    if (!isNaN(dateObj.getTime())) {
      sanitized.date = parsed.date;
    }
  }

  return {
    data: sanitized,
    modelUsed: modelName,
  };
}

/**
 * Generate monthly financial insights from calculated statistics.
 */
export async function generateMonthlyInsightsAI(stats, monthName) {
  const prompt = `
Analyze this user's monthly financial report and return exactly 3 concise, practical, actionable insights.
Focus on spending velocity, category concentrations, and practical savings advice.

Monthly Financial Data for ${monthName}:
- Total Income: ₹${stats.totalIncome}
- Total Expenses: ₹${stats.totalExpenses}
- Net Cash Flow: ₹${stats.totalIncome - stats.totalExpenses}
- Spending by Category: ${Object.entries(stats.byCategory || {})
    .map(([cat, val]) => `${cat}: ₹${val}`)
    .join(", ")}

Respond ONLY as a valid JSON array of 3 strings:
["Actionable insight 1", "Actionable insight 2", "Actionable insight 3"]
`;

  try {
    const { text } = await executeWithFallback(prompt);
    const cleanedText = text
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const insights = JSON.parse(cleanedText);
    if (Array.isArray(insights) && insights.length > 0) {
      return insights.slice(0, 3);
    }
  } catch (err) {
    console.warn("[Gemini AI] Insight generation failed, using deterministic fallback:", err.message);
  }

  // Deterministic rule-based fallback ensuring zero downtime
  const net = stats.totalIncome - stats.totalExpenses;
  const insights = [];

  if (net > 0) {
    insights.push(`You generated a positive cash flow of ₹${net.toFixed(2)} this month.`);
  } else if (net < 0) {
    insights.push(`Expenses exceeded income by ₹${Math.abs(net).toFixed(2)}; look for categories to trim.`);
  } else {
    insights.push("Your income and expenses balanced exactly this month.");
  }

  // Find top spending category
  const categories = Object.entries(stats.byCategory || {});
  if (categories.length > 0) {
    categories.sort((a, b) => b[1] - a[1]);
    const [topCat, topVal] = categories[0];
    insights.push(`Your highest spending category was ${topCat} (₹${topVal.toFixed(2)}).`);
  } else {
    insights.push("Setting up category budgets will help track your biggest cost centers.");
  }

  insights.push("Review recurring subscriptions to ensure you are only paying for services you actively use.");
  return insights;
}
