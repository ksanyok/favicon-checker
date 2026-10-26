# Troubleshooting

## `Error: Page returned HTTP 403`

The site blocks unknown clients (often a WAF or Cloudflare challenge). The checker does not try to bypass protection. Check from a network the site trusts, or use the online version.

## `timeout` for an icon

The icon host is slow or unreachable. Increase the limit with `--timeout 20000`.

## An icon shows as `-` format

The URL returned something that is not an image (often an HTML error page with status 200). Open the icon URL in a browser to see what is actually served.

## `npx github:...` is slow the first time

npx downloads the repository once and caches it. Install globally with `npm install -g` to avoid the delay.

## `SyntaxError: Cannot use import statement`

Your Node.js is too old. Run `node -v`; version 18 or newer is required.

Still stuck? [Open an issue](https://github.com/ksanyok/favicon-checker/issues/new/choose) or try the [online version](https://promopilot.link/en/tools/favicon-checker.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=favicon-checker).

---
[Home](Home) · [Getting started](Getting-Started) · [FAQ](FAQ) · [Troubleshooting](Troubleshooting) · [Online tool](https://promopilot.link/en/tools/favicon-checker.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=favicon-checker)
