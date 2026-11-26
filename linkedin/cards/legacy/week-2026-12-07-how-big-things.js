// Card (1080x1350 at 2x) for the "How Big Things Get Done" post.
const { chromium } = require('playwright');
const OUT = '/home/user/Dashboards/linkedin/assets/week-2026-12-07/01-how-big-things.png';
const CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:#fff;font-family:Inter,system-ui,sans-serif;color:#14202E}
.c{position:absolute;inset:0;padding:84px 80px 190px;display:flex;flex-direction:column}
.k{font-size:22px;font-weight:700;letter-spacing:.12em;color:#1F6FBF;text-transform:uppercase}
h1{font-size:92px;line-height:1.02;font-weight:800;letter-spacing:-.03em;margin-top:24px}
h1 .m{background:linear-gradient(transparent 58%,#F6D84C 58%,#F6D84C 92%,transparent 92%)}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px}
.cap{font-size:24px;font-weight:700;color:#4A5563}
.row{display:grid;grid-template-columns:236px 1fr;gap:22px;align-items:center;margin-top:38px}
.row b{font-size:62px;font-weight:800;letter-spacing:-.03em;line-height:1;white-space:nowrap}
.row .t{font-size:27px;font-weight:600;line-height:1.25;margin-bottom:10px}
.track{height:30px;border-radius:6px;background:#E7EAEF;position:relative;overflow:hidden}
.track i{position:absolute;left:0;top:0;bottom:0;background:#14315F;border-radius:6px}
.row.hot b{color:#B14F00}.row.hot .track i{background:#EC6F0A;min-width:6px}
.src{font-size:19px;color:#4A5563;margin-top:26px}
.box{border-radius:18px;padding:28px 34px;background:#14202E;color:#fff}
.box p{font-size:36px;line-height:1.28;font-weight:800}
.box p b{color:#F6D84C}
.foot{position:absolute;left:80px;right:80px;bottom:64px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid #E3E7EC;padding-top:24px}
.foot b{font-size:26px;font-weight:700;display:block}.foot span{font-size:22px;color:#4A5563}.foot i{font-style:normal;font-size:22px;font-weight:700;color:#1F6FBF}`;
const html = `<div class="c"><div class="k">From a book every planner should read</div>
<h1>Think slow.<br><span class="m">Act fast.</span></h1>
<div class="mid"><div>
<div class="cap">Out of 16,000 projects, how many finished…</div>
<div class="row"><b>&lt;50 %</b><div><div class="t">on budget</div><div class="track"><i style="width:48%"></i></div></div></div>
<div class="row"><b>8.5 %</b><div><div class="t">on budget and on time</div><div class="track"><i style="width:8.5%"></i></div></div></div>
<div class="row hot"><b>0.5 %</b><div><div class="t">on budget, on time, with the promised benefits</div><div class="track"><i style="width:0.5%"></i></div></div></div>
<div class="src">Source: Flyvbjerg &amp; Gardner, How Big Things Get Done (2023)</div></div>
<div class="box"><p>We usually plan fast and build slow. <b>The projects that work do the opposite.</b></p></div></div>
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
