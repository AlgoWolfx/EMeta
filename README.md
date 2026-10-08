# EMeta

**See what your files reveal before you share them.**

EMeta is a free, open-source metadata viewer and cleaner by **EGORA Digital**. Inspect embedded information, choose what to remove, and download a verified copy. Files and parsed values stay in your browser; originals are never overwritten.

Built with React, TypeScript and Vite. Runs as a static website with no backend, accounts or upload service.

## What you can do

- Inspect location, camera, date, creator, software and document fields in grouped or raw views.
- Search metadata and highlight potentially sensitive fields.
- Remove selected supported metadata families or select all safe metadata.
- Compare original and cleaned metadata, then download a verified copy.
- Process mixed batches and download individual files or a ZIP with collision-safe names.
- Preview HEIC/HEIF images and PDF pages locally.
- Use seven interface languages, Arabic RTL, keyboard controls and light/dark/system themes.

Cleaning preserves required content, orientation and rendering properties within each format's documented support. Verification must pass before a download is enabled.

## Supported formats

| Format               | Cleaning scope                                              | Preservation check                                            |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| JPEG/JPG             | EXIF, IPTC, XMP and supported application/trailing metadata | Image data and decoded appearance; required rotation retained |
| PNG/APNG             | Supported text, EXIF/XMP and embedded timestamps            | Image, animation and color chunks retained                    |
| WebP / animated WebP | EXIF/XMP                                                    | Image/animation data retained; RIFF structure repaired        |
| Classic TIFF         | Supported metadata directory entries                        | Image strips/tiles and offsets retained                       |
| HEIC/HEIF            | Supported EXIF/XMP items                                    | Removed bytes erased; all decoded images compared             |
| PDF                  | Selected document properties and XMP                        | Fresh rewrite; every page rendered and compared               |
| MP4/MOV/WebM/MKV     | Supported container tags and dates                          | Audio/video payload retained without recompression            |

Signed, encrypted or XFA PDFs, PDFs over 50 pages, encrypted/timed metadata video tracks and unsafe/unsupported structures are refused. Unknown chunks or private tags may remain. See [format support and limits](docs/FORMAT_SUPPORT.md) for exact behavior.

Metadata cleaning does not redact visible text, images, watermarks, PDF annotations or attachments. Filesystem timestamps are separate. Retained color/rendering information and required rotation may include descriptive data; this tool does not promise forensic anonymity or removal of every hidden payload.

## Run locally

Install **Node.js 22.12+** and npm; Node 24 is recommended.

```sh
git clone https://github.com/AlgoWolfx/EMeta.git
cd EMeta
npm ci
npm run dev
```

Open the local address Vite prints on the same computer (development port **5174**). `npm run build` creates `dist/`; `npm run preview` serves the production build on **4174**. No credentials or database are needed.

FFmpeg, FFprobe and Python with Pillow are required only for the independent native checks in `npm test`, not for running the website.

## Use the cleaner

1. Choose files or drop them into the workspace.
2. Inspect the metadata, warnings and preservation limits.
3. Choose the metadata families to remove and select **Clean file**.
4. Compare the original and cleaned result. Download becomes available after verification.

Limits: **30 files per batch**, **50 MB per file**, **200 MB per batch** and **40 megapixels per image**. PDFs are cleaned up to 50 pages at up to 4 MP per rendered page. A failed file has its own error and does not invalidate successful files in the batch.

Download names retain the original name plus `-clean`; rename a copy if its filename reveals private information. Clearing the list releases the session, and reloading starts empty.

## Languages

English · Deutsch · Türkçe · العربية · 日本語 · Español · Português

Change the header language without losing loaded files, metadata search, selected families or verified results. Arabic uses right-to-left layout; filenames and metadata values remain unchanged.

A supported `?lang=tr` URL takes priority over the saved preference, then the browser language and English fallback. FAQs and all four format guides are translated into the same seven languages. Detailed parser diagnostics retain their original English text beneath a localized explanation when no exact translation exists.

## Privacy

No uploads, backend, accounts, analytics, remote fonts or file history. Only theme and language preferences are saved locally. File bytes and parsed values remain in this tab. Clearing/reloading releases the session; this is not a secure-memory-erasure guarantee.

## Checks

```sh
npm test
npm run build
npm run format:check
npm run test:e2e
```

Browser tests need Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to your installed binary; the cloud default is `/usr/bin/chromium`. Alternatively, install Playwright Chromium and set that executable path.

Fixtures are synthetic files with known metadata. Checks cover selected-family removal, refusal modes, all eight JPEG orientations, actual downloaded pixels, HEIC/PDF previews, mixed TIFF/video ZIPs, cancellation, privacy, seven languages, mobile layout and automated accessibility. Independent Pillow and FFmpeg checks compare native image/video/audio output. Physical-device and Firefox/Safari checks remain release validation.

## Deploy and SEO

Publish `dist/` on static HTTPS hosting with directory-index support. Set `VITE_SITE_URL` to the exact final HTTPS address before building; assets, canonical URLs, guide links and sitemap follow it.

The build emits **28 standalone guide pages**: four format guides in seven languages. A configured deployment includes language alternates and a 29-page sitemap. Without an address, builds remain non-indexable and emit an empty sitemap. The public address is currently undecided.

See [SEO and deployment](docs/SEO.md) and [release checks](docs/RELEASE_CHECKLIST.md). Format guides work without JavaScript; local file processing requires JavaScript.

## Project and contribution

Read [PROJECT_SPEC.md](PROJECT_SPEC.md), [architecture](docs/ARCHITECTURE.md), [issue implementation map](docs/ISSUES.md) and [CONTRIBUTING.md](CONTRIBUTING.md). The established Emil Kowalski + Impeccable direction is recorded in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md). Graphify is optional development tooling; `graphify update .` refreshes the project's local AST graph.

Companion project: [EQR](https://github.com/AlgoWolfx/EQR), a QR code studio with local generation and offline support.

## License

Application source: [MIT](LICENSE). Bundled dependencies retain their licenses; see [third-party notices](public/licenses/NOTICE.md), including the separately loaded LGPL-3.0 HEIF decoder and its source/replacement materials. Keep these materials with distributions.

Built by **Yiğit Bayrak · EGORA Digital**.
