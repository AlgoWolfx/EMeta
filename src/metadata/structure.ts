import { ascii, crc32, readOrientation, u32 } from "./binary";
import type { Block, Family, Structure } from "./types";

function finish(
  format: Structure["format"],
  blocks: Block[],
  width?: number,
  height?: number,
): Structure {
  const warnings: string[] = [];
  let cleanable = format !== "tiff";
  for (const block of blocks.filter((b) => b.family === "exif")) {
    try {
      block.orientation = readOrientation(block.payload!);
    } catch {
      warnings.push(
        "Damaged EXIF: cleaning is disabled because image rotation cannot be preserved safely.",
      );
      cleanable = false;
    }
  }
  const orientations = new Set(
    blocks.filter((b) => b.orientation).map((b) => b.orientation),
  );
  if (orientations.size > 1) {
    warnings.push("Conflicting orientation records: cleaning is disabled.");
    cleanable = false;
  }
  if (blocks.some((b) => b.label === "MPF")) {
    warnings.push(
      "Multi-picture JPEG: inspection only. Auxiliary images cannot be safely rewritten.",
    );
    cleanable = false;
  }
  return { format, blocks, width, height, warnings, cleanable };
}

function jpeg(b: Uint8Array): Structure {
  const blocks: Block[] = [{ label: "SOI", bytes: b.slice(0, 2) }];
  let p = 2,
    width: number | undefined,
    height: number | undefined,
    sawScan = false;
  while (p < b.length) {
    const start = p;
    if (b[p++] !== 0xff)
      throw new Error("The JPEG marker structure is damaged.");
    while (b[p] === 0xff) p++;
    const code = b[p++];
    if (code === 0xd9) {
      if (!sawScan || !width || !height)
        throw new Error("This JPEG has no valid image data.");
      blocks.push({ label: "EOI", bytes: b.slice(start, p), code });
      if (p < b.length)
        blocks.push({
          label: "Trailing data",
          bytes: b.slice(p),
          family: "other",
        });
      return finish("jpeg", blocks, width, height);
    }
    if (code === undefined || code === 0 || code === 0xd8 || code < 0xc0)
      throw new Error("The JPEG contains an invalid marker.");
    if (code >= 0xd0 && code <= 0xd7)
      throw new Error("A JPEG restart marker is outside the image scan.");
    if (p + 2 > b.length) throw new Error("The JPEG is truncated.");
    const length = b[p] * 256 + b[p + 1];
    if (length < 2 || p + length > b.length)
      throw new Error("The JPEG contains a truncated marker.");
    const payload = b.slice(p + 2, p + length);
    p += length;
    let label = `Marker ${code.toString(16).toUpperCase()}`,
      family: Family | undefined;
    if (code === 0xe1) {
      family =
        ascii(payload, 0, 6) === "Exif\0\0"
          ? "exif"
          : ascii(payload, 0, 28).startsWith("http://ns.adobe.com/")
            ? "xmp"
            : "other";
      label = family.toUpperCase();
    } else if (code === 0xed) {
      family = "iptc";
      label = "IPTC / Photoshop";
    } else if (code === 0xfe) {
      family = "text";
      label = "JPEG comment";
    } else if (code === 0xe2 && ascii(payload, 0, 4) === "MPF\0") label = "MPF";
    else if (code === 0xe2 && ascii(payload, 0, 12) === "ICC_PROFILE\0")
      label = "Color profile";
    else if (code >= 0xe0 && code <= 0xef && code !== 0xe0 && code !== 0xee) {
      family = "other";
      label = `APP${code - 0xe0}`;
    }
    if ([0xc0, 0xc1, 0xc2].includes(code)) {
      if (payload.length < 6)
        throw new Error("The JPEG image dimensions are truncated.");
      height = payload[1] * 256 + payload[2];
      width = payload[3] * 256 + payload[4];
    }
    blocks.push({ label, family, code, payload, bytes: b.slice(start, p) });
    if (code === 0xda) {
      sawScan = true;
      const scanStart = p;
      while (p < b.length) {
        if (b[p] !== 0xff) {
          p++;
          continue;
        }
        let q = p + 1;
        while (b[q] === 0xff) q++;
        if (b[q] === 0 || (b[q] >= 0xd0 && b[q] <= 0xd7)) {
          p = q + 1;
          continue;
        }
        break;
      }
      blocks.push({ label: "Image scan", bytes: b.slice(scanStart, p) });
    }
  }
  throw new Error("The JPEG is incomplete: its end marker is missing.");
}

