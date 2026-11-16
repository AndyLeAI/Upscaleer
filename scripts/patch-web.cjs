'use strict';
/** Prepare the same Upscaleer UI for the static site. Run AFTER patch-upstream.cjs. */
const fs = require('node:fs');
const path = require('node:path');
const repo = path.join(__dirname, '..', 'upstream');
function check(ok, message) { if (!ok) throw Error(message); }
function setJson(relative, edit) {
  const f = path.join(repo, relative);
  check(fs.existsSync(f), `Missing ${relative}`);
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  edit(data);
  fs.writeFileSync(f, JSON.stringify(data, null, 4) + '\n');
}
function main() {
  check(fs.existsSync(path.join(repo, 'src/pages/index.astro')), 'Missing upstream, clone before patch');
  const texts = [
    ['en_us', 'AI upscaling for photos, drawings and illustrations, entirely in your browser.',
      'Your images are processed in this browser on your device; they are not uploaded.'],
    ['vi_vn', 'Nâng cấp độ phân giải ảnh chụp, tranh vẽ và hình minh họa bằng AI ngay trong trình duyệt.',
      'Ảnh được xử lý ngay trên thiết bị của bạn, không tải lên máy chủ.']
  ];
  for (const [locale, desc, privacy] of texts) {
    setJson(`src/i18n/${locale}.json`, data => {
      data.page.description = desc;
      data.start.privacy = privacy;
    });
  }
  // Manifest URLs need to work under /Upscaleer/, not the domain root.
  const manifestFile = path.join(repo, 'public/site.webmanifest');
  if (fs.existsSync(manifestFile)) setJson('public/site.webmanifest', data => {
    if (Array.isArray(data.icons)) for (const icon of data.icons) {
      if (icon.src === '/upscaleer-icon.png') icon.src = './upscaleer-icon.png';
    }
  });
  // Preserve the original licence even though the About modal is removed.
  const license = path.join(repo, 'LICENSE.md');
  const publicDir = path.join(repo, 'public');
  check(fs.existsSync(license), 'Upstream LICENSE.md missing');
  fs.copyFileSync(license, path.join(publicDir, 'UPSCALR-LICENSE.md'));
  const page = path.join(repo, 'src/pages/index.astro');
  let html = fs.readFileSync(page, 'utf8');
  check(html.includes('<input id="file-input"'), 'UI patch changed: could not add license link');
  if (!html.includes('id="upscaleer-licenses"')) {
    const eol = html.includes('\r\n') ? '\r\n' : '\n';
    html = html.replace('<input id="file-input"',
      '<a id="upscaleer-licenses" href={`${base}UPSCALR-LICENSE.md`} target="_blank" rel="noopener noreferrer" data-i18n="footer.licenses" class="absolute bottom-3 left-5 z-10 text-[11px] text-white/40 hover:text-white/80">Licences</a>' + eol + '        <input id="file-input"');
  }
  html = html.replace(/(<a id="upscaleer-licenses")(?![^>]*data-i18n)/, '$1 data-i18n="footer.licenses"');
  fs.writeFileSync(page, html);
  const og = path.join(__dirname, '..', 'assets', 'og-image.png');
  if (fs.existsSync(og)) fs.copyFileSync(og, path.join(publicDir, 'og-image.png'));
  console.log('[OK] Web metadata, manifest, social preview and original licence');
}
try { main(); } catch (err) { console.error('[ERROR]', err.message); process.exitCode = 1; }
