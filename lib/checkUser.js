import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";
import crypto from "crypto";

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  try {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    const name = fullName || user.username || "WealthWise Member";
    const email = user.emailAddresses?.[0]?.emailAddress || `${user.id}@clerk.user`;

    const loggedInUser = await db.users.upsert({
      where: {
        clerkUserId: user.id,
      },
      update: {
        name,
        imageUrl: user.imageUrl,
        email,
        updatedAt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        clerkUserId: user.id,
        name,
        imageUrl: user.imageUrl,
        email,
        updatedAt: new Date(),
      },
    });

    return loggedInUser;
  } catch (error) {
    console.error("checkUser error:", error.message);
    return null;
  }
};
