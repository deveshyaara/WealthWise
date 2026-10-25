import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/prisma";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 
  (process.env.DATABASE_URL?.match(/postgres\.([a-zA-Z0-9_-]+):/)
    ? `https://${process.env.DATABASE_URL.match(/postgres\.([a-zA-Z0-9_-]+):/)[1]}.supabase.co`
    : null);

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

// Initialize Supabase Client if credentials are available
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })
  : null;

const BUCKET_NAME = "receipts";

/**
 * Ensures private receipts storage bucket exists if Supabase is connected.
 */
async function ensureBucketExists() {
  if (!supabase) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 5242880, // 5MB limit
      });
    }
  } catch (error) {
    console.error("[Receipt Storage] Bucket check warning:", error.message);
  }
}

/**
 * Saves a receipt attachment persistently for a transaction.
 */
export async function saveReceiptAttachment({
  transactionId,
  userId,
  buffer,
  fileName,
  fileType,
}) {
  if (!transactionId || !userId || !buffer) {
    throw new Error("Missing required receipt attachment parameters.");
  }

  let storagePath = null;
  const extension = fileName?.split(".").pop() || "jpg";
  const path = `${userId}/${transactionId}-${Date.now()}.${extension}`;

  // Try saving to Supabase Storage if configured
  if (supabase) {
    try {
      await ensureBucketExists();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, buffer, {
          contentType: fileType || "image/jpeg",
          upsert: true,
        });

      if (!uploadError) {
        storagePath = path;
      }
    } catch (err) {
      console.warn("[Receipt Storage] Supabase upload failed, using database storage:", err.message);
    }
  }

  // Persist record in database (with binary data if storagePath wasn't uploaded)
  const attachment = await db.receipt_attachments.upsert({
    where: { transactionId },
    update: {
      fileName: fileName || "receipt.jpg",
      fileType: fileType || "image/jpeg",
      fileSize: buffer.length,
      storagePath,
      fileData: buffer, // Keep safe copy in PostgreSQL
      updatedAt: new Date(),
    },
    create: {
      id: crypto.randomUUID(),
      transactionId,
      userId,
      fileName: fileName || "receipt.jpg",
      fileType: fileType || "image/jpeg",
      fileSize: buffer.length,
      storagePath,
      fileData: buffer,
      updatedAt: new Date(),
    },
  });

  // Also update transaction.receiptUrl with an internal reference
  await db.transactions.update({
    where: { id: transactionId },
    data: { receiptUrl: `/api/receipts/${transactionId}` },
  });

  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
  };
}

/**
 * Generates an authorized viewing URL for a receipt.
 */
export async function getAuthorizedReceiptUrl(transactionId, userId) {
  const transaction = await db.transactions.findFirst({
    where: {
      id: transactionId,
      userId,
    },
    include: {
      receipt_attachments: true,
    },
  });

  if (!transaction || !transaction.receipt_attachments) {
    return null;
  }

  const attachment = transaction.receipt_attachments;

  // If Supabase Storage object exists, create short-lived signed URL
  if (supabase && attachment.storagePath) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(attachment.storagePath, 300); // 5-minute expiry

      if (!error && data?.signedUrl) {
        return {
          url: data.signedUrl,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
        };
      }
    } catch (err) {
      console.warn("[Receipt Storage] Signed URL creation fallback to internal API:", err.message);
    }
  }

  // Fallback to authenticated internal streaming route
  return {
    url: `/api/receipts/${transactionId}`,
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    fileSize: attachment.fileSize,
  };
}

/**
 * Deletes a receipt attachment permanently.
 */
export async function deleteReceiptAttachment(transactionId, userId) {
  const attachment = await db.receipt_attachments.findFirst({
    where: {
      transactionId,
      userId,
    },
  });

  if (!attachment) return { success: false, error: "Receipt not found." };

  if (supabase && attachment.storagePath) {
    try {
      await supabase.storage.from(BUCKET_NAME).remove([attachment.storagePath]);
    } catch (err) {
      console.warn("[Receipt Storage] Error removing Supabase object:", err.message);
    }
  }

  await db.receipt_attachments.delete({
    where: { id: attachment.id },
  });

  await db.transactions.update({
    where: { id: transactionId },
    data: { receiptUrl: null },
  });

  return { success: true };
}

/**
 * Retrieves the raw binary receipt buffer and MIME type for authorized streaming.
 */
export async function getReceiptAttachmentData(transactionId, userId) {
  const attachment = await db.receipt_attachments.findFirst({
    where: {
      transactionId,
      userId,
    },
  });

  if (!attachment) return null;

  if (attachment.fileData) {
    return {
      buffer: Buffer.from(attachment.fileData),
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
    };
  }

  if (supabase && attachment.storagePath) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(attachment.storagePath);

      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
        };
      }
    } catch (err) {
      console.error("[Receipt Storage] Error downloading from Supabase:", err.message);
    }
  }

  return null;
}
