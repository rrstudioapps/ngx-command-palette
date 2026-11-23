// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

// End-to-end and accessibility checks on the built demo, in a real Chromium.
//   npm run build:demo && npm run e2e
// Environment: E2E_DIR (build folder), E2E_HOST (default 127.0.0.1), E2E_PORT (default 4311),
// E2E_CHROMIUM (path to a Chromium/headless shell; by default the one installed for playwright-core).

import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const dir = path.resolve(process.env.E2E_DIR ?? 'dist/demo/browser');
const host = process.env.E2E_HOST ?? '127.0.0.1';
const port = Number(process.env.E2E_PORT ?? 4311);
const base = `http://${host}:${port}`;
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

const browser = await chromium.launch(
  process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
);
const failures = [];
let checks = 0;

async function check(name, fn) {
  checks++;
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${String(error.message ?? error).split('\n')[0]}`);
  }
}
function equal(actual, expected, what) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
/** Polls `read()` until it returns `expected` (the UI updates asynchronously), or fails after 3 s. */
async function until(read, expected, what) {
  let actual;
  for (let i = 0; i < 30; i++) {
    actual = await read();
    if (JSON.stringify(actual) === JSON.stringify(expected)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  equal(actual, expected, what);
}

async function newPage(scheme = 'light') {
  // Reduced motion: axe must not measure colors in the middle of the opening animation
  const context = await browser.newContext({
    viewport: { width: 1000, height: 640 },
    colorScheme: scheme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  return page;
}
const openPalette = async (page) => {
  await page.keyboard.press('Control+k');
  await page.locator('.rr-cp-dialog').waitFor();
};
const input = (page) => page.locator('.rr-cp-dialog input');
const optionLabels = (page) => page.locator('[role=option] .rr-cp-label').allTextContents();
const firstOption = async (page) => (await optionLabels(page))[0];
const pathSteps = async (page) =>
  (await page.locator('.rr-cp-path-current').allTextContents()).map((t) => t.trim());

async function axeViolations(page) {
  await page.evaluate(axeSource);
  const result = await page.evaluate(() =>
    globalThis.axe.run(document, { resultTypes: ['violations'] }),
  );
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

try {
  await check('Ctrl+K opens, focuses the search and Esc closes', async () => {
    const page = await newPage();
    await openPalette(page);
    await until(
      () => input(page).evaluate((el) => el === document.activeElement),
      true,
      'input focused',
    );
    await page.keyboard.press('Escape');
    await until(() => page.locator('.rr-cp-dialog').count(), 0, 'dialog count');
    await page.context().close();
  });

  await check('searching and pressing Enter navigates', async () => {
    const page = await newPage();
    await openPalette(page);
    await page.keyboard.type('set');
    await until(() => firstOption(page), 'Settings', 'first result');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/settings');
    await page.context().close();
  });

  await check('pinned commands come first while the search is empty', async () => {
    const page = await newPage();
    await openPalette(page);
    const groups = await page.locator('.rr-cp-group-label').allTextContents();
    equal(groups[0]?.trim(), 'Pinned', 'first section');
    await page.context().close();
  });

  await check('the ">" prefix lists only actions', async () => {
    const page = await newPage();
    await openPalette(page);
    await page.keyboard.type('>');
    await until(async () => (await optionLabels(page)).includes('Overview'), false, 'route listed');
    equal((await optionLabels(page)).includes('Copy install command'), true, 'action listed');
    await page.context().close();
  });

  await check('the prefix hints list the modes and a click types the prefix', async () => {
    const page = await newPage();
    await openPalette(page);
    const hints = page.locator('.rr-cp-hint');
    equal(
      (await hints.allTextContents()).map((t) => t.replace(/\s+/g, '')),
      ['>Actions', '@Customers'],
      'hints',
    );
    await hints.nth(1).click();
    await until(() => input(page).inputValue(), '@', 'prefix typed');
    await until(() => hints.nth(1).getAttribute('aria-pressed'), 'true', 'pressed');
    equal(await input(page).evaluate((el) => el === document.activeElement), true, 'input focused');
    await hints.nth(1).click();
    await until(() => input(page).inputValue(), '', 'prefix removed');
    await page.context().close();
  });

  await check('a command hotkey works with the palette closed', async () => {
    const page = await newPage();
    const themeLabel = async () => {
      await openPalette(page);
      const label = (await optionLabels(page)).find((l) => l.includes('theme'));
      await page.keyboard.press('Escape');
      await until(() => page.locator('.rr-cp-dialog').count(), 0, 'closed');
      return label;
    };
    const before = await themeLabel();
    await page.keyboard.press('Alt+t');
    const after = await themeLabel();
    equal(!!before && !!after && before !== after, true, `theme label ${before} -> ${after}`);
    await page.context().close();
  });

  await check('a command with a prompt asks for a value, then runs', async () => {
    const page = await newPage();
    await openPalette(page);
    await page.keyboard.type('open cust');
    await until(() => firstOption(page), 'Open customer by id…', 'result');
    await page.keyboard.press('Enter');
    await until(
      () => input(page).getAttribute('placeholder'),
      'Customer id, e.g. 1',
      'placeholder',
    );
    await page.keyboard.press('Enter'); // empty value: nothing happens
    await page.waitForTimeout(200);
    equal(await page.locator('.rr-cp-dialog').count(), 1, 'still open');
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/customers/2');
    await page.context().close();
  });

  await check('a sub-palette opens and Backspace goes back', async () => {
    const page = await newPage();
    await openPalette(page);
    await page.keyboard.type('appear');
    await until(() => firstOption(page), 'Appearance…', 'result');
    await page.keyboard.press('Enter');
    await until(() => pathSteps(page), ['Appearance…'], 'path');
    await page.keyboard.press('Backspace');
    await until(() => pathSteps(page), [], 'path after back');
    await page.context().close();
  });

  const activeStyles = (page) =>
    page.evaluate(() => {
      const active = document.querySelector('.rr-cp-item-active');
      const field = getComputedStyle(document.querySelector('.rr-cp-input'));
      const item = getComputedStyle(active);
      return {
        activeFg: item.color,
        itemPadding: item.padding,
        itemGap: item.columnGap,
        shadow: item.boxShadow === 'none' ? 'none' : 'bar',
        labelWeight: getComputedStyle(active.querySelector('.rr-cp-label')).fontWeight,
        inputHeight: field.height,
        inputBorder: field.borderTopWidth,
        inputBg: field.backgroundColor,
        inputShadow: field.boxShadow,
        inputRadius: field.borderTopLeftRadius,
      };
    });
  async function styledPage(css) {
    const page = await newPage();
    if (css) await page.addStyleTag({ content: css });
    await openPalette(page);
    await page.keyboard.type('set');
    await until(() => firstOption(page), 'Settings', 'search result');
    return page;
  }

  await check("spacing and weight variables keep today's look by default", async () => {
    const page = await styledPage('');
    const got = await activeStyles(page);
    equal(
      [got.itemPadding, got.itemGap, got.shadow, got.labelWeight, got.inputHeight],
      ['6px 10px', '10px', 'bar', '400', '52px'],
      'defaults',
    );
    await page.context().close();
  });

  await check('the new variables also work when set on :root', async () => {
    const page = await styledPage(
      ':root{--rr-cp-item-active-fg:rgb(255,0,0);--rr-cp-item-active-shadow:none;--rr-cp-item-padding:2px 4px;--rr-cp-item-gap:3px;--rr-cp-label-weight:700;--rr-cp-input-height:40px}',
    );
    const got = await activeStyles(page);
    equal(
      [got.activeFg, got.shadow, got.itemPadding, got.itemGap, got.labelWeight, got.inputHeight],
      ['rgb(255, 0, 0)', 'none', '2px 4px', '3px', '700', '40px'],
      'custom values',
    );
    await page.context().close();
  });

  await check('the search field ignores global input rules', async () => {
    const reference = await activeStyles(await styledPage(''));
    const page = await styledPage(
      "input,input[type='text'],.app input{border:1px solid red;background:yellow;box-shadow:0 0 0 3px blue;border-radius:9px;height:80px}",
    );
    const got = await activeStyles(page);
    equal(
      [got.inputBorder, got.inputBg, got.inputShadow, got.inputRadius, got.inputHeight],
      [
        reference.inputBorder,
        reference.inputBg,
        reference.inputShadow,
        reference.inputRadius,
        reference.inputHeight,
      ],
      'search field',
    );
    await page.context().close();
  });

  for (const scheme of ['light', 'dark']) {
    await check(`axe: no violations (${scheme}: empty, search, sub-palette, prompt)`, async () => {
      const page = await newPage(scheme);
      await openPalette(page);
      const found = [...(await axeViolations(page))];
      await input(page).fill('set');
      await until(() => firstOption(page), 'Settings', 'search result');
      await page.waitForTimeout(500);
      found.push(...(await axeViolations(page)));
      await input(page).fill('appear');
      await until(() => firstOption(page), 'Appearance…', 'appearance result');
      await page.keyboard.press('Enter');
      await until(() => pathSteps(page), ['Appearance…'], 'sub-palette path');
      found.push(...(await axeViolations(page)));
      await page.keyboard.press('Backspace');
      await until(() => pathSteps(page), [], 'back to the top');
      await input(page).fill('open cust');
      await until(() => firstOption(page), 'Open customer by id…', 'prompt result');
      await page.keyboard.press('Enter');
      await until(
        () => input(page).getAttribute('placeholder'),
        'Customer id, e.g. 1',
        'prompt step',
      );
      found.push(...(await axeViolations(page)));
      equal(found, [], 'violations');
      await page.context().close();
    });
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${checks - failures.length}/${checks} checks passed`);
process.exit(failures.length ? 1 : 0);
