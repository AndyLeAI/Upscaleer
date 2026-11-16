'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const UPSTREAM = path.join(ROOT, 'upstream');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd, args, cwd = ROOT) {
  console.log(`\n>>> ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' } });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`Command failed (${r.status}): ${cmd} ${args.join(' ')}`);
}
function checkTools() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && (minor < 23 || (minor === 23 && Number(process.versions.node.split('.')[2]) < 4)))) throw new Error('Astro 7.4 requires Node.js >= 22.23.4. Please install Node.js 24 LTS, restart the terminal, and retry.');
  for (const [cmd, arg, help] of [
    ['git', '--version', 'Install Git for Windows'],
    ['cargo', '--version', 'Install Rust via rustup.rs with MSVC toolchain'],
    ['rustc', '--version', 'Install Rust via rustup.rs with MSVC toolchain'],
  ]) {
    const result = spawnSync(cmd,[arg],{encoding:'utf8',shell:process.platform==='win32'});
    if (result.status !== 0) throw new Error(`${cmd} not available. ${help}.`);
    console.log(`[TOOL] ${result.stdout.trim()}`);
    if (cmd === 'rustc') {
      const parts = /rustc (\d+)\.(\d+)\./.exec(result.stdout);
      if (parts && (+parts[1] < 1 || (+parts[1] === 1 && +parts[2] < 90))) {
        throw new Error('Rust >= 1.90 required by current Tauri dialog plugin. Run: rustup update stable');
      }
    }
  }
}
function migrateLegacyElectron() {
  const nodeModules = path.join(ROOT,'node_modules');
  const electron = path.join(nodeModules,'electron');
  const builder = path.join(nodeModules,'electron-builder');
  const legacySource = path.join(ROOT,'electron');
  const lockPath = path.join(ROOT,'package-lock.json');
  if (fs.existsSync(lockPath) && /\"electron(?:-builder)?\"/.test(fs.readFileSync(lockPath,'utf8'))) {
    fs.rmSync(lockPath,{force:true});
  }
  if (fs.existsSync(electron) || fs.existsSync(builder)) {
    console.log('\n[MIGRATION] Old Electron modules detected. Deleting ONLY root node_modules/ so npm can install Tauri CLI.');
    console.log('[MIGRATION] upstream/ and its AI models will NOT be deleted.');
    try { fs.rmSync(nodeModules, {recursive:true,force:true,maxRetries:5,retryDelay:500}); }
    catch (e) { throw new Error(`Cannot remove legacy root node_modules (files locked): ${e.message}. Close old app/terminals and manually delete root node_modules/.`); }
    fs.rmSync(path.join(ROOT,'package-lock.json'),{force:true});
  }
  // Legacy source files can remain when extracting on top of the old folder.
  // They are not used by Tauri and must not be committed to GitHub.
  if (fs.existsSync(legacySource)) fs.rmSync(legacySource,{recursive:true,force:true});
  fs.rmSync(path.join(ROOT,'scripts','build-windows.cjs'),{force:true});
}
function main() {
  checkTools();
  migrateLegacyElectron();
  if (!fs.existsSync(path.join(UPSTREAM,'package.json'))) {
    if (fs.existsSync(UPSTREAM) && fs.readdirSync(UPSTREAM).length) {
      throw new Error('upstream/ exists but does not contain package.json. Restore or rename that folder.');
    }
    run('git',['clone','--depth','1','--branch','develop','https://github.com/schmarante/upscalr.git','upstream']);
  }
  if (!fs.existsSync(path.join(UPSTREAM,'package-lock.json'))) throw new Error('Upstream package-lock.json missing.');
  run('node',['scripts/patch-upstream.cjs']);
  run(npm,['ci','--no-audit','--no-fund'], UPSTREAM);
  console.log('\n[MODELS] Ensure matching ONNX models (release first; automatic conversion only when release is absent).');
  run('node',['scripts/ensure-models.cjs']);
  console.log('\n[TAURI V2] Installing only @tauri-apps/cli (not Electron).');
  run(npm,['install','--no-audit','--no-fund','--prefer-offline']);
  console.log('\n[OK] Tauri v2 / Rust source is installed. Start with dev.bat.');
}
try {main();} catch (e) {console.error('\n[ERROR]',e.message);process.exitCode=1;}
