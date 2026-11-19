import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface StoredDocumentFile {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  uploadedAt: Date;
}

export function getStorageDirectory(): string {
  const customDir = process.env.IDENTITY_DOCUMENTS_DIR?.trim();
  const baseDir = customDir
    ? path.isAbsolute(customDir)
      ? customDir
      : path.resolve(/*turbopackIgnore: true*/ process.cwd(), customDir)
    : path.join(process.cwd(), "uploads", "identity_documents");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  return baseDir;
}

export function getMaxFileSizeBytes(): number {
  const mb = parseInt(process.env.IDENTITY_DOCUMENTS_MAX_SIZE_MB || "5", 10);
  return (isNaN(mb) || mb <= 0 ? 5 : mb) * 1024 * 1024;
}

export function getMaxFileSizeMb(): number {
  const mb = parseInt(process.env.IDENTITY_DOCUMENTS_MAX_SIZE_MB || "5", 10);
  return isNaN(mb) || mb <= 0 ? 5 : mb;
}

export function getRetentionDays(): number {
  const days = parseInt(process.env.IDENTITY_DOCUMENTS_RETENTION_DAYS || "90", 10);
  return isNaN(days) || days <= 0 ? 90 : days;
}

/**
 * Validates file magic bytes (file signature) against declared MIME type
 * Supported:
 * - JPEG (image/jpeg): FF D8 FF
 * - PNG (image/png): 89 50 4E 47 0D 0A 1A 0A
 * - PDF (application/pdf): 25 50 44 46 2D (%PDF-)
 */
export function validateMagicBytes(
  buffer: Buffer,
  declaredMimeType: string
): { valid: boolean; detectedType?: string; error?: string } {
  if (!buffer || buffer.length < 8) {
    return { valid: false, error: "File content is empty or unreadable." };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (declaredMimeType === "image/jpeg" || declaredMimeType === "image/jpg") {
      return { valid: true, detectedType: "image/jpeg" };
    }
    return { valid: false, error: "File has JPEG content but incorrect declared format." };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (declaredMimeType === "image/png") {
      return { valid: true, detectedType: "image/png" };
    }
    return { valid: false, error: "File has PNG content but incorrect declared format." };
  }

  // PDF: 25 50 44 46 2D (%PDF-)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    if (declaredMimeType === "application/pdf") {
      return { valid: true, detectedType: "application/pdf" };
    }
    return { valid: false, error: "File has PDF content but incorrect declared format." };
  }

  return {
    valid: false,
    error: "Invalid file signature. Only authentic JPG, PNG, and PDF documents are accepted.",
  };
}

/**
 * Saves a verified document to the private storage directory
 */
export async function saveDocumentFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: string,
  fileKey: string
): Promise<StoredDocumentFile> {
  const dir = getStorageDirectory();
  const fileId = crypto.randomUUID();
  const sanitizedOriginal = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext =
    mimeType === "application/pdf"
      ? ".pdf"
      : mimeType === "image/png"
      ? ".png"
      : ".jpg";

  const safeFileName = `${userId}_${fileKey}_${fileId}${ext}`;
  const fullPath = path.join(dir, safeFileName);

  await fs.promises.writeFile(fullPath, buffer);

  return {
    fileId,
    originalName: sanitizedOriginal,
    mimeType,
    size: buffer.length,
    storagePath: fullPath,
    uploadedAt: new Date(),
  };
}

/**
 * Safely removes a file from disk
 */
export async function deleteDocumentFile(storagePath: string): Promise<boolean> {
  try {
    if (storagePath && fs.existsSync(storagePath)) {
      await fs.promises.unlink(storagePath);
      return true;
    }
  } catch (err) {
    console.error("[IdentityStorage] Error deleting file:", storagePath, err);
  }
  return false;
}

/**
 * Generates a short-lived HMAC-SHA256 signed URL to access private documents
 */
export function generateSignedDocumentUrl(
  fileId: string,
  expiresInSeconds: number = 900 // 15 minutes default
): string {
  const secret = process.env.NEXTAUTH_SECRET || "local_dev_identity_secret";
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${fileId}:${expires}`)
    .digest("hex");

  return `/api/identity-documents/view?fileId=${encodeURIComponent(fileId)}&expires=${expires}&sig=${signature}`;
}

/**
 * Validates a signed URL token
 */
export function verifySignedDocumentUrl(
  fileId: string,
  expiresStr: string,
  sig: string
): boolean {
  try {
    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || Math.floor(Date.now() / 1000) > expires) {
      return false; // Expired
    }

    const secret = process.env.NEXTAUTH_SECRET || "local_dev_identity_secret";
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${fileId}:${expires}`)
      .digest("hex");

    return (
      sig.length === expectedSig.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    );
  } catch {
    return false;
  }
}
