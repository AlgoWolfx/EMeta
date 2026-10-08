export const FAQ = [
  {
    q: "What is file metadata?",
    a: "Metadata describes a file: a photo may include GPS coordinates, camera details and dates; a PDF can store its author and editor; a video can carry location and title tags.",
  },
  {
    q: "Does EMeta upload my files?",
    a: "No. Inspection, cleaning and verification run locally in your browser. EMeta has no upload endpoint, account, analytics or file history. Only your theme and language preferences are stored.",
  },
  {
    q: "Can I remove GPS location from HEIC photos?",
    a: "EMeta removes supported EXIF and XMP items from HEIC/HEIF, erases their stored bytes and compares decoded images. Color and container rotation stay intact. Ambiguous or damaged files are refused.",
  },
  {
    q: "What does PDF metadata removal change?",
    a: "EMeta removes selected document properties and XMP, copies retained document objects into a fresh PDF and compares every page render before enabling download. Visible text, annotations and attachments stay; this is not PDF redaction.",
  },
  {
    q: "Does cleaning a video reduce its quality?",
    a: "Supported MP4, MOV, WebM and MKV cleaning erases container tags and dates while preserving the compressed video and audio bytes. It does not re-encode media. Encrypted and timed metadata tracks are not cleaned.",
  },
  {
    q: "Why can a cleaned file stay the same size?",
    a: "HEIC, TIFF and video can store data at absolute offsets. EMeta erases private payload bytes and rebuilds or clears metadata records without moving retained content. Same file size does not mean the selected metadata is still present.",
  },
  {
    q: "Does metadata removal make a file anonymous?",
    a: "No. Visible information, filenames, filesystem dates, unknown private tags and information inside attachments may still identify someone. EMeta verifies selected supported metadata removal, not anonymity.",
  },
];
export const GUIDES = [
  {
    slug: "heic",
    title: "Remove HEIC and HEIF metadata",
    description:
      "Inspect and remove EXIF, GPS and XMP from HEIC/HEIF locally, preserving image items and checking decoded pixels.",
    formats: "HEIC / HEIF",
    body: "HEIC photos can carry EXIF location, camera and date records alongside XMP. EMeta identifies those metadata items, erases their extents and removes their container references. Retained images, color and display properties stay in place; all decoded images are compared before output is offered.",
    limits:
      "Unsupported item tables, external offsets, overlapping metadata/image ranges and ambiguous orientation are refused. Container rotation is retained. This does not remove information visible in the photograph.",
  },
  {
    slug: "pdf",
    title: "Remove PDF metadata locally",
    description:
      "Clean PDF author, title, dates, producer and XMP with a fresh rewrite and page render verification in your browser.",
    formats: "PDF",
    body: "PDF document properties can include author, title, subject, keywords, creation dates and editor software. XMP can repeat those details. EMeta rewrites reachable document objects into a fresh context so old revisions and orphaned metadata are not copied, then checks every page render before download.",
    limits:
      "Signed, encrypted, XFA, damaged PDFs and documents over 50 pages are not cleaned. Page content, forms, annotations and attachments remain; removing metadata is not redacting visible content.",
  },
  {
    slug: "video",
    title: "Remove video metadata without re-encoding",
    description:
      "Erase supported MP4, MOV, WebM and MKV location, title, editor and date tags while preserving original audio/video payloads.",
    formats: "MP4 / MOV / WebM / MKV",
    body: "Video container tags can expose where a clip was recorded, its title, editor and dates. EMeta erases supported container records and timestamps in place. Audio/video samples, playback timing, track geometry and rotation remain unchanged; no recompression or server upload is needed.",
    limits:
      "Timed metadata tracks and encrypted tracks are refused. Subtitles, attachments, visible content and unknown private boxes may retain identifying information. Playback still depends on your device’s codec support.",
  },
  {
    slug: "images",
    title: "Remove image EXIF and GPS metadata",
    description:
      "Inspect and clean JPEG, PNG, WebP and classic TIFF metadata locally, preserving image quality and required rotation.",
    formats: "JPEG / PNG / WebP / TIFF",
    body: "Use EMeta to review GPS coordinates, camera information, author fields, dates and editor records. Select EXIF, IPTC, XMP or embedded text, clean the file and compare original and cleaned metadata. JPEG/PNG/WebP payloads are preserved, and classic TIFF directory cleaning retains image strips and tiles.",
    limits:
      "Required EXIF orientation and color/rendering properties may remain. Unknown private tags/chunks are disclosed and retained. BigTIFF, corrupt data or metadata overlapping image content are not cleaned.",
  },
];
export const ROOT_TITLE =
  "EMeta — Remove File Metadata Locally | HEIC, PDF & Video";
export const ROOT_DESCRIPTION =
  "Inspect and remove EXIF, GPS, PDF properties and video tags locally. Free open-source metadata cleaner for images, HEIC/HEIF, PDF, MP4, MOV, WebM and MKV.";
