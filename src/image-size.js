// Minimal, dependency-free image header parsers.
// Each parser returns { format, width, height } or null when the bytes do not match.

const u16be = (b, o) => (b[o] << 8) | b[o + 1];
const u16le = (b, o) => b[o] | (b[o + 1] << 8);
const u32be = (b, o) => ((b[o] << 24) >>> 0) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
const u24le = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

function png(b) {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  return { format: 'png', width: u32be(b, 16), height: u32be(b, 20) };
}

function gif(b) {
  if (b.length < 10 || String.fromCharCode(b[0], b[1], b[2]) !== 'GIF') return null;
  return { format: 'gif', width: u16le(b, 6), height: u16le(b, 8) };
}

function ico(b) {
  // ICONDIR: reserved=0, type=1 (icon) or 2 (cursor), count
  if (b.length < 6 || u16le(b, 0) !== 0 || (u16le(b, 2) !== 1 && u16le(b, 2) !== 2)) return null;
  const count = u16le(b, 4);
  if (count === 0 || b.length < 6 + count * 16) return null;
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16;
    sizes.push({ width: b[o] || 256, height: b[o + 1] || 256 });
  }
  const largest = sizes.reduce((a, s) => (s.width * s.height > a.width * a.height ? s : a), sizes[0]);
  return { format: 'ico', width: largest.width, height: largest.height, sizes };
}

function jpeg(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 9 < b.length) {
    if (b[o] !== 0xff) { o++; continue; }
    const marker = b[o + 1];
    const len = u16be(b, o + 2);
    // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { format: 'jpeg', width: u16be(b, o + 7), height: u16be(b, o + 5) };
    }
    o += 2 + len;
  }
  return { format: 'jpeg', width: 0, height: 0 };
}

function webp(b) {
  if (b.length < 30 || String.fromCharCode(...b.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...b.slice(8, 12)) !== 'WEBP') return null;
  const chunk = String.fromCharCode(...b.slice(12, 16));
  if (chunk === 'VP8X') return { format: 'webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (chunk === 'VP8L') {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') return { format: 'webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  return { format: 'webp', width: 0, height: 0 };
}

function svg(b) {
  const head = Buffer.from(b.slice(0, 4096)).toString('utf8');
  const m = head.match(/<svg\b[^>]*>/i);
  if (!m) return null;
  const tag = m[0];
  const attr = (name) => {
    const r = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
    return r ? r[1] : null;
  };
  let width = parseFloat(attr('width')) || 0;
  let height = parseFloat(attr('height')) || 0;
  const vb = attr('viewBox');
  if ((!width || !height) && vb) {
    const p = vb.trim().split(/[\s,]+/).map(Number);
    if (p.length === 4) { width = width || p[2]; height = height || p[3]; }
  }
  return { format: 'svg', width, height, vector: true };
}

/**
 * Detect format and pixel size from the first bytes of an image.
 * @param {Uint8Array} bytes
 * @returns {{format: string, width: number, height: number, sizes?: Array, vector?: boolean} | null}
 */
export function imageSize(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return png(b) || gif(b) || ico(b) || jpeg(b) || webp(b) || svg(b);
}
