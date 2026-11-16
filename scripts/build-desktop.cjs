'use strict';
/** Build the original Astro app at / into renderer/ for the embedded Tauri scheme.
 * GitHub Pages uses a DIFFERENT build with BASE_PATH=/Upscaleer/.
 */
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
function run(cmd,args,cwd=ROOT,env={}) {
  console.log(`\n>>> ${cmd} ${args.join(' ')}\n`);
  const r=spawnSync(cmd,args,{cwd,stdio:'inherit',shell:process.platform==='win32',env:{...process.env,...env}});
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`);
}
try {
  if (!fs.existsSync(path.join(ROOT,'upstream','public','models','manifest.json'))) throw new Error('ONNX models not found. Run install.bat first.');
  run('node',['scripts/patch-upstream.cjs']);
  const npm=process.platform === 'win32' ? 'npm.cmd':'npm';
  run(npm,['run','build'],path.join(ROOT,'upstream'),{
    BASE_PATH:'/',
    OUT_DIR:'../renderer',
    SITE_URL:'http://tauri.localhost',
    PUBLIC_UPSCALEER_DESKTOP:'1',
  });
  const index=path.join(ROOT,'renderer','index.html');
  if(!fs.existsSync(index)) throw new Error('Astro did not create renderer/index.html');
  // GitHub Pages COI serviceworker is unnecessary for Tauri; Tauri serves the
  // official COOP/COEP headers itself (see src-tauri/tauri.conf.json).
  let html=fs.readFileSync(index,'utf8');
  html=html.replace(/<script\s+[^>]*src="[^"]*coi-(?:config|serviceworker)\.js"[^>]*><\/script>/g,'');
  fs.writeFileSync(index,html);
  console.log('[OK] Tauri renderer created (base /, models included, GitHub Pages service worker not loaded).');
} catch(e) { console.error('[ERROR]',e.message); process.exitCode=1; }
