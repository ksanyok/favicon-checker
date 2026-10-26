import { imageSize } from './image-size.js';
import { parseIconLinks, manifestIcons, parseSizes } from './parse.js';

export { imageSize } from './image-size.js';
export { parseIconLinks, manifestIcons, parseSizes, parseAttributes } from './parse.js';

const UA = 'favicon-checker/1.0 (+https://github.com/ksanyok/favicon-checker)';
const MAX_ICON_BYTES = 2 * 1024 * 1024;

function normalizeUrl(input) {
  const s = String(input || '').trim();
  if (!s) throw new TypeError('A URL or domain is required');
  return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).href;
}

async function request(url, { fetchImpl, timeout, method = 'GET' }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetchImpl(url, {
      method,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: '*/*' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readLimited(res, limit) {
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf.length > limit ? buf.slice(0, limit) : buf;
}

async function probeIcon(icon, opts) {
  const out = { ...icon, status: null, contentType: null, bytes: null, format: null, width: null, height: null };
  try {
    const res = await request(icon.url, opts);
    out.status = res.status;
    out.finalUrl = res.url || icon.url;
    out.contentType = (res.headers.get('content-type') || '').split(';')[0].trim() || null;
    if (res.ok) {
      const body = await readLimited(res, MAX_ICON_BYTES);
      out.bytes = body.length;
      const info = imageSize(body);
      if (info) {
        out.format = info.format;
        out.width = info.width || null;
        out.height = info.height || null;
        if (info.sizes) out.embeddedSizes = info.sizes;
      }
    }
  } catch (err) {
    out.error = err.name === 'AbortError' ? 'timeout' : err.message;
  }
  return out;
}

/**
 * Turn probed icons into a list of findings. Pure function — easy to test.
 * @param {{icons: Array, faviconIco?: object, manifest?: object}} report
 * @returns {Array<{level: 'error'|'warning'|'info', code: string, message: string}>}
 */
export function audit(report) {
  const issues = [];
  const add = (level, code, message) => issues.push({ level, code, message });
  const icons = report.icons || [];
  const ok = icons.filter((i) => i.status >= 200 && i.status < 300 && i.format);

  if (!icons.length && !(report.faviconIco && report.faviconIco.status === 200)) {
    add('error', 'no-favicon', 'No favicon found: no <link rel="icon"> tags and /favicon.ico does not respond with 200.');
  }
  for (const i of icons) {
    if (i.error) add('error', 'icon-unreachable', `${i.url} could not be fetched (${i.error}).`);
    else if (i.status && i.status >= 400) add('error', 'icon-broken', `${i.url} returns HTTP ${i.status}.`);
    else if (i.status && !i.format) add('warning', 'icon-not-image', `${i.url} does not look like an image (content-type: ${i.contentType || 'unknown'}).`);
  }
  if (!icons.some((i) => i.source === 'html' && i.rel !== 'mask-icon')) {
    add('warning', 'no-link-tag', 'No <link rel="icon"> in the HTML. Search engines and browsers fall back to /favicon.ico, which is fragile.');
  }
  if (report.faviconIco && report.faviconIco.status !== 200) {
    add('warning', 'no-root-ico', `/favicon.ico responds with ${report.faviconIco.status || report.faviconIco.error}. Some clients request it directly.`);
  }
  if (!icons.some((i) => i.rel.startsWith('apple-touch-icon'))) {
    add('warning', 'no-apple-touch-icon', 'No apple-touch-icon. iOS will use a screenshot of the page for home-screen bookmarks.');
  }
  const raster = ok.filter((i) => i.format !== 'svg');
  const hasSvg = ok.some((i) => i.format === 'svg');
  const big = raster.some((i) => i.width >= 48 && i.height >= 48);
  if (ok.length && !big && !hasSvg) {
    add('warning', 'too-small', 'No icon of at least 48x48 px. Google asks for a square icon whose size is a multiple of 48 px.');
  }
  for (const i of raster) {
    if (i.width && i.height && i.width !== i.height) add('warning', 'not-square', `${i.url} is ${i.width}x${i.height}; favicons should be square.`);
    const declared = parseSizes(i.sizes);
    if (Array.isArray(declared) && declared.length && i.format !== 'ico') {
      const match = declared.some((d) => d.width === i.width && d.height === i.height);
      if (!match) add('warning', 'sizes-mismatch', `${i.url} declares sizes="${i.sizes}" but is actually ${i.width}x${i.height}.`);
    }
    if (i.bytes > 100 * 1024) add('info', 'heavy-icon', `${i.url} weighs ${Math.round(i.bytes / 1024)} KB; consider compressing it.`);
  }
  if (report.manifest && report.manifest.url) {
    if (report.manifest.status !== 200) {
      add('warning', 'manifest-broken', `Web app manifest ${report.manifest.url} returns ${report.manifest.status || report.manifest.error}.`);
    } else {
      const m = icons.filter((i) => i.source === 'manifest');
      const has = (n) => m.some((i) => (i.sizes || '').split(/\s+/).includes(`${n}x${n}`));
      if (!has(192) || !has(512)) add('info', 'manifest-sizes', 'Manifest should list 192x192 and 512x512 icons for installable PWAs.');
    }
  }
  return issues;
}

/**
 * Fetch a page and check every favicon it declares.
 * @param {string} input URL or bare domain
 * @param {{timeout?: number, fetch?: typeof fetch, probe?: boolean}} [options]
 */
export async function checkFavicons(input, options = {}) {
  const opts = { fetchImpl: options.fetch || globalThis.fetch, timeout: options.timeout ?? 10000 };
  const probe = options.probe !== false;
  const url = normalizeUrl(input);

  const page = await request(url, opts);
  const finalUrl = page.url || url;
  const html = page.ok ? await page.text() : '';
  if (!page.ok) {
    throw Object.assign(new Error(`Page returned HTTP ${page.status}`), { status: page.status, url: finalUrl });
  }

  const { icons, manifest: manifestUrl } = parseIconLinks(html, finalUrl);
  const report = { url, finalUrl, icons: [], faviconIco: null, manifest: null };

  if (manifestUrl) {
    report.manifest = { url: manifestUrl, status: null };
    try {
      const res = await request(manifestUrl, opts);
      report.manifest.status = res.status;
      if (res.ok) icons.push(...manifestIcons(JSON.parse(await res.text()), res.url || manifestUrl));
    } catch (err) {
      report.manifest.error = err.name === 'AbortError' ? 'timeout' : err.message;
    }
  }

  const rootIco = new URL('/favicon.ico', finalUrl).href;
  const seen = new Set();
  const unique = icons.filter((i) => (seen.has(`${i.rel}|${i.url}`) ? false : seen.add(`${i.rel}|${i.url}`)));

  report.icons = probe ? await Promise.all(unique.map((i) => probeIcon(i, opts))) : unique;
  const declaredIco = report.icons.find((i) => i.url === rootIco);
  if (declaredIco) {
    report.faviconIco = { url: rootIco, status: declaredIco.status };
  } else if (probe) {
    const ico = await probeIcon({ rel: 'shortcut icon', href: '/favicon.ico', url: rootIco, source: 'default' }, opts);
    report.faviconIco = { url: rootIco, status: ico.status, error: ico.error };
    if (ico.status === 200 && ico.format) report.icons.push(ico);
  }

  report.issues = audit(report);
  report.ok = !report.issues.some((i) => i.level === 'error');
  return report;
}
