import { seedTransactions } from "@/actions/seed";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await seedTransactions();
  return Response.json(result);
}
