import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getReceiptAttachmentData } from "@/lib/receipt-storage";

export async function GET(request, { params }) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return new Response("Unauthorized. Please log in to view receipts.", {
        status: 401,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const resolvedParams = await params;
    const transactionId = resolvedParams?.id;

    if (!transactionId) {
      return new Response("Invalid transaction ID", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const user = await db.users.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return new Response("User record not found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Retrieve verified receipt data strictly belonging to this authorized user
    const receiptData = await getReceiptAttachmentData(transactionId, user.id);

    if (!receiptData) {
      return new Response("Receipt attachment not found or access denied.", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Stream binary response with strict security headers
    return new Response(receiptData.buffer, {
      status: 200,
      headers: {
        "Content-Type": receiptData.fileType || "image/jpeg",
        "Content-Disposition": `inline; filename="${encodeURIComponent(receiptData.fileName)}"`,
        "Content-Length": String(receiptData.buffer.length),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[Receipt Stream API Error]:", error);
    return new Response("Internal server error streaming receipt", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
