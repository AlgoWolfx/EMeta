import type { Format } from "./metadata/types";
import { verifyDecode } from "./files";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
async function pdf(bytes: Uint8Array) {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = pdfWorker;
  return lib.getDocument({
    data: bytes,
    useSystemFonts: true,
    disableFontFace: false,
    stopAtErrors: true,
    enableXfa: false,
    useWasm: false,
  }).promise;
}
export async function verifyPdf(
  blob: Blob,
  original?: Blob,
): Promise<Blob | undefined> {
  const current = await pdf(new Uint8Array(await blob.arrayBuffer())),
    source = original
      ? await pdf(new Uint8Array(await original.arrayBuffer()))
      : undefined;
  let preview: Blob | undefined;
  try {
    if (
      (source && current.numPages > 50) ||
      current.numPages < 1 ||
      (source && source.numPages !== current.numPages)
    )
      throw new Error("PDF page count exceeds verification limits or changed.");
    for (let i = 1; i <= (source ? current.numPages : 1); i++) {
      const page = await current.getPage(i),
        viewport = page.getViewport({ scale: 1 });
      if (viewport.width * viewport.height > 4_000_000)
        throw new Error(
          "PDF page is too large for complete render verification.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport,
        annotationMode: 1,
      }).promise;
      if (source) {
        const other = await source.getPage(i),
          view = other.getViewport({ scale: 1 });
        if (view.width !== viewport.width || view.height !== viewport.height)
          throw new Error("PDF page geometry changed.");
        const before = document.createElement("canvas");
        before.width = canvas.width;
        before.height = canvas.height;
        await other.render({
          canvas: before,
          canvasContext: before.getContext("2d")!,
          viewport: view,
          annotationMode: 1,
        }).promise;
        const a = before
            .getContext("2d")!
            .getImageData(0, 0, before.width, before.height).data,
          b = canvas
            .getContext("2d")!
            .getImageData(0, 0, canvas.width, canvas.height).data;
        if (a.length !== b.length || a.some((x, index) => x !== b[index]))
          throw new Error(
            `PDF verification failed: page ${i} changed. No download was created.`,
          );
      }
      if (i === 1)
        preview =
          (await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/png"),
          )) ?? undefined;
      page.cleanup();
    }
  } finally {
    await current.destroy();
    await source?.destroy();
  }
  return preview;
}
export async function verifyFile(blob: Blob, format: Format, original?: Blob) {
  if (format === "pdf") return verifyPdf(blob, original);
  if (["jpeg", "png", "webp"].includes(format)) await verifyDecode(blob);
  // HEIF is decoded in its worker. TIFF/video preserve and reopen their container and compressed payload.
  return undefined;
}
