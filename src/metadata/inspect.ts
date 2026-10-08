import * as exifr from "exifr";
import { ascii } from "./binary";
import { parseStructure } from "./structure";
import type { Block, Field, Group, Inspection } from "./types";

const MAX_TEXT = 1024 * 1024;
const pretty = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_:]/g, " ");
function category(key: string, fallback: Group): Group {
  if (/gps|latitude|longitude|location|city|country|sublocation/i.test(key))
    return "Location";
  if (
    /make$|model|lens|serial|camera|device|exposure|iso|fnumber|focal|flash|shutter|aperture/i.test(
      key,
    )
  )
    return "Camera & device";
  if (/date|time|offsettime/i.test(key)) return "Date & time";
  if (/software|tool|editor|processing/i.test(key)) return "Software";
  if (/author|creator|artist|copyright|rights|owner|byline|credit/i.test(key))
    return "Creator & copyright";
  if (/width|height|orientation|resolution|colorspace/i.test(key))
    return "Image";
  return fallback;
}
function valueText(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array)
    return `[${value.length} bytes of binary data]`;
  if (typeof value === "object")
    return JSON.stringify(value)?.slice(0, 4096) ?? "";
  return String(value).slice(0, 4096);
}
function fieldsOf(
  obj: unknown,
  fallback: Group,
  prefix = "",
  out: Field[] = [],
): Field[] {
  if (!obj || typeof obj !== "object") return out;
  for (const [name, value] of Object.entries(obj)) {
    if (out.length >= 512) break;
    const key = prefix ? `${prefix}.${name}` : name;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Uint8Array) &&
      !(value instanceof Date)
    )
      fieldsOf(value, fallback, key, out);
    else if (value !== undefined && value !== null) {
      const group = category(key, fallback);
      out.push({
        key,
        value: valueText(value),
        group,
        sensitive: group === "Location" || /serial|owner|uniqueid/i.test(key),
      });
    }
  }
  return out;
}
async function inflate(b: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([b.slice().buffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.length;
      if (size > MAX_TEXT)
        throw new Error("Compressed text exceeds the inspection limit.");
      parts.push(item.value);
    }
  } finally {
    await reader.cancel();
  }
  const result = new Uint8Array(size);
  let p = 0;
  for (const part of parts) {
    result.set(part, p);
    p += part.length;
  }
  return result;
}
export async function embeddedText(
  block: Block,
): Promise<{ key: string; text: string }> {
  const b = block.payload!;
  if (b.length > MAX_TEXT)
    throw new Error("Text record exceeds the inspection limit.");
  if (block.code === 0xfe)
    return { key: "Comment", text: new TextDecoder("windows-1252").decode(b) };
  if (block.code === "XMP ")
    return { key: "XMP", text: new TextDecoder().decode(b) };
  if (block.code === 0xe1) {
    const zero = b.indexOf(0);
    if (zero < 0 || ascii(b, 0, zero).includes("extension"))
      throw new Error("Extended XMP cannot be displayed completely.");
    return { key: "XMP", text: new TextDecoder().decode(b.subarray(zero + 1)) };
  }
  const zero = b.indexOf(0);
  if (zero < 1 || zero > 79) throw new Error("PNG text keyword is invalid.");
  const key = new TextDecoder("windows-1252").decode(b.subarray(0, zero));
  let textBytes = b.subarray(zero + 1);
  if (block.code === "zTXt") {
    if (textBytes[0] !== 0) throw new Error("Unknown text compression.");
    textBytes = await inflate(textBytes.subarray(1));
  } else if (block.code === "iTXt") {
    const compressed = textBytes[0];
    if (![0, 1].includes(compressed) || textBytes[1] !== 0)
      throw new Error("Invalid international text record.");
    textBytes = textBytes.subarray(2);
    for (let i = 0; i < 2; i++) {
      const end = textBytes.indexOf(0);
      if (end < 0) throw new Error("International text header is truncated.");
      textBytes = textBytes.subarray(end + 1);
    }
    if (compressed) textBytes = await inflate(textBytes);
  }
  return {
    key,
    text: new TextDecoder(
      block.code === "iTXt" ? "utf-8" : "windows-1252",
    ).decode(textBytes),
  };
}

