export type Format =
  | "jpeg"
  | "png"
  | "webp"
  | "tiff"
  | "heic"
  | "pdf"
  | "mp4"
  | "mov"
  | "webm"
  | "mkv";
export type Family =
  | "exif"
  | "iptc"
  | "xmp"
  | "text"
  | "time"
  | "other"
  | "pdf-info"
  | "video-tags"
  | "container-crc";
export type Group =
  | "Document"
  | "Container"
  | "Location"
  | "Camera & device"
  | "Date & time"
  | "Creator & copyright"
  | "Software"
  | "Image"
  | "EXIF"
  | "IPTC"
  | "XMP"
  | "Text";
export interface Field {
  key: string;
  value: string;
  group: Group;
  sensitive: boolean;
}
export interface Block {
  label: string;
  family?: Family;
  bytes: Uint8Array;
  payload?: Uint8Array;
  code?: number | string;
  orientation?: number;
}
export interface Structure {
  format: Format;
  blocks: Block[];
  width?: number;
  height?: number;
  warnings: string[];
  cleanable: boolean;
}
export interface Inspection {
  pageCount?: number;
  preview?: Blob;
  format: Format;
  width?: number;
  height?: number;
  fields: Field[];
  families: Family[];
  containers: { label: string; family: Family; size: number }[];
  warnings: string[];
  cleanable: boolean;
  orientation: number;
}
export interface CleanResult {
  verification?: string;
  bytes: Uint8Array;
  before: Inspection;
  after: Inspection;
  removedBytes: number;
  removedContainers: number;
  preservedOrientation: boolean;
}
export const FAMILY_LABELS: Record<Family, string> = {
  exif: "EXIF",
  iptc: "IPTC",
  xmp: "XMP",
  text: "Embedded text",
  time: "Embedded timestamps",
  "pdf-info": "PDF document properties",
  "video-tags": "Video container tags",
  "container-crc": "Container checksums",
  other: "Other JPEG metadata",
};
export const FAMILY_DESCRIPTIONS: Record<Family, string> = {
  exif: "Location, camera, dates and thumbnails. Required rotation stays.",
  iptc: "Creator, caption, keywords and copyright.",
  xmp: "Editor history, descriptions and other XML metadata.",
  text: "Comments and embedded text records.",
  time: "Embedded creation and modification dates.",
  "pdf-info": "Title, author, subject, keywords and PDF producer information.",
  "video-tags": "Location, titles, comments, editor and encoder tags.",
  "container-crc": "Checksums removed only when editing a video container.",
  other: "Unknown application markers and trailing data.",
};
