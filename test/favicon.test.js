import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageSize, parseIconLinks, parseSizes, manifestIcons, audit, checkFavicons } from '../src/index.js';

const pngHeader = (w, h) => {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const v = new DataView(b.buffer);
  v.setUint32(16, w);
  v.setUint32(20, h);
  return b;
};

const icoHeader = (sizes) => {
  const b = new Uint8Array(6 + sizes.length * 16);
  b[2] = 1;
  b[4] = sizes.length;
  sizes.forEach((s, i) => { b[6 + i * 16] = s === 256 ? 0 : s; b[7 + i * 16] = s === 256 ? 0 : s; });
  return b;
};

test('imageSize reads PNG dimensions', () => {
  assert.deepEqual(imageSize(pngHeader(180, 180)), { format: 'png', width: 180, height: 180 });
});

test('imageSize reads every entry of an ICO and reports the largest', () => {
  const info = imageSize(icoHeader([16, 32, 256]));
  assert.equal(info.format, 'ico');
  assert.equal(info.width, 256);
  assert.deepEqual(info.sizes.map((s) => s.width), [16, 32, 256]);
});

test('imageSize reads SVG viewBox', () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"></svg>');
  assert.deepEqual(imageSize(svg), { format: 'svg', width: 64, height: 64, vector: true });
});

test('imageSize reads GIF and returns null for garbage', () => {
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 16, 0, 16, 0]);
  assert.deepEqual(imageSize(gif), { format: 'gif', width: 16, height: 16 });
  assert.equal(imageSize(new TextEncoder().encode('<html>not an image</html>')), null);
});

test('parseIconLinks finds icons, resolves URLs and respects <base>', () => {
  const html = `<head>
    <base href="https://cdn.example.com/assets/">
    <link rel="icon" type="image/png" sizes="32x32" href="fav-32.png">
    <link REL='Apple-Touch-Icon' href="/apple.png">
    <!-- <link rel="icon" href="commented.png"> -->
    <link rel="stylesheet" href="style.css">
    <link rel="manifest" href="/site.webmanifest">
  </head>`;
  const { icons, manifest } = parseIconLinks(html, 'https://example.com/page');
  assert.equal(icons.length, 2);
  assert.equal(icons[0].url, 'https://cdn.example.com/assets/fav-32.png');
  assert.equal(icons[0].sizes, '32x32');
  assert.equal(icons[1].rel, 'apple-touch-icon');
  assert.equal(icons[1].url, 'https://cdn.example.com/apple.png');
  assert.equal(manifest, 'https://cdn.example.com/site.webmanifest');
});

test('parseSizes handles lists and "any"', () => {
  assert.deepEqual(parseSizes('16x16 32X32'), [{ width: 16, height: 16 }, { width: 32, height: 32 }]);
  assert.equal(parseSizes('any'), 'any');
  assert.deepEqual(parseSizes(null), []);
});

test('manifestIcons resolves src against the manifest URL', () => {
  const icons = manifestIcons({ icons: [{ src: 'icons/192.png', sizes: '192x192' }, { nope: 1 }] }, 'https://example.com/app/manifest.json');
  assert.equal(icons.length, 1);
  assert.equal(icons[0].url, 'https://example.com/app/icons/192.png');
});

test('audit flags a site with no favicon at all', () => {
  const issues = audit({ icons: [], faviconIco: { status: 404 } });
  assert.ok(issues.some((i) => i.code === 'no-favicon' && i.level === 'error'));
});

test('audit catches size mismatch, non-square and small icons', () => {
  const issues = audit({
    icons: [{ rel: 'icon', source: 'html', url: 'https://x/a.png', status: 200, format: 'png', width: 16, height: 20, sizes: '32x32' }],
    faviconIco: { status: 200 },
  });
  const codes = issues.map((i) => i.code);
  assert.ok(codes.includes('sizes-mismatch'));
  assert.ok(codes.includes('not-square'));
  assert.ok(codes.includes('too-small'));
  assert.ok(codes.includes('no-apple-touch-icon'));
});

test('audit is quiet for a well-configured site', () => {
  const issues = audit({
    icons: [
      { rel: 'icon', source: 'html', url: 'https://x/48.png', status: 200, format: 'png', width: 48, height: 48, sizes: '48x48' },
      { rel: 'apple-touch-icon', source: 'html', url: 'https://x/180.png', status: 200, format: 'png', width: 180, height: 180, sizes: '180x180' },
    ],
    faviconIco: { status: 200 },
  });
  assert.deepEqual(issues, []);
});

test('checkFavicons works end-to-end with a mocked fetch', async () => {
  const files = {
    'https://example.com/': { type: 'text/html', body: '<link rel="icon" href="/i.png" sizes="48x48"><link rel="apple-touch-icon" href="/a.png">' },
    'https://example.com/i.png': { type: 'image/png', body: pngHeader(48, 48) },
    'https://example.com/a.png': { type: 'image/png', body: pngHeader(180, 180) },
    'https://example.com/favicon.ico': { type: 'image/x-icon', body: icoHeader([16, 32]) },
  };
  const fakeFetch = async (url) => {
    const f = files[url];
    if (!f) return new Response('not found', { status: 404 });
    return new Response(f.body, { status: 200, headers: { 'content-type': f.type } });
  };
  const report = await checkFavicons('example.com', { fetch: fakeFetch });
  assert.equal(report.ok, true);
  assert.equal(report.icons.length, 3);
  assert.equal(report.faviconIco.status, 200);
  assert.deepEqual(report.issues, []);
});
