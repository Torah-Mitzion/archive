/* Parses every script the browser is served — the public site and the back
 * office alike.
 *
 *   node scripts/check-browser.mjs
 *
 * docs/ has no build step: what is committed is what runs, so a syntax error
 * reaches production intact. One did. A block comment in docs/admin/sb.js
 * quoted PostgREST's empty content-range, whose star-slash closed the comment
 * four words early; sb.js stopped parsing, app.js imports it, nothing ran, and
 * the back office showed "Loading…" to everybody until someone opened the
 * console. Nothing in the repository would have caught it. This does.
 *
 * Modules are parsed as modules and plain scripts as scripts — a file that
 * parses either way passes. Run it before committing anything under docs/. */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';

function scripts(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { out.push(...scripts(path)); continue; }
    if (extname(name) === '.js') out.push(path);
  }
  return out;
}

const tmp = mkdtempSync(join(tmpdir(), 'tmz-check-'));
const parse = (path, ext) => {
  const copy = join(tmp, basename(path, '.js') + ext);
  copyFileSync(path, copy);
  const r = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout + r.stderr).replaceAll(copy, path) };
};

let failed = 0;
for (const path of scripts('docs').sort()) {
  /* A module first: everything here is either one or is old enough to parse as
     both. Only a file that fails both ways is broken. */
  const asModule = parse(path, '.mjs');
  if (asModule.ok || parse(path, '.cjs').ok) { console.log(`ok   ${path}`); continue; }
  failed++;
  console.log(`FAIL ${path}`);
  for (const line of asModule.out.split('\n').slice(0, 6)) if (line.trim()) console.log('     ' + line.trim());
}
rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
