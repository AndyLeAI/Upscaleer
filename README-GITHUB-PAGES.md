# Upscaleer on GitHub Pages (AndyLeAI)

The desktop shell in this archive uses **Tauri v2 + Rust, never Electron**. This does not affect web hosting. The GitHub Pages workflow builds the original Astro + ONNX Runtime Web frontend (after Upscaleer branding and About removal) into static HTML/CSS/JS with model files. All inference happens on the visitor's own browser GPU (WebGPU) or CPU (WASM).

## Publish

1. Under GitHub account `AndyLeAI`, create an **empty public** repository named **Upscaleer** at https://github.com/new (no auto-generated README).
2. Extract this ZIP and run `publish-github.bat`, then sign in when GitHub asks. The script commits only the project wrapper and icons; large original ONNX files under `upstream/` are ignored.
3. Under https://github.com/AndyLeAI/Upscaleer/settings/pages, select **Source: GitHub Actions**.
4. Under https://github.com/AndyLeAI/Upscaleer/actions, ensure the `Deploy Upscaleer to GitHub Pages` build/deploy succeeded (or use **Run workflow**).
5. Open **https://AndyLeAI.github.io/Upscaleer/**. This URL is only valid after successful deployment.

## Source layout and builds

* `.github/workflows/deploy-pages.yml`: checks out original upscalr develop, applies patches, downloads the exact model release or converts official checkpoints on a missing release (exit 2), publishes newly converted models to `AndyLeAI/Upscaleer` GitHub Releases for reuse, validates ONNX models, compiles with `BASE_PATH=/Upscaleer/`, measures site size, deploys to Pages.
* `build-web.bat`: equivalent local static web build into `upstream/dist/`.
* Tauri desktop is **not used** in the GitHub Actions Pages build. Pages builds only Astro. Local `dev.bat` / `build.bat` use Tauri v2.

GitHub Pages has a **1 GiB** published-artifact/site limit. Large ONNX assets approach this size; the workflow measures and refuses deployments exceeding the limit. If the build fails due to size, move models to a separately hosted static origin with appropriate CORS/COEP headers and adjust paths, or use a different static host. The upstream repo/license and all model licensing terms still apply.

The original repo's `coi-serviceworker.js` enables cross-origin isolation on Pages where HTTP headers cannot be customized. On Tauri, COOP/COEP headers are supplied natively instead. Use modern secure-context browsers/HTTPS for WebGPU.

This kit has not been executed inside your own GitHub account. A green GitHub Actions workflow and a real image test in the deployed page are required to confirm production operation.

### ONNX release fallback

A model release is tied to the checksum of `models.json` and the upstream converter. When upstream `develop` changes, the exact release may not exist yet; the build automatically converts from official model checkpoints and publishes the new assets to the `AndyLeAI/Upscaleer` repository release. GitHub Actions therefore needs `contents: write` permission, included in the workflow. Models are verified against the generated manifest and SHA-256 and are cached for later builds. Large-model conversions can consume significant build time, memory and bandwidth.
