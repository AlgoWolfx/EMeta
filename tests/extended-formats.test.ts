import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, test, expect } from "vitest";
import { inspect, clean } from "../src/metadata/engine";
import type { Family } from "../src/metadata/types";
const all: Family[] = [
  "exif",
  "iptc",
  "xmp",
  "text",
  "time",
  "other",
  "pdf-info",
  "video-tags",
];
const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const utf = (b: Uint8Array) => new TextDecoder().decode(b);
for (const name of [
  "metadata.pdf",
  "metadata.heic",
  "metadata.tiff",
  "metadata.mp4",
  "metadata-audio.mp4",
  "metadata.mov",
  "metadata.webm",
  "metadata.mkv",
]) {
  test(`${name}: real metadata is removed and output is reopened`, async () => {
    const bytes = fixture(name),
      before = await inspect(bytes);
    expect(before.cleanable).toBe(true);
    expect(before.containers.length).toBeGreaterThan(0);
    const r = await clean(bytes, all);
    expect(r.after.containers).toHaveLength(0);
    expect(r.removedContainers).toBeGreaterThan(0);
    if (name === "metadata.pdf") {
      expect(r.after.pageCount).toBe(2);
      expect(utf(r.bytes)).not.toContain("Private PDF Author");
      expect(utf(r.bytes)).not.toContain("ORPHAN_PRIVATE_HISTORY");
      expect(utf(r.bytes)).not.toContain("PRIVATE_XMP_HISTORY_LOCATION");
    } else {
      expect(r.bytes.length).toBe(bytes.length);
      writeFileSync(`/tmp/emeta-clean-${name}`, r.bytes);
    }
  }, 60000);
}
for (const ext of ["mp4", "mov", "webm", "mkv"])
  test(`${ext}: independent ffmpeg decoded video hashes remain identical`, async () => {
    const source = `tests/fixtures/metadata.${ext}`,
      r = await clean(fixture(`metadata.${ext}`), all),
      output = `/tmp/emeta-video-clean.${ext}`;
    writeFileSync(output, r.bytes);
    const hashes = (path: string) =>
      execFileSync(
        "ffmpeg",
        ["-v", "error", "-i", path, "-map", "0:v:0", "-f", "framemd5", "-"],
        { encoding: "utf8" },
      )
        .split("\n")
        .filter((x) => x && !x.startsWith("#"));
    expect(hashes(output)).toEqual(hashes(source));
    const metadata = JSON.parse(
      execFileSync(
        "ffprobe",
        ["-v", "error", "-show_format", "-show_streams", "-of", "json", output],
        { encoding: "utf8" },
      ),
    );
    expect(JSON.stringify(metadata)).not.toContain("Synthetic private title");
    expect(JSON.stringify(metadata)).not.toContain("+40.741");
  });
test("signed PDFs are inspection only", async () => {
  const r = await inspect(fixture("signed.pdf"));
  expect(r.cleanable).toBe(false);
  await expect(clean(fixture("signed.pdf"), all)).rejects.toThrow("safely");
});
test("broken PDF is refused", async () => {
  await expect(inspect(fixture("private.pdf"))).rejects.toThrow("PDF");
});
test("selected PDF properties removal keeps unselected XMP", async () => {
  const r = await clean(fixture("metadata.pdf"), ["pdf-info"]);
  expect(r.after.families).toEqual(["xmp"]);
});

test("TIFF: independent Pillow decoding preserves every pixel", async () => {
  const r = await clean(fixture("metadata.tiff"), all);
  const output = "/tmp/emeta-tiff-independent.tiff";
  writeFileSync(output, r.bytes);
  execFileSync("python", [
    "-c",
    `from PIL import Image, ImageSequence
import sys
with Image.open(sys.argv[1]) as a, Image.open(sys.argv[2]) as b:
 assert a.n_frames == b.n_frames
 for x, y in zip(ImageSequence.Iterator(a), ImageSequence.Iterator(b)):
  assert x.size == y.size and x.convert('RGBA').tobytes() == y.convert('RGBA').tobytes()
`,
    "tests/fixtures/metadata.tiff",
    output,
  ]);
});
test("MP4: audio samples and video frames survive metadata removal", async () => {
  const r = await clean(fixture("metadata-audio.mp4"), all),
    output = "/tmp/emeta-audio-clean.mp4";
  writeFileSync(output, r.bytes);
  for (const stream of ["0:a:0", "0:v:0"]) {
    const hash = (file: string) =>
      execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          file,
          "-map",
          stream,
          "-f",
          "hash",
          "-hash",
          "sha256",
          "-",
        ],
        { encoding: "utf8" },
      );
    expect(hash(output)).toBe(hash("tests/fixtures/metadata-audio.mp4"));
  }
});
test("compressed PDF XMP is bounded before complete inflation", async () => {
  const { PDFDocument, PDFName } = await import("pdf-lib");
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage();
  const metadata = doc.context.flateStream(
    new TextEncoder().encode("x".repeat(2 * 1024 * 1024)),
    { Type: "Metadata", Subtype: "XML" },
  );
  doc.catalog.set(PDFName.of("Metadata"), doc.context.register(metadata));
  await expect(inspect(await doc.save())).rejects.toThrow("inspection limit");
});
test("truncated media containers are refused without output", async () => {
  for (const name of [
    "metadata.mp4",
    "metadata.heic",
    "metadata.webm",
    "metadata.tiff",
  ]) {
    await expect(clean(fixture(name).slice(0, 60), all)).rejects.toThrow();
  }
});

test("AVIF compatible HEIF brands do not imply supported HEIC cleaning", async () => {
  const data = new Uint8Array(24);
  new DataView(data.buffer).setUint32(0, 24);
  data.set(new TextEncoder().encode("ftypavif"), 4);
  data.set(new TextEncoder().encode("mif1"), 16);
  await expect(inspect(data)).rejects.toThrow("AVIF");
});
