import { seedTransactions } from "@/actions/seed";
import { auth } from "@clerk/nextjs/server";

export async function GET(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") || undefined;

  const result = await seedTransactions(accountId);
  return Response.json(result, { status: result.success ? 200 : 400 });
}
