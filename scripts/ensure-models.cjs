'use strict';
/**
 * Fetch the exact model-release tag for this upstream revision. If no release
 * exists (exit 2), convert the official checkpoints with upstream's converter.
 * Never silently use models made for a different converter revision.
 * Windows: run a temporary path-fixed converter copy WITHOUT changing the
 * original converter bytes (which are included in the release-tag hash).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const UPSTREAM = path.join(ROOT, 'upstream');
const VERIFY = path.join(ROOT, 'scripts', 'verify.cjs');
const STATE_NAME = '.upscaleer-model-state.json';
const ORIGINAL_REPO = 'schmarante/upscalr';
const FALLBACK_REPO = 'AndyLeAI/Upscaleer';

function spawnNode(args, cwd = UPSTREAM, options = {}) {
  const out = spawnSync(process.execPath, args, { cwd, stdio: options.capture ? 'pipe' : 'inherit', encoding: options.capture ? 'utf8' : undefined });
  if (out.error) throw out.error;
  if (out.signal) throw new Error(`Child process interrupted (${out.signal}).`);
  return out;
}
function modelTag() {
  const r = spawnNode(['scripts/models-release.mjs', 'key'], UPSTREAM, { capture: true });
  if (r.status !== 0) throw new Error('Cannot calculate upstream model revision: ' + (r.stderr || r.stdout));
  const tag = r.stdout.trim();
  if (!/^models-[a-f0-9]{12}$/.test(tag)) throw new Error('Invalid upstream model revision: ' + tag);
  return tag;
}
function verify() {
  return spawnNode([VERIFY], ROOT, { capture: true });
}
function stamp(tag, source) {
  fs.mkdirSync(path.join(UPSTREAM, 'public', 'models'), { recursive: true });
  fs.writeFileSync(path.join(UPSTREAM, 'public', 'models', STATE_NAME),
    JSON.stringify({ tag, source }, null, 2) + '\n');
}
function fetchFrom(repo) {
  console.log(`\n[MODELS] Fetching matching release from ${repo}...`);
  const r = spawnNode(['scripts/models-release.mjs', 'fetch', '--repo', repo]);
  if (r.status !== 0 && r.status !== 2) {
    throw new Error(`Model download from ${repo} failed (code ${r.status}). This is not a missing-release error; check connection and retry.`);
  }
  return r.status === 0;
}
function runConverter({ platform = process.platform } = {}) {
  console.log('\n[MODELS] No matching ONNX release yet. Converting models from their official checkpoints.');
  console.log('[MODELS] Requires substantial disk space, RAM, and downloads; checkpoint files are cached for future attempts.');
  let temp;
  try {
    if (platform === 'win32') {
      const origin = path.join(UPSTREAM, 'scripts', 'convert-models.mjs');
      let source = fs.readFileSync(origin, 'utf8');
      const originalRoot = 'const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));';
      if (source.includes(originalRoot)) {
        if (!source.includes("import path from 'node:path';")) throw new Error('Converter structure changed: path import not found.');
        source = source.replace("import path from 'node:path';", "import path from 'node:path';\nimport { fileURLToPath } from 'node:url';");
        source = source.replace(originalRoot, 'const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));');
      } else if (!source.includes('fileURLToPath(import.meta.url)')) {
        throw new Error('Converter structure changed; cannot safely apply Windows path workaround.');
      }
      temp = path.join(UPSTREAM, 'scripts', '.upscaleer-convert-windows.mjs');
      fs.writeFileSync(temp, source);
      console.log('[MODELS] Windows path workaround enabled in a temporary copy; release hash remains unchanged.');
    }
    const entry = platform === 'win32' ? 'scripts/.upscaleer-convert-windows.mjs' : 'scripts/convert-models.mjs';
    const r = spawnNode([entry]);
    if (r.status !== 0) throw new Error(`Model conversion failed (code ${r.status}). Existing checkpoints remain in upstream/.cache/weights; retry install.bat after resolving the download issue.`);
  } finally {
    if (temp) fs.rmSync(temp, { force: true });
  }
}
function main() {
  const tag = modelTag();
  console.log(`[MODELS] Required release: ${tag}`);
  const old = verify();
  if (old.status === 0) {
    console.log('[MODELS] Reusing verified ONNX files for the current revision.');
    console.log(old.stdout.trim());
    return;
  }
  console.log('[MODELS] Existing models absent, incomplete, or not from this revision: ' + (old.stderr || old.stdout || '').trim());
  const candidates = [...new Set([ORIGINAL_REPO, process.env.UPSCALEER_MODEL_MIRROR || FALLBACK_REPO])];
  let source = 'converted';
  for (const repo of candidates) {
    if (fetchFrom(repo)) { source = `release:${repo}`; break; }
  }
  if (source === 'converted') runConverter();
  stamp(tag, source);
  const result = verify();
  if (result.status !== 0) {
    fs.rmSync(path.join(UPSTREAM, 'public', 'models', STATE_NAME), { force: true });
    throw new Error('Model verification failed after ' + source + ': ' + (result.stderr || result.stdout));
  }
  console.log(result.stdout.trim());
  console.log(`[OK] Models ready (${source}).`);
}
if (require.main === module) {
  try { main(); } catch (e) { console.error('\n[ERROR]', e.message); process.exitCode = 1; }
}
module.exports = { modelTag, runConverter, main };
