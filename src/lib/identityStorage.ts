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

// -------------------------------------------------------------
// Durable Cloud S3 / Cloudflare R2 Storage Adapter (AWS SigV4)
// -------------------------------------------------------------
export interface S3StorageConfig {
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  endpoint?: string;
}

export function getS3Config(): S3StorageConfig | null {
  const bucket = process.env.S3_BUCKET_NAME || process.env.IDENTITY_STORAGE_BUCKET;
  const accessKey = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || process.env.AWS_REGION || "us-east-1";
  const endpoint = process.env.S3_ENDPOINT?.trim();

  if (bucket && accessKey && secretKey) {
    return { bucket, accessKey, secretKey, region, endpoint: endpoint || undefined };
  }
  return null;
}

function hmac(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function hashSha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function s3Request(
  method: "PUT" | "GET" | "DELETE",
  s3Key: string,
  body?: Buffer,
  contentType?: string
): Promise<{ status: number; buffer?: Buffer; error?: string }> {
  const s3 = getS3Config();
  if (!s3) throw new Error("S3 durable storage is not configured.");

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  let url: string;
  let host: string;
  if (s3.endpoint) {
    const endpointUrl = new URL(s3.endpoint);
    host = endpointUrl.host;
    const basePath = endpointUrl.pathname.replace(/\/$/, "");
    url = `${endpointUrl.origin}${basePath}/${s3.bucket}/${encodeURIComponent(s3Key).replace(/%2F/g, "/")}`;
  } else {
    host = `${s3.bucket}.s3.${s3.region}.amazonaws.com`;
    url = `https://${host}/${encodeURIComponent(s3Key).replace(/%2F/g, "/")}`;
  }

  const payloadHash = body ? hashSha256(body) : hashSha256("");

  const headers: Record<string, string> = {
    host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
  if (contentType && method === "PUT") {
    headers["content-type"] = contentType;
  }

  const signedHeaderKeys = Object.keys(headers).sort();
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join("");

  const urlObj = new URL(url);
  const canonicalUri = urlObj.pathname;
  const canonicalQueryString = "";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${s3.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashSha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(s3.secretKey, dateStamp, s3.region, "s3");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${s3.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers,
    body: method === "PUT" && body ? new Uint8Array(body) : undefined,
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    return { status: res.status, error: text || `S3 HTTP ${res.status}` };
  }

  if (method === "GET" && res.ok) {
    const arrayBuf = await res.arrayBuffer();
    return { status: res.status, buffer: Buffer.from(arrayBuf) };
  }

  return { status: res.status };
}

/**
 * Saves a verified document to durable storage (S3 / Cloudflare R2 if configured, or local private disk)
 */
export async function saveDocumentFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: string,
  fileKey: string
): Promise<StoredDocumentFile> {
  const fileId = crypto.randomUUID();
  const sanitizedOriginal = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext =
    mimeType === "application/pdf"
      ? ".pdf"
      : mimeType === "image/png"
      ? ".png"
      : ".jpg";

  const safeFileName = `${userId}_${fileKey}_${fileId}${ext}`;
  const s3 = getS3Config();

  if (s3) {
    const s3Key = `identity_documents/${userId}/${safeFileName}`;
    const res = await s3Request("PUT", s3Key, buffer, mimeType);
    if (res.error) {
      throw new Error(`Failed to store document in durable cloud storage: ${res.error}`);
    }
    return {
      fileId,
      originalName: sanitizedOriginal,
      mimeType,
      size: buffer.length,
      storagePath: `s3://${s3.bucket}/${s3Key}`,
      uploadedAt: new Date(),
    };
  }

  // Local private filesystem storage fallback
  const dir = getStorageDirectory();
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
 * Retrieves the document buffer from storage (S3 or local disk)
 */
export async function getDocumentBuffer(storagePath: string): Promise<Buffer | null> {
  if (!storagePath || storagePath === "[DELETED_BY_RETENTION_POLICY]") {
    return null;
  }

  if (storagePath.startsWith("s3://")) {
    const withoutPrefix = storagePath.slice(5);
    const slashIdx = withoutPrefix.indexOf("/");
    if (slashIdx === -1) return null;
    const s3Key = withoutPrefix.slice(slashIdx + 1);
    const res = await s3Request("GET", s3Key);
    return res.buffer || null;
  }

  try {
    if (fs.existsSync(storagePath)) {
      return await fs.promises.readFile(storagePath);
    }
  } catch (err) {
    console.error("[IdentityStorage] Error reading document file:", storagePath, err);
  }
  return null;
}

/**
 * Safely removes a file from durable storage (S3 or disk)
 */
export async function deleteDocumentFile(storagePath: string): Promise<boolean> {
  if (!storagePath || storagePath === "[DELETED_BY_RETENTION_POLICY]") {
    return false;
  }

  if (storagePath.startsWith("s3://")) {
    const withoutPrefix = storagePath.slice(5);
    const slashIdx = withoutPrefix.indexOf("/");
    if (slashIdx === -1) return false;
    const s3Key = withoutPrefix.slice(slashIdx + 1);
    const res = await s3Request("DELETE", s3Key);
    return res.status >= 200 && res.status < 300;
  }

  try {
    if (fs.existsSync(storagePath)) {
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

/**
 * Executes retention policy cleanup: purges expired documents from storage,
 * sets retention markers, and resets user identityStatus so fresh upload is required.
 */
export async function cleanupExpiredIdentityDocuments(): Promise<{
  recordsArchived: number;
  filesDeleted: number;
  errors: string[];
}> {
  const { default: RiderIdentity } = await import("@/models/RiderIdentity");
  const { default: User } = await import("@/models/User");

  const now = new Date();
  const expiredRecords = await RiderIdentity.find({
    retentionUntil: { $lte: now },
    isArchived: { $ne: true },
  });

  let filesDeleted = 0;
  let recordsArchived = 0;
  const errors: string[] = [];

  for (const record of expiredRecords) {
    try {
      for (const key of ["front", "back", "photoPage"]) {
        const file = (record.files as any)?.[key];
        if (file?.storagePath && file.storagePath !== "[DELETED_BY_RETENTION_POLICY]") {
          const ok = await deleteDocumentFile(file.storagePath);
          if (ok) filesDeleted++;
          file.storagePath = "[DELETED_BY_RETENTION_POLICY]";
        }
      }
      record.isArchived = true;
      record.status = "PENDING_REVIEW";
      await record.save();

      // Reset User identityStatus so fresh upload is required for future custom trips
      await User.findByIdAndUpdate(record.userId, {
        identityStatus: "NOT_SUBMITTED",
      });

      recordsArchived++;
    } catch (err: any) {
      console.error(`[Retention Cleanup] Error archiving record ${record._id}:`, err);
      errors.push(`Record ${record._id}: ${err.message || String(err)}`);
    }
  }

  return { recordsArchived, filesDeleted, errors };
}
