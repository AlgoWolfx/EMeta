# EMeta — Project Specification

## Goal

Build a simple privacy utility that lets users inspect and sanitize metadata in common files without sending the file to a server whenever local processing is technically possible.

## Initial file support

Prioritize:
- JPEG/JPG
- PNG
- WebP
- TIFF

Then evaluate:
- HEIC/HEIF
- PDF
- common video formats

Do not pretend a format is supported if metadata removal cannot be validated safely.

## Metadata categories

Show human-readable groups such as:
- GPS/location
- camera/device
- date/time
- author/creator
- software/editor
- copyright
- image dimensions
- orientation
- EXIF
- IPTC
- XMP

Highlight privacy-sensitive values such as GPS coordinates.

## Core flows

### Inspect
Drop/select files → parse metadata → display grouped results.

### Clean
Select metadata categories or "Remove all safe metadata" → process locally → export sanitized file.

### Batch
Process multiple files with consistent rules.

## UX requirements

- drag and drop
- instant understandable summary
- raw metadata view for technical users
- clear warning before destructive transformations
- before/after metadata comparison
- clean, dense utility UI
- no fake security claims

## Privacy requirements

Prefer local processing.

If a format ever requires a backend, the UI and documentation must explicitly disclose that before upload. Core v1 should avoid backend processing.

## Engineering requirements

- isolate metadata parsers behind adapters
- preserve file visual quality where possible
- avoid recompression when metadata can be removed without it
- test output files after sanitization
- preserve unrelated file data safely
- add unit tests using fixtures with known EXIF/GPS fields
- handle malformed metadata without crashing

## Quality bar

A cleaned file must be reopened and verified that selected metadata is actually gone.

Do not merely hide metadata in the UI.

## Delivery order

1. Establish project architecture/design system.
2. Add drag/drop.
3. Implement JPEG metadata inspection.
4. Implement metadata cleaning.
5. Add PNG/WebP support.
6. Add batch flow.
7. Add comparison UI.
8. Add tests/fixtures.
9. Evaluate HEIC/PDF/video support.
10. Final privacy and accessibility review.

## Brand

Built by Yiğit Bayrak · EGORA Digital

Never add watermarks to user files.
