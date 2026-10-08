import { ascii, u32 } from "../binary";
export interface Box {
  type: string;
  start: number;
  data: number;
  end: number;
  header: number;
}
export function integer(b: Uint8Array, p: number, n: number): number {
  if (n < 0 || n > 8 || p < 0 || p + n > b.length)
    throw new Error("The container has an invalid integer field.");
  let value = 0;
  for (let i = 0; i < n; i++) value = value * 256 + b[p + i];
  if (!Number.isSafeInteger(value))
    throw new Error("The container uses offsets outside the supported range.");
  return value;
}
export function boxes(b: Uint8Array, start = 0, end = b.length): Box[] {
  const out: Box[] = [];
  let p = start;
  while (p < end) {
    if (p + 8 > end) throw new Error("The media box table is truncated.");
    let size = u32(b, p),
      header = 8;
    const type = ascii(b, p + 4, 4);
    if (size === 1) {
      size = integer(b, p + 8, 8);
      header = 16;
    } else if (size === 0) size = end - p;
    if (size < header || p + size > end)
      throw new Error(`The ${type} box has an invalid length.`);
    out.push({ type, start: p, data: p + header, end: p + size, header });
    p += size;
    if (out.length > 50000)
      throw new Error("The container has too many boxes.");
  }
  return out;
}
export function boxBytes(type: string, payload: Uint8Array) {
  const out = new Uint8Array(payload.length + 8);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(payload, 8);
  return out;
}
export function freeBox(box: Box) {
  const out = new Uint8Array(box.end - box.start);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(new TextEncoder().encode("free"), 4);
  return out;
}
export function cstring(b: Uint8Array, start: number, end: number) {
  let p = start;
  while (p < end && b[p] !== 0) p++;
  if (p === end) throw new Error("The item string is not terminated.");
  return { text: new TextDecoder().decode(b.subarray(start, p)), next: p + 1 };
}
