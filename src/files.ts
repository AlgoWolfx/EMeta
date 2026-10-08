export const MAX_FILES = 30;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_BYTES = 200 * 1024 * 1024;
export const formatBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / (1024 * 1024)).toFixed(1)} MB`;
export const cleanName = (name: string) =>
  name.replace(/\.[^.]+$/, "") + "-clean" + (name.match(/\.[^.]+$/)?.[0] ?? "");
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadZip(files: { name: string; blob: Blob }[]) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip(),
    names = new Set<string>();
  for (const file of files) {
    let name = file.name.replace(/[\\/\x00-\x1f]/g, "_"),
      number = 2;
    const base = name;
    while (names.has(name.toLowerCase()))
      name = base.replace(/(\.[^.]+)?$/, (_, ext = "") => `-${number++}${ext}`);
    names.add(name.toLowerCase());
    zip.file(name, await file.blob.arrayBuffer());
  }
  download(
    await zip.generateAsync({ type: "blob", compression: "STORE" }),
    "emeta-cleaned.zip",
  );
}
export async function verifyDecode(blob: Blob) {
  // Browser decoders reopen the exported copy independently of the metadata parser.
  const image = await createImageBitmap(blob);
  try {
    if (!image.width || !image.height)
      throw new Error("The exported image could not be decoded.");
  } finally {
    image.close();
  }
}
