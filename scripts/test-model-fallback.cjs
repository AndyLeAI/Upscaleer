'use strict';
/** Offline regression: release missing (2) -> converter -> verified manifest and marker.
 * No network and no heavyweight ONNX downloads. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'upstream');
assert(!fs.existsSync(fixture), 'Test refuses to overwrite a real upstream/ checkout. Run in a clean source directory.');
const scripts = path.join(fixture, 'scripts');
const models = path.join(fixture, 'public', 'models');
fs.mkdirSync(scripts, {recursive:true});
fs.mkdirSync(models, {recursive:true});
fs.mkdirSync(path.join(fixture,'src','pages'),{recursive:true});
try {
  fs.writeFileSync(path.join(fixture,'src','pages','index.astro'),'fixture');
  fs.writeFileSync(path.join(scripts,'models.json'),JSON.stringify({models:[{id:'dummy',arch:'compact'}]}));
  fs.writeFileSync(path.join(scripts,'models-release.mjs'),`
const cmd=process.argv[2];
if(cmd==='key'){console.log('models-703d93e021fa');process.exit(0);}
if(cmd==='fetch'){console.log('no release models-703d93e021fa yet');process.exit(2);}
process.exit(1);
`);
  fs.writeFileSync(path.join(scripts,'convert-models.mjs'),`
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const target=path.join(root,'public','models');
const bytes=Buffer.from('FAKE_ONNX_FOR_TEST_ONLY');
const hash=crypto.createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(path.join(target,'dummy.onnx'),bytes);
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify({models:{dummy:{variants:{fp32:{file:'dummy.onnx',bytes:bytes.length,sha256:hash},fp16:{file:'dummy.onnx',bytes:bytes.length,sha256:hash}}}}}));
`);
  // Run Windows-specific temporary converter workaround. Its output is identical,
  // but the original converter must retain exactly the same bytes afterwards.
  const old = fs.readFileSync(path.join(scripts,'convert-models.mjs'));
  const orchestrator = require('./ensure-models.cjs');
  orchestrator.runConverter({platform:'win32'});
  assert.deepEqual(fs.readFileSync(path.join(scripts,'convert-models.mjs')),old);
  assert(!fs.existsSync(path.join(scripts,'.upscaleer-convert-windows.mjs')));
  // Reset ONNX results to test the missing-release fetch/convert flow.
  fs.rmSync(path.join(models, 'manifest.json')); fs.rmSync(path.join(models, 'dummy.onnx'));
  orchestrator.main();
  const st=JSON.parse(fs.readFileSync(path.join(models,'.upscaleer-model-state.json')));
  assert.equal(st.source,'converted');
  assert.equal(st.tag,'models-703d93e021fa');
  const verify = cp.spawnSync(process.execPath,['scripts/verify.cjs'],{cwd:root,encoding:'utf8'});
  assert.equal(verify.status,0,verify.stderr);
  orchestrator.main();
  console.log('[PASS] no matching release -> converts; full SHA-256 verification, state-aware reuse, Windows original hash unchanged.');
  // Tampering detected
  fs.appendFileSync(path.join(models,'dummy.onnx'),'x');
  const tampered = cp.spawnSync(process.execPath,['scripts/verify.cjs'],{cwd:root,encoding:'utf8'});
  assert.notEqual(tampered.status,0);
  console.log('[PASS] altered model detected');
} finally {
  fs.rmSync(fixture,{recursive:true,force:true});
}
