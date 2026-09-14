/* Stamps every local script and stylesheet reference in docs/index.html with
   the current commit, so a browser that cached the last app.js fetches the
   new one the moment the page changes. Run before committing site changes:
     node scripts/stamp.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const v = execSync('git rev-parse --short HEAD').toString().trim() + Date.now().toString(36).slice(-3);
const p = 'docs/index.html';
const s = readFileSync(p, 'utf8').replace(/((?:src|href)="(?!https?:)[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"/g, `$1?v=${v}"`);
writeFileSync(p, s);
console.log('stamped', v);
