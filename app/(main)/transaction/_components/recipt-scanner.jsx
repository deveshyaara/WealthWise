"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, Loader2, Image as ImageIcon, CheckCircle2, AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import useFetch from "@/hooks/use-fetch";
import { scanReceipt } from "@/actions/transaction";

export function ReceiptScanner({ onScanComplete, onReceiptChange }) {
  const fileInputRef = useRef(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [scanStatus, setScanStatus] = useState("idle"); // idle | scanning | success | error

  const {
    loading: scanReceiptLoading,
    fn: scanReceiptFn,
  } = useFetch(scanReceipt);

  const processFile = useCallback(
    async (file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size should be less than 5MB");
        return;
      }

      const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
      if (file.type && !allowedMimes.includes(file.type.toLowerCase())) {
        toast.error("Please upload a JPG, PNG, or WebP receipt image.");
        return;
      }

      // Generate local preview URL
      const previewUrl = URL.createObjectURL(file);

      // Convert to base64 for persistent submission
      const reader = new FileReader();
      reader.onload = async () => {
        const resultString = reader.result;
        const base64Data = resultString.includes(",")
          ? resultString.split(",")[1]
          : resultString;

        const receiptObj = {
          file,
          previewUrl,
          base64: base64Data,
          name: file.name,
          type: file.type || "image/jpeg",
          size: file.size,
        };

        setSelectedReceipt(receiptObj);
        setScanStatus("scanning");

        if (onReceiptChange) {
          onReceiptChange(receiptObj);
        }

        // Trigger AI scan
        const formData = new FormData();
        formData.append("file", file);

        try {
          const result = await scanReceiptFn(formData);
          if (result?.error) {
            setScanStatus("error");
            toast.error(result.error);
          } else if (result?.data) {
            setScanStatus("success");
            onScanComplete(result.data);
            toast.success("Receipt scanned and details extracted successfully!");
          } else {
            setScanStatus("error");
            toast.error("No transaction data could be extracted from this receipt.");
          }
        } catch (err) {
          console.error("Receipt scan error:", err);
          setScanStatus("error");
          toast.error(err.message || "Failed to extract receipt info.");
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read image file.");
      };

      reader.readAsDataURL(file);
    },
    [onReceiptChange, scanReceiptFn, onScanComplete]
  );

  const handleRemoveReceipt = () => {
    if (selectedReceipt?.previewUrl) {
      URL.revokeObjectURL(selectedReceipt.previewUrl);
    }
    setSelectedReceipt(null);
    setScanStatus("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onReceiptChange) {
      onReceiptChange(null);
    }
    toast.info("Receipt removed");
  };

  const handleRetryScan = async () => {
    if (!selectedReceipt?.file) return;
    setScanStatus("scanning");
    const formData = new FormData();
    formData.append("file", selectedReceipt.file);
    try {
      const result = await scanReceiptFn(formData);
      if (result?.error) {
        setScanStatus("error");
        toast.error(result.error);
      } else if (result?.data) {
        setScanStatus("success");
        onScanComplete(result.data);
        toast.success("Receipt scanned and details extracted successfully!");
      } else {
        setScanStatus("error");
        toast.error("No transaction data could be extracted from this receipt.");
      }
    } catch (err) {
      setScanStatus("error");
      toast.error(err.message || "Failed to extract receipt info.");
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        aria-label="Upload receipt image"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            processFile(file);
          }
        }}
      />

      {!selectedReceipt ? (
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white hover:text-white hover:opacity-95 shadow-sm transition-all"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanReceiptLoading}
        >
          <Camera className="mr-2 h-4 w-4" />
          <span>Upload or Scan Receipt with AI</span>
        </Button>
      ) : (
        <div className="rounded-lg border bg-card p-3 shadow-sm transition-all">
          <div className="flex items-center gap-3">
            {/* Thumbnail Preview */}
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
              {selectedReceipt.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedReceipt.previewUrl}
                  alt="Receipt preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
            </div>

            {/* Metadata & Scan Status */}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {selectedReceipt.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedReceipt.size)}
              </p>

              <div className="mt-1 flex items-center gap-2">
                {scanStatus === "scanning" && (
                  <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Extracting data...
                  </Badge>
                )}
                {scanStatus === "success" && (
                  <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    AI Data Extracted
                  </Badge>
                )}
                {scanStatus === "error" && (
                  <Badge variant="secondary" className="gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs">
                    <AlertCircle className="h-3 w-3" />
                    Extraction Incomplete
                  </Badge>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {scanStatus === "error" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Retry AI Extraction"
                  onClick={handleRetryScan}
                  disabled={scanReceiptLoading}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanReceiptLoading}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Remove Receipt"
                onClick={handleRemoveReceipt}
                disabled={scanReceiptLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
