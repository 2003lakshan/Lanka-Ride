import fs from "fs";
import path from "path";
import sharp from "sharp";

const ICON_SRC = "C:/Users/ACER/.gemini/antigravity/brain/faa80631-387d-4531-a761-cfca117ddb54/.user_uploaded/media_1795274917519_42788229.png";
const FULL_LOGO_SRC = "C:/Users/ACER/.gemini/antigravity/brain/faa80631-387d-4531-a761-cfca117ddb54/.user_uploaded/media_1795274917459_d79f9914.png";

const BRAND_DIR = path.resolve(process.cwd(), "public/brand");

function createIco(pngBuffers: { width: number; height: number; buffer: Buffer }[]): Buffer {
  const headerSize = 6;
  const entrySize = 16;
  const numImages = pngBuffers.length;
  let offset = headerSize + entrySize * numImages;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type 1
  header.writeUInt16LE(numImages, 4); // number of images

  const entries: Buffer[] = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(item.buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buffer)]);
}

async function run() {
  if (!fs.existsSync(BRAND_DIR)) {
    fs.mkdirSync(BRAND_DIR, { recursive: true });
  }

  console.log("=== 1. Processing Simplified Icon ===");
  // Trim transparent padding from the icon
  const iconTrimmed = await sharp(ICON_SRC).trim().toBuffer({ resolveWithObject: true });
  console.log(`Trimmed icon dimensions: ${iconTrimmed.info.width}x${iconTrimmed.info.height}`);

  fs.writeFileSync(path.join(BRAND_DIR, "at-your-service-icon.png"), iconTrimmed.data);

  // Dark variant of icon (make navy airplane white so it is clearly visible on #102A43)
  const { data: iconData, info: iconInfo } = await sharp(iconTrimmed.data)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const iconDarkData = Buffer.from(iconData);
  const wIcon = iconInfo.width;
  const hIcon = iconInfo.height;

  for (let y = 0; y < Math.floor(hIcon * 0.35); y++) {
    for (let x = Math.floor(wIcon * 0.55); x < wIcon; x++) {
      const idx = (y * wIcon + x) * 4;
      const a = iconDarkData[idx + 3];
      if (a > 30) {
        const r = iconDarkData[idx];
        const g = iconDarkData[idx + 1];
        const b = iconDarkData[idx + 2];
        // If it's navy blue (airplane)
        if (r < 50 && g < 75 && b < 125) {
          iconDarkData[idx] = 255;
          iconDarkData[idx + 1] = 255;
          iconDarkData[idx + 2] = 255;
        }
      }
    }
  }

  const iconDarkBuffer = await sharp(iconDarkData, {
    raw: { width: wIcon, height: hIcon, channels: 4 }
  })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(BRAND_DIR, "at-your-service-icon-dark.png"), iconDarkBuffer);
  console.log("Saved at-your-service-icon.png and at-your-service-icon-dark.png");

  console.log("\n=== 2. Processing Full Logo ===");
  // Convert JPEG / non-transparent to transparent by flood-filling exterior white background
  const { data: fullRaw, info: fullInfo } = await sharp(FULL_LOGO_SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const wFull = fullInfo.width;
  const hFull = fullInfo.height;

  // BFS flood fill from all perimeter pixels
  const isBg = new Uint8Array(wFull * hFull);
  const queue: number[] = [];

  // Seed with all edge pixels that are light
  for (let x = 0; x < wFull; x++) {
    for (const y of [0, hFull - 1]) {
      const idx = (y * wFull + x) * 4;
      if (fullRaw[idx] > 220 && fullRaw[idx + 1] > 220 && fullRaw[idx + 2] > 220) {
        const pIdx = y * wFull + x;
        if (!isBg[pIdx]) {
          isBg[pIdx] = 1;
          queue.push(pIdx);
        }
      }
    }
  }
  for (let y = 0; y < hFull; y++) {
    for (const x of [0, wFull - 1]) {
      const idx = (y * wFull + x) * 4;
      if (fullRaw[idx] > 220 && fullRaw[idx + 1] > 220 && fullRaw[idx + 2] > 220) {
        const pIdx = y * wFull + x;
        if (!isBg[pIdx]) {
          isBg[pIdx] = 1;
          queue.push(pIdx);
        }
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % wFull;
    const cy = Math.floor(curr / wFull);

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < wFull && ny >= 0 && ny < hFull) {
        const nIdx = ny * wFull + nx;
        if (!isBg[nIdx]) {
          const pIdx = nIdx * 4;
          const r = fullRaw[pIdx];
          const g = fullRaw[pIdx + 1];
          const b = fullRaw[pIdx + 2];

          // Exterior background pixel criteria: near white
          // Or if in the shadow smudge zone under pin (x between 160-360, y >= 536) where r>160 && g>160 && b>160
          const isUnderPinShadow = nx >= 150 && nx <= 380 && ny >= 536 && r > 150 && g > 150 && b > 150;
          if ((r > 225 && g > 225 && b > 225) || isUnderPinShadow) {
            isBg[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }
    }
  }

  // Create transparent buffer for full logo
  const fullTransparent = Buffer.from(fullRaw);
  for (let i = 0; i < wFull * hFull; i++) {
    if (isBg[i]) {
      fullTransparent[i * 4 + 3] = 0; // transparent
    }
  }

  // Trim transparent margin from full logo
  const fullTrimmed = await sharp(fullTransparent, {
    raw: { width: wFull, height: hFull, channels: 4 }
  })
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });

  console.log(`Trimmed full logo dimensions: ${fullTrimmed.info.width}x${fullTrimmed.info.height}`);
  fs.writeFileSync(path.join(BRAND_DIR, "at-your-service-full-logo.png"), fullTrimmed.data);

  // Generate Dark Background Variant of Full Logo
  // In the dark version:
  // "At Your" text (navy blue) is converted to crisp white [255, 255, 255]
  // Airplane (navy blue) is converted to crisp white [255, 255, 255]
  // "Service" (orange/gold) and swoosh remain authentic orange/gold
  const { data: fullTrimmedData, info: fullTrimmedInfo } = await sharp(fullTrimmed.data)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const darkFullData = Buffer.from(fullTrimmedData);
  const wT = fullTrimmedInfo.width;
  const hT = fullTrimmedInfo.height;

  for (let y = 0; y < hT; y++) {
    for (let x = 0; x < wT; x++) {
      const idx = (y * wT + x) * 4;
      const a = darkFullData[idx + 3];
      if (a > 30) {
        const r = darkFullData[idx];
        const g = darkFullData[idx + 1];
        const b = darkFullData[idx + 2];

        // 1. "At Your" text area (x > 0.38 * wT, y < 0.45 * hT):
        // Dark navy text pixels:
        if (x > wT * 0.38 && y < hT * 0.46) {
          if (r < 65 && g < 85 && b < 135) {
            darkFullData[idx] = 255;
            darkFullData[idx + 1] = 255;
            darkFullData[idx + 2] = 255;
          }
        }

        // 2. Navy airplane at top right of pin (x between 0.28*wT and 0.44*wT, y < 0.24*hT):
        if (x >= wT * 0.26 && x <= wT * 0.46 && y < hT * 0.24) {
          if (r < 65 && g < 85 && b < 135) {
            darkFullData[idx] = 255;
            darkFullData[idx + 1] = 255;
            darkFullData[idx + 2] = 255;
          }
        }
      }
    }
  }

  const fullDarkBuffer = await sharp(darkFullData, {
    raw: { width: wT, height: hT, channels: 4 }
  })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(BRAND_DIR, "at-your-service-full-logo-dark.png"), fullDarkBuffer);
  console.log("Saved at-your-service-full-logo.png and at-your-service-full-logo-dark.png");

  console.log("\n=== 3. Generating Favicons, App Icons, and ICO ===");
  // Create square canvas with subtle safe-area padding (~10%) for the icon
  // The icon is slightly taller than wide (696x882). Max dimension is height.
  const targetSquareSize = 1024;
  const iconFitHeight = Math.round(targetSquareSize * 0.88);
  const resizedIconForSquare = await sharp(iconTrimmed.data)
    .resize({ height: iconFitHeight, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const squareIconBuffer = await sharp({
    create: {
      width: targetSquareSize,
      height: targetSquareSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resizedIconForSquare, gravity: "center" }])
    .png()
    .toBuffer();

  // Generate PNG sizes
  const s16 = await sharp(squareIconBuffer).resize(16, 16).png().toBuffer();
  const s32 = await sharp(squareIconBuffer).resize(32, 32).png().toBuffer();
  const s48 = await sharp(squareIconBuffer).resize(48, 48).png().toBuffer();
  const s180 = await sharp(squareIconBuffer).resize(180, 180).png().toBuffer();
  const s192 = await sharp(squareIconBuffer).resize(192, 192).png().toBuffer();
  const s512 = await sharp(squareIconBuffer).resize(512, 512).png().toBuffer();

  fs.writeFileSync(path.join(BRAND_DIR, "favicon-16x16.png"), s16);
  fs.writeFileSync(path.join(BRAND_DIR, "favicon-32x32.png"), s32);
  fs.writeFileSync(path.join(BRAND_DIR, "apple-touch-icon.png"), s180);
  fs.writeFileSync(path.join(BRAND_DIR, "icon-192.png"), s192);
  fs.writeFileSync(path.join(BRAND_DIR, "icon-512.png"), s512);

  // Also write apple-touch-icon to public root for fallback scanners
  fs.writeFileSync(path.resolve(process.cwd(), "public/apple-touch-icon.png"), s180);

  // Generate true ICO file with 16, 32, 48
  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: s16 },
    { width: 32, height: 32, buffer: s32 },
    { width: 48, height: 48, buffer: s48 }
  ]);

  fs.writeFileSync(path.join(BRAND_DIR, "favicon.ico"), icoBuffer);
  fs.writeFileSync(path.resolve(process.cwd(), "public/favicon.ico"), icoBuffer);
  fs.writeFileSync(path.resolve(process.cwd(), "src/app/favicon.ico"), icoBuffer);
  console.log("Generated valid multi-resolution favicon.ico (16, 32, 48) and saved to public and src/app!");

  // Generate Web Manifest
  const manifest = {
    name: "At Your Service – Powered by Pexora",
    short_name: "At Your Service",
    description: "Premium Sri Lanka Travel Operations & Airport Transfers",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#102A43",
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/brand/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };

  fs.writeFileSync(path.resolve(process.cwd(), "public/manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("Saved public/manifest.json");

  console.log("\n✅ ALL BRAND ASSETS GENERATED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("Error generating brand assets:", err);
  process.exit(1);
});
