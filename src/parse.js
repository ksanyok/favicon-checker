// HTML helpers: find icon-related <link> tags without a DOM library.

const ICON_RELS = ['icon', 'shortcut icon', 'apple-touch-icon', 'apple-touch-icon-precomposed', 'mask-icon', 'fluid-icon'];

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Parse attributes of a single tag string into a lowercase-keyed object. */
export function parseAttributes(tag) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const body = tag.replace(/^<\s*[a-z0-9-]+/i, '').replace(/\/?>$/, '');
  let m;
  while ((m = re.exec(body))) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (!(name in attrs)) attrs[name] = decodeEntities(value);
  }
  return attrs;
}

/** Return the effective base URL, honouring <base href>. */
export function baseUrlOf(html, pageUrl) {
  const m = html.match(/<base\b[^>]*>/i);
  if (m) {
    const { href } = parseAttributes(m[0]);
    if (href) {
      try { return new URL(href, pageUrl).href; } catch { /* ignore invalid base */ }
    }
  }
  return pageUrl;
}

/**
 * Extract icon <link> tags and the web app manifest link from an HTML document.
 * @param {string} html
 * @param {string} pageUrl absolute URL of the document
 */
export function parseIconLinks(html, pageUrl) {
  const head = html.replace(/<!--[\s\S]*?-->/g, '');
  const base = baseUrlOf(head, pageUrl);
  const icons = [];
  let manifest = null;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = parseAttributes(m[0]);
    const rel = (a.rel || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!a.href) continue;
    let url;
    try { url = new URL(a.href.trim(), base).href; } catch { continue; }
    if (rel.split(' ').includes('manifest')) {
      manifest = manifest || url;
      continue;
    }
    const isIcon = ICON_RELS.includes(rel) || rel.split(' ').includes('icon');
    if (!isIcon) continue;
    icons.push({
      rel,
      href: a.href,
      url,
      sizes: a.sizes || null,
      type: a.type || null,
      media: a.media || null,
      source: 'html',
    });
  }
  return { icons, manifest };
}

/** Parse a `sizes` attribute ("16x16 32x32", "any") into [{width,height}] or 'any'. */
export function parseSizes(sizes) {
  if (!sizes) return [];
  if (/\bany\b/i.test(sizes)) return 'any';
  return sizes
    .split(/\s+/)
    .map((s) => s.match(/^(\d+)[xX](\d+)$/))
    .filter(Boolean)
    .map((m) => ({ width: Number(m[1]), height: Number(m[2]) }));
}

/** Extract icons from a parsed web app manifest object. */
export function manifestIcons(manifest, manifestUrl) {
  if (!manifest || !Array.isArray(manifest.icons)) return [];
  return manifest.icons
    .filter((i) => i && typeof i.src === 'string')
    .map((i) => {
      let url = null;
      try { url = new URL(i.src, manifestUrl).href; } catch { /* skip */ }
      return url && {
        rel: 'manifest icon',
        href: i.src,
        url,
        sizes: i.sizes || null,
        type: i.type || null,
        purpose: i.purpose || null,
        source: 'manifest',
      };
    })
    .filter(Boolean);
}
