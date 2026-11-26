#!/usr/bin/env node
// Renders LinkedIn cards to PNG (1080 x 1350 at 2x) from a cards module.
// Usage: node render_cards.js <cards-module.js> <out-dir> [only-this-name]
// The module exports a function: (kit) => ({ '01-name': kit.card({...}), ... }).
// For each card it prints the gap between the content and the footer, so an overflow is caught without opening the image.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const kit = require('./card_kit');

(async () => {
  const [mod, outDir, only] = process.argv.slice(2);
  if (!mod || !outDir) { console.error('usage: node render_cards.js <cards-module.js> <out-dir> [only-this-name]'); process.exit(2); }
  const cards = require(path.resolve(mod))(kit);
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cards-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  let bad = 0;
  for (const [name, body] of Object.entries(cards)) {
    if (only && name !== only) continue;
    // A file on disk, not setContent: local screenshots inside a card only load from a file:// page.
    const html = path.join(tmp, name + '.html');
    fs.writeFileSync(html, kit.page(body));
    await page.goto('file://' + html);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const gap = await page.evaluate(() => {
      const f = document.querySelector('.foot'), m = document.querySelector('.mid');
      if (!f || !m || !m.lastElementChild) return null;
      return Math.round(f.getBoundingClientRect().top - m.lastElementChild.getBoundingClientRect().bottom);
    });
    const out = path.join(outDir, name + '.png');
    await page.screenshot({ path: out });
    if (gap !== null && gap < 24) { bad++; console.log(`${out}  OVERFLOW: content ends ${gap}px from the footer; shorten the card`); }
    else console.log(`${out}  ok${gap === null ? '' : `, ${gap}px above the footer`}`);
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(bad ? 1 : 0);
})();
