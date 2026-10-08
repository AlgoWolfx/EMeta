# Release checks

- Run `npm ci`, `npm test`, `npm run build`, `npm run format:check`, `npm run test:e2e`.
- Inspect real camera JPEGs (orientation, color, progressive), PNG/WebP/TIFF/HEIC, multipage PDF and mixed video/unsupported batches. Preserve originals; refuse ambiguity.
- Independently inspect exported files using ExifTool or equivalent and compare appearance. Review retained ICC/JFIF/Adobe/unknown chunks; never call these metadata-free.
- Manually check Firefox/Safari, physical iOS/Android, keyboard, 200% zoom and assistive technologies. Chromium automation does not establish those platforms.
- Check all seven languages, saved/URL/browser preference, Arabic RTL and language changes with files loaded. Confirm original metadata values and download names remain intact.
- Configure VITE_SITE_URL for the final HTTPS root/subpath; verify canonical, hreflang alternates, 29-page sitemap, origin robots policy and standalone guide URLs.
- Preserve third-party notices and HEIF decoder source/replacement instructions with distributions.
- Choose HTTPS hosting, deploy `dist/`, verify paths/headers. A source-code push does not publish a website or create a release; verify the deployed result separately.
- Suggested static host policy: `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; font-src 'self' blob: data:; style-src 'self'; img-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`. Vite development needs HMR-specific allowances.
- Check no files/metadata persist, upload or trigger analytics/unexpected third-party requests.
- Preserve MIT and Yiğit Bayrak · EGORA Digital attribution. No watermarks.
