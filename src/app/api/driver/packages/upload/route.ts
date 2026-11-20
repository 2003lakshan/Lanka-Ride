import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized. Driver access required." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    // Validate mime type
    const validMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validMimes.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Invalid image format. Allowed formats: JPG, PNG, and WebP." },
        { status: 400 }
      );
    }

    // Validate size (max 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image file exceeds the 5MB size limit. Please choose a smaller image." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Basic magic bytes check for JPEG, PNG, WEBP
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isRiff = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";

    if (!isJpeg && !isPng && !isRiff) {
      return NextResponse.json(
        { error: "File contents do not match a valid image." },
        { status: 400 }
      );
    }

    // Determine extension
    let ext = "jpg";
    if (isPng) ext = "png";
    if (isRiff) ext = "webp";

    const uploadDir = path.join(process.cwd(), "public", "uploads", "packages");
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `pkg_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/packages/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      size: file.size,
      name: file.name
    });
  } catch (error: any) {
    console.error("Package image upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload image." }, { status: 500 });
  }
}

