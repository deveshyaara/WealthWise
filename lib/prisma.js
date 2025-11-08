import { PrismaClient } from "@prisma/client";

// Declare global variable to store the Prisma instance across hot reloads
const globalForPrisma = globalThis;

// Function to create or get the Prisma Client instance
function getPrismaClient() {
  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

    // Connect in production
    if (process.env.NODE_ENV === "production") {
      globalForPrisma.prismaClient.$connect().catch((err) => {
        console.error("❌ Failed to connect to database:", err);
      });
    }
  }
  return globalForPrisma.prismaClient;
}

// Export the Prisma client instance
export const db = getPrismaClient();
