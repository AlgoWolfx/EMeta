import { ascii } from "./binary";
import { inspect as inspectImage } from "./inspect";
import { clean as cleanImage } from "./clean";
import type { CleanResult, Family, Inspection } from "./types";
export function category(bytes: Uint8Array) {
  if (ascii(bytes, 0, 5) === "%PDF-") return "pdf";
  if (bytes[0] === 0x1a && bytes[1] === 0x45) return "video";
  if (["II*\0", "MM\0*"].includes(ascii(bytes, 0, 4))) return "tiff";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4),
      compatible = ascii(bytes, 8, Math.min(64, bytes.length - 8));
    if (brand === "avif" || brand === "avis")
      throw new Error(
        "AVIF is not currently supported. Choose HEIC/HEIF or another supported format.",
      );
    if (
      ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].some((b) =>
        compatible.includes(b),
      )
    )
      return "heic";
    return "video";
  }
  // QuickTime can begin with a wide/free/mdat atom rather than ftyp.
  if (
    bytes.length >= 8 &&
    ["wide", "moov", "mdat", "free"].includes(ascii(bytes, 4, 4))
  )
    return "video";
  return "image";
}
export async function inspect(bytes: Uint8Array): Promise<Inspection> {
  switch (category(bytes)) {
    case "pdf":
      return (await import("./adapters/pdf")).inspectPdf(bytes);
    case "heic":
      return (await import("./adapters/heif")).inspectHeif(bytes);
    case "video":
      return (await import("./adapters/video")).inspectVideo(bytes);
    case "tiff":
      return (await import("./adapters/tiff")).inspectTiff(bytes);
    default:
      return inspectImage(bytes);
  }
}
export async function clean(
  bytes: Uint8Array,
  families: Family[],
): Promise<CleanResult> {
  if (!families.length)
    throw new Error("Choose at least one metadata family to remove.");
  switch (category(bytes)) {
    case "pdf":
      return (await import("./adapters/pdf")).cleanPdf(bytes, families);
    case "heic":
      return (await import("./adapters/heif")).cleanHeif(bytes, families);
    case "video":
      return (await import("./adapters/video")).cleanVideo(bytes, families);
    case "tiff":
      return (await import("./adapters/tiff")).cleanTiff(bytes, families);
    default:
      return cleanImage(bytes, families);
  }
}
