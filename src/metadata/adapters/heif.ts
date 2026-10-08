import * as exifr from "exifr";
import { ascii, equal, join } from "../binary";
import { boxes, boxBytes, cstring, integer, type Box } from "./bmff";
import type { CleanResult, Family, Field, Inspection } from "../types";
import { makeField } from "./shared";
interface Item {
  id: number;
  box: Box;
  family?: Family;
  type: string;
}
interface Extent {
  start: number;
  end: number;
}
interface Location {
  id: number;
  raw: Uint8Array;
  extents: Extent[];
}
function parse(bytes: Uint8Array) {
  const top = boxes(bytes),
    meta = top.find((b) => b.type === "meta");
  if (!meta) throw new Error("HEIF metadata box is missing.");
  const children = boxes(bytes, meta.data + 4, meta.end),
    iinf = children.find((b) => b.type === "iinf"),
    iloc = children.find((b) => b.type === "iloc"),
    idat = children.find((b) => b.type === "idat");
  if (!iinf || !iloc) throw new Error("HEIF item tables are missing.");
  const iinfHeader = bytes[iinf.data] === 0 ? 6 : 8,
    items: Item[] = [];
  for (const entry of boxes(bytes, iinf.data + iinfHeader, iinf.end)) {
    if (entry.type !== "infe") throw new Error("Unsupported HEIF item table.");
    const version = bytes[entry.data];
    if (version !== 2 && version !== 3)
      throw new Error("Only HEIF version 2/3 item descriptors can be cleaned.");
    const idSize = version === 2 ? 2 : 4,
      id = integer(bytes, entry.data + 4, idSize),
      protection = integer(bytes, entry.data + 4 + idSize, 2),
      type = ascii(bytes, entry.data + 6 + idSize, 4);
    if (protection) throw new Error("Protected HEIF items cannot be cleaned.");
    let family: Family | undefined = type === "Exif" ? "exif" : undefined;
    if (type === "mime") {
      const name = cstring(bytes, entry.data + 10 + idSize, entry.end),
        mime = cstring(bytes, name.next, entry.end).text;
      if (mime === "application/rdf+xml" || mime === "application/xml")
        family = "xmp";
    }
    items.push({ id, box: entry, family, type });
  }
  const version = bytes[iloc.data];
  if (version > 2) throw new Error("Unsupported HEIF location table version.");
  const offsetSize = bytes[iloc.data + 4] >>> 4,
    lengthSize = bytes[iloc.data + 4] & 15,
    baseSize = bytes[iloc.data + 5] >>> 4,
    indexSize = version ? bytes[iloc.data + 5] & 15 : 0;
  const countSize = version === 2 ? 4 : 2,
    count = integer(bytes, iloc.data + 6, countSize),
    locations: Location[] = [];
  if (count > 5000) throw new Error("This HEIF has too many items.");
  let p = iloc.data + 6 + countSize;
  for (let i = 0; i < count; i++) {
    const start = p,
      idSize = version === 2 ? 4 : 2,
      id = integer(bytes, p, idSize);
    p += idSize;
    const method = version ? integer(bytes, p, 2) & 15 : 0;
    if (version) p += 2;
    const reference = integer(bytes, p, 2);
    p += 2;
    if (reference || method > 1)
      throw new Error("External or derived HEIF item offsets are unsupported.");
    const base = integer(bytes, p, baseSize);
    p += baseSize;
    const extentCount = integer(bytes, p, 2);
    p += 2;
    const extents: Extent[] = [];
    if (extentCount > 5000) throw new Error("Too many HEIF extents.");
    for (let j = 0; j < extentCount; j++) {
      p += indexSize;
      const offset = integer(bytes, p, offsetSize);
      p += offsetSize;
      const length = integer(bytes, p, lengthSize);
      p += lengthSize;
      const absolute = base + offset + (method === 1 ? (idat?.data ?? -1) : 0);
      if (!length || absolute < 0 || absolute + length > bytes.length)
        throw new Error("HEIF item extent is invalid.");
      const parent =
        method === 1
          ? idat
          : top.find(
              (b) =>
                b.type === "mdat" &&
                absolute >= b.data &&
                absolute + length <= b.end,
            );
      if (!parent || absolute < parent.data || absolute + length > parent.end)
        throw new Error("HEIF extent is outside its data container.");
      extents.push({ start: absolute, end: absolute + length });
    }
    locations.push({ id, raw: bytes.slice(start, p), extents });
  }
  if (p !== iloc.end)
    throw new Error("Unexpected data in the HEIF item location table.");
  if (
    new Set(items.map((i) => i.id)).size !== items.length ||
    new Set(locations.map((l) => l.id)).size !== locations.length
  )
    throw new Error("Duplicate HEIF item IDs.");
  for (const item of items)
    if (!locations.some((l) => l.id === item.id))
      throw new Error("HEIF item location is missing.");
  const pitm = children.find((b) => b.type === "pitm");
  if (
    pitm &&
    items.find(
      (i) =>
        i.id === integer(bytes, pitm.data + 4, bytes[pitm.data] === 0 ? 2 : 4),
    )?.family
  )
    throw new Error("HEIF primary image references a metadata item.");
  const warnings = items.some((i) => i.type === "mime" && !i.family)
    ? ["Unknown MIME items are retained and may contain other information."]
    : [];
  return {
    top,
    meta,
    children,
    iinf,
    iloc,
    iinfHeader,
    ilocHeader: 6 + countSize,
    items,
    locations,
    warnings,
  };
}
function payload(bytes: Uint8Array, location: Location) {
  return join(location.extents.map((e) => bytes.slice(e.start, e.end)));
}
let modulePromise: Promise<any> | undefined;
async function decoded(bytes: Uint8Array, preview = false) {
  modulePromise ??= import("libheif-js/libheif-wasm/libheif-bundle.mjs").then(
    (m) => m.default(),
  );
  const lib = await modulePromise,
    decoder = new lib.HeifDecoder(),
    images = decoder.decode(bytes),
    digests: string[] = [];
  if (!images.length || images.length > 30)
    throw new Error("HEIF decoder could not reopen this image collection.");
  let blob: Blob | undefined,
    width = 0,
    height = 0;
  try {
    for (const [index, img] of images.entries()) {
      const w = img.get_width(),
        h = img.get_height();
      if (w * h > 40_000_000)
        throw new Error("HEIF exceeds the 40-megapixel verification limit.");
      const pixels = {
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4),
      };
      await new Promise<void>((resolve, reject) =>
        img.display(pixels, (out: unknown) =>
          out
            ? resolve()
            : reject(new Error("HEIF pixels could not be decoded.")),
        ),
      );
      const hash = await crypto.subtle.digest("SHA-256", pixels.data.buffer);
      digests.push(
        `${w}x${h}:${Array.from(new Uint8Array(hash))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("")}`,
      );
      if (!index) {
        width = w;
        height = h;
        if (preview && typeof OffscreenCanvas !== "undefined") {
          const canvas = new OffscreenCanvas(w, h);
          canvas
            .getContext("2d")!
            .putImageData(new ImageData(pixels.data, w, h), 0, 0);
          blob = await canvas.convertToBlob({ type: "image/png" });
        }
      }
    }
  } finally {
    for (const img of images) img.free();
  }
  return { digests, preview: blob, width, height };
}
export async function inspectHeif(bytes: Uint8Array): Promise<Inspection> {
  const p = parse(bytes),
    fields: Field[] = [],
    containers: Inspection["containers"] = [];
  for (const item of p.items.filter((i) => i.family)) {
    const raw = payload(
      bytes,
      p.locations.find((l) => l.id === item.id)!,
    );
    containers.push({
      label: `HEIF ${item.family!.toUpperCase()} item`,
      family: item.family!,
      size: raw.length,
    });
    if (item.family === "exif") {
      const offset = integer(raw, 0, 4) + 4;
      if (offset >= raw.length) throw new Error("HEIF EXIF offset is invalid.");
      const data = await exifr.parse(raw.subarray(offset), {
        mergeOutput: true,
        translateValues: false,
        reviveValues: false,
        userComment: true,
      });
      for (const [key, value] of Object.entries(data ?? {}))
        fields.push(
          makeField(
            key,
            typeof value === "object" ? JSON.stringify(value) : value,
            "EXIF",
          ),
        );
    } else
      fields.push(makeField("XMP XML", new TextDecoder().decode(raw), "XMP"));
  }
  const image = await decoded(bytes, true);
  fields.unshift(
    makeField("Dimensions", `${image.width} × ${image.height} px`, "Image"),
  );
  const ambiguousRotation = fields.some(
    (f) => /orientation$/i.test(f.key) && Number(f.value) > 1,
  );
  if (ambiguousRotation)
    p.warnings.push(
      "EXIF display orientation is ambiguous relative to HEIF container rotation; cleaning is disabled.",
    );
  return {
    format: "heic",
    fields,
    containers,
    families: [...new Set(containers.map((c) => c.family))],
    warnings: [
      ...p.warnings,
      "HEIF image items, color and container rotation are preserved. Required rotation is a container property; EXIF is removed as a whole.",
    ],
    cleanable: !ambiguousRotation,
    orientation: 1,
    width: image.width,
    height: image.height,
    preview: image.preview,
  };
}
function fixedBox(type: string, payload: Uint8Array, length: number) {
  let padding = length - 8 - payload.length;
  if (padding < 0 || (padding > 0 && padding < 8))
    throw new Error(
      "HEIF table cannot be rewritten without moving image data.",
    );
  if (padding) {
    const free = boxBytes("free", new Uint8Array(padding - 8));
    return join([boxBytes(type, payload), free]);
  }
  return boxBytes(type, payload);
}
export async function cleanHeif(
  bytes: Uint8Array,
  families: Family[],
): Promise<CleanResult> {
  const before = await inspectHeif(bytes),
    p = parse(bytes),
    selected = new Set(families),
    removed = new Set(
      p.items
        .filter((i) => i.family && selected.has(i.family))
        .map((i) => i.id),
    );
  if (!before.cleanable)
    throw new Error(
      "This HEIF has ambiguous EXIF rotation and cannot be safely cleaned.",
    );
  const erased = p.locations
      .filter((l) => removed.has(l.id))
      .flatMap((l) => l.extents),
    retained = p.locations
      .filter((l) => !removed.has(l.id))
      .flatMap((l) => l.extents);
  for (const a of erased)
    for (const b of retained)
      if (a.start < b.end && b.start < a.end)
        throw new Error(
          "HEIF metadata overlaps image data. Cleaning is refused.",
        );
  const output = bytes.slice();
  for (const e of erased) output.fill(0, e.start, e.end);
  const infoHeader = bytes.slice(p.iinf.data, p.iinf.data + p.iinfHeader),
    infoView = new DataView(infoHeader.buffer);
  const infoCount = p.items.filter((i) => !removed.has(i.id)).length;
  if (infoHeader[0] === 0) infoView.setUint16(4, infoCount);
  else infoView.setUint32(4, infoCount);
  output.set(
    fixedBox(
      "iinf",
      join([
        infoHeader,
        ...p.items
          .filter((i) => !removed.has(i.id))
          .map((i) => bytes.slice(i.box.start, i.box.end)),
      ]),
      p.iinf.end - p.iinf.start,
    ),
    p.iinf.start,
  );
  const locHeader = bytes.slice(p.iloc.data, p.iloc.data + p.ilocHeader),
    locView = new DataView(locHeader.buffer),
    locCount = p.locations.filter((l) => !removed.has(l.id)).length;
  if (locHeader[0] === 2) locView.setUint32(6, locCount);
  else locView.setUint16(6, locCount);
  output.set(
    fixedBox(
      "iloc",
      join([
        locHeader,
        ...p.locations.filter((l) => !removed.has(l.id)).map((l) => l.raw),
      ]),
      p.iloc.end - p.iloc.start,
    ),
    p.iloc.start,
  );
  const iref = p.children.find((b) => b.type === "iref");
  if (iref) {
    const idSize = bytes[iref.data] === 0 ? 2 : 4,
      refs: Uint8Array[] = [];
    for (const ref of boxes(bytes, iref.data + 4, iref.end)) {
      const from = integer(bytes, ref.data, idSize),
        count = integer(bytes, ref.data + idSize, 2);
      if (ref.data + idSize + 2 + count * idSize !== ref.end)
        throw new Error("HEIF item reference is invalid.");
      if (removed.has(from)) continue;
      const to: number[] = [];
      for (let j = 0; j < count; j++) {
        const id = integer(bytes, ref.data + idSize + 2 + j * idSize, idSize);
        if (!removed.has(id)) to.push(id);
      }
      if (!to.length) continue;
      const data = new Uint8Array(idSize + 2 + to.length * idSize),
        view = new DataView(data.buffer);
      if (idSize === 2) view.setUint16(0, from);
      else view.setUint32(0, from);
      view.setUint16(idSize, to.length);
      to.forEach((id, j) =>
        idSize === 2
          ? view.setUint16(idSize + 2 + j * idSize, id)
          : view.setUint32(idSize + 2 + j * idSize, id),
      );
      refs.push(boxBytes(ref.type, data));
    }
    output.set(
      fixedBox(
        "iref",
        join([bytes.slice(iref.data, iref.data + 4), ...refs]),
        iref.end - iref.start,
      ),
      iref.start,
    );
  }
  const reopened = parse(output);
  for (const item of reopened.items)
    if (item.family && selected.has(item.family))
      throw new Error("HEIF verification failed: metadata item remains.");
  for (const e of erased)
    if (output.subarray(e.start, e.end).some((x) => x !== 0))
      throw new Error("HEIF metadata payload was not erased.");
  for (const e of retained)
    if (!equal(bytes.subarray(e.start, e.end), output.subarray(e.start, e.end)))
      throw new Error("HEIF image item changed.");
  const original = await decoded(bytes),
    cleaned = await decoded(output);
  if (original.digests.join() !== cleaned.digests.join())
    throw new Error("HEIF verification failed: decoded pixels changed.");
  const after = await inspectHeif(output);
  return {
    bytes: output,
    before,
    after,
    removedBytes: 0,
    removedContainers: removed.size,
    preservedOrientation: true,
    verification:
      "Metadata items and their stored bytes erased; all decoded image pixels match. Container size is unchanged.",
  };
}
