# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-26

### Added
- `favicon-checker` CLI with text and JSON output, `--strict` and `--timeout`
- Detection of `<link rel=icon>`, apple-touch-icon, mask-icon, manifest icons and `/favicon.ico`
- Header parsers for PNG, ICO, GIF, JPEG, WebP and SVG (real pixel sizes)
- Rules: missing/broken icons, Google 48 px rule, sizes mismatch, non-square, manifest sizes
- Library API (`checkFavicons`, `audit`, `imageSize`, `parseIconLinks`) and GitHub Action

[1.0.0]: https://github.com/ksanyok/favicon-checker/releases/tag/v1.0.0
