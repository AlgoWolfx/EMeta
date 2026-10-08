# Contributing

Use Node 22.12+ and `npm ci`. Run `npm run dev`, then `npm test`, `npm run build`, `npm run test:e2e` for pipeline changes. Prettier: `npm run format` / `npm run format:check`.

Keep parsers/writers behind metadata contracts. Detect signatures, preserve originals and isolate errors. New cleaning adapters need known-field fixtures, preserved payload or explicit transformation warnings, reopened-output removal checks and independent browser/codec verification before download is enabled.

No uploads, telemetry, external fonts or runtime third-party network requests. Document retained/unsupported data in UI and FORMAT_SUPPORT.md; disappearing displayed fields alone do not prove removal.

Follow documented Emil Kowalski + Impeccable utility direction. Check keyboard, mobile, both themes, long filenames, raw fields and empty/loading/error states. Screenshots use synthetic fixtures.

Update docs/ISSUES.md when capabilities change. Graphify outputs and browser reports are ignored local artifacts; run `graphify update .` after source changes.
