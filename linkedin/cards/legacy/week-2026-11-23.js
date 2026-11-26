// Renders five light-theme LinkedIn cards (1080x1350 at 2x) for the week of 23 Nov 2026.
const { chromium } = require('playwright');
const OUT = '/home/user/Dashboards/linkedin/assets/week-2026-11-23';
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:#fff;font-family:Inter,system-ui,sans-serif;color:#14202E}
.c{position:absolute;inset:0;padding:84px 80px 190px;display:flex;flex-direction:column}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.k{font-size:22px;font-weight:700;letter-spacing:.12em;color:#1F6FBF;text-transform:uppercase}
h1{font-size:70px;line-height:1.08;font-weight:800;letter-spacing:-.02em;margin-top:26px}
h1 .m{background:linear-gradient(transparent 58%,#F6D84C 58%,#F6D84C 92%,transparent 92%)}
.sub{font-size:34px;line-height:1.35;color:#4A5563;margin-top:26px;font-weight:500}
.foot{position:absolute;left:80px;right:80px;bottom:64px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid #E3E7EC;padding-top:24px}
.foot b{font-size:26px;font-weight:700;display:block}
.foot span{font-size:22px;color:#4A5563}
.foot i{font-style:normal;font-size:22px;font-weight:700;color:#1F6FBF}
.box{margin-top:44px;border:2px solid #D5DAE1;border-radius:18px;padding:34px 38px;background:#F6F7F9}
.box .t{font-size:24px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4A5563;margin-bottom:18px}
ol{list-style:none;counter-reset:n}
ol li{counter-increment:n;font-size:37px;line-height:1.3;font-weight:600;padding:16px 0 16px 72px;position:relative}
ol li::before{content:counter(n);position:absolute;left:0;top:16px;width:50px;height:50px;border-radius:50%;background:#14202E;color:#fff;font-size:24px;font-weight:700;display:flex;align-items:center;justify-content:center}
.big{font-size:230px;font-weight:800;letter-spacing:-.04em;line-height:.95;margin-top:30px}
.big small{font-size:64px;letter-spacing:0;font-weight:700;color:#4A5563;margin-left:14px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:46px}
.col{border-radius:18px;padding:36px 34px 18px;border:2px solid #D5DAE1}
.col h3{font-size:26px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px}
.col p{font-size:35px;line-height:1.3;font-weight:600;margin-bottom:22px}
.col p small{display:block;font-size:27px;font-weight:500;color:#4A5563;margin-top:2px}
.chips{display:flex;gap:18px;margin-top:40px}
.chip{flex:1;text-align:center;border:3px solid #14202E;border-radius:999px;padding:18px 0;font-size:34px;font-weight:700}
.chip.q{background:#14202E;color:#fff}
.note{font-size:30px;color:#4A5563;margin-top:16px;line-height:1.35}
`;
const foot = `<div class="foot"><div><b>Muhammad Usman, PMP</b><span>Project Controls Manager · 18 years in construction</span></div><i>#ProjectControls</i></div>`;
const cards = {
  '01-percent-complete': `<div class="c"><div class="k">Notes from 18 years of progress meetings</div>
    <div class="mid"><div class="big" style="font-size:236px;white-space:nowrap">92 %<small>complete</small></div>
    <div class="sub" style="font-size:52px;color:#14202E;font-weight:700;margin-top:22px">can mean six weeks.<br><span class="m" style="background:linear-gradient(transparent 58%,#F6D84C 58%,#F6D84C 92%,transparent 92%)">It can also mean six months.</span></div>
    <div class="box"><div class="t">Ask for three other numbers</div><ol>
      <li>Remaining hours by system, against the crews on site</li>
      <li>The ten items that gate mechanical completion, by name</li>
      <li>Rate needed vs rate achieved in the last four weeks</li></ol></div></div>${foot}</div>`,
  '02-two-plans': `<div class="c"><div class="k">Notes from 18 years of baselines</div>
    <h1>Two plans: the one we <span class="m">report</span> and the one we <span class="m">build</span>.</h1>
    <div class="mid"><div class="cols" style="margin-top:0">
      <div class="col" style="background:#F6F7F9"><h3 style="color:#4A5563">Reported</h3><p>P6 baseline<small>thousands of activities</small></p><p>Updated monthly<small>actual dates in one batch</small></p><p>Opened by planners<small>and the client's reviewer</small></p></div>
      <div class="col" style="background:#FFF8D6;border-color:#E9CF55"><h3 style="color:#8a6a00">Built</h3><p>Excel lookahead<small>three weeks, by supervisor</small></p><p>Updated daily<small>at the site meeting</small></p><p>Opened by site<small>the plan that is followed</small></p></div>
    </div>
    <div class="box" style="margin-top:34px;background:#14202E;border-color:#14202E;color:#fff"><div style="font-size:42px;font-weight:800;line-height:1.25">Make it one plan: the lookahead comes out of the schedule, not typed beside it.</div></div></div>${foot}</div>`,
  '03-float': `<div class="c"><div class="k">Notes from 18 years of delay disputes</div>
    <h1>Who owns <span class="m">the float</span>?</h1>
    <div class="chips"><div class="chip">Contractor</div><div class="chip">Owner</div><div class="chip">Shared</div></div>
    <div class="mid"><div class="box" style="margin-top:0;background:#fff"><div class="t">Float by path, now vs three months ago (working days, illustrative)</div><div id="bars"></div>
    <div class="note">The path that lost the most float this quarter is your <b style="color:#14202E">next critical path</b>.</div></div></div>${foot}</div>`,
  '04-area-vs-system': `<div class="c"><div class="k">Notes from 18 years of mechanical completion</div>
    <h1 style="font-size:62px">Every area is <span class="m">90 % done</span>. The priority loop is not ready for test.</h1>
    <div class="mid"><div id="loop"></div>
    <div class="sub" style="font-size:36px;margin-top:26px">Area progress tells you how much is done.<br><b style="color:#14202E">System progress tells you when you can start up.</b></div></div>${foot}</div>`,
  '05-ai-planner': `<div class="c"><div class="k">Notes from 18 years of planning</div>
    <h1>AI changes <span class="m">what a planner is for</span>.</h1>
    <div class="mid"><div class="cols" style="margin-top:0">
      <div class="col" style="background:#F6F7F9"><h3 style="color:#4A5563">The agent now does</h3><p>Logic and data entry</p><p>Quantities and man-hours</p><p>S-curves and commodity curves</p><p>DCMA checks and reports</p></div>
      <div class="col" style="background:#EAF2FB;border-color:#9CC3EA"><h3 style="color:#1F6FBF">The planner still does</h3><p>Knowing what site knows</p><p>Trade-offs and scenarios</p><p>Defending the date in the meeting</p><p>Asking: what has to be true for this date to hold?</p></div>
    </div><div class="box" style="margin-top:34px;background:#14202E;border-color:#14202E;color:#fff"><div style="font-size:40px;font-weight:800;line-height:1.25">The software part gets easier every month. The judgement part does not.</div></div></div>${foot}</div>`
};
function barsSVG() {
  const P = [['Path A', 42, 38], ['Path B', 35, 31], ['Path C', 36, 6], ['Path D', 22, 18], ['Critical', 0, 0]];
  const W = 840, x0 = 170, sc = (W - x0 - 150) / 45; let s = `<svg width="${W}" height="${P.length * 96 + 50}" font-family="Inter" xmlns="http://www.w3.org/2000/svg">`;
  s += `<rect x="${x0}" y="4" width="22" height="14" fill="#C3CAD4"/><text x="${x0 + 30}" y="17" font-size="20" fill="#4A5563">3 months ago</text><rect x="${x0 + 200}" y="4" width="22" height="14" fill="#14202E"/><text x="${x0 + 230}" y="17" font-size="20" fill="#4A5563">now</text>`;
  P.forEach((p, i) => { const y = 46 + i * 96, hot = p[0] === 'Path C';
    s += `<text x="0" y="${y + 40}" font-size="30" font-weight="${hot ? 800 : 600}" fill="#14202E">${p[0]}</text>`;
    s += `<rect x="${x0}" y="${y + 6}" width="${Math.max(2, p[1] * sc)}" height="26" fill="#C3CAD4"/>`;
    s += `<rect x="${x0}" y="${y + 36}" width="${Math.max(2, p[2] * sc)}" height="32" fill="${hot ? '#EC6F0A' : '#14202E'}"/>`;
    s += `<text x="${x0 + Math.max(2, p[2] * sc) + 12}" y="${y + 61}" font-size="28" font-weight="700" fill="${hot ? '#B14F00' : '#14202E'}">${p[2]}${hot ? '  (lost 30)' : ''}</text>`; });
  return s + '</svg>';
}
function loopSVG() {
  const W = 920, H = 520; let s = `<svg width="${W}" height="${H}" font-family="Inter" xmlns="http://www.w3.org/2000/svg">`;
  const A = [[0, 0, 'Area 1'], [470, 0, 'Area 2'], [0, 270, 'Area 3'], [470, 270, 'Area 4']];
  A.forEach(a => { s += `<rect x="${a[0]}" y="${a[1]}" width="450" height="250" rx="14" fill="#EEF2F6" stroke="#C3CAD4" stroke-width="2"/>`;
    s += `<text x="${a[0] + 24}" y="${a[1] + 46}" font-size="28" font-weight="700" fill="#14202E">${a[2]}</text><text x="${a[0] + 24}" y="${a[1] + 92}" font-size="46" font-weight="800" fill="#1F6FBF">90 %</text>`;
    s += `<rect x="${a[0] + 24}" y="${a[1] + 112}" width="200" height="12" rx="6" fill="#D5DAE1"/><rect x="${a[0] + 24}" y="${a[1] + 112}" width="180" height="12" rx="6" fill="#1F6FBF"/>`; });
  s += `<path d="M 300 150 L 640 150 L 640 400 L 300 400 Z" fill="none" stroke="#F6D84C" stroke-width="22" stroke-linejoin="round"/>`;
  s += `<path d="M 300 150 L 640 150 L 640 400 L 300 400 Z" fill="none" stroke="#14202E" stroke-width="3" stroke-dasharray="14 10"/>`;
  [[470, 150], [640, 270], [470, 400], [300, 270]].forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="16" fill="#EC6F0A" stroke="#fff" stroke-width="4"/>`; });
  s += `<rect x="345" y="172" width="250" height="58" rx="10" fill="#14202E"/><text x="470" y="210" text-anchor="middle" font-size="27" font-weight="700" fill="#fff">Priority loop</text>`;
  s += `<text x="460" y="508" text-anchor="middle" font-size="24" fill="#4A5563">Orange dots: the open 10 % of each area falls on the loop</text>`;
  return s + '</svg>';
}
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  for (const [name, html] of Object.entries(cards)) {
    if (process.env.ONLY && name !== process.env.ONLY) continue;
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`);
    if (name === '03-float') await p.evaluate(s => document.getElementById('bars').innerHTML = s, barsSVG());
    if (name === '04-area-vs-system') await p.evaluate(s => document.getElementById('loop').innerHTML = s, loopSVG());
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${OUT}/${name}.png` });
    console.log('ok', name);
  }
  await b.close();
})();
