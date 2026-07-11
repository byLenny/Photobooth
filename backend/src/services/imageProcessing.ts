import fs from "node:fs";
import sharp from "sharp";
import type { CollageLayout, FilterName, Settings } from "../types.js";

const CELL_WIDTH = 800;
const CELL_HEIGHT = 600;

export async function applyFilter(input: Buffer, filter: FilterName): Promise<Buffer> {
  const image = sharp(input);
  switch (filter) {
    case "grayscale":
      return image.grayscale().jpeg({ quality: 90 }).toBuffer();
    case "sepia":
      return image
        .grayscale()
        .tint({ r: 112, g: 66, b: 20 })
        .jpeg({ quality: 90 })
        .toBuffer();
    case "vintage":
      return image
        .modulate({ saturation: 0.6, brightness: 1.05 })
        .tint({ r: 255, g: 236, b: 210 })
        .jpeg({ quality: 90 })
        .toBuffer();
    case "none":
    default:
      return image.jpeg({ quality: 90 }).toBuffer();
  }
}

export async function compositeOverlay(input: Buffer, overlayPath: string): Promise<Buffer> {
  if (!fs.existsSync(overlayPath)) return input;
  const base = sharp(input);
  const meta = await base.metadata();
  const width = meta.width ?? CELL_WIDTH;
  const height = meta.height ?? CELL_HEIGHT;
  const resizedOverlay = await sharp(overlayPath)
    .resize(width, height, { fit: "fill" })
    .toBuffer();
  return base
    .composite([{ input: resizedOverlay, gravity: "center" }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function buildCollage(images: Buffer[], layout: CollageLayout): Promise<Buffer> {
  const resized = await Promise.all(
    images.map((buf) => sharp(buf).resize(CELL_WIDTH, CELL_HEIGHT, { fit: "cover" }).toBuffer()),
  );

  if (layout === "strip-vertical") {
    const canvasWidth = CELL_WIDTH;
    const canvasHeight = CELL_HEIGHT * resized.length;
    const composite = resized.map((input, i) => ({ input, left: 0, top: i * CELL_HEIGHT }));
    return sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(composite)
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  // grid-2x2 (pads with blank cells if fewer than 4 images)
  const cols = 2;
  const rows = Math.ceil(resized.length / cols) || 1;
  const canvasWidth = CELL_WIDTH * cols;
  const canvasHeight = CELL_HEIGHT * rows;
  const composite = resized.map((input, i) => ({
    input,
    left: (i % cols) * CELL_WIDTH,
    top: Math.floor(i / cols) * CELL_HEIGHT,
  }));
  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composite)
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function processSession(
  originals: Buffer[],
  settings: Settings,
  overlayPath: string | null,
): Promise<Buffer> {
  let working: Buffer;
  if (settings.shotMode === "collage" && originals.length > 1) {
    working = await buildCollage(originals, settings.collageLayout);
  } else {
    working = originals[0]!;
  }

  working = await applyFilter(working, settings.filter);

  if (settings.overlayEnabled && overlayPath) {
    working = await compositeOverlay(working, overlayPath);
  }

  return working;
}
