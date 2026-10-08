import { ascii, equal, u32 } from "../binary";
import { boxes, freeBox, integer, type Box } from "./bmff";
import { applyRegions, makeField, result, type Region } from "./shared";
import type { CleanResult, Family, Field, Format } from "../types";
interface Parsed {
  format: Format;
  regions: Region[];
  fields: Field[];
  media: { start: number; end: number }[];
  warnings: string[];
  cleanable: boolean;
}
const parentTypes = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
  "mvex",
  "moof",
  "traf",
  "mfra",
]);
function mp4(bytes: Uint8Array): Parsed {
  const regions: Region[] = [],
    fields: Field[] = [],
    media: { start: number; end: number }[] = [],
    warnings: string[] = [];
  let timed = false;
  const top = boxes(bytes),
    brand = top.find((b) => b.type === "ftyp");
  if (
    !top.some((b) => b.type === "moov") ||
    !top.some((b) => b.type === "mdat")
  )
    throw new Error("The video is incomplete: movie or media data is missing.");
  const format: Format =
    brand && ascii(bytes, brand.data, 4) === "qt  " ? "mov" : "mp4";
  function walk(list: Box[], depth = 0) {
    if (depth > 20)
      throw new Error("Video box nesting exceeds the supported limit.");
    for (const b of list) {
      if (b.type === "mdat") {
        media.push({ start: b.data, end: b.end });
        continue;
      }
      if (b.type === "uuid") {
        const uuid = Array.from(bytes.subarray(b.data, b.data + 16))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        if (uuid === "be7acfcb97a942e89c71999491e3afac") {
          regions.push({
            start: b.start,
            end: b.end,
            family: "xmp",
            label: "Video XMP",
            replacement: freeBox(b),
          });
          fields.push(
            makeField(
              "XMP XML",
              new TextDecoder().decode(bytes.subarray(b.data + 16, b.end)),
              "XMP",
            ),
          );
        } else
          warnings.push(
            "Unknown UUID boxes are retained and may contain additional information.",
          );
        continue;
      }
      if (["udta", "meta"].includes(b.type)) {
        regions.push({
          start: b.start,
          end: b.end,
          family: "video-tags",
          label: `${b.type} video tags`,
          replacement: freeBox(b),
        });
        const raw = new TextDecoder().decode(bytes.subarray(b.data, b.end));
        fields.push(
          makeField(
            /©xyz|loci|GPS|location|ISO6709/i.test(raw)
              ? "Location tags"
              : "Video tags",
            raw.replace(/[\x00-\x1f]/g, " ").slice(0, 4096),
            "Container",
          ),
        );
        continue;
      }
      if (["mvhd", "tkhd", "mdhd"].includes(b.type)) {
        const version = bytes[b.data],
          n = version === 1 ? 8 : version === 0 ? 4 : 0;
        if (!n || b.data + 4 + n * 2 > b.end)
          throw new Error("Invalid video timestamp header.");
        for (const [index, label] of [
          "Creation time",
          "Modification time",
        ].entries()) {
          const start = b.data + 4 + n * index,
            timestamp = integer(bytes, start, n);
          if (timestamp) {
            regions.push({
              start,
              end: start + n,
              family: "time",
              label: `${b.type} ${label}`,
            });
            let value = String(timestamp);
            try {
              value = new Date((timestamp - 2082844800) * 1000).toISOString();
            } catch {
              /* Keep raw timestamp. */
            }
            fields.push(makeField(`${b.type} ${label}`, value));
          }
        }
      }
      if (b.type === "hdlr") {
        if (b.data + 24 > b.end) throw new Error("Invalid video handler.");
        const type = ascii(bytes, b.data + 8, 4);
        if (["meta", "mdta", "mett", "metx", "gps "].includes(type))
          timed = true;
        const name = new TextDecoder()
          .decode(bytes.subarray(b.data + 24, b.end))
          .replace(/\0/g, "");
        if (name) {
          regions.push({
            start: b.data + 24,
            end: b.end,
            family: "video-tags",
            label: "Track handler name",
          });
          fields.push(makeField("Track handler name", name));
        }
      }
      if (b.type === "stsd") {
        if (b.data + 8 > b.end) throw new Error("Invalid video sample table.");
        const entries = boxes(bytes, b.data + 8, b.end);
        if (
          entries.some((e) => ["encv", "enca", "enct", "encs"].includes(e.type))
        )
          throw new Error("Encrypted video tracks are not supported.");
        if (entries.some((e) => ["mett", "metx", "gpmd"].includes(e.type)))
          timed = true;
        fields.push(
          makeField(
            "Track codecs",
            entries.map((e) => e.type).join(", "),
            "Container",
          ),
        );
      }
      if (parentTypes.has(b.type)) walk(boxes(bytes, b.data, b.end), depth + 1);
    }
  }
  walk(top);
  if (timed)
    warnings.push(
      "Timed metadata tracks detected. Cleaning is disabled because location samples inside media data require a dedicated remuxer.",
    );
  warnings.push(
    "Video/audio samples, codec settings, timing and rotation remain byte-identical. Visible content, subtitles, attachments and unknown private boxes are outside tag removal.",
  );
  return {
    format,
    regions,
    fields,
    media,
    warnings: [...new Set(warnings)],
    cleanable: !timed,
  };
}
interface Element {
  id: number;
  start: number;
  data: number;
  end: number;
  idSize: number;
  sizeSize: number;
  unknown: boolean;
}
function vint(bytes: Uint8Array, p: number, isId = false) {
  const first = bytes[p];
  if (!first) throw new Error("Invalid EBML integer.");
  let n = 1,
    mask = 128;
  while (!(first & mask)) {
    mask >>= 1;
    n++;
  }
  if (n > (isId ? 4 : 8) || p + n > bytes.length)
    throw new Error("Truncated EBML integer.");
  let value = isId ? first : first & (mask - 1);
  for (let i = 1; i < n; i++) value = value * 256 + bytes[p + i];
  const unknown =
    !isId &&
    (first & (mask - 1)) === mask - 1 &&
    bytes.subarray(p + 1, p + n).every((x) => x === 255);
  if (!unknown && !Number.isSafeInteger(value))
    throw new Error("EBML size is outside the supported range.");
  return { value, n, unknown };
}
function elements(bytes: Uint8Array, start: number, end: number) {
  const out: Element[] = [];
  let p = start;
  while (p < end) {
    const id = vint(bytes, p, true),
      size = vint(bytes, p + id.n),
      data = p + id.n + size.n,
      next = size.unknown ? end : data + size.value;
    if (next > end || next < data)
      throw new Error("The EBML element length is invalid.");
    out.push({
      id: id.value,
      start: p,
      data,
      end: next,
      idSize: id.n,
      sizeSize: size.n,
      unknown: size.unknown,
    });
    p = next;
    if (out.length > 50000) throw new Error("Too many EBML elements.");
  }
  return out;
}
function voidElement(e: Element) {
  const length = e.end - e.start,
    n = e.sizeSize + e.idSize - 1,
    body = length - 1 - n;
  if (n > 8 || body < 0 || body >= 2 ** (7 * n) - 1)
    throw new Error("EBML element cannot be safely replaced.");
  const b = new Uint8Array(length);
  b[0] = 0xec;
  let size = body;
  for (let i = n; i >= 1; i--) {
    b[i] = size % 256;
    size = Math.floor(size / 256);
  }
  b[1] |= 1 << (8 - n);
  return b;
}
function emptyApp(e: Element, source: Uint8Array) {
  const out = new Uint8Array(e.end - e.start);
  out.set(source.subarray(e.start, e.start + e.idSize));
  let n = e.sizeSize,
    remaining = out.length - e.idSize - n;
  if (remaining === 1) {
    n++;
    remaining--;
  }
  if (n > 8) throw new Error("Cannot safely erase this app string.");
  out[e.idSize] = 1 << (8 - n);
  if (remaining > 0) {
    const start = e.idSize + n,
      voidSize = remaining - 2;
    if (voidSize < 0 || voidSize >= 127)
      throw new Error("Unsupported app string length.");
    out[start] = 0xec;
    out[start + 1] = 0x80 | voidSize;
  }
  return out;
}
function webm(bytes: Uint8Array): Parsed {
  const root = elements(bytes, 0, bytes.length),
    header = root.find((e) => e.id === 0x1a45dfa3),
    segment = root.find((e) => e.id === 0x18538067);
  if (!header || !segment)
    throw new Error("WebM/Matroska header or segment is missing.");
  const doc = elements(bytes, header.data, header.end).find(
      (e) => e.id === 0x4282,
    ),
    type = doc ? ascii(bytes, doc.data, doc.end - doc.data) : "";
  if (!["webm", "matroska"].includes(type))
    throw new Error("Unsupported EBML document type.");
  const regions: Region[] = [],
    fields: Field[] = [],
    media: { start: number; end: number }[] = [],
    warnings: string[] = [];
  let unsupported = false;
  const master = new Set([
    0x1549a966, 0x1654ae6b, 0xae, 0xe0, 0xe1, 0x114d9b74, 0x4dbb,
  ]);
  const tags: Record<number, string> = {
    [0x7ba9]: "Title",
    [0x4d80]: "Muxing app",
    [0x5741]: "Writing app",
    [0x536e]: "Track name",
    [0x1254c367]: "Tags",
  };
  function walk(start: number, end: number, depth = 0) {
    if (depth > 20) throw new Error("EBML nesting limit exceeded.");
    for (const e of elements(bytes, start, end)) {
      if (e.id === 0x1f43b675) {
        if (e.unknown)
          throw new Error(
            "Streamed unknown-length clusters cannot be safely inspected for trailing metadata.",
          );
        media.push({ start: e.start, end: e.end });
        continue;
      }
      if (e.id === 0x6d80)
        throw new Error(
          "Encrypted or compressed Matroska tracks are not supported.",
        );
      if (e.id === 0x83 && integer(bytes, e.data, e.end - e.data) === 0x21)
        unsupported = true;
      if (e.id === 0x1941a469)
        warnings.push(
          "Matroska attachments are retained and can contain their own private data.",
        );
      if (e.id === 0xbf) {
        regions.push({
          start: e.start,
          end: e.end,
          family: "container-crc",
          label: "Container checksum",
          replacement: voidElement(e),
        });
        continue;
      }
      if (tags[e.id]) {
        if (e.end === e.data) continue;
        const label = tags[e.id],
          value = new TextDecoder().decode(bytes.subarray(e.data, e.end));
        regions.push({
          start: e.start,
          end: e.end,
          family: "video-tags",
          label,
          replacement: [0x4d80, 0x5741].includes(e.id)
            ? emptyApp(e, bytes)
            : voidElement(e),
        });
        fields.push(makeField(label, value.replace(/[\x00-\x1f]/g, " ")));
        continue;
      }
      if (e.id === 0x4461) {
        regions.push({
          start: e.start,
          end: e.end,
          family: "time",
          label: "DateUTC",
          replacement: voidElement(e),
        });
        fields.push(makeField("DateUTC", "Embedded creation timestamp"));
        continue;
      }
      if (master.has(e.id)) walk(e.data, e.end, depth + 1);
    }
  }
  walk(segment.data, segment.end);
  if (!media.length) throw new Error("The video has no media clusters.");
  if (unsupported)
    warnings.push("Matroska metadata tracks are inspection only.");
  warnings.push(
    "Audio/video clusters and playback properties are preserved without remuxing. Container checksums are removed after editing; no media samples are rewritten.",
  );
  return {
    format: type === "webm" ? "webm" : "mkv",
    regions,
    fields,
    media,
    warnings,
    cleanable: !unsupported,
  };
}
function parse(bytes: Uint8Array) {
  return bytes[0] === 0x1a && bytes[1] === 0x45 ? webm(bytes) : mp4(bytes);
}
export function inspectVideo(bytes: Uint8Array) {
  const p = parse(bytes);
  return result(
    p.format,
    p.fields,
    p.regions.filter((r) => r.family !== "container-crc"),
    p.warnings,
    p.cleanable,
  );
}
export function cleanVideo(bytes: Uint8Array, families: Family[]): CleanResult {
  const p = parse(bytes),
    before = inspectVideo(bytes);
  if (!p.cleanable)
    throw new Error(
      "This video contains metadata tracks that cannot be safely cleaned.",
    );
  const selected = [...families, "container-crc"] as Family[],
    output = applyRegions(bytes, p.regions, selected),
    after = inspectVideo(output);
  for (const family of families)
    if (after.families.includes(family))
      throw new Error("Video verification failed: selected tags remain.");
  const reopened = parse(output);
  if (p.media.length !== reopened.media.length)
    throw new Error("Video media container count changed.");
  for (const e of p.media)
    if (!equal(bytes.subarray(e.start, e.end), output.subarray(e.start, e.end)))
      throw new Error("Video verification failed: media data changed.");
  return {
    bytes: output,
    before,
    after,
    removedBytes: 0,
    removedContainers: before.containers.filter((r) =>
      families.includes(r.family),
    ).length,
    preservedOrientation: true,
    verification:
      "Selected tags erased; audio/video payload bytes and playback properties preserved. Container size is unchanged.",
  };
}
