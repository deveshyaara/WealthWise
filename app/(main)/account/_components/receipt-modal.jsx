"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink, Trash2, Loader2, FileImage } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { deleteReceiptForTransaction } from "@/actions/transaction";

export function ReceiptModal({ transaction, isOpen, onClose, onReceiptDeleted }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  if (!transaction) return null;

  const receiptUrl = transaction.receiptUrl || `/api/receipts/${transaction.id}`;
  const fileName = transaction.receipt_attachments?.fileName || `receipt-${transaction.id}.jpg`;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to permanently delete this receipt? This cannot be undone.")) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await deleteReceiptForTransaction(transaction.id);
      if (res?.success) {
        toast.success("Receipt deleted successfully.");
        if (onReceiptDeleted) {
          onReceiptDeleted(transaction.id);
        }
        onClose();
      } else {
        toast.error(res?.error || "Failed to delete receipt.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete receipt.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-6 sm:rounded-xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileImage className="h-5 w-5 text-primary" />
              Receipt Details
            </DialogTitle>
            <Badge variant="outline" className="text-xs">
              {transaction.category}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {transaction.description} • {format(new Date(transaction.date), "PPP")}
          </DialogDescription>
        </DialogHeader>

        {/* Receipt Image Display */}
        <div className="relative min-h-[260px] max-h-[480px] w-full overflow-hidden rounded-lg border bg-muted/40 flex items-center justify-center p-2">
          {imageLoading && !imageError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">Loading authorized receipt...</p>
            </div>
          )}

          {imageError ? (
            <div className="text-center p-8 text-muted-foreground">
              <FileImage className="mx-auto h-12 w-12 opacity-40 mb-2" />
              <p className="text-sm font-medium">Receipt image could not be loaded</p>
              <p className="text-xs mt-1">The receipt may have been removed or access was restricted.</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={receiptUrl}
              alt={`Receipt for ${transaction.description}`}
              className="max-h-[440px] w-auto max-w-full rounded object-contain shadow-sm"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
            />
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-center pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 text-xs gap-1.5"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete Receipt
          </Button>

          <div className="flex gap-2">
            <a
              href={receiptUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </a>
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="h-4 w-4" />
                Open Full
              </Button>
            </a>
            <Button type="button" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
