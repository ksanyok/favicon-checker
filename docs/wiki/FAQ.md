# FAQ

## Why does Google show a grey globe instead of my favicon?

Google needs a crawlable, square favicon of at least 48×48 px (a multiple of 48) linked from the home page, and Googlebot must be allowed to fetch both the page and the icon. Run the checker against your home page: a `too-small`, `icon-broken` or `no-link-tag` finding usually explains it. After fixing, it can take days or weeks for search results to update.

## Do I still need /favicon.ico in 2026?

Not strictly, if you declare icons with `<link rel="icon">`. But many tools (RSS readers, some crawlers, older browsers, bookmarking services) request `/favicon.ico` directly without reading your HTML, so serving one avoids 404s in logs and blank icons in those clients.

## What sizes should I provide?

A practical set: `favicon.ico` with 16/32/48 px inside, a 180×180 `apple-touch-icon.png`, and 192×192 + 512×512 PNGs in the web manifest. An SVG icon (`type="image/svg+xml"`) scales to any size in modern browsers.

## Why does it say my declared sizes do not match?

The `sizes` attribute is only a hint; browsers pick an icon based on it before downloading. If you declare `32x32` but serve a 64×64 file, browsers may pick the wrong one and scale it. The checker reads the real size from the file header.

## Does it execute JavaScript?

No. It reads the HTML your server returns, just like most crawlers do. Icons injected only by client-side JavaScript will not be found — and search engines may miss them too.

## Is there a version without installing anything?

Yes — the [online Favicon Checker](https://promopilot.link/en/tools/favicon-checker.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=favicon-checker) does the same check in the browser and shows previews of each icon.

---
[Home](Home) · [Getting started](Getting-Started) · [FAQ](FAQ) · [Troubleshooting](Troubleshooting) · [Online tool](https://promopilot.link/en/tools/favicon-checker.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=favicon-checker)
