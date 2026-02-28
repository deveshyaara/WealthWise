import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  try {
    const name = `${user.firstName} ${user.lastName}`;

    const loggedInUser = await db.users.upsert({
      where: {
        clerkUserId: user.id,
      },
      update: {
        name,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0].emailAddress,
        updatedAt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        clerkUserId: user.id,
        name,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0].emailAddress,
        updatedAt: new Date(),
      },
    });

    return loggedInUser;
  } catch (error) {
    console.error("checkUser error:", error.message);
    return null;
  }
};

