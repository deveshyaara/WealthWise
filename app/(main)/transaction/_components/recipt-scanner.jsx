"use client";

import { useRef, useEffect, useCallback } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import useFetch from "@/hooks/use-fetch";
import { scanReceipt } from "@/actions/transaction";

console.log("✅ ReceiptScanner component loaded");

export function ReceiptScanner({ onScanComplete }) {
  console.log("🔄 ReceiptScanner component rendered");
  const fileInputRef = useRef(null);

  const {
    loading: scanReceiptLoading,
    fn: scanReceiptFn,
    data: scannedData,
    error: scanError,
  } = useFetch(scanReceipt);

  const handleReceiptScan = async (file) => {
    console.log("📸 Receipt scan started", { fileName: file.name, fileSize: file.size, fileType: file.type });
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size should be less than 5MB");
      console.error("❌ File too large:", file.size);
      return;
    }

    // Create FormData and append the file
    const formData = new FormData();
    formData.append("file", file);
    
    console.log("📤 Sending file to server action...");

    try {
      const result = await scanReceiptFn(formData);
      console.log("✅ Scan result:", result);
    } catch (error) {
      console.error("❌ Scan error:", error);
      toast.error(error.message || "Failed to scan receipt");
    }
  };

  const handleScanComplete = useCallback(() => {
    console.log("🔍 handleScanComplete called", { scannedData, scanReceiptLoading });
    
    if (scannedData && !scanReceiptLoading) {
      // Check if response has error
      if (scannedData.error) {
        console.error("❌ Scan error:", scannedData.error);
        toast.error(scannedData.error);
        return;
      }
      
      // Check if response has data
      if (scannedData.data) {
        console.log("✅ Calling onScanComplete with:", scannedData.data);
        onScanComplete(scannedData.data);
        toast.success("Receipt scanned successfully");
      } else {
        console.warn("⚠️ No data in scanned response:", scannedData);
        toast.error("No data extracted from receipt");
      }
    } else {
      console.log("⏸️ Not calling onScanComplete:", { hasData: !!scannedData, isLoading: scanReceiptLoading });
    }
  }, [scannedData, scanReceiptLoading, onScanComplete]);

  useEffect(() => {
    handleScanComplete();
  }, [handleScanComplete]);

  useEffect(() => {
    if (scanError) {
      toast.error(scanError.message || "Failed to scan receipt");
    }
  }, [scanError]);

  return (
    <div className="flex items-center gap-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          console.log("📂 File input onChange triggered", e.target.files);
          const file = e.target.files?.[0];
          if (file) {
            console.log("📎 File selected:", file.name);
            handleReceiptScan(file);
          } else {
            console.warn("⚠️ No file selected");
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 animate-gradient hover:opacity-90 transition-opacity text-white hover:text-white"
        onClick={() => {
          console.log("🖱️ Scan Receipt button clicked");
          console.log("📁 File input ref:", fileInputRef.current);
          fileInputRef.current?.click();
        }}
        disabled={scanReceiptLoading}
      >
        {scanReceiptLoading ? (
          <>
            <Loader2 className="mr-2 animate-spin" />
            <span>Scanning Receipt...</span>
          </>
        ) : (
          <>
            <Camera className="mr-2" />
            <span>Scan Receipt with AI</span>
          </>
        )}
      </Button>
    </div>
  );
}
