import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFObjectCopier,
  PDFRef,
  PDFStream,
  PDFString,
  PDFHexString,
  PDFRawStream,
} from "pdf-lib";
import type { CleanResult, Family, Field, Inspection } from "../types";
import { makeField } from "./shared";
const key = (s: string) => PDFName.of(s);
async function load(bytes: Uint8Array) {
  try {
    const doc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
    if (!(doc.catalog instanceof PDFDict))
      throw new Error("Missing PDF catalog");
    doc.getPageCount();
    return doc;
  } catch {
    throw new Error(
      "This PDF is encrypted, damaged or unsupported. Use an unencrypted valid PDF.",
    );
  }
}
function dictionaries(doc: PDFDocument): PDFDict[] {
  const found: PDFDict[] = [],
    seen = new Set<object>();
  function walk(v: unknown, depth = 0) {
    if (!v || typeof v !== "object" || seen.has(v) || depth > 100) return;
    seen.add(v);
    if (v instanceof PDFStream) walk(v.dict, depth + 1);
    else if (v instanceof PDFDict) {
      found.push(v);
      for (const [, value] of v.entries())
        if (!(value instanceof PDFRef)) walk(value, depth + 1);
    } else if ("asArray" in v && typeof v.asArray === "function")
      for (const item of v.asArray()) walk(item, depth + 1);
  }
  for (const [, obj] of doc.context.enumerateIndirectObjects()) walk(obj);
  return found;
}
function scope(doc: PDFDocument) {
  const dicts = dictionaries(doc);
  const signed = dicts.some(
    (d) => d.get(key("FT"))?.toString() === "/Sig" || d.has(key("ByteRange")),
  );
  const unsafeForm = Boolean(
    doc.catalog.get(key("AcroForm")) &&
    doc.context.lookup(doc.catalog.get(key("AcroForm"))) instanceof PDFDict &&
    (doc.context.lookup(doc.catalog.get(key("AcroForm"))) as PDFDict).has(
      key("XFA"),
    ),
  );
  return { dicts, signed, unsafeForm };
}
async function xmpText(stream: PDFRawStream): Promise<string> {
  const limit = 1024 * 1024;
  if (stream.getContentsSize() > limit)
    throw new Error("PDF metadata is too large to inspect safely.");
  const filter = stream.dict.get(key("Filter"));
  if (!filter) return new TextDecoder().decode(stream.getContents());
  if (filter.toString() !== "/FlateDecode")
    return "Compressed XMP metadata (XML preview unavailable for this filter).";
  const reader = new Blob([new Uint8Array(stream.getContents())])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit)
        throw new Error("PDF metadata exceeds the inspection limit.");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(data);
}
export async function inspectPdf(bytes: Uint8Array): Promise<Inspection> {
  const doc = await load(bytes),
    { dicts, signed, unsafeForm } = scope(doc),
    fields: Field[] = [makeField("Pages", doc.getPageCount(), "Document")];
  const containers: Inspection["containers"] = [];
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  if (info instanceof PDFDict && info.entries().length) {
    containers.push({
      label: "PDF document properties",
      family: "pdf-info",
      size: info.toString().length,
    });
    for (const [name, value] of info.entries()) {
      const v = doc.context.lookup(value);
      fields.push(
        makeField(
          name.decodeText(),
          v instanceof PDFString || v instanceof PDFHexString
            ? v.decodeText()
            : (v?.toString() ?? ""),
          "Document",
        ),
      );
    }
  }
  const streams = new Set<object>();
  for (const d of dicts) {
    const ref = d.get(key("Metadata"));
    if (!ref) continue;
    const s = doc.context.lookup(ref);
    if (!s || streams.has(s)) continue;
    streams.add(s);
    let text = "XMP metadata stream";
    if (s instanceof PDFRawStream) text = await xmpText(s);
    fields.push(makeField("XMP XML", text, "XMP"));
    containers.push({
      label: "PDF XMP stream",
      family: "xmp",
      size: s instanceof PDFStream ? s.getContentsSize() : 0,
    });
  }
  const warnings = [
    "PDF metadata cleaning preserves page content, forms, annotations and attachments. It does not redact visible text or remove private information inside attachments.",
  ];
  if (signed)
    warnings.push(
      "Signed PDF: cleaning is disabled because rewriting would invalidate the signature.",
    );
  if (unsafeForm)
    warnings.push("XFA PDF: this form encoding cannot be safely rewritten.");
  const count = doc.getPageCount();
  if (count > 50)
    warnings.push(
      "PDFs over 50 pages are inspection only to keep complete render verification bounded.",
    );
  return {
    format: "pdf",
    fields,
    families: [...new Set(containers.map((c) => c.family))],
    containers,
    warnings,
    cleanable: !signed && !unsafeForm && count > 0 && count <= 50,
    orientation: 1,
    pageCount: count,
  };
}
export async function cleanPdf(
  bytes: Uint8Array,
  families: Family[],
): Promise<CleanResult> {
  const before = await inspectPdf(bytes);
  if (!before.cleanable)
    throw new Error("This PDF cannot be safely rewritten. Review its warning.");
  const doc = await load(bytes),
    selected = new Set(families);
  if (selected.has("xmp"))
    for (const d of dictionaries(doc)) d.delete(key("Metadata"));
  // Copy only reachable objects into a fresh context: old revisions and orphaned Info/XMP streams are not serialized.
  const target = await PDFDocument.create({ updateMetadata: false }),
    copier = PDFObjectCopier.for(doc.context, target.context);
  target.context.trailerInfo.Root = target.context.register(
    copier.copy(doc.catalog),
  );
  if (!selected.has("pdf-info") && doc.context.trailerInfo.Info)
    target.context.trailerInfo.Info = target.context.register(
      copier.copy(doc.context.lookup(doc.context.trailerInfo.Info)!),
    );
  const output = await target.save({
      useObjectStreams: false,
      addDefaultPage: false,
      updateFieldAppearances: false,
    }),
    after = await inspectPdf(output);
  for (const family of families)
    if (after.families.includes(family))
      throw new Error("PDF verification failed: selected metadata remains.");
  if (after.pageCount !== before.pageCount)
    throw new Error("PDF verification failed: the page count changed.");
  return {
    bytes: output,
    before,
    after,
    removedBytes: bytes.length - output.length,
    removedContainers: before.containers.filter((c) => selected.has(c.family))
      .length,
    preservedOrientation: false,
    verification:
      "Selected metadata removed; every page must pass render comparison before download.",
  };
}