function png(b: Uint8Array): Structure {
  const blocks: Block[] = [{ label: "PNG signature", bytes: b.slice(0, 8) }];
  let p = 8,
    width: number | undefined,
    height: number | undefined,
    sawData = false;
  const known = new Set([
    "IHDR",
    "IDAT",
    "IEND",
    "PLTE",
    "tRNS",
    "cHRM",
    "gAMA",
    "iCCP",
    "sBIT",
    "sRGB",
    "bKGD",
    "pHYs",
    "hIST",
    "sPLT",
    "acTL",
    "fcTL",
    "fdAT",
    "cICP",
    "mDCV",
    "cLLI",
  ]);
  const unknown: string[] = [];
  while (p < b.length) {
    if (p + 12 > b.length) throw new Error("The PNG chunk table is truncated.");
    const size = u32(b, p),
      type = ascii(b, p + 4, 4),
      end = p + size + 12;
    if (!/^[a-zA-Z]{4}$/.test(type) || end > b.length)
      throw new Error("The PNG contains an invalid chunk.");
    if (crc32(b.subarray(p + 4, end - 4)) !== u32(b, end - 4))
      throw new Error(
        `The PNG ${type} checksum failed. The file may be corrupt.`,
      );
    const payload = b.slice(p + 8, end - 4);
    if (p === 8 && type !== "IHDR")
      throw new Error("The PNG header is missing.");
    if (type === "IHDR") {
      if (p !== 8 || size !== 13) throw new Error("The PNG header is invalid.");
      width = u32(payload, 0);
      height = u32(payload, 4);
    }
    let family: Family | undefined;
    if (type === "eXIf") family = "exif";
    else if (type === "tIME") family = "time";
    else if (["tEXt", "zTXt", "iTXt"].includes(type))
      family = ascii(payload, 0, Math.min(payload.length, 100)).startsWith(
        "XML:com.adobe.xmp\0",
      )
        ? "xmp"
        : "text";
    else if (!known.has(type)) {
      if (type[0] === type[0].toUpperCase())
        throw new Error(`Unsupported critical PNG chunk: ${type}.`);
      unknown.push(type);
    }
    blocks.push({
      label: type,
      family,
      payload,
      code: type,
      bytes: b.slice(p, end),
    });
    p = end;
    if (type === "IDAT") sawData = true;
    if (type === "IEND") {
      if (size || !sawData || !width || !height || p !== b.length)
        throw new Error(
          "The PNG has incomplete image data or an unexpected trailer.",
        );
      const result = finish("png", blocks, width, height);
      if (unknown.length)
        result.warnings.push(
          `Unknown PNG chunks are preserved: ${unknown.join(", ")}. They may contain additional metadata.`,
        );
      return result;
    }
  }
  throw new Error("The PNG is incomplete: its end chunk is missing.");
}

function webp(b: Uint8Array): Structure {
  if (u32(b, 4, true) + 8 !== b.length)
    throw new Error("The WebP container length is invalid.");
  const blocks: Block[] = [{ label: "RIFF", bytes: b.slice(0, 12) }];
  const unknown: string[] = [];
  let p = 12,
    width: number | undefined,
    height: number | undefined,
    sawImage = false;
  while (p < b.length) {
    if (p + 8 > b.length) throw new Error("The WebP chunk table is truncated.");
    const type = ascii(b, p, 4),
      size = u32(b, p + 4, true),
      end = p + 8 + size + (size % 2);
    if (end > b.length) throw new Error("The WebP contains a truncated chunk.");
    const payload = b.slice(p + 8, p + 8 + size);
    if (type === "VP8X") {
      if (payload.length !== 10)
        throw new Error("The extended WebP header is invalid.");
      width = 1 + payload[4] + payload[5] * 256 + payload[6] * 65536;
      height = 1 + payload[7] + payload[8] * 256 + payload[9] * 65536;
    } else if (type === "VP8 " && !width) {
      if (payload.length < 10 || ascii(payload, 3, 3) !== "\x9d\x01\x2a")
        throw new Error("The WebP image header is invalid.");
      width = (payload[6] | (payload[7] << 8)) & 0x3fff;
      height = (payload[8] | (payload[9] << 8)) & 0x3fff;
    } else if (type === "VP8L" && !width) {
      if (payload.length < 5 || payload[0] !== 0x2f)
        throw new Error("The lossless WebP image header is invalid.");
      const bits = u32(payload, 1, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
    if (["VP8 ", "VP8L", "ANMF"].includes(type)) sawImage = true;
    const family =
      type === "EXIF" ? "exif" : type === "XMP " ? "xmp" : undefined;
    if (
      !family &&
      !["VP8X", "VP8 ", "VP8L", "ANIM", "ANMF", "ALPH", "ICCP"].includes(type)
    )
      unknown.push(type);
    blocks.push({
      label: type.trim(),
      family,
      payload,
      code: type,
      bytes: b.slice(p, end),
    });
    p = end;
  }
  if (!sawImage || !width || !height)
    throw new Error("The WebP has no valid image data.");
  const result = finish("webp", blocks, width, height);
  if (unknown.length)
    result.warnings.push(
      `Unknown WebP chunks are preserved: ${unknown.join(", ")}. They may contain additional metadata.`,
    );
  return result;
}

export function parseStructure(b: Uint8Array): Structure {
  if (b[0] === 0xff && b[1] === 0xd8) return jpeg(b);
  if (b.length >= 8 && ascii(b, 0, 8) === "\x89PNG\r\n\x1a\n") return png(b);
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP")
    return webp(b);
  if (b.length >= 8 && ["II*\0", "MM\0*"].includes(ascii(b, 0, 4))) {
    readOrientation(b);
    return {
      format: "tiff",
      blocks: [{ label: "TIFF", bytes: b, payload: b, family: "exif" }],
      warnings: [
        "TIFF is inspection only. Safe removal would require rewriting image directories and is not supported in v1.",
      ],
      cleanable: false,
    };
  }
  throw new Error(
    "Unsupported file. Choose JPEG, PNG, WebP, classic TIFF, HEIC/HEIF, PDF, MP4, MOV, WebM or MKV.",
  );
}
