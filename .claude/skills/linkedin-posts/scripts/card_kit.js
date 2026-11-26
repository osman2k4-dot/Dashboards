// Shared look for the LinkedIn cards: 1080 x 1350, light theme, one idea per card.
// A cards module exports a function (kit) => ({ 'file-name': kit.card({...}), ... }).
const INK = '#14202E', MUTED = '#4A5563', ACCENT = '#1F6FBF', MARK = '#F6D84C', HOT = '#EC6F0A';

const CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:#fff;font-family:Inter,system-ui,sans-serif;color:${INK}}
.c{position:absolute;inset:0;padding:84px 80px 190px;display:flex;flex-direction:column}
.k{font-size:22px;font-weight:700;letter-spacing:.12em;color:${ACCENT};text-transform:uppercase}
h1{font-size:66px;line-height:1.08;font-weight:800;letter-spacing:-.02em;margin-top:24px}
h1.big{font-size:92px;line-height:1.02;letter-spacing:-.03em}
.m{background:linear-gradient(transparent 58%,${MARK} 58%,${MARK} 92%,transparent 92%)}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:28px}
.cap{font-size:22px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${MUTED}}
.src{font-size:19px;color:${MUTED}}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.grid.three{grid-template-columns:repeat(3,1fr);gap:16px}
.tile{border:2px solid #D5DAE1;border-radius:18px;padding:20px 26px;background:#F6F7F9}
.tile.hl{background:#FFF8D6;border-color:#E9CF55}
.tile .tag{display:inline-block;font-size:17px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7a5c00;background:${MARK};border-radius:99px;padding:4px 14px;margin-bottom:12px}
.tile .n{font-size:72px;font-weight:800;letter-spacing:-.03em;line-height:1}
.tile .l{font-size:25px;line-height:1.3;font-weight:600;margin-top:10px}
.tile .s{font-size:19px;color:${MUTED};margin-top:10px}
.grid.three .tile{padding:16px 18px;border-radius:14px}
.grid.three .tile .n{font-size:54px}.grid.three .tile .l{font-size:20px;line-height:1.25;margin-top:8px}.grid.three .tile .s{font-size:16px;margin-top:6px}
.box{border-radius:18px;padding:28px 34px;background:${INK};color:#fff}
.box .h{font-size:21px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${MARK};margin-bottom:10px}
.box p{font-size:32px;line-height:1.3;font-weight:700}
.box p b{color:${MARK}}
.list{border:2px solid #D5DAE1;border-radius:18px;padding:30px 36px;background:#F6F7F9}
.list .h{font-size:22px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};margin-bottom:14px}
.list ol{list-style:none;counter-reset:n}
.list li{counter-increment:n;font-size:34px;line-height:1.3;font-weight:600;padding:14px 0 14px 70px;position:relative}
.list li::before{content:counter(n);position:absolute;left:0;top:14px;width:48px;height:48px;border-radius:50%;background:${INK};color:#fff;font-size:24px;font-weight:700;display:flex;align-items:center;justify-content:center}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.col{border-radius:18px;padding:34px 34px 16px;border:2px solid #D5DAE1;background:#F6F7F9}
.col.hl{background:#FFF8D6;border-color:#E9CF55}
.col h3{font-size:26px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px;color:${MUTED}}
.col p{font-size:33px;line-height:1.3;font-weight:600;margin-bottom:20px}
.col p small{display:block;font-size:26px;font-weight:500;color:${MUTED};margin-top:2px}
.row{display:grid;grid-template-columns:236px 1fr;gap:22px;align-items:center;margin-top:36px}
.row b{font-size:62px;font-weight:800;letter-spacing:-.03em;line-height:1;white-space:nowrap}
.row .t{font-size:27px;font-weight:600;line-height:1.25;margin-bottom:10px}
.track{height:30px;border-radius:6px;background:#E7EAEF;position:relative;overflow:hidden}
.track i{position:absolute;left:0;top:0;bottom:0;background:#14315F;border-radius:6px;min-width:6px}
.row.hot b{color:#B14F00}.row.hot .track i{background:${HOT}}
.shot{border:2px solid #D5DAE1;border-radius:16px;overflow:hidden;background:#EEF1F5}
.shot img{display:block;width:100%}
.foot{position:absolute;left:80px;right:80px;bottom:64px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid #E3E7EC;padding-top:24px}
.foot b{font-size:26px;font-weight:700;display:block}.foot span{font-size:22px;color:${MUTED}}.foot i{font-style:normal;font-size:22px;font-weight:700;color:${ACCENT}}`;

const AUTHOR = { name: 'Muhammad Usman, PMP', line: 'Project Controls Manager · 18 years in construction' };

const foot = (tag = '#ProjectControls') =>
  `<div class="foot"><div><b>${AUTHOR.name}</b><span>${AUTHOR.line}</span></div><i>${tag}</i></div>`;

// kicker: small blue line above the title. title: HTML; wrap the key words in mark('...').
// body: HTML for the middle of the card. big: true for a two- or three-word title.
const card = ({ kicker, title, body, tag, big }) =>
  `<div class="c"><div class="k">${kicker}</div><h1${big ? ' class="big"' : ''}>${title}</h1><div class="mid">${body}</div>${foot(tag)}</div>`;

const mark = t => `<span class="m">${t}</span>`;
// A statistic: n = the number, l = what it measures in plain words, s = source and year.
const tile = ({ n, l, s, hl, tag }) =>
  `<div class="tile${hl ? ' hl' : ''}">${tag ? `<div class="tag">${tag}</div>` : ''}<div class="n">${n}</div><div class="l">${l}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
const grid = (tiles, three) => `<div class="grid${three ? ' three' : ''}">${tiles.map(tile).join('')}</div>`;
const box = (heading, text) => `<div class="box">${heading ? `<div class="h">${heading}</div>` : ''}<p>${text}</p></div>`;
const list = (heading, items) => `<div class="list">${heading ? `<div class="h">${heading}</div>` : ''}<ol>${items.map(i => `<li>${i}</li>`).join('')}</ol></div>`;
const cols = (a, b) => `<div class="cols">${[a, b].map(c => `<div class="col${c.hl ? ' hl' : ''}"><h3>${c.h}</h3>${c.items.map(i => `<p>${i}</p>`).join('')}</div>`).join('')}</div>`;
// Shrinking bars: rows = [{ n: '8.5 %', label: 'on budget and on time', pct: 8.5, hot: false }].
const bars = (caption, rows, source) =>
  `<div>${caption ? `<div class="cap" style="text-transform:none;letter-spacing:0;font-size:24px">${caption}</div>` : ''}${rows.map(r =>
    `<div class="row${r.hot ? ' hot' : ''}"><b>${r.n}</b><div><div class="t">${r.label}</div><div class="track"><i style="width:${r.pct}%"></i></div></div></div>`).join('')}${source ? `<div class="src" style="margin-top:26px">${source}</div>` : ''}</div>`;
const shot = (file, style = '') => `<div class="shot" style="${style}"><img src="file://${require('path').resolve(file)}"></div>`;

const page = body => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;

module.exports = { CSS, AUTHOR, INK, MUTED, ACCENT, MARK, HOT, foot, card, mark, tile, grid, box, list, cols, bars, shot, page };
