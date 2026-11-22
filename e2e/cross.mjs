// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

// Cross-browser and device checks on the built demo: Firefox, a touch phone, and the zoom levels
// of WCAG 1.4.4 (200%) and 1.4.10 (400%, reflow, emulated with a narrower viewport).
//   npm run build:demo && npm run e2e:cross
// Environment: E2E_DIR, E2E_HOST (default 127.0.0.1), E2E_PORT (default 4312), E2E_CHROMIUM
// (path to a Chromium/headless shell), E2E_BROWSERS (comma list of chromium,firefox,webkit).

import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwright = require('playwright-core');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const dir = path.resolve(process.env.E2E_DIR ?? 'dist/demo/browser');
const host = process.env.E2E_HOST ?? '127.0.0.1';
const port = Number(process.env.E2E_PORT ?? 4312);
const base = `http://${host}:${port}`;
const wanted = (process.env.E2E_BROWSERS ?? 'chromium,firefox').split(',');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', base).pathname;
  let file = path.join(dir, path.normalize(url));
  if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = path.join(dir, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(port, host, resolve));

const failures = [];
let checks = 0;
async function check(name, fn) {
  checks++;
  try {
    const note = await fn();
    console.log(`ok   ${name}${note ? ` (${note})` : ''}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${String(error.message ?? error).split('\n')[0]}`);
  }
}
const equal = (actual, expected, what) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
async function until(read, expected, what) {
  let actual;
  for (let i = 0; i < 30; i++) {
    actual = await read();
    if (JSON.stringify(actual) === JSON.stringify(expected)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  equal(actual, expected, what);
}
async function axeViolations(page) {
  await page.evaluate(axeSource);
  const result = await page.evaluate(() =>
    globalThis.axe.run(document, { resultTypes: ['violations'] }),
  );
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}
const optionLabels = (page) => page.locator('[role=option] .rr-cp-label').allTextContents();

/** Geometry of the open dialog against the viewport. */
const geometry = (page) =>
  page.evaluate(() => {
    const d = document.querySelector('.rr-cp-dialog').getBoundingClientRect();
    const root = document.documentElement;
    const input = document.querySelector('.rr-cp-dialog input');
    const option = document.querySelector('[role=option]').getBoundingClientRect();
    return {
      left: Math.round(d.left),
      right: Math.round(d.right),
      top: Math.round(d.top),
      bottom: Math.round(d.bottom),
      vw: window.innerWidth,
      vh: window.innerHeight,
      pageScrollsX: root.scrollWidth > root.clientWidth,
      inputFont: parseFloat(getComputedStyle(input).fontSize),
      optionHeight: Math.round(option.height),
    };
  });

function launchOptions(name) {
  if (name === 'chromium' && process.env.E2E_CHROMIUM)
    return { executablePath: process.env.E2E_CHROMIUM };
  return {};
}

const scenarios = [
  {
    id: 'desktop',
    context: { viewport: { width: 1000, height: 640 }, reducedMotion: 'reduce' },
    open: (page) => page.keyboard.press('Control+k'),
    keyboard: true,
  },
  {
    id: 'phone (touch)',
    browsers: ['chromium'],
    context: {
      viewport: { width: 390, height: 780 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    },
    open: (page) => page.locator('button.search').tap(),
    touch: true,
  },
  {
    // 1000x640 at 200% zoom is a 500x320 CSS-pixel viewport
    id: 'zoom 200%',
    context: {
      viewport: { width: 500, height: 320 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    },
    open: (page) => page.keyboard.press('Control+k'),
    fits: true,
  },
  {
    // WCAG 1.4.10 reflow: 1280 wide at 400% is 320 CSS pixels
    id: 'zoom 400% (reflow)',
    context: {
      viewport: { width: 320, height: 256 },
      deviceScaleFactor: 4,
      reducedMotion: 'reduce',
    },
    open: (page) => page.keyboard.press('Control+k'),
    fits: true,
  },
];

for (const name of wanted) {
  let browser;
  try {
    browser = await playwright[name].launch(launchOptions(name));
  } catch (error) {
    failures.push(`${name}: cannot launch`);
    console.log(`FAIL ${name}: cannot launch\n     ${String(error.message).split('\n')[0]}`);
    continue;
  }
  for (const s of scenarios) {
    if (s.browsers && !s.browsers.includes(name)) continue;
    for (const scheme of s.id === 'desktop' ? ['light', 'dark'] : ['light']) {
      const label = `${name} / ${s.id}${s.id === 'desktop' ? ` / ${scheme}` : ''}`;
      const newPage = async () => {
        const context = await browser.newContext({ ...s.context, colorScheme: scheme });
        const page = await context.newPage();
        await page.goto(base + '/', { waitUntil: 'networkidle' });
        return page;
      };

      await check(`${label}: opens and the search is focused`, async () => {
        const page = await newPage();
        await s.open(page);
        await page.locator('.rr-cp-dialog').waitFor();
        await until(
          () => page.locator('.rr-cp-dialog input').evaluate((el) => el === document.activeElement),
          true,
          'input focused',
        );
        await page.context().close();
      });

      if (s.keyboard) {
        await check(`${label}: type, Enter navigates, Esc closes`, async () => {
          const page = await newPage();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          await page.keyboard.type('set');
          await until(async () => (await optionLabels(page))[0], 'Settings', 'first result');
          await page.keyboard.press('Enter');
          await page.waitForURL('**/settings');
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          await page.keyboard.press('Escape');
          await until(() => page.locator('.rr-cp-dialog').count(), 0, 'closed');
          await page.context().close();
        });
        await check(`${label}: ArrowDown moves aria-activedescendant`, async () => {
          const page = await newPage();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          const id = () =>
            page.locator('.rr-cp-dialog input').getAttribute('aria-activedescendant');
          const first = await id();
          await page.keyboard.press('ArrowDown');
          await until(async () => (await id()) !== first, true, 'active option changed');
          await page.context().close();
        });
        await check(`${label}: focus returns to the opener after Esc`, async () => {
          const page = await newPage();
          await page.locator('button.search').focus();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          await page.keyboard.press('Escape');
          await until(() => page.locator('.rr-cp-dialog').count(), 0, 'closed');
          await until(
            () => page.evaluate(() => document.activeElement?.classList.contains('search')),
            true,
            'opener focused',
          );
          await page.context().close();
        });
        await check(`${label}: no axe violations`, async () => {
          const page = await newPage();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          await page.waitForTimeout(300);
          equal(await axeViolations(page), [], 'axe');
          await page.context().close();
        });
      }

      if (s.touch) {
        await check(`${label}: tapping a result runs it`, async () => {
          const page = await newPage();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          await page.locator('[role=option]', { hasText: 'Settings' }).first().tap();
          await page.waitForURL('**/settings');
          await until(() => page.locator('.rr-cp-dialog').count(), 0, 'closed');
          await page.context().close();
        });
        await check(`${label}: tapping outside closes`, async () => {
          const page = await newPage();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          await page.touchscreen.tap(5, 775);
          await until(() => page.locator('.rr-cp-dialog').count(), 0, 'closed');
          await page.context().close();
        });
      }

      if (s.fits || s.touch) {
        await check(`${label}: dialog fits the viewport, no horizontal scroll`, async () => {
          const page = await newPage();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          await page.waitForTimeout(300);
          const g = await geometry(page);
          if (g.left < 0 || g.right > g.vw)
            throw new Error(`dialog x ${g.left}..${g.right} in ${g.vw}`);
          if (g.top < 0 || g.bottom > g.vh)
            throw new Error(`dialog y ${g.top}..${g.bottom} in ${g.vh}`);
          if (g.pageScrollsX) throw new Error('page scrolls horizontally');
          await page.context().close();
          return `dialog ${g.left}..${g.right} of ${g.vw}px`;
        });
        await check(`${label}: the list scrolls and the last result is reachable`, async () => {
          const page = await newPage();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          await page.keyboard.press('End');
          await page.waitForTimeout(200);
          const visible = await page.evaluate(() => {
            const o = document.querySelector('[role=option][aria-selected=true]');
            if (!o) return 'no selected option';
            const r = o.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= window.innerHeight ? true : `${r.top}..${r.bottom}`;
          });
          equal(visible, true, 'last option in view');
          await page.context().close();
        });
        await check(`${label}: no axe violations`, async () => {
          const page = await newPage();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          await page.waitForTimeout(300);
          equal(await axeViolations(page), [], 'axe');
          await page.context().close();
        });
      }

      if (s.touch) {
        await check(`${label}: font size avoids iOS zoom, rows are tappable`, async () => {
          const page = await newPage();
          await s.open(page);
          await page.locator('.rr-cp-dialog').waitFor();
          const g = await geometry(page);
          if (g.inputFont < 16) throw new Error(`input font ${g.inputFont}px (<16 zooms on iOS)`);
          if (g.optionHeight < 40) throw new Error(`row height ${g.optionHeight}px (<40)`);
          await page.context().close();
          return `input ${g.inputFont}px, row ${g.optionHeight}px`;
        });
      }
    }
  }
  await browser.close();
}

server.close();
console.log(
  failures.length
    ? `\n${failures.length} failed of ${checks}`
    : `\n${checks}/${checks} checks passed`,
);
process.exit(failures.length ? 1 : 0);