export async function inspect(bytes: Uint8Array): Promise<Inspection> {
  const structure = parseStructure(bytes);
  const warnings = [...structure.warnings];
  const fields: Field[] = [];
  let cleanable = structure.cleanable;
  const orientation =
    structure.blocks.find((b) => b.orientation)?.orientation ?? 1;
  for (const block of structure.blocks) {
    if (!block.family) continue;
    try {
      if (block.family === "exif") {
        const raw = block.payload!;
        const tiff = ascii(raw, 0, 6) === "Exif\0\0" ? raw.subarray(6) : raw;
        fields.push(
          ...fieldsOf(
            await exifr.parse(tiff, {
              mergeOutput: true,
              translateValues: false,
              reviveValues: false,
              makerNote: false,
              userComment: true,
              ifd1: false,
            }),
            "EXIF",
          ),
        );
      } else if (block.family === "iptc") {
        fields.push(
          ...fieldsOf(
            await exifr.parse(bytes, {
              tiff: false,
              xmp: false,
              icc: false,
              iptc: true,
            }),
            "IPTC",
          ),
        );
      } else if (block.family === "xmp") {
        const { text } = await embeddedText(block);
        const output = await exifr.sidecar(
          new TextEncoder().encode(text),
          { mergeOutput: true, translateValues: false },
          "xmp",
        );
        const values = fieldsOf(output, "XMP");
        fields.push(...values);
        const rotation = values.find((f) => /orientation$/i.test(f.key));
        if (
          rotation &&
          Number(rotation.value) > 1 &&
          Number(rotation.value) !== orientation
        ) {
          warnings.push(
            "XMP contains display orientation without a matching EXIF record. Cleaning is disabled to avoid changing image appearance.",
          );
          cleanable = false;
        }
        if (!values.length)
          fields.push({
            key: "XMP XML",
            value: text.slice(0, 4096),
            group: "XMP",
            sensitive: /gps|latitude|longitude/i.test(text),
          });
      } else if (block.family === "text") {
        const { key, text } = await embeddedText(block);
        const group = category(key, "Text");
        fields.push({
          key,
          value: text.slice(0, 4096),
          group,
          sensitive: group === "Location",
        });
      } else if (block.family === "time") {
        const p = block.payload!;
        fields.push({
          key: "Embedded modification time",
          value:
            p.length === 7
              ? `${p[0] * 256 + p[1]}-${String(p[2]).padStart(2, "0")}-${String(p[3]).padStart(2, "0")} ${String(p[4]).padStart(2, "0")}:${String(p[5]).padStart(2, "0")}:${String(p[6]).padStart(2, "0")} UTC`
              : "Invalid timestamp",
          group: "Date & time",
          sensitive: false,
        });
      }
    } catch {
      warnings.push(
        `${block.label}: some values could not be read. The complete metadata container remains selectable for removal.`,
      );
      if (block.family === "xmp") {
        cleanable = false;
        warnings.push(
          "Unreadable XMP: cleaning is disabled because display orientation cannot be checked.",
        );
      }
    }
  }
  if (structure.width)
    fields.unshift({
      key: "Dimensions",
      value: `${structure.width} × ${structure.height} px`,
      group: "Image",
      sensitive: false,
    });
  if (!fields.some((f) => /orientation$/i.test(f.key)))
    fields.push({
      key: "Orientation",
      value: String(orientation),
      group: "Image",
      sensitive: false,
    });
  if (fields.length >= 512)
    warnings.push(
      "Large metadata set: the display is limited to 512 values per container. Removal still applies to the complete container.",
    );
  const containers = structure.blocks
    .filter((b) => b.family)
    .map((b) => ({ label: b.label, family: b.family!, size: b.bytes.length }));
  const families = [...new Set(containers.map((c) => c.family))];
  return {
    format: structure.format,
    width: structure.width,
    height: structure.height,
    fields,
    containers,
    families,
    warnings: [...new Set(warnings)],
    cleanable,
    orientation,
  };
}
export const fieldLabel = pretty;
