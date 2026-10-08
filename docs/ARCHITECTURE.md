# Architecture

React + TypeScript + Vite, with metadata parsing/rewriting in a module worker. PDF.js rendering runs through its own local worker and main-thread canvases; file session orchestration and downloads run on the main thread. No upload or remote metadata service.

```text
Picker/drop → bounded session → signature/container inspection in worker
→ browser decode → grouped/raw view → selected-family rewrite in worker
→ reparse + removal/orientation/image-data verification → browser reopens copy
→ individual download / local ZIP
```

## Boundaries

- `src/metadata/types.ts`: shared formats, families, field/result contracts.
- `binary.ts`: bounded reads, CRC32, chunk construction and minimal orientation-only TIFF.
- `structure.ts`: JPEG marker streams (including progressive scans), PNG chunks, WebP RIFF and legacy image signatures. Signatures determine format.
- `inspect.ts`: exifr EXIF/IPTC/XMP adapters, bounded PNG text inflation, grouped values/exposure warnings. User URLs are never parser inputs.
- `clean.ts`: whole-family removal; orientation retention; WebP size/flag updates; independent reparse and removal/image-byte checks.
- `engine.ts`: byte-signature routing and lazy loading of `adapters/` for classic TIFF, HEIF item tables, fresh PDF rewriting and MP4/MOV/EBML containers.
- `verification.ts`: lazy PDF.js, first-page preview and every-page original/output pixel comparison before PDF export; image browser decode. HEIF is decoded and compared inside its worker.
- `seo/`: shared visible FAQ/format content and build-generated crawlable HTML, URL configuration, schema, robots and sitemap.
- `i18n/`: seven shared translation catalogs, preference selection, parameter interpolation and React language context. URL selection overrides the optional saved preference, then the browser language and English fallback. Status messages retain keys/parameters so language changes update in-flight progress without restarting workers. File names and metadata values are never translated; raw data stays isolated from RTL layout. Localized summaries preserve untranslated technical diagnostics in explicitly marked English details.
- `worker.ts` / `client.ts`: transferable input, async transport and worker termination. Generation guards prevent obsolete file reads from starting after cancellation.
- `files.ts`: limits, browser decode verification, URL cleanup and ZIP collision handling. JSZip loads on demand.
- `components/`: drop area, preview URL lifecycle, metadata presentation.
- `App.tsx`: session, queue, original/output comparison, progress, theme and working layout.

Batch files process sequentially to bound memory. Errors are isolated. Results enter state only after verification, so unverified output is not downloadable. Originals are never overwritten; changing cleaning rules always starts from the original. Cancellation retains completed results and marks queued inspection cancelled. Clear and reselect to retry. Preview URLs are revoked on change/unmount; download URLs are revoked after download begins.

## Verification

Fixtures contain known GPS/camera/creator/software, actual IPTC/XMP and compressed PNG text. Unit tests cover all orientations, family selection, idempotence, animation/color/image bytes, progressive/trailing metadata, corrupt structure and refusal modes. Browser tests compare decoded RGBA of actual downloads with originals for all eight rotations, PNG and WebP; exercise ZIPs/collisions/errors, drag/drop/cancel/limits, privacy and 320px light/dark accessibility. Extended tests cover HEIC/PDF actual previews/downloads, TIFF/video mixed ZIPs, signed/corrupt refusal, bounded PDF XMP inflation and no-JavaScript guide pages. Independent native checks reopen TIFF with Pillow and compare FFmpeg video frames/audio hashes.

Animation payloads are byte-identical; every frame has not been independently rendered in browser tests. Chromium is the automated baseline; Firefox/Safari, large real camera collections and physical mobile devices remain release checks.
