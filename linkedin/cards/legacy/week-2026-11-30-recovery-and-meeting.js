// Two light-theme cards (1080x1350 at 2x) for the week of 30 Nov 2026.
const { chromium } = require('playwright');
const OUT = '/home/user/Dashboards/linkedin/assets/week-2026-11-30';
const CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:#fff;font-family:Inter,system-ui,sans-serif;color:#14202E}
.c{position:absolute;inset:0;padding:84px 80px 190px;display:flex;flex-direction:column}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:30px}
.k{font-size:22px;font-weight:700;letter-spacing:.12em;color:#1F6FBF;text-transform:uppercase}
h1{font-size:66px;line-height:1.08;font-weight:800;letter-spacing:-.02em;margin-top:26px}
h1 .m{background:linear-gradient(transparent 58%,#F6D84C 58%,#F6D84C 92%,transparent 92%)}
.box{border-radius:18px;padding:30px 36px;background:#14202E;color:#fff}
.box .t{font-size:22px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#F6D84C;margin-bottom:12px}
.box p{font-size:33px;line-height:1.32;font-weight:700}
.st{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.st div{border:2px solid #E9CF55;background:#FFF8D6;border-radius:14px;padding:16px 18px}
.st b{font-size:54px;font-weight:800;display:block;line-height:1;letter-spacing:-.02em}
.st span{font-size:20px;line-height:1.25;font-weight:600;display:block;margin-top:8px}
.st em{font-size:16px;color:#4A5563;font-style:normal;display:block;margin-top:6px}
.cap{font-size:21px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4A5563;margin-bottom:-14px}
.foot{position:absolute;left:80px;right:80px;bottom:64px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid #E3E7EC;padding-top:24px}
.foot b{font-size:26px;font-weight:700;display:block}.foot span{font-size:22px;color:#4A5563}.foot i{font-style:normal;font-size:22px;font-weight:700;color:#1F6FBF}`;
const foot = `<div class="foot"><div><b>Muhammad Usman, PMP</b><span>Project Controls Manager · 18 years in construction</span></div><i>#ProjectControls</i></div>`;
function gantt() {
  const W = 920, L = 210, end = 700; let s = `<svg width="760" height="388" viewBox="0 0 ${W} 470" font-family="Inter" xmlns="http://www.w3.org/2000/svg">`;
  s += `<text x="0" y="26" font-size="24" font-weight="800" fill="#14202E">Current forecast</text><text x="0" y="246" font-size="24" font-weight="800" fill="#14202E">"Recovery" schedule</text>`;
  const A = [['Structure', 0, 240], ['Piping', 150, 420], ['Hydrotest', 520, 210], ['Pre-comm.', 690, 130]];
  A.forEach((a, i) => { const y = 44 + i * 44; s += `<text x="0" y="${y + 24}" font-size="22" fill="#4A5563">${a[0]}</text><rect x="${L + a[1] * .66}" y="${y + 4}" width="${a[2] * .66}" height="28" rx="5" fill="#7DBDEB"/>`; });
  const B = [['Structure', 0, 200, ''], ['Piping', 70, 330, '−30 %, same crews'], ['Hydrotest', 330, 240, 'parallel on the same steel'], ['Pre-comm.', 575, 125, '']];
  B.forEach((b, i) => { const y = 264 + i * 44; s += `<text x="0" y="${y + 24}" font-size="22" fill="#4A5563">${b[0]}</text><rect x="${L + b[1] * .66}" y="${y + 4}" width="${b[2] * .66}" height="28" rx="5" fill="#EC6F0A"/>`;
    if (b[3]) s += `<text x="${L + (b[1] + b[2]) * .66 + 12}" y="${y + 26}" font-size="21" font-weight="700" fill="#B14F00" paint-order="stroke" stroke="#fff" stroke-width="10">${b[3]}</text>`; });
  const xe = L + end * .66 - 4; s += `<line x1="${xe}" y1="36" x2="${xe}" y2="452" stroke="#14202E" stroke-width="3" stroke-dasharray="10 7"/>`;
  s += `<rect x="${xe - 120}" y="424" width="240" height="40" rx="8" fill="#14202E"/><text x="${xe}" y="451" text-anchor="middle" font-size="21" font-weight="700" fill="#fff">Contract end date</text>`;
  s += `<text x="${L + 820 * .66 + 6}" y="${44 + 3 * 44 + 26}" font-size="21" font-weight="700" fill="#1F6FBF">+3 months late</text>`;
  return s + '</svg>';
}
function meeting() {
  const W = 920; let s = `<svg width="${W}" height="330" font-family="Inter" xmlns="http://www.w3.org/2000/svg">`;
  const sc = 920 / 100;
  s += `<text x="0" y="30" font-size="26" font-weight="800" fill="#14202E">The usual weekly meeting · 100 minutes</text>`;
  s += `<rect x="0" y="48" width="${90 * sc}" height="70" rx="8" fill="#C3CAD4"/><text x="24" y="93" font-size="26" font-weight="700" fill="#14202E">90 min explaining last week</text>`;
  s += `<rect x="${90 * sc + 4}" y="48" width="${10 * sc - 4}" height="70" rx="8" fill="#14315F"/>`;
  s += `<text x="${W}" y="146" text-anchor="end" font-size="22" font-weight="700" fill="#14315F">10 min on next week</text>`;
  s += `<text x="0" y="214" font-size="26" font-weight="800" fill="#14202E">The meeting that changes next week · 30 minutes</text>`;
  s += `<rect x="0" y="232" width="${5 * sc}" height="70" rx="8" fill="#C3CAD4"/><rect x="${5 * sc + 4}" y="232" width="${25 * sc - 4}" height="70" rx="8" fill="#14315F"/>`;
  s += `<text x="${30 * sc + 18}" y="277" font-size="26" font-weight="700" fill="#14315F">25 min on the next two weeks</text>`;
  s += `<text x="0" y="326" font-size="22" fill="#4A5563">5 min: exceptions only, the report went out the day before</text>`;
  return s + '</svg>';
}
const cards = {
  '01-recovery-schedule': `<div class="c"><div class="k">Notes from 18 years of recovery schedules</div>
    <h1>Same end date. Same crews. <span class="m">Who pays for it?</span></h1>
    <div class="mid" style="gap:24px"><div id="g"></div>
    <div class="cap">The people who must deliver it · construction studies</div>
    <div class="st"><div><b>94 %</b><span>of construction professionals felt stress in the past year</span><em>CIOB, 2025 · UK, 865 surveyed</em></div>
    <div><b>64 %</b><span>of construction workers had anxiety or depression in the past year</span><em>Clayco, 2025 · US</em></div>
    <div><b>Why?</b><span>Too much work and unrealistic deadlines were named most</span><em>CIOB, 2025</em></div></div>
    <div class="box" style="padding:22px 30px"><div class="t">A real recovery also answers</div><p style="font-size:30px">What does it ask of the people, and for how long? And what is the honest date?</p></div></div>${foot}</div>`,
  '02-progress-meeting': `<div class="c"><div class="k">Notes from 18 years of progress meetings</div>
    <h1>The meeting should <span class="m">change next week</span>, not explain last week.</h1>
    <div class="mid"><div id="g"></div><div class="box"><div class="t">What I changed</div><p>Report out the day before. Open with the ten items for the next two weeks, owner by name. Decisions on the screen before anyone leaves.</p></div></div>${foot}</div>`
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  for (const [name, html] of Object.entries(cards)) {
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`);
    await p.evaluate(s => document.getElementById('g').innerHTML = s, name.startsWith('01') ? gantt() : meeting());
    await p.evaluate(() => document.fonts.ready);
    const gap = await p.evaluate(() => Math.round(document.querySelector('.foot').getBoundingClientRect().top - document.querySelector('.box').getBoundingClientRect().bottom));
    await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('ok', name, 'gap', gap);
  }
  await b.close();
})();
