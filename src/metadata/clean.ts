import { equal, join, orientationExif, pngChunk, webpChunk } from "./binary";
import { inspect } from "./inspect";
import { parseStructure } from "./structure";
import type { Block, CleanResult, Family, Structure } from "./types";

function rotationBlock(
  format: Structure["format"],
  orientation: number,
): Uint8Array {
  const tiff = orientationExif(orientation);
  if (format === "png") return pngChunk("eXIf", tiff);
  if (format === "webp") return webpChunk("EXIF", tiff);
  const payload = join([new TextEncoder().encode("Exif\0\0"), tiff]);
  return join([
    new Uint8Array([
      0xff,
      0xe1,
      (payload.length + 2) >>> 8,
      (payload.length + 2) & 0xff,
    ]),
    payload,
  ]);
}
function imageData(s: Structure) {
  return join(
    s.blocks
      .filter((b) => !b.family && b.code !== "VP8X" && b.label !== "RIFF")
      .map((b) => b.bytes),
  );
}
export async function clean(
  bytes: Uint8Array,
  families: Family[],
): Promise<CleanResult> {
  if (!families.length)
    throw new Error("Choose at least one metadata family to remove.");
  const before = await inspect(bytes),
    source = parseStructure(bytes);
  if (!before.cleanable)
    throw new Error(
      "This file is inspection only. It cannot be cleaned without risking image appearance.",
    );
  const selected = new Set(families);
  let removedContainers = 0;
  let keptRotation = false;
  const parts = source.blocks.map((block: Block) => {
    if (!block.family || !selected.has(block.family)) return block.bytes;
    removedContainers++;
    if (block.family === "exif" && before.orientation > 1 && !keptRotation) {
      keptRotation = true;
      return rotationBlock(source.format, before.orientation);
    }
    return new Uint8Array();
  });
  if (source.format === "webp") {
    const extended = source.blocks.findIndex((b) => b.code === "VP8X");
    if (extended !== -1) {
      parts[extended] = parts[extended].slice();
      if (selected.has("exif") && !keptRotation) parts[extended][8] &= ~0x08;
      if (selected.has("xmp")) parts[extended][8] &= ~0x04;
    }
    parts[0] = parts[0].slice();
    new DataView(parts[0].buffer).setUint32(
      4,
      parts.reduce((n, p) => n + p.length, 0) - 8,
      true,
    );
  }
  const output = join(parts),
    reopened = parseStructure(output),
    after = await inspect(output);
  if (!equal(imageData(source), imageData(reopened)))
    throw new Error(
      "Verification failed: image data changed. No output was created.",
    );
  if (before.orientation !== after.orientation)
    throw new Error(
      "Verification failed: image rotation changed. No output was created.",
    );
  for (const block of reopened.blocks) {
    if (!block.family || !selected.has(block.family)) continue;
    if (block.family === "exif" && keptRotation) {
      const raw = block.payload!;
      const canonical = orientationExif(before.orientation);
      const tiff = source.format === "jpeg" ? raw.subarray(6) : raw;
      if (equal(tiff, canonical)) continue;
    }
    throw new Error(
      "Verification failed: selected metadata remains. No output was created.",
    );
  }
  return {
    bytes: output,
    before,
    after,
    removedBytes: bytes.length - output.length,
    removedContainers,
    preservedOrientation: keptRotation,
  };
}
