import { equal } from "../binary";
import { inspect as inspectImage } from "../inspect";
import type { CleanResult, Family } from "../types";
interface Entry {
  tag: number;
  start: number;
  raw: Uint8Array;
  valueStart: number;
  length: number;
  family?: Family;
}
interface Dir {
  offset: number;
  entries: Entry[];
  next: number;
  metadata: boolean;
  end: number;
}
const sizes: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
  13: 4,
};
const families: Record<number, Family> = {
  0x8769: "exif",
  0x8825: "exif",
  0xa005: "exif",
  0x83bb: "iptc",
  0x8649: "iptc",
  0x2bc: "xmp",
  0x10d: "text",
  0x10e: "text",
  0x13b: "text",
  0x8298: "text",
  0x13c: "text",
  0x131: "text",
  0x132: "time",
};
function parse(bytes: Uint8Array) {
  const little = bytes[0] === 0x49,
    v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    dirs: Dir[] = [],
    seen = new Set<number>();
  const u16 = (p: number) => {
    if (p < 0 || p + 2 > bytes.length) throw new Error("Truncated TIFF value.");
    return v.getUint16(p, little);
  };
  const u32 = (p: number) => {
    if (p < 0 || p + 4 > bytes.length) throw new Error("Truncated TIFF value.");
    return v.getUint32(p, little);
  };
  const media: { start: number; end: number }[] = [];
  function values(e: Entry) {
    if (![3, 4, 13].includes(u16(e.start + 2)))
      throw new Error("Unsupported TIFF image pointer type.");
    const n = e.length / sizes[u16(e.start + 2)];
    return Array.from({ length: n }, (_, i) =>
      u16(e.start + 2) === 3
        ? u16(e.valueStart + i * 2)
        : u32(e.valueStart + i * 4),
    );
  }
  function walk(offset: number, metadata = false, depth = 0) {
    if (!offset) return;
    if (depth > 20 || seen.has(offset))
      throw new Error("Cyclic or deeply nested TIFF directories.");
    seen.add(offset);
    const count = u16(offset),
      end = offset + 2 + 12 * count + 4;
    if (count > 4096 || end > bytes.length)
      throw new Error("Invalid TIFF directory size.");
    const entries: Entry[] = [];
    for (let i = 0; i < count; i++) {
      const start = offset + 2 + i * 12,
        tag = u16(start),
        type = u16(start + 2),
        n = u32(start + 4),
        size = sizes[type];
      if (!size) throw new Error("Unknown TIFF field type.");
      const length = n * size,
        valueStart = length <= 4 ? start + 8 : u32(start + 8);
      if (valueStart < 0 || valueStart + length > bytes.length)
        throw new Error("TIFF value points outside the file.");
      entries.push({
        tag,
        start,
        raw: bytes.slice(start, start + 12),
        valueStart,
        length,
        family: families[tag],
      });
    }
    const next = u32(end - 4);
    dirs.push({ offset, entries, next, metadata, end });
    if (!metadata) {
      for (const [offTag, lenTag] of [
        [273, 279],
        [324, 325],
        [513, 514],
      ]) {
        const off = entries.find((e) => e.tag === offTag),
          len = entries.find((e) => e.tag === lenTag);
        if (!off && !len) continue;
        if (!off || !len)
          throw new Error("TIFF image offset/count pair is incomplete.");
        const a = values(off),
          b = values(len);
        if (a.length !== b.length)
          throw new Error("TIFF image table lengths differ.");
        a.forEach((start, i) => {
          if (start < 8 || start + b[i] > bytes.length)
            throw new Error("TIFF image data is out of bounds.");
          media.push({ start, end: start + b[i] });
        });
      }
    }
    for (const entry of entries) {
      if ([0x8769, 0x8825, 0xa005, 0x14a].includes(entry.tag))
        for (const child of values(entry))
          walk(child, metadata || entry.tag !== 0x14a, depth + 1);
    }
    if (next) walk(next, metadata, depth + 1);
  }
  if (u16(2) !== 42) throw new Error("BigTIFF is not supported.");
  walk(u32(4));
  if (!media.length) throw new Error("TIFF image strip/tile data is missing.");
  return { dirs, little, media };
}
export async function inspectTiff(bytes: Uint8Array) {
  const p = parse(bytes),
    r = await inspectImage(bytes);
  r.cleanable = true;
  r.warnings = [
    "Classic TIFF directory cleaning preserves strips/tiles, color and display orientation. Unknown private tags remain; BigTIFF and cyclic directories are refused.",
  ];
  r.containers = p.dirs.flatMap((d) =>
    d.metadata
      ? []
      : d.entries
          .filter((e) => e.family)
          .map((e) => ({
            family: e.family!,
            label: `TIFF tag 0x${e.tag.toString(16)}`,
            size: e.length + 12,
          })),
  );
  r.families = [...new Set(r.containers.map((c) => c.family))];
  return r;
}
export async function cleanTiff(
  bytes: Uint8Array,
  families: Family[],
): Promise<CleanResult> {
  const before = await inspectTiff(bytes),
    p = parse(bytes),
    selected = new Set(families),
    output = bytes.slice(),
    v = new DataView(output.buffer),
    erased: { start: number; end: number }[] = [];
  const protectedRanges = [
    ...p.media,
    ...p.dirs
      .filter((d) => !d.metadata || !selected.has("exif"))
      .map((d) => ({ start: d.offset, end: d.end })),
    ...p.dirs
      .filter((d) => d.metadata && !selected.has("exif"))
      .flatMap((d) =>
        d.entries
          .filter((e) => e.length > 4)
          .map((e) => ({ start: e.valueStart, end: e.valueStart + e.length })),
      ),
    ...p.dirs
      .filter((d) => !d.metadata)
      .flatMap((d) =>
        d.entries
          .filter((e) => !e.family || !selected.has(e.family))
          .filter((e) => e.length > 4)
          .map((e) => ({ start: e.valueStart, end: e.valueStart + e.length })),
      ),
  ];
  if (selected.has("exif"))
    for (const d of p.dirs.filter((d) => d.metadata)) {
      erased.push({ start: d.offset, end: d.end });
      for (const e of d.entries)
        if (e.length > 4)
          erased.push({ start: e.valueStart, end: e.valueStart + e.length });
    }
  for (const d of p.dirs.filter((d) => !d.metadata)) {
    const kept = d.entries.filter((e) => !e.family || !selected.has(e.family));
    for (const e of d.entries.filter((e) => e.family && selected.has(e.family)))
      if (e.length > 4)
        erased.push({ start: e.valueStart, end: e.valueStart + e.length });
    output.fill(0, d.offset, d.end);
    v.setUint16(d.offset, kept.length, p.little);
    kept.forEach((e, i) => output.set(e.raw, d.offset + 2 + i * 12));
    v.setUint32(d.offset + 2 + kept.length * 12, d.next, p.little);
  }
  for (const a of erased)
    for (const b of protectedRanges)
      if (a.start < b.end && b.start < a.end)
        throw new Error(
          "TIFF metadata overlaps retained image data. Cleaning refused.",
        );
  for (const e of erased) output.fill(0, e.start, e.end);
  const reopened = parse(output);
  if (reopened.media.length !== p.media.length)
    throw new Error("TIFF image table changed.");
  for (const e of p.media)
    if (!equal(bytes.subarray(e.start, e.end), output.subarray(e.start, e.end)))
      throw new Error("TIFF image payload changed.");
  const after = await inspectTiff(output);
  for (const family of families)
    if (after.families.includes(family))
      throw new Error("Selected TIFF metadata remains.");
  return {
    bytes: output,
    before,
    after,
    removedBytes: 0,
    removedContainers: before.containers.filter((c) => selected.has(c.family))
      .length,
    preservedOrientation: true,
    verification:
      "Selected TIFF tags and stored values erased; image strips/tiles and rendering tags preserved. Container size is unchanged.",
  };
}
