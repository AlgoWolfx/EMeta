export const ascii = (b: Uint8Array, start = 0, length = b.length - start) =>
  String.fromCharCode(...b.subarray(start, start + length));
export function join(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}
export function u32(b: Uint8Array, offset: number, little = false) {
  if (offset < 0 || offset + 4 > b.length)
    throw new Error("The file contains a truncated data block.");
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(
    offset,
    little,
  );
}
export function crc32(b: Uint8Array) {
  let crc = 0xffffffff;
  for (const value of b) {
    crc ^= value;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export const equal = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
export function pngChunk(type: string, payload: Uint8Array) {
  const data = new Uint8Array(payload.length + 12),
    view = new DataView(data.buffer);
  view.setUint32(0, payload.length);
  data.set(new TextEncoder().encode(type), 4);
  data.set(payload, 8);
  view.setUint32(data.length - 4, crc32(data.subarray(4, data.length - 4)));
  return data;
}
export function webpChunk(type: string, payload: Uint8Array) {
  const data = new Uint8Array(8 + payload.length + (payload.length % 2));
  data.set(new TextEncoder().encode(type));
  new DataView(data.buffer).setUint32(4, payload.length, true);
  data.set(payload, 8);
  return data;
}
// A minimal TIFF directory carries only display orientation, without private subdirectories or thumbnails.
export function orientationExif(orientation: number) {
  const b = new Uint8Array(26),
    v = new DataView(b.buffer);
  b.set([0x49, 0x49, 42, 0]);
  v.setUint32(4, 8, true);
  v.setUint16(8, 1, true);
  v.setUint16(10, 0x112, true);
  v.setUint16(12, 3, true);
  v.setUint32(14, 1, true);
  v.setUint16(18, orientation, true);
  return b;
}
export function readOrientation(raw: Uint8Array): number {
  const b = ascii(raw, 0, 6) === "Exif\0\0" ? raw.subarray(6) : raw;
  if (b.length < 8 || !["II", "MM"].includes(ascii(b, 0, 2)))
    throw new Error("The EXIF header is damaged.");
  const little = b[0] === 0x49,
    v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (v.getUint16(2, little) !== 42)
    throw new Error("This EXIF encoding cannot be safely rewritten.");
  const offset = v.getUint32(4, little);
  if (offset < 8 || offset + 2 > b.length)
    throw new Error("The EXIF directory is damaged.");
  const count = v.getUint16(offset, little);
  if (offset + 2 + count * 12 + 4 > b.length)
    throw new Error("The EXIF directory is truncated.");
  let orientation = 1,
    foundOrientation = false;
  for (let i = 0; i < count; i++) {
    const p = offset + 2 + i * 12;
    if (v.getUint16(p, little) === 0x112) {
      if (v.getUint16(p + 2, little) !== 3 || v.getUint32(p + 4, little) !== 1)
        throw new Error("The image orientation is ambiguous.");
      const value = v.getUint16(p + 8, little);
      if (value < 1 || value > 8 || (foundOrientation && orientation !== value))
        throw new Error("The image orientation is invalid.");
      orientation = value;
      foundOrientation = true;
    }
  }
  return orientation;
}
