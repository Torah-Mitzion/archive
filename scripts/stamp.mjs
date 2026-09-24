/* Stamps every local script and stylesheet reference in docs/index.html with
   the current commit, so a browser that cached the last app.js fetches the
   new one the moment the page changes. Run before committing site changes:
     node scripts/stamp.mjs */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
const v = execSync('git rev-parse --short HEAD').toString().trim() + Date.now().toString(36).slice(-3);
/* The back office is stamped too. Its scripts had no version on them at all,
   so a fix to views.js reached a browser only once the CDN and the browser
   both happened to let go of the old copy — which for the person holding the
   bug report is indistinguishable from not fixing it. */
for (const p of ['docs/index.html', 'docs/admin/index.html']) {
  const s = readFileSync(p, 'utf8').replace(/((?:src|href)="(?!https?:)[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"/g, `$1?v=${v}"`);
  writeFileSync(p, s);
}

/* The back office is a module graph, and stamping the HTML only stamps its
   root. app.js was versioned; the ./views.js it imports was not, so a browser
   holding an old copy of the file where nearly all the back office actually
   lives would keep running it under a fresh app.js — the same bug the line
   above was written to fix, one level down. An import specifier is not an
   attribute, so the HTML rule cannot reach it. */
/* Every module in the folder, not a list someone has to remember to extend:
   the first version of this named three files and missed visits.js, which is
   how the bug it fixes comes back. */
const modules = readdirSync('docs/admin').filter(f => f.endsWith('.js')).map(f => `docs/admin/${f}`);
for (const p of modules) {
  const before = readFileSync(p, 'utf8');
  const after = before.replace(
    /(from\s+'\.\/[A-Za-z0-9_-]+\.js)(\?v=[^']*)?'/g, `$1?v=${v}'`);
  if (after !== before) writeFileSync(p, after);
}
console.log('stamped', v);
