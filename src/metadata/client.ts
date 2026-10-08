import type { CleanResult, Family, Inspection } from "./types";
let nextId = 0;
let worker: Worker | undefined;
let generation = 0;
const pending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.error) job.reject(new Error(e.data.error));
      else job.resolve(e.data.result);
    };
    worker.onerror = () =>
      cancelProcessing(
        "The file processor stopped. Please select your files again.",
      );
  }
  return worker;
}
export function cancelProcessing(message = "Processing cancelled.") {
  generation++;
  worker?.terminate();
  worker = undefined;
  for (const job of pending.values()) job.reject(new Error(message));
  pending.clear();
}
export function processFile(
  file: Blob,
  operation: "inspect",
): Promise<Inspection>;
export function processFile(
  file: Blob,
  operation: "clean",
  families: Family[],
): Promise<CleanResult>;
export async function processFile(
  file: Blob,
  operation: "inspect" | "clean",
  families?: Family[],
): Promise<unknown> {
  const started = generation;
  const buffer = await file.arrayBuffer(),
    id = ++nextId;
  if (started !== generation) throw new Error("Processing cancelled.");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, operation, buffer, families }, [buffer]);
  });
}
