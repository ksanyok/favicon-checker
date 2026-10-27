#!/usr/bin/env node
import { checkFavicons } from '../src/index.js';

const HELP = `Usage: favicon-checker <url|domain> [options]

Checks every favicon a page declares: <link rel="icon">, apple-touch-icon,
web app manifest icons and /favicon.ico. Reports real pixel sizes and problems.

Options:
  --json            Print the full report as JSON
  --timeout <ms>    Per-request timeout (default 10000)
  --strict          Exit with code 1 on warnings too, not only errors
  -h, --help        Show this help
  -v, --version     Show version

Online version (no install): https://promopilot.link/en/tools/favicon-checker.php?utm_source=github&utm_medium=cli&utm_campaign=tools&utm_content=favicon-checker
`;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

if (flag('-h') || flag('--help') || !args.length) {
  process.stdout.write(HELP);
  process.exit(args.length ? 0 : 2);
}
if (flag('-v') || flag('--version')) {
  const { readFile } = await import('node:fs/promises');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}

const target = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '--timeout');
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const ICON = { error: c(31, '✖'), warning: c(33, '!'), info: c(36, 'i') };

try {
  const report = await checkFavicons(target, { timeout: Number(value('--timeout', 10000)) });
  if (flag('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(c(1, `Favicons for ${report.finalUrl}`));
    if (!report.icons.length) console.log('  (none found)');
    for (const i of report.icons) {
      const size = i.width ? `${i.width}x${i.height}` : '?';
      const status = i.status === 200 ? c(32, '200') : c(31, String(i.status ?? i.error));
      console.log(`  ${status}  ${i.rel.padEnd(22)} ${String(i.format || '-').padEnd(5)} ${size.padEnd(9)} ${i.url}`);
    }
    console.log('');
    if (!report.issues.length) console.log(c(32, '✔ No problems found'));
    for (const issue of report.issues) console.log(`  ${ICON[issue.level]} ${issue.message}`);
  }
  const failing = report.issues.filter((i) => i.level === 'error' || (flag('--strict') && i.level === 'warning'));
  process.exit(failing.length ? 1 : 0);
} catch (err) {
  console.error(c(31, `Error: ${err.message}`));
  process.exit(2);
}
