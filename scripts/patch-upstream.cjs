'use strict';
/**
 * Apply a small, reviewable set of edits to a fresh checkout of
 * https://github.com/schmarante/upscalr (branch develop).
 * Does NOT replace the image-processing implementation.
 * A change in upstream selectors fails clearly instead of silently breaking.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const UPSTREAM = path.join(ROOT, 'upstream');
const SRC = path.join(UPSTREAM, 'src');
const PUBLIC = path.join(UPSTREAM, 'public');

function assert(condition, message) { if (!condition) throw new Error(message); }
function replaceOnce(source, from, to, label) {
  assert(source.includes(from), `Upstream changed: cannot find ${label}. Patch requires review.`);
  return source.replace(from, to);
}
function edit(file, transform) {
  assert(fs.existsSync(file), `Missing upstream file: ${file}`);
  const original = fs.readFileSync(file, 'utf8');
  // Git for Windows may check out text with CRLF (core.autocrlf=true),
  // while upstream patches often contain LF. Compare/patch normalized text.
  const windowsNewlines = original.includes('\r\n');
  const before = original.replace(/\r\n/g, '\n');
  const after = transform(before);
  const output = windowsNewlines ? after.replace(/\n/g, '\r\n') : after;
  if (output !== original) fs.writeFileSync(file, output, 'utf8');
  console.log(`[PATCH] ${path.relative(UPSTREAM, file)}`);
}
function copy(asset, destination) {
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.copyFileSync(path.join(ROOT, 'assets', asset), destination);
}
function main() {
  assert(fs.existsSync(path.join(UPSTREAM, 'package.json')), 'Upstream source not found; run install.bat first.');
  const pageFile = path.join(SRC, 'pages', 'index.astro');
  edit(pageFile, source => {
    if (!source.includes('id="upscaleer-language"')) {
      // Match the two identifying elements, not indentation or exact newline spacing.
      // A Windows checkout can use CRLF, and upstream may reformat Tailwind classes.
      const brandHeader = /<Fragment\s+set:html=\{logo\('size-6 shrink-0 text-sky-400'\)\}\s*\/>\s*<span\b[^>]*>\s*UPSCALR\s*<\/span>/;
      assert(brandHeader.test(source), 'Upstream changed: cannot find UPSCALR brand header. Please provide src/pages/index.astro for review.');
      source = source.replace(brandHeader,
        `<img src={\`\${base}upscaleer-icon.png\`} class="size-7 shrink-0 object-contain" alt="" />\n                <span class="text-sm font-semibold tracking-wide text-white">Upscaleer</span>\n                <select id="upscaleer-language" aria-label="Language" data-i18n-aria="about.language" class="ml-auto cursor-pointer rounded border border-white/15 bg-neutral-900 px-1.5 py-1 text-[11px] text-white/75">\n                    <option value="en_us">English</option>\n                    <option value="vi_vn">Tiếng Việt</option>\n                </select>`);
      const beginMarker = '<!-- brand line bottom left with "About" -->';
      const endMarker = '<input id="file-input"';
      const begin = source.indexOf(beginMarker);
      const end = source.indexOf(endMarker, begin);
      assert(begin >= 0 && end > begin, 'Upstream About block not found.');
      source = source.slice(0, begin) + source.slice(end);
      // Old SVG favicon takes precedence over custom PNG in some browsers.
      source = source.replace(/\s*<link rel="icon" type="image\/svg\+xml"[^>]*\/>/, '');
      source = source.replace('<meta name="apple-mobile-web-app-title" content="UPSCALR" />', '<meta name="apple-mobile-web-app-title" content="Upscaleer" />');
      source = source.replace('<meta property="og:site_name" content="UPSCALR" />', '<meta property="og:site_name" content="Upscaleer" />');
    }
    // Set English as the build-time language, not German. This also avoids
    // a flash of German before the client-side language has loaded.
    source = source.replace("import de from '../i18n/de_de.json';", "import en from '../i18n/en_us.json';");
    source = source.replace(/(\bn\?\.\[p\], )de(\) \?\? k;)/, '$1en$2');
    source = source.replace(/<html lang="de">/, '<html lang="en">');
    source = source.replace('// German default texts rendered at build time', '// English default texts rendered at build time');
    source = source.replace('content="de_DE"', 'content="en_US"');
    source = source.replace(/(<meta property="og:locale:alternate" content=")en_US(" \/>)/, '$1vi_VN$2');
    // Migrate already-patched English/German selectors without duplicating UI.
    source = source.replace(/<option value="de_de">Deutsch<\/option>/g, '<option value="vi_vn">Tiếng Việt</option>');
    source = source.replace(/(<select id="upscaleer-language")(?![^>]*data-i18n-aria)/, '$1 data-i18n-aria="about.language"');
    assert(!source.includes('<option value="de_de">'), 'German option is still present.');
    // Upgrade old already-patched Electron-era sources, too. This must be
    // outside the first-install branding block for idempotent migrations.
    if (!source.includes('PUBLIC_UPSCALEER_DESKTOP')) {
      source = replaceOnce(source,
        `    "connect-src 'self' data: blob:",`,
        `    import.meta.env.PUBLIC_UPSCALEER_DESKTOP === '1' ? "connect-src 'self' data: blob: ipc: http://ipc.localhost https://ipc.localhost" : "connect-src 'self' data: blob:",`,
        'CSP connect-src for native Rust IPC');
    }
    assert(source.includes('id="upscaleer-language"'), 'Upscaleer language control was not inserted.');
    assert(!source.includes('data-about-mobile') && !source.includes('data-about class='), 'About UI removal incomplete.');
    return source;
  });

  edit(path.join(SRC, 'scripts', 'app.ts'), source => {
    if (!source.includes("const languageSelect = document.querySelector<HTMLSelectElement>('#upscaleer-language');")) {
      source = replaceOnce(source,
        `import { applyDom, getLocale, t } from './i18n';`,
        `import { applyDom, getLanguage, setLanguage, getLocale, t } from './i18n';`,
        'i18n import');
      source = replaceOnce(source, `import { buildAbout } from './about';\n`, '', 'About import');
      const begin = source.indexOf('// --- about ---');
      const end = source.indexOf('// --- start ---', begin);
      assert(begin >= 0 && end > begin, 'About controller not found.');
      const replacement = `// --- desktop language switch (About dialog removed) ---\n` +
        `const languageSelect = document.querySelector<HTMLSelectElement>('#upscaleer-language');\n` +
        `if (languageSelect) {\n` +
        `    languageSelect.value = getLanguage();\n` +
        `    languageSelect.addEventListener('change', async () => {\n` +
        `        if (await setLanguage(languageSelect.value)) updatePanel();\n` +
        `    });\n` +
        `}\n\n`;
      source = source.slice(0, begin) + replacement + source.slice(end);
    }
    // Only the Tauri desktop shell invokes Rust; no Tauri npm dependency is
    // introduced into upstream. The same patched source builds on GitHub Pages.
    if (!source.includes('// --- Upscaleer Tauri v2 native save ---')) {
      source = replaceOnce(source,
        `const download = $<HTMLAnchorElement>('[data-download]', panel);`,
        `const download = $<HTMLAnchorElement>('[data-download]', panel);
// --- Upscaleer Tauri v2 native save ---
// Browser downloads are untouched. Inside Tauri, preserve the original image
// bytes and let Rust open a native Save As dialog. Binary IPC avoids Base64.
download.addEventListener('click', async (event) => {
    const nativeInvoke = (window as any).__TAURI__?.core?.invoke;
    if (typeof nativeInvoke !== 'function' || !result) return;
    event.preventDefault();
    try {
        const chosen = await nativeInvoke('prepare_save', { fileName: result.name });
        if (!chosen) return;
        await nativeInvoke('write_image', new Uint8Array(await result.blob.arrayBuffer()));
    } catch (e) {
        console.error('Upscaleer native save failed:', e);
        showNotice({ id: 'native-save', icon: 'warning', title: t('notice.nativeSave.title'), message: t('notice.nativeSave.message') + ' ' + String(e), timeout: 12000 });
    }
});`,
        'download button for native Tauri Save As');
    }
    source = source.replace("title: 'Save failed', message: String(e)", "title: t('notice.nativeSave.title'), message: t('notice.nativeSave.message') + ' ' + String(e)");
    assert(!source.includes('buildAbout(') && !source.includes('aboutDialog'), 'About controller removal incomplete.');
    assert(source.includes('// --- Upscaleer Tauri v2 native save ---'), 'Tauri save integration not applied.');
    return source;
  });

  // English is the only reference language. Remove the German JSON so the
  // Vite glob cannot load German even if previously selected via localStorage.
  edit(path.join(SRC, 'scripts', 'i18n.ts'), source => {
    source = source.replace(/export const DEFAULT_LANGUAGE = 'de_de';/, "export const DEFAULT_LANGUAGE = 'en_us';");
    assert(source.includes("export const DEFAULT_LANGUAGE = 'en_us';"), 'Cannot set English fallback in i18n.ts');
    // Preserve language-selection logic; it gracefully ignores a legacy de_de value.
    return source;
  });

  const englishPath = path.join(SRC, 'i18n', 'en_us.json');
  edit(englishPath, text => {
    const dict = JSON.parse(text);
    dict.page.title = 'Upscaleer – upscale images locally';
    dict.page.description = 'AI upscaling for photos, drawings and illustrations – in a local desktop app.';
    dict.page.ogImageAlt = 'Upscaleer icon';
    dict.page.brand = '<b>Upscaleer</b> · AI upscaling on your device';
    dict.start.privacy = 'Processing runs locally on your computer. Your images are not uploaded.';
    dict.languages = { en_us: 'English', vi_vn: 'Tiếng Việt' };
    dict.footer = { licenses: 'Licences' };
    dict.notice ??= {};
    dict.notice.nativeSave = { title: 'Save failed', message: 'Could not save the image:' };
    return JSON.stringify(dict, null, 4) + '\n';
  });
  const viSource = path.join(ROOT, 'translations', 'vi_vn.json');
  assert(fs.existsSync(viSource), 'Missing translations/vi_vn.json');
  const viOverrides = JSON.parse(fs.readFileSync(viSource, 'utf8'));
  const english = JSON.parse(fs.readFileSync(englishPath, 'utf8'));
  // Overlay translated UI onto the current upstream dictionary; new keys not
  // yet translated fall back to English, never German.
  function combine(base, translation) {
    if (!base || typeof base !== 'object' || Array.isArray(base)) return translation === undefined ? base : translation;
    const result = {...base};
    for (const [k, val] of Object.entries(translation || {})) result[k] = combine(base[k], val);
    return result;
  }
  function checkPlaceholders(base, translation, trail = '') {
    if (!base || !translation || typeof base !== 'object' || typeof translation !== 'object') {
      if (typeof base === 'string' && typeof translation === 'string') {
        const vars = value => [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]).sort().join(',');
        assert(vars(base) === vars(translation), `Placeholder mismatch in Vietnamese: ${trail}`);
      }
      return;
    }
    for (const [key, value] of Object.entries(translation)) checkPlaceholders(base[key], value, `${trail}.${key}`);
  }
  checkPlaceholders(english, viOverrides);
  const vi = combine(english, viOverrides);
  vi.languages = {en_us: 'English', vi_vn: 'Tiếng Việt'};
  vi.footer = { licenses: 'Giấy phép' };
  const viFile = path.join(SRC, 'i18n', 'vi_vn.json');
  const viEol = fs.readFileSync(englishPath, 'utf8').includes('\r\n') ? '\r\n' : '\n';
  const viOutput = (JSON.stringify(vi, null, 4) + '\n').replace(/\n/g, viEol);
  if (!fs.existsSync(viFile) || fs.readFileSync(viFile, 'utf8') !== viOutput) fs.writeFileSync(viFile, viOutput, 'utf8');
  console.log('[PATCH] src\\i18n\\vi_vn.json');
  const germanFile = path.join(SRC, 'i18n', 'de_de.json');
  if (fs.existsSync(germanFile)) fs.rmSync(germanFile);
  assert(!fs.existsSync(germanFile), 'German language file still exists.');

  // Fix a genuine Windows path bug in model-fetch script. Do NOT edit
  // convert-models.mjs: its exact bytes are part of the upstream release hash.
  edit(path.join(UPSTREAM, 'scripts', 'models-release.mjs'), source => {
    if (!source.includes('fileURLToPath(import.meta.url)')) {
      source = replaceOnce(source, `import path from 'node:path';`,
        `import path from 'node:path';\nimport { fileURLToPath } from 'node:url';`, 'path import');
      source = replaceOnce(source,
        `const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));`,
        `const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));`,
        'Windows-safe repository path');
    }
    return source;
  });

  copy('Upscaleer.png', path.join(PUBLIC, 'upscaleer-icon.png'));
  copy('favicon-96x96.png', path.join(PUBLIC, 'favicon-96x96.png'));
  copy('apple-touch-icon.png', path.join(PUBLIC, 'apple-touch-icon.png'));
  copy('Upscaleer.ico', path.join(PUBLIC, 'favicon.ico'));
  const manifestFile = path.join(PUBLIC, 'site.webmanifest');
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.name = 'Upscaleer';
    manifest.short_name = 'Upscaleer';
    if (Array.isArray(manifest.icons)) {
      manifest.icons = [{src: '/upscaleer-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any'}];
    }
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  }
  // Keep full original licences/metadata in upstream and packaged resources.
  console.log('[OK] Upscaleer: English + Vietnamese only, About removed, Tauri v2 native save ready.');
}
try {main();} catch (e) {console.error('[ERROR]', e.message); process.exitCode = 1;}
