// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

// Checks the project rules that a linter does not cover. Run by CI: `npm run check:rules`.
//  1. every .ts and .css source has the SPDX license header
//  2. the library does not import rxjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sources = ['projects', 'e2e', 'scripts']
  .flatMap(walk)
  .filter((file) => /\.(ts|css|mjs)$/.test(file));

for (const file of sources) {
  if (!readFileSync(file, 'utf8').slice(0, 300).includes('SPDX-License-Identifier: MIT')) {
    problems.push(`${file}: missing the SPDX-License-Identifier: MIT header`);
  }
}

const libRoot = 'projects/ngx-command-palette/src';
const lib = walk(libRoot).filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));

for (const file of lib) {
  if (/from\s+['"]rxjs/.test(readFileSync(file, 'utf8'))) {
    problems.push(`${file}: imports rxjs (the library has no dependency besides Angular)`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`check:rules ok (${sources.length} sources checked)`);
