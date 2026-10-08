import { clean } from "./engine";
import { inspect } from "./engine";
import type { Family } from "./types";
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    operation: "inspect" | "clean";
    buffer: ArrayBuffer;
    families?: Family[];
  }>,
) => {
  const { id, operation, buffer, families = [] } = event.data;
  try {
    const result =
      operation === "clean"
        ? await clean(new Uint8Array(buffer), families)
        : await inspect(new Uint8Array(buffer));
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error
          ? error.message
          : "The file could not be processed.",
    });
  }
};
