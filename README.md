# Upscaleer — Tauri v2 + Rust (Windows) + GitHub Pages

**Desktop framework: exclusively Tauri v2 + Rust + Microsoft Edge WebView2. No Electron.**
The AI/UX code comes from [schmarante/upscalr](https://github.com/schmarante/upscalr) (develop branch), using Astro + ONNX Runtime Web on the local GPU (WebGPU) or CPU (WASM). The About dialog is removed; English/Deutsch remains available and the app uses your icon.

## Windows prerequisites

1. Windows 10/11 64-bit with current Microsoft Edge WebView2 Runtime (commonly already installed).
2. [Node.js](https://nodejs.org/) 22.14+ and npm.
3. [Git for Windows](https://git-scm.com/download/win).
4. [Rust](https://rustup.rs/) stable **1.90+**, default **MSVC toolchain**: `rustup default stable-x86_64-pc-windows-msvc` and `rustup update stable`.
5. [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with **Desktop development with C++** workload + Windows SDK.
6. Internet during initial source, npm, Rust crates and AI model setup; free disk space for large models and the Rust build.

## Run

* `install.bat`: clone original repo if absent, patch UI, install upstream npm dependencies and only `@tauri-apps/cli` at the wrapper root, fetch/verify the exact matching ONNX model release, or automatically convert the original checkpoints if that release has not yet been published. Existing valid models and cached checkpoints are reused. It recognizes an old Electron installation and clears only legacy **root** `node_modules`, without touching `upstream/` and AI model files.
* `dev.bat`: launch Tauri v2 + Astro hot-reload (`http://127.0.0.1:4321` inside a native WebView2 window). Rust code compiles on first run.
* `build.bat`: compile Astro to `renderer/`, compile Rust and create a NSIS installer. Results: `src-tauri/target/release/upscaleer.exe` and `src-tauri/target/release/bundle/nsis/`. The executable includes the web frontend and ONNX assets, so it may be large.
* `build-web.bat`: create static site in `upstream/dist` with `/Upscaleer/` base path.
* `publish-github.bat`: publish wrapper to `AndyLeAI/Upscaleer`. GitHub Actions deploys web UI automatically; see `README-GITHUB-PAGES.md`.

## Migrating from previous Electron ZIP

Extract the **entire new Tauri v2 ZIP over the old Upscaleer directory** (the folder containing `install.bat`), choosing **Replace** when asked. Close old terminals/desktop windows and execute `install.bat`. The setup will remove the obsolete `electron/`, old `scripts/build-windows.cjs`, and stale Electron **root** `node_modules`, then install Tauri CLI. **Do not delete `upstream/`**: your source and previously downloaded ONNX models are reused.

If Windows reports `EPERM`, close the previous desktop app and any terminal using the `node_modules` folder; manually remove only the **root** `node_modules` folder and rerun `install.bat`. Do not remove `upstream/node_modules` or `upstream/public/models` for this error.

## Missing ONNX release (exit code 2)

If `models:fetch` cannot find the required `models-<hash>` release, that is not a Git, Rust, or Tauri error. `scripts/ensure-models.cjs` tries the original repository, then AndyLeAI/Upscaleer, then converts the officially published checkpoints using the original Node converter (no Python and no Electron). It keeps `.cache/weights` to avoid redownloading successful checkpoints. On Windows the converter gets a temporary path fix; the original script and its model-release SHA input remain untouched. Download/conversion may require several GB of free disk space and significant memory.

The installed Astro version requires **Node.js >=22.23.4**, so upgrade from 22.17.0 before re-running `install.bat`. Node.js 24 LTS is recommended. Do not delete `upstream/` or `upstream/.cache/weights` after a failed model conversion.

## Design and behavior

* `src-tauri/`: Rust native window, Tauri v2 config and icon. `app.security.headers` provides COOP/COEP on the embedded production origin for ONNX WASM threading; upstream Astro provides the same headers in dev.
* `src-tauri/src/lib.rs`: native **Save As** dialog and binary IPC write. The webpage continues to use its standard download button on GitHub Pages; inside Tauri only, it invokes Rust. No JavaScript-side filesystem permissions are granted.
* `scripts/patch-upstream.cjs`: idempotent UI, logo, translations, CSP/native-save changes; supports LF/CRLF and re-patching existing prior-version sources.
* `scripts/build-desktop.cjs`: Astro build at `/` into `renderer/`, with packaged AI models. The web build separately uses `/Upscaleer/`, so publishing cannot accidentally break the desktop asset paths.
* `scripts/patch-web.cjs`: web metadata, relative manifest icon and license notice.

**GPU:** The AI still runs inside the **client** WebView2 through WebGPU when supported by installed WebView2, driver and hardware. CPU/WASM fallback is used otherwise. Native Rust handles dialogs/files, not GPU inference. WebGPU acceleration and threaded WASM have **not been verified on Windows in this environment**.

## Tests and limitations

`node scripts/test-model-fallback.cjs` tests the model-release-missing fallback and SHA-256 verification, and `node scripts/test-patch.cjs` runs offline source patch tests for LF/CRLF, double-run idempotence, About removal, native-save hook, license link and model-path correction. The full Windows Rust compilation and downloaded ONNX models still require your machine and network; no prebuilt EXE is shipped.

The original project uses **PolyForm Noncommercial 1.0.0**; commercial use requires separate permission from its owner. Keep the upstream license and model notices. See `UPSTREAM-LICENSE.md`.
