# Third-party notices

EMeta application source is MIT licensed (LICENSE). Third-party libraries retain their own copyrights and licenses; those terms are not replaced by the application's MIT license.

- **libheif-js 1.19.8**, Copyright Kiril Vatev and upstream contributors, LGPL-3.0. [Library license](libheif-js-LGPL-3.0.txt), [upstream compiled library notices](libheif-LICENSE.txt). EMeta uses the unmodified prebuilt decoder in a separately loaded JavaScript/WASM module; no encoder or conversion is used. Upstream wrapper source: https://github.com/catdad-experiments/libheif-js/tree/1.19.8 (commit fe8e9c29440b839910be9dc32e8d2b826c8217ca). Emscripten build source/scripts: https://github.com/catdad-experiments/libheif-emscripten/tree/v1.19.8 (commit a6c4a1b450f1dab0d68887a57b5ac3d69e618436), with its pinned libheif submodule and decoder dependencies. See SOURCES.md for source/replacement instructions. Debugging modifications to this library is permitted under its license.
- **pdf-lib 1.17.1**, Copyright Andrew Dillon, MIT. [License](pdf-lib-MIT.txt). Source: https://github.com/Hopding/pdf-lib/tree/v1.17.1.
- **PDF.js / pdfjs-dist 5.7.284**, Copyright Mozilla Foundation and contributors, Apache-2.0. [License](pdfjs-Apache-2.0.txt). Source: https://github.com/mozilla/pdf.js/tree/v5.7.284.

These notices and license texts are copied to `dist/licenses/` by Vite and included with the review archive. Existing React, exifr, JSZip, Lucide and development dependencies retain the notices distributed in their npm packages and bundled code. Versions and integrity checks are recorded in package-lock.json. Keep third-party notices when redistributing the application.
