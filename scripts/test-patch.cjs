'use strict';
// Offline regression test: simulates a checkout of the current UPSCALR UI,
// with both LF and Windows CRLF, without downloading large ONNX models.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ORIGIN = path.resolve(__dirname, '..');
const SAMPLE_INDEX = `---
const base = import.meta.env.BASE_URL;
---

<html lang="de"><head>
import de from '../i18n/de_de.json';
const tr = (k: string): string => k.split('.').reduce<any>((n, p) => n?.[p], de) ?? k;
<meta property="og:locale" content="de_DE" />
<meta property="og:locale:alternate" content="en_US" />
const CSP = [
    "connect-src 'self' data: blob:",
];
<meta property="og:site_name" content="UPSCALR" />
<link rel="icon" type="image/svg+xml" href={\`\${base}favicon.svg\`} />
<meta name="apple-mobile-web-app-title" content="UPSCALR" />
</head><body>
<div id="panel"><div class="flex items-center gap-2">
                <Fragment set:html={logo('size-6 shrink-0 text-sky-400')} />
                <span class="text-sm font-semibold tracking-wide text-white">UPSCALR</span>
</div></div>
<!-- brand line bottom left with "About" -->
<div><button data-about class="some-class">About</button></div>
<button data-about-mobile>About</button>
<dialog id="about"><div data-about-body></div></dialog>
<input id="file-input" type="file" />
</body></html>
`;
const SAMPLE_APP = `import { applyDom, getLocale, t } from './i18n';
import { buildAbout } from './about';
function updatePanel() {}
const panel = document.querySelector('#panel');
const download = $<HTMLAnchorElement>('[data-download]', panel);
// --- about ---
const aboutDialog = document.querySelector('#about');
buildAbout({});
// --- start ---
applyDom();
updatePanel();
`;
const SAMPLE_MODEL_SCRIPT = `import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
`;
function write(root, relative, content, windows) {
  const dest = path.join(root, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, windows ? content.replace(/\n/g, '\r\n') : content);
}
function execute(script) {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${path.basename(script)} failed:\n${r.stdout}\n${r.stderr}`);
}
function verify(windows) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `upscaleer-${windows ? 'crlf' : 'lf'}-`));
  try {
    const upstream = path.join(root, 'upstream');
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    for (const asset of ['Upscaleer.png', 'favicon-96x96.png', 'apple-touch-icon.png', 'Upscaleer.ico', 'og-image.png']) {
      fs.copyFileSync(path.join(ORIGIN, 'assets', asset), path.join(root, 'assets', asset));
    }
    for (const name of ['patch-upstream.cjs', 'patch-web.cjs']) fs.copyFileSync(path.join(ORIGIN, 'scripts', name), path.join(root, 'scripts', name));
    fs.mkdirSync(path.join(root, 'translations'), { recursive: true });
    fs.copyFileSync(path.join(ORIGIN, 'translations', 'vi_vn.json'), path.join(root, 'translations', 'vi_vn.json'));
    write(upstream, 'package.json', '{}\n', windows);
    write(upstream, 'LICENSE.md', 'Original UPSCALR licence\n', windows);
    write(upstream, 'src/pages/index.astro', SAMPLE_INDEX, windows);
    write(upstream, 'src/scripts/app.ts', SAMPLE_APP, windows);
    write(upstream, 'src/scripts/i18n.ts', "export const DEFAULT_LANGUAGE = 'de_de';\n", windows);
    write(upstream, 'scripts/models-release.mjs', SAMPLE_MODEL_SCRIPT, windows);
    for (const lang of ['en_us', 'de_de']) write(upstream, `src/i18n/${lang}.json`, JSON.stringify({ page: { title: 'UPSCALR' }, start: { privacy: 'Original' } }, null, 2) + '\n', windows);
    write(upstream, 'public/site.webmanifest', JSON.stringify({ name: 'UPSCALR', short_name: 'UPSCALR', icons: [{ src: '/favicon.ico' }] }, null, 2) + '\n', windows);
    const patch = path.join(root, 'scripts', 'patch-upstream.cjs');
    const webPatch = path.join(root, 'scripts', 'patch-web.cjs');
    execute(patch); execute(patch); // idempotence on both line endings
    let page = fs.readFileSync(path.join(upstream, 'src/pages/index.astro'), 'utf8');
    assert.match(page, /<span[^>]*>Upscaleer<\/span>/);
    assert.match(page, /id="upscaleer-language"/);
    assert.match(page, /value="en_us">English<\/option>/);
    assert.match(page, /value="vi_vn">Tiếng Việt<\/option>/);
    assert.doesNotMatch(page, /Deutsch|value="de_de"/);
    assert.match(page, /import en from/);
    assert.match(page, /\ben\) \?\? k;/);
    assert.match(page, /<html lang="en">/);
    assert.match(page, /content="vi_VN"/);
    assert.match(page, /upscaleer-icon\.png/);
    assert.doesNotMatch(page, /data-about|<dialog id="about"/);
    assert.doesNotMatch(page, /favicon\.svg/);
    assert.match(page, /PUBLIC_UPSCALEER_DESKTOP/);
    const app = fs.readFileSync(path.join(upstream, 'src/scripts/app.ts'), 'utf8');
    assert.match(app, /getLanguage, setLanguage/);
    assert.match(app, /nativeInvoke\('prepare_save'/);
    assert.match(app, /nativeInvoke\('write_image'/);
    assert.doesNotMatch(app, /buildAbout|aboutDialog/);
    assert.match(fs.readFileSync(path.join(upstream, 'scripts/models-release.mjs'), 'utf8'), /fileURLToPath\(import\.meta\.url\)/);
    assert.match(fs.readFileSync(path.join(upstream, 'src/scripts/i18n.ts'), 'utf8'), /DEFAULT_LANGUAGE = 'en_us'/);
    assert(!fs.existsSync(path.join(upstream, 'src/i18n/de_de.json')));
    const viDict = JSON.parse(fs.readFileSync(path.join(upstream, 'src/i18n/vi_vn.json'), 'utf8'));
    const enDict = JSON.parse(fs.readFileSync(path.join(upstream, 'src/i18n/en_us.json'), 'utf8'));
    assert.equal(viDict.panel.start, 'Nâng cấp ảnh');
    assert.equal(viDict.notice.nativeSave.title, 'Không thể lưu ảnh');
    assert.deepEqual(Object.keys(viDict.languages), ['en_us','vi_vn']);
    assert.deepEqual(Object.keys(enDict.languages), ['en_us','vi_vn']);
    if (windows) assert.match(page, /\r\n/);
    // Simulate a prior patched install which still offered Deutsch.
    const legacyPage = fs.readFileSync(path.join(upstream, 'src/pages/index.astro'), 'utf8')
      .replace('<option value="vi_vn">Tiếng Việt</option>', '<option value="de_de">Deutsch</option>');
    fs.writeFileSync(path.join(upstream, 'src/pages/index.astro'), legacyPage);
    write(upstream, 'src/i18n/de_de.json', '{}\n', windows);
    execute(patch); // upgrade existing project, don't require a fresh clone
    page = fs.readFileSync(path.join(upstream, 'src/pages/index.astro'), 'utf8');
    assert.match(page, /<option value="vi_vn">Tiếng Việt<\/option>/);
    assert(!fs.existsSync(path.join(upstream, 'src/i18n/de_de.json')));
    execute(webPatch); execute(webPatch);
    page = fs.readFileSync(path.join(upstream, 'src/pages/index.astro'), 'utf8');
    assert.equal(page.match(/id="upscaleer-licenses"/g)?.length, 1);
    assert.match(fs.readFileSync(path.join(upstream, 'public/site.webmanifest'), 'utf8'), /\.\/upscaleer-icon\.png/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(upstream, 'src/i18n/vi_vn.json'), 'utf8')).start.privacy, 'Ảnh được xử lý ngay trên thiết bị của bạn, không tải lên máy chủ.');
    assert(fs.existsSync(path.join(upstream, 'public/UPSCALR-LICENSE.md')));
    console.log(`[PASS] ${windows ? 'Windows CRLF' : 'Unix LF'}: branding, About removal, language, icons, model path, web patch, repeat-run`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
verify(false);
verify(true);
console.log('[PASS] Offline patch regression tests completed.');
