'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const upstream = path.join(root, 'upstream');
const modelsDir = path.join(upstream, 'public', 'models');
function fail(message) { throw new Error(message); }
function digest(file) {
  // Stream chunks rather than loading a large (hundreds-of-MB) model into RAM.
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(4 * 1024 * 1024);
    let length;
    while ((length = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, length));
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
try {
  if (!fs.existsSync(path.join(upstream, 'src', 'pages', 'index.astro'))) fail('Upstream source missing. Run install.bat.');
  const manifestPath = path.join(modelsDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) fail('ONNX manifest missing. Run install.bat to download or convert models.');
  const statePath = path.join(modelsDir, '.upscaleer-model-state.json');
  if (!fs.existsSync(statePath)) fail('Model revision marker missing; checking a matching release or converting models.');
  const tagOutput = spawnSync(process.execPath, ['scripts/models-release.mjs', 'key'], {cwd: upstream, encoding:'utf8'});
  if (tagOutput.status !== 0) fail('Cannot calculate model revision tag: ' + tagOutput.stderr);
  const tag = tagOutput.stdout.trim();
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (state.tag !== tag) fail(`Model revision changed: have ${state.tag}, need ${tag}.`);
  const specs = JSON.parse(fs.readFileSync(path.join(upstream, 'scripts', 'models.json'), 'utf8')).models;
  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!json.models || Object.keys(json.models).length !== specs.length) fail('ONNX manifest has an incomplete model list.');
  let count = 0, bytes = 0;
  for (const spec of specs) {
    const model = json.models[spec.id];
    if (!model) fail(`Model missing in manifest: ${spec.id}`);
    const expected = spec.arch === 'onnx' ? Object.keys(spec.variants) : (spec.precisions || ['fp32', 'fp16']);
    if (!model.variants || Object.keys(model.variants).length !== expected.length) fail(`Variant count incorrect for ${spec.id}`);
    for (const variant of expected) {
      const v = model.variants[variant];
      if (!v || !v.file || path.basename(v.file) !== v.file || !v.file.endsWith('.onnx')) fail(`Invalid model path for ${spec.id}/${variant}`);
      if (typeof v.bytes !== 'number' || !/^[a-f0-9]{64}$/.test(v.sha256 || '')) fail(`Invalid manifest checksum for ${v.file}`);
      const loc = path.join(modelsDir, v.file);
      if (!fs.existsSync(loc)) fail(`Model missing: ${v.file}`);
      const size = fs.statSync(loc).size;
      if (size !== v.bytes) fail(`Model size incorrect: ${v.file} (${size} versus ${v.bytes}).`);
      if (digest(loc) !== v.sha256) fail(`Model SHA-256 mismatch: ${v.file}`);
      ++count; bytes += size;
    }
  }
  console.log(`[OK] ${count} ONNX model files verified by SHA-256 (${(bytes / 1048576).toFixed(0)} MiB); revision ${tag}.`);
} catch (e) { console.error('[ERROR]', e.message); process.exitCode = 1; }
