import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { clean } from "../src/metadata/clean";
import { inspect } from "../src/metadata/inspect";
import { parseStructure } from "../src/metadata/structure";
import {
  ascii,
  join,
  pngChunk,
  webpChunk,
  readOrientation,
  orientationExif,
} from "../src/metadata/binary";
import type { Family } from "../src/metadata/types";
const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const all: Family[] = ["exif", "iptc", "xmp", "text", "time", "other"];
const imageChunks = (b: Uint8Array) =>
  parseStructure(b)
    .blocks.filter(
      (x) =>
        x.label === "Image scan" ||
        [
          "IDAT",
          "fdAT",
          "ANMF",
          "VP8 ",
          "VP8L",
          "ICCP",
          "iCCP",
          "Color profile",
        ].includes(String(x.code)) ||
        x.label === "Color profile",
    )
    .map((x) => x.bytes);

describe("Real metadata inspection", () => {
  test.each([
    "orientation-1.jpg",
    "metadata.png",
    "metadata.webp",
    "metadata.tiff",
  ])("%s exposes known GPS, camera, creator and software", async (name) => {
    const r = await inspect(fixture(name));
    expect(
      r.fields.some(
        (f) => f.group === "Location" && f.sensitive && /40|74/.test(f.value),
      ),
    ).toBe(true);
    expect(r.fields.some((f) => f.value === "Fixture Camera")).toBe(true);
    expect(r.fields.some((f) => f.value === "Fixture Editor")).toBe(true);
    expect(r.fields.some((f) => f.value.includes("Test Creator"))).toBe(true);
    expect(r.cleanable).toBe(name !== "metadata.tiff");
  });
  test("JPEG also displays actual IPTC and XMP", async () => {
    const r = await inspect(fixture("orientation-1.jpg"));
    expect(r.families).toEqual(
      expect.arrayContaining(["exif", "iptc", "xmp", "text"]),
    );
    expect(r.fields.some((f) => f.value.includes("Test Photographer"))).toBe(
      true,
    );
    expect(r.fields.some((f) => f.value.includes("Synthetic Editor"))).toBe(
      true,
    );
  });
  test("PNG compressed and international text are decoded", async () => {
    const r = await inspect(fixture("metadata.png"));
    expect(r.fields.some((f) => f.value === "Compressed private comment")).toBe(
      true,
    );
    expect(r.fields.some((f) => f.value.includes("Synthetic Editor"))).toBe(
      true,
    );
    expect(r.families).toContain("time");
  });
});
describe("Verified lossless cleaning", () => {
  test.each([
    "orientation-1.jpg",
    "metadata.png",
    "metadata.webp",
    "animated.png",
    "animated.webp",
  ])(
    "%s removes selected containers and preserves pixels, animation and profiles",
    async (name) => {
      const bytes = fixture(name),
        r = await clean(bytes, all);
      expect(r.after.containers).toHaveLength(0);
      expect(r.after.fields.some((f) => f.group === "Location")).toBe(false);
      expect(r.after.fields.some((f) => f.value.includes("Test Creator"))).toBe(
        false,
      );
      expect(imageChunks(r.bytes)).toEqual(imageChunks(bytes));
      expect(r.removedBytes).toBeGreaterThan(0);
    },
  );
  test.each([2, 3, 4, 5, 6, 7, 8])(
    "orientation %i is retained in a minimal, private-data-free EXIF record",
    async (n) => {
      const r = await clean(fixture(`orientation-${n}.jpg`), all);
      expect(r.after.orientation).toBe(n);
      expect(r.after.containers).toHaveLength(1);
      expect(r.after.containers[0].size).toBe(36);
      expect(r.after.fields.filter((f) => f.group !== "Image")).toHaveLength(0);
      expect(r.preservedOrientation).toBe(true);
    },
  );
  test("rotated WebP retains its orientation flag and minimal EXIF", async () => {
    const r = await clean(fixture("rotated.webp"), all);
    expect(r.after.orientation).toBe(6);
    expect(
      parseStructure(r.bytes).blocks.find((b) => b.code === "VP8X")!
        .payload![0] & 8,
    ).toBe(8);
  });
  test("selected-family cleaning preserves unselected metadata byte-for-byte", async () => {
    const b = fixture("orientation-1.jpg"),
      r = await clean(b, ["text"]);
    const before = parseStructure(b)
      .blocks.filter((x) => x.family && x.family !== "text")
      .map((x) => x.bytes);
    const after = parseStructure(r.bytes)
      .blocks.filter((x) => x.family)
      .map((x) => x.bytes);
    expect(after).toEqual(before);
    expect(r.after.families).not.toContain("text");
    expect(r.after.fields.some((f) => f.group === "Location")).toBe(true);
  });
  test("recleaning an already sanitized image is idempotent", async () => {
    const first = await clean(fixture("metadata.png"), all),
      second = await clean(first.bytes, all);
    expect(second.bytes).toEqual(first.bytes);
    expect(second.removedContainers).toBe(0);
  });
});
describe("Refusal and honest limitations", () => {
  test.each(["private.pdf", "broken.jpg"])("%s is refused", async (name) => {
    await expect(inspect(fixture(name))).rejects.toThrow();
  });
  test("empty file is refused", async () => {
    await expect(inspect(new Uint8Array())).rejects.toThrow("Unsupported");
  });
  test("TIFF is inspection only", async () => {
    await expect(clean(fixture("metadata.tiff"), all)).rejects.toThrow(
      "inspection only",
    );
  });
  test("corrupt PNG checksums are refused", async () => {
    const b = fixture("metadata.png");
    b[60] ^= 1;
    await expect(inspect(b)).rejects.toThrow("checksum");
  });
  test("truncated WebP and JPEG are refused", async () => {
    await expect(
      inspect(fixture("metadata.webp").subarray(0, 100)),
    ).rejects.toThrow();
    await expect(
      inspect(fixture("plain.jpg").subarray(0, 400)),
    ).rejects.toThrow();
  });
  test("malformed EXIF disables cleaning instead of silently dropping rotation", async () => {
    const b = fixture("plain.jpg"),
      broken = new Uint8Array([255, 225, 0, 10, 69, 120, 105, 102, 0, 0, 0, 0]);
    const bytes = join([b.slice(0, 2), broken, b.slice(2)]),
      r = await inspect(bytes);
    expect(r.cleanable).toBe(false);
    await expect(clean(bytes, all)).rejects.toThrow("inspection only");
  });
  test("unknown PNG chunks are preserved and disclosed", async () => {
    const b = fixture("metadata.png"),
      chunk = pngChunk(
        "prIv",
        new TextEncoder().encode("unknown private data"),
      );
    const source = join([b.slice(0, -12), chunk, b.slice(-12)]),
      r = await clean(source, all);
    expect(r.after.warnings.join(" ")).toContain("prIv");
    expect(parseStructure(r.bytes).blocks.some((x) => x.code === "prIv")).toBe(
      true,
    );
  });
  test("unknown WebP chunks are preserved and disclosed", async () => {
    const b = fixture("metadata.webp"),
      source = join([b, webpChunk("TEST", new Uint8Array([1, 2]))]);
    new DataView(source.buffer).setUint32(4, source.length - 8, true);
    const r = await clean(source, all);
    expect(r.after.warnings.join(" ")).toContain("TEST");
    expect(ascii(r.bytes).includes("TEST")).toBe(true);
  });
  test("no selection is not a clean operation", async () => {
    await expect(clean(fixture("plain.jpg"), [])).rejects.toThrow("Choose");
  });
  test("metadata after progressive JPEG scans is removed too", async () => {
    const b = fixture("orientation-1.jpg"),
      comment = new TextEncoder().encode("Late private comment");
    const marker = join([
      new Uint8Array([255, 254, 0, comment.length + 2]),
      comment,
    ]);
    const source = join([b.slice(0, -2), marker, b.slice(-2)]),
      r = await clean(source, all);
    expect(r.after.families).not.toContain("text");
    expect(ascii(r.bytes).includes("Late private")).toBe(false);
  });
  test("conflicting duplicate EXIF orientation tags are refused", () => {
    const first = orientationExif(1),
      b = new Uint8Array(38);
    b.set(first.slice(0, 22));
    b.set(first.slice(10, 22), 22);
    const v = new DataView(b.buffer);
    v.setUint16(8, 2, true);
    v.setUint16(30, 6, true);
    expect(() => readOrientation(b)).toThrow("orientation");
  });
  test("XMP-only display orientation prevents unsafe cleaning", async () => {
    const xml =
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:tiff="http://ns.adobe.com/tiff/1.0/" tiff:Orientation="6"/></rdf:RDF></x:xmpmeta>';
    const p = join([
      new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0"),
      new TextEncoder().encode(xml),
    ]);
    const source = fixture("plain.jpg"),
      marker = join([
        new Uint8Array([255, 225, (p.length + 2) >> 8, (p.length + 2) & 255]),
        p,
      ]);
    const bytes = join([source.slice(0, 2), marker, source.slice(2)]);
    expect((await inspect(bytes)).cleanable).toBe(false);
    await expect(clean(bytes, all)).rejects.toThrow("inspection only");
  });
});
