// Statistics card (1080x1350 at 2x): why projects are late despite planning.
const { chromium } = require('playwright');
const OUT = '/home/user/Dashboards/linkedin/assets/week-2026-11-30/03-still-late.png';
const CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:#fff;font-family:Inter,system-ui,sans-serif;color:#14202E}
.c{position:absolute;inset:0;padding:80px 76px 180px;display:flex;flex-direction:column}
.k{font-size:22px;font-weight:700;letter-spacing:.12em;color:#1F6FBF;text-transform:uppercase}
h1{font-size:64px;line-height:1.08;font-weight:800;letter-spacing:-.02em;margin-top:22px}
h1 .m{background:linear-gradient(transparent 58%,#F6D84C 58%,#F6D84C 92%,transparent 92%)}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:26px}
.g{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.t{border:2px solid #D5DAE1;border-radius:18px;padding:20px 26px;background:#F6F7F9}
.t .n{font-size:72px;font-weight:800;letter-spacing:-.03em;line-height:1;color:#14202E}
.t .l{font-size:25px;line-height:1.3;font-weight:600;margin-top:10px}
.t .s{font-size:19px;color:#4A5563;margin-top:10px}
.t.hl{background:#FFF8D6;border-color:#E9CF55}
.tag{display:inline-block;font-size:17px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a5c00;background:#F6D84C;border-radius:99px;padding:4px 14px;margin-bottom:12px}
.box{border-radius:18px;padding:26px 32px;background:#14202E;color:#fff}
.box .h{font-size:21px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#F6D84C;margin-bottom:10px}
.box p{font-size:31px;line-height:1.3;font-weight:700}
.foot{position:absolute;left:76px;right:76px;bottom:60px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid #E3E7EC;padding-top:22px}
.foot b{font-size:26px;font-weight:700;display:block}.foot span{font-size:22px;color:#4A5563}.foot i{font-style:normal;font-size:22px;font-weight:700;color:#1F6FBF}`;
const html = `<div class="c"><div class="k">Notes from 18 years in project controls</div>
<h1>More planners. More specifications. <span class="m">Still late.</span></h1>
<div class="mid"><div class="g">
<div class="t"><div class="n">79 %</div><div class="l">of Middle East project professionals surveyed said their projects were delayed in the past year</div><div class="s">PwC Middle East survey, 2025 · 100+ surveyed</div></div>
<div class="t"><div class="n">66 %</div><div class="l">extra time claimed on projects that ended in dispute. A 24-month project asked for about 16 months more</div><div class="s">HKA CRUX, 2026 · 2,410 projects, 122 countries</div></div>
<div class="t hl"><div class="tag">Where the delay starts</div><div class="n">40 %</div><div class="l">of those projects had design failures: errors, late or incomplete design</div><div class="s">HKA CRUX, 2026</div></div>
<div class="t hl"><div class="tag">Where the delay starts</div><div class="n">33 %</div><div class="l">had a change in scope, the biggest single cause</div><div class="s">HKA CRUX, 2026</div></div>
</div>
<div class="box"><div class="h">What planning should do</div><p>Not only report progress. Plan the design and every scope change, with dates and owners.</p></div></div>
<div class="foot"><div><b>Muhammad Usman, PMP</b><span>Project Controls Manager · 18 years in construction</span></div><i>#ProjectControls</i></div></div>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  const gap = await p.evaluate(() => Math.round(document.querySelector('.foot').getBoundingClientRect().top - document.querySelector('.box').getBoundingClientRect().bottom));
  await p.screenshot({ path: OUT }); console.log('ok gap', gap);
  await b.close();
})();
