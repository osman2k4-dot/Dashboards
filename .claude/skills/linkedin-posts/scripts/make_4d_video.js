// Renders the Orion 4D progress model walkthrough (the 53 s video posted on 24 Nov 2026) as JPEG frames at 25 fps.
// Copy and edit the numbered steps to make a new clip; each step sets the model state, a caption and a camera move.
//
// Needs a local copy of three.js r128, because the demo page loads it from a CDN the container may not reach:
//   cd "$WORK" && npm pack three@0.128.0 && tar xzf three-0.128.0.tgz      (gives package/build/three.min.js)
// Run (about 15 minutes in a cloud container; each frame is a software-rendered screenshot):
//   THREE_JS="$WORK/package/build/three.min.js" OUT_DIR="$WORK/frames" node make_4d_video.js
// Re-render only part of it: add SKIP=<first frame> END=<last frame>; the other frames are kept.
// Encode:
//   ffmpeg -y -framerate 25 -i "$WORK/frames/f%05d.jpg" -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart out.mp4
// Check a contact sheet before encoding:
//   ffmpeg -y -framerate 25 -i "$WORK/frames/f%05d.jpg" -vf "select='not(mod(n\\,60))',scale=480:-1,tile=4x6" -frames:v 1 sheet.jpg
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '../../../..');
const OUT = path.resolve(process.env.OUT_DIR || 'frames');
if (!process.env.THREE_JS) { console.error('Set THREE_JS to a local three.min.js (r128); see the header of this file.'); process.exit(2); }
const SKIP = +(process.env.SKIP || 0), END = +(process.env.END || 1e9);
if (!SKIP) { fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); }
const three = fs.readFileSync(process.env.THREE_JS);
const FPS = 25; let n = 0;
const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const lerp = (a, b, k) => a + (b - a) * k;
const lerpView = (a, b, k) => Object.fromEntries(Object.keys(b).map(p => [p, lerp(a[p], b[p], k)]));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 })).newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.route('**/three.min.js', r => r.fulfill({ body: three, contentType: 'application/javascript' }));
  await page.goto('file://' + path.join(REPO, 'demo-4d-progress-model.html'));
  await page.waitForFunction(() => window.orion, null, { timeout: 120000, polling: 500 });
  await page.addStyleTag({ content: `
    .hint{display:none!important}
    .view{height:calc(100vh - 110px)!important}
    #vcap{position:fixed;left:0;right:0;bottom:0;height:70px;background:#14202E;color:#fff;display:flex;align-items:center;justify-content:center;
      font:600 23px/1.3 'Segoe UI',system-ui,sans-serif;padding:0 50px;text-align:center;z-index:50}
    #vcap b{color:#F6D84C;font-weight:700}
    #vcard{position:fixed;inset:0;z-index:60;background:#F4F6F9;display:none;flex-direction:column;justify-content:center;padding:0 120px;font-family:'Segoe UI',system-ui,sans-serif;color:#14202E}
    #vcard .k{font:700 16px 'Segoe UI';letter-spacing:.14em;color:#1F6FBF;text-transform:uppercase}
    #vcard h1{font:800 60px/1.1 'Segoe UI',system-ui;margin:16px 0 18px;color:#14202E}
    #vcard p{font:500 26px/1.45 'Segoe UI';color:#4A5563;max-width:1050px}
    #vcard .u{margin-top:34px;font:700 24px 'Segoe UI';color:#1F6FBF}
    #vcard .d{margin-top:10px;font:600 17px 'Segoe UI';color:#8a5a12}
    .card{box-shadow:none!important;overflow:visible!important;max-height:none!important}
    .focus li.vhl{outline:3px solid #F6D84C;outline-offset:-1px;background:#fffbe6}` });
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<div id="vcap"></div><div id="vcard"></div>');
    window.cap = h => { document.getElementById('vcap').innerHTML = '<span>' + h + '</span>'; };
    window.card = h => { const c = document.getElementById('vcard'); c.innerHTML = h || ''; c.style.display = h ? 'flex' : 'none'; };
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(600);
  const shot = async () => { if (n >= SKIP && n < END) await page.screenshot({ path: `${OUT}/f${String(n).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 }); n++; };
  const hold = async sec => { const f = `${OUT}/f${String(n - 1).padStart(5, '0')}.jpg`; for (let i = 0; i < Math.round(sec * FPS); i++) { if (n >= SKIP && n < END) fs.copyFileSync(f, `${OUT}/f${String(n).padStart(5, '0')}.jpg`); n++; } };
  const view = v => page.evaluate(v => orion.view(v), v);
  const fly = async (from, to, frames) => { for (let i = 1; i <= frames; i++) { await view(lerpView(from, to, ease(i / frames))); await shot(); } };
  const orbit = async (v, daz, frames, extra) => { for (let i = 0; i < frames; i++) { await view(Object.assign({}, v, { az: v.az + daz * i / frames })); await shot(); } return Object.assign({}, v, { az: v.az + daz }); };
  const H = await page.evaluate(() => Object.assign({}, orion.HOME));
  // choose the test pack to show: MC-01, inside a unit, partly welded, with several spools
  const pick = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('#ovPage .focus li b')].map(b => b.textContent);
    const c = ids.map(id => orion.TPS.find(t => t.id === id)).filter(t => t.erected < t.spools.length);
    c.sort((a, b) => b.scope - a.scope); const t = c[0];
    const sp = t.spools.map(i => orion.SPOOLS[i]).find(s => s.st === 'ER' || s.st === 'FU') || t.spools.map(i => orion.SPOOLS[i]).find(s => s.st !== 'WD') || orion.SPOOLS[t.spools[0]];
    const ci = orion.INST.cyl.findIndex(r => r[12] === sp.i);
    return { tp: t.i, id: t.id, unit: t.unit, pct: Math.round(t.welded / t.scope * 100), ci, n: t.spools.length };
  });
  console.log('pack', JSON.stringify(pick));

  // 1. Title card
  await page.evaluate(() => card(`<div class="k">Project controls · 4D progress model</div><h1>What is done, what remains,<br>and where to focus.</h1>
    <p>A progress report gives the numbers. The 4D model shows where the remaining piping physically is, spool by spool, and which test packs to push first for the MC-01 degreasing loop.</p>
    <div class="d">Demo · fictional plant and data</div>`));
  await shot(); await hold(3.6);
  await page.evaluate(() => card(''));

  // 2. Whole plant, built work by discipline
  let V = Object.assign({}, H, { az: H.az - 0.10 });
  await page.evaluate(() => cap('The whole plant at the cut-off, coloured by discipline: <b>hatched = in progress</b>, cream = not started.'));
  V = await orbit(V, 0.12, 100);

  // 3. Spool status
  await page.evaluate(() => { orion.mode('spool'); cap('Colour by spool status from the site lists: <b>not received, received, erected, fit-up, welded</b>.'); });
  V = await orbit(V, 0.08, 90);

  // 4. Unit 340, the unit furthest behind
  const T340 = await page.evaluate(() => { const c = orion.view(); const t = orion.focus('340'); orion.view(c); return t; });
  await page.evaluate(() => cap('Unit 340 only: <b>yellow and orange = spools still on the ground or not at site</b>. The balance is visible at a glance.'));
  const t340 = Object.assign({}, T340, { az: -0.5, el: 0.72, r: T340.r * 0.62 });
  await fly(V, t340, 40);
  V = await orbit(t340, 0.10, 70);

  // 5. MC-01 loop
  const TMC = Object.assign({}, H, { az: -0.18, el: 0.70 });
  await page.evaluate(() => { orion.focus('mc1'); cap('MC-01 loop: the client\'s priority test packs drawn strong, the rest pale. <b>This is the degreasing scope.</b>'); });
  await fly(V, TMC, 40);
  V = await orbit(TMC, 0.08, 60);

  // 6. Overview: where to focus
  await page.evaluate(() => { orion.tab('ov'); cap('Where to focus: MC-01 test packs ranked by how much is already welded = <b>least work to release a hydrotest</b>.'); });
  await page.waitForTimeout(200); await shot(); await hold(2.4);
  const inList = await page.evaluate(id => { const li = [...document.querySelectorAll('.focus li')].find(l => l.querySelector('b').textContent === id); if (li) { li.classList.add('vhl'); const pg = document.getElementById('ovPage'); pg.scrollTop = Math.max(0, li.offsetTop - pg.clientHeight + li.offsetHeight + 90); } return !!li; }, pick.id);
  console.log('pack in focus list', inList);
  if (!inList) {
    // show it at the top of the list for the demo
    await page.evaluate(id => { const ul = document.querySelector('.focus'); const li = ul.firstElementChild; li.classList.add('vhl'); }, pick.id);
  }
  await shot(); await hold(1.6);

  // 7. Test pack in 3D, then a spool card
  const before = await page.evaluate(() => { orion.tab('4d'); return orion.view(); });
  const TTP = await page.evaluate(i => { orion.mode('spool'); const t = orion.tp(i); return t; }, pick.tp);
  const B = await page.evaluate(i => orion.bounds(i), pick.tp);
  const tpv = Object.assign({}, TTP, { tx: (B[0] + B[1]) / 2, tz: (B[2] + B[3]) / 2, ty: 4, r: Math.min(240, Math.max(70, TTP.r * 0.5)), az: -0.85, el: 0.5 });
  await view(Object.assign({}, V));
  console.log('step7 starts at frame', n);
  await page.evaluate(id => cap('One click: test pack <b>' + id + '</b> lights up. You see which spools to erect and weld next, and where.'), pick.id);
  await fly(V, tpv, 40);
  V = await orbit(tpv, 0.12, 75);
  await page.evaluate(ci => { orion.card('cyl', ci); cap('Click any spool: line, size, status, field joints, test pack and the <b>planned hydrotest from P6</b>.'); }, pick.ci);
  await view(V); await shot(); await hold(3.4);
  await page.evaluate(() => orion.close());

  console.log('step8 starts at frame', n);
  // 8. Hydrotest register
  await page.evaluate(() => { orion.tab('ht'); cap('Hydrotest register: every test pack with welded %, paper status and its <b>planned hydrotest</b>.'); });
  await page.waitForTimeout(200); await shot(); await hold(3.2);

  // 9. Plan summary report
  await page.evaluate(() => { orion.tab('rp'); cap('Plan summary per unit: quantities, rate needed, float, and <b>the three points where a slip moves the end date first</b>.'); });
  await page.waitForTimeout(200); await shot(); await hold(1.6);
  const maxS = await page.evaluate(() => { const p = document.getElementById('rpPage'); return p.scrollHeight - p.clientHeight; });
  for (let i = 1; i <= 45; i++) { await page.evaluate(y => { document.getElementById('rpPage').scrollTop = y; }, Math.round(maxS * ease(i / 45))); await shot(); }
  await hold(2.4);

  // 10. Play the plan
  await page.evaluate(() => { orion.tab('4d'); orion.clear(); orion.reset(); orion.mode('built'); orion.setWeek(0); cap('Press Play: the P6 plan runs forward week by week to <b>MC-01, MC-02 and completion</b>.'); });
  V = Object.assign({}, H, { az: H.az - 0.05 });
  const perWeek = 6;
  for (let w = 0; w <= 30; w++) for (let j = 0; j < perWeek; j++) {
    await page.evaluate(([w, v]) => { orion.setWeek(w); orion.view(v); }, [w, Object.assign({}, V, { az: V.az + (w * perWeek + j) * 0.0007 })]); await shot();
  }
  await hold(1.0);

  // 11. End card
  await page.evaluate(() => card(`<div class="k">4D progress model</div><h1>3D model + site lists + P6,<br>joined spool by spool.</h1>
    <p>Status of every spool, the remaining work in place, test packs ranked for hydrotest, and a plan summary per unit. One HTML file that opens in any browser. Built with Claude Code.</p>
    <div class="u">osman2k4-dot.github.io/Dashboards</div><div class="d">Demo · fictional plant and data</div>`));
  await shot(); await hold(3.8);
  console.log('frames', n, 'seconds', (n / FPS).toFixed(1));
  await browser.close();
})();
