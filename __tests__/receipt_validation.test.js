import { describe, it, expect } from "vitest";
import { validateImageMagicBytes } from "@/lib/receipt-validator";

describe("Receipt Image Signature & Magic Bytes Verification", () => {
  it("accepts valid JPEG buffer (FF D8 FF)", () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(validateImageMagicBytes(jpegBuffer)).toBe(true);
  });

  it("accepts valid PNG buffer (89 50 4E 47 0D 0A 1A 0A)", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(validateImageMagicBytes(pngBuffer)).toBe(true);
  });

  it("accepts valid WebP buffer (RIFF....WEBP)", () => {
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // 'RIFF'
      0x24, 0x00, 0x00, 0x00, // file size
      0x57, 0x45, 0x42, 0x50, // 'WEBP'
    ]);
    expect(validateImageMagicBytes(webpBuffer)).toBe(true);
  });

  it("accepts valid HEIC/HEIF buffer (ftyp box)", () => {
    const heicBuffer = Buffer.from([
      0x00, 0x00, 0x00, 0x18, // box size
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x68, 0x65, 0x69, 0x63, // 'heic'
    ]);
    expect(validateImageMagicBytes(heicBuffer)).toBe(true);
  });

  it("rejects malicious executable / shell script disguised as image", () => {
    const scriptBuffer = Buffer.from("#!/bin/bash\necho 'malicious code'\n");
    expect(validateImageMagicBytes(scriptBuffer)).toBe(false);
  });

  it("rejects HTML / SVG content disguised as image", () => {
    const htmlBuffer = Buffer.from("<svg onload=alert(1)>Test</svg>");
    expect(validateImageMagicBytes(htmlBuffer)).toBe(false);
  });

  it("rejects empty or truncated buffers (< 12 bytes)", () => {
    expect(validateImageMagicBytes(Buffer.from([]))).toBe(false);
    expect(validateImageMagicBytes(Buffer.from([0xff, 0xd8]))).toBe(false);
    expect(validateImageMagicBytes(null)).toBe(false);
    expect(validateImageMagicBytes(undefined)).toBe(false);
  });
});
