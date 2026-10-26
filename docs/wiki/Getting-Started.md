# Getting started

## Requirements

Node.js 18 or newer. Nothing else — the package has no dependencies.

## Install

```bash
# run straight from GitHub, nothing to install
npx github:ksanyok/favicon-checker example.com

# or install the CLI globally
npm install -g github:ksanyok/favicon-checker
favicon-checker example.com
```

## First run

### Check a site

```bash
favicon-checker example.com
```

### Full JSON report (pipe into jq or save for later)

```bash
favicon-checker https://example.com --json > favicons.json
```

### Fail on warnings too, e.g. in a deploy pipeline

```bash
favicon-checker https://staging.example.com --strict
```

## Reading the result

Each line is one icon: HTTP status, `rel`, detected format, real size and URL. Below the list come the findings:

- **✖ error** — something is broken (no favicon at all, a 404 icon). Exit code 1.
- **! warning** — works, but not as intended (sizes mismatch, no apple-touch-icon, too small for Google).
- **i info** — nice to have (manifest sizes, heavy files).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No errors (warnings allowed unless `--strict`) |
| 1 | At least one error, or a warning with `--strict` |
| 2 | The page could not be loaded or the arguments are wrong |

Use them in scripts and CI to fail a build when something breaks.

---
[Home](Home) · [Getting started](Getting-Started) · [FAQ](FAQ) · [Troubleshooting](Troubleshooting) · [Online tool](https://promopilot.link/en/tools/favicon-checker.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=favicon-checker)
