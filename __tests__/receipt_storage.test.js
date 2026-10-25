import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    receipt_attachments: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    transactions: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@/lib/prisma", () => ({
  db: mockDb,
}));

import {
  saveReceiptAttachment,
  getAuthorizedReceiptUrl,
  getReceiptAttachmentData,
  deleteReceiptAttachment,
} from "@/lib/receipt-storage";
import { validateImageMagicBytes } from "@/lib/receipt-validator";

describe("Receipt Storage & Cross-User Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("File Magic Bytes Signature Validation", () => {
    it("accepts valid JPEG magic bytes (FF D8 FF)", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(validateImageMagicBytes(jpegBuffer)).toBe(true);
    });

    it("accepts valid PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(validateImageMagicBytes(pngBuffer)).toBe(true);
    });

    it("accepts valid WebP magic bytes (RIFF....WEBP)", () => {
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      expect(validateImageMagicBytes(webpBuffer)).toBe(true);
    });

    it("rejects malicious disguised executables or text files (.exe disguised as .png)", () => {
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
      expect(validateImageMagicBytes(exeBuffer)).toBe(false);

      const htmlBuffer = Buffer.from("<html><script>alert(1)</script></html>");
      expect(validateImageMagicBytes(htmlBuffer)).toBe(false);

      const emptyBuffer = Buffer.from([]);
      expect(validateImageMagicBytes(emptyBuffer)).toBe(false);
    });
  });

  describe("saveReceiptAttachment", () => {
    it("persists receipt attachment and links it to transaction and user", async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      mockDb.receipt_attachments.upsert.mockResolvedValue({
        id: "att_123",
        fileName: "grocery_bill.jpg",
        fileSize: 4,
      });
      mockDb.transactions.update.mockResolvedValue({ id: "tx_123" });

      const result = await saveReceiptAttachment({
        transactionId: "tx_123",
        userId: "user_owner",
        buffer: jpegBuffer,
        fileName: "grocery_bill.jpg",
        fileType: "image/jpeg",
      });

      expect(result).toEqual({
        id: "att_123",
        fileName: "grocery_bill.jpg",
        fileSize: 4,
      });

      expect(mockDb.receipt_attachments.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transactionId: "tx_123" },
          create: expect.objectContaining({
            transactionId: "tx_123",
            userId: "user_owner",
            fileName: "grocery_bill.jpg",
            fileType: "image/jpeg",
            fileData: jpegBuffer,
          }),
        })
      );

      expect(mockDb.transactions.update).toHaveBeenCalledWith({
        where: { id: "tx_123" },
        data: { receiptUrl: "/api/receipts/tx_123" },
      });
    });

    it("throws error when missing required parameters", async () => {
      await expect(
        saveReceiptAttachment({ transactionId: null, userId: "u1", buffer: Buffer.from([1]) })
      ).rejects.toThrow("Missing required receipt attachment parameters.");
    });
  });

  describe("Authorization & Cross-User Isolation", () => {
    it("allows authorized owner to view receipt URL", async () => {
      mockDb.transactions.findFirst.mockResolvedValue({
        id: "tx_123",
        userId: "user_owner",
        receipt_attachments: {
          id: "att_123",
          fileName: "receipt.jpg",
          fileType: "image/jpeg",
          fileSize: 2048,
          storagePath: null,
        },
      });

      const res = await getAuthorizedReceiptUrl("tx_123", "user_owner");
      expect(res).toEqual({
        url: "/api/receipts/tx_123",
        fileName: "receipt.jpg",
        fileType: "image/jpeg",
        fileSize: 2048,
      });
    });

    it("strictly denies cross-user access when requester is not the transaction owner", async () => {
      // Attacker 'user_attacker' tries to request 'user_owner' transaction
      mockDb.transactions.findFirst.mockResolvedValue(null);

      const res = await getAuthorizedReceiptUrl("tx_123", "user_attacker");
      expect(res).toBeNull();
      expect(mockDb.transactions.findFirst).toHaveBeenCalledWith({
        where: {
          id: "tx_123",
          userId: "user_attacker",
        },
        include: {
          receipt_attachments: true,
        },
      });
    });

    it("returns null when transaction has no receipt attached", async () => {
      mockDb.transactions.findFirst.mockResolvedValue({
        id: "tx_no_receipt",
        userId: "user_owner",
        receipt_attachments: null,
      });

      const res = await getAuthorizedReceiptUrl("tx_no_receipt", "user_owner");
      expect(res).toBeNull();
    });

    it("retrieves raw binary data for authorized user streaming", async () => {
      const sampleBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      mockDb.receipt_attachments.findFirst.mockResolvedValue({
        id: "att_123",
        fileName: "receipt.jpg",
        fileType: "image/jpeg",
        fileSize: 4,
        fileData: sampleBuffer,
      });

      const res = await getReceiptAttachmentData("tx_123", "user_owner");
      expect(res).not.toBeNull();
      expect(res?.buffer).toEqual(sampleBuffer);
      expect(res?.fileType).toBe("image/jpeg");
    });

    it("refuses to stream data if user does not own the receipt attachment", async () => {
      mockDb.receipt_attachments.findFirst.mockResolvedValue(null);

      const res = await getReceiptAttachmentData("tx_123", "user_attacker");
      expect(res).toBeNull();
      expect(mockDb.receipt_attachments.findFirst).toHaveBeenCalledWith({
        where: {
          transactionId: "tx_123",
          userId: "user_attacker",
        },
      });
    });
  });

  describe("deleteReceiptAttachment", () => {
    it("deletes receipt attachment and resets transaction receiptUrl for authorized owner", async () => {
      mockDb.receipt_attachments.findFirst.mockResolvedValue({
        id: "att_123",
        transactionId: "tx_123",
        userId: "user_owner",
      });
      mockDb.receipt_attachments.delete.mockResolvedValue({});
      mockDb.transactions.update.mockResolvedValue({});

      const res = await deleteReceiptAttachment("tx_123", "user_owner");
      expect(res).toEqual({ success: true });
      expect(mockDb.receipt_attachments.delete).toHaveBeenCalledWith({
        where: { id: "att_123" },
      });
      expect(mockDb.transactions.update).toHaveBeenCalledWith({
        where: { id: "tx_123" },
        data: { receiptUrl: null },
      });
    });

    it("denies receipt deletion if caller is unauthorized or receipt doesn't exist", async () => {
      mockDb.receipt_attachments.findFirst.mockResolvedValue(null);

      const res = await deleteReceiptAttachment("tx_123", "user_attacker");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Receipt not found.");
      expect(mockDb.receipt_attachments.delete).not.toHaveBeenCalled();
    });
  });
});
