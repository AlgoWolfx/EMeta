# HEIF decoder source and replacement

The loaded libheif-js decoder is LGPL-3.0; source and build scripts remain available with their original licenses. The exact upstream sources used by npm's 1.19.8 package are:

- Wrapper and ES-module bundler: libheif-js tag 1.19.8, commit `fe8e9c29440b839910be9dc32e8d2b826c8217ca`.
- Emscripten build distribution: libheif-emscripten tag v1.19.8, commit `a6c4a1b450f1dab0d68887a57b5ac3d69e618436`.
- Its libheif submodule: commit `5e9deb19fe6b3768af0bb8e9e5e8438b15171bf3`, https://github.com/strukturag/libheif/tree/5e9deb19fe6b3768af0bb8e9e5e8438b15171bf3.
- libde265 1.0.15: https://github.com/strukturag/libde265/tree/v1.0.15, commit `17bb8d9fcea62db8cdeb0fc7ef8d15dbd19a22e4`. This release enables libde265; AV1/AOM is disabled.
- Decoder dependency defaults and Emscripten commands are in libheif's `build-emscripten.sh`; the distributor's `.github/workflows/` records the actual release build flags. Follow those checked-in scripts to build a modified decoder.

[The source archive](heif-decoder-sources.tar.gz) alongside this file includes the pinned wrapper, build distribution, libheif and libde265 sources with build scripts and licenses. Source provenance and pins are preserved in this document. These upstream files are not EMeta application code.

To replace the separately loaded library, build a compatible ES module following the upstream scripts; replace `node_modules/libheif-js/libheif-wasm/libheif-bundle.mjs`, then run `npm run build` from EMeta's complete MIT-licensed application source. `src/metadata/adapters/heif.ts` imports this module dynamically and calls the public decoder interface. The application does not prohibit modification, replacement or reverse engineering for debugging library modifications. Preserve the LGPL and upstream notices with redistributed builds.

Rebuilding the upstream decoder is not needed to run EMeta or its normal development checks. Node/npm installation uses the integrity-checked package-lock.json artifact; EMeta does not disable checksum or TLS validation.
