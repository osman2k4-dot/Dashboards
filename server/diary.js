'use strict';
// Pure calculations shared by the API and the diary writer. Mirrors the logic in app-progress-diary.html.

const DAY = 86400000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const parse = (s) => new Date(s + 'T00:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(parse(s).getTime() + n * DAY));
const toSerial = (s) => Math.round((parse(s).getTime() - EXCEL_EPOCH) / DAY);
const fromSerial = (n) => iso(new Date(EXCEL_EPOCH + Math.round(Number(n)) * DAY));
const longDate = (s) => parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtN = (n, d = 0) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtQ = (n) => fmtN(n, Math.abs(n % 1) > 0.001 ? 1 : 0);
const pct = (n) => (n * 100).toFixed(1) + '%';
const shortArea = (an) => String(an).split(' – ')[0];
const sum = (o) => Object.values(o || {}).reduce((s, v) => s + Number(v || 0), 0);

// Accepts an ISO string, an Excel serial, a JS Date or a dd/mm/yyyy text and returns ISO or null.
function toISO(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : iso(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
  if (typeof v === 'number') return v > 20000 && v < 80000 ? fromSerial(v) : null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s); return isNaN(d) ? null : iso(d);
}

function blankArea(by) { return { by: by || '', qty: {}, remarks: {}, manpower: {}, equip: {}, delays: '', hse: '', lookahead: '' }; }
function blankEntry() { return { wxAm: '', wxPm: '', temp: '', hours: '', areas: {} }; }
function areaHasContent(a) { return !!a && (Object.values(a.qty).some(v => v > 0) || Object.values(a.manpower).some(v => v > 0) || Object.values(a.equip).some(v => v > 0) || !!a.delays || !!a.hse || !!a.lookahead); }
function hasContent(e) { return !!e && Object.values(e.areas).some(areaHasContent); }

function restDays(state) { const v = state.project.restDays == null ? '5' : String(state.project.restDays); return v === '' ? [] : v.split(',').map(Number); }
function isRestDay(state, date) { return restDays(state).includes(parse(date).getUTCDay()); }
function lastWorkingDayBefore(state, date) { let d = addDays(date, -1); for (let i = 0; i < 14; i++) { if (state.entries[d] && hasContent(state.entries[d])) return d; d = addDays(d, -1); } return null; }

function qtyOn(e, actId) { let s = 0; if (!e) return 0; for (const an in e.areas) s += Number(e.areas[an].qty[actId] || 0); return s; }
function cumThrough(state, actId, date) { let s = 0; for (const d in state.entries) { if (d <= date) s += qtyOn(state.entries[d], actId); } return s; }
function totalWeight(acts) { return acts.reduce((s, a) => s + Number(a.weight || 0), 0) || 1; }
function actualPct(state, date, acts = state.activities) { const W = totalWeight(acts); return acts.reduce((s, a) => s + Number(a.weight || 0) * Math.min(1, cumThrough(state, a.id, date) / (Number(a.scope) || 1)), 0) / W; }
function planFrac(a, date) { const s = parse(a.planStart), f = parse(a.planFinish), t = parse(date); if (!(s < f)) return t >= f ? 1 : 0; return Math.max(0, Math.min(1, (t - s) / (f - s))); }
function planPct(state, date, acts = state.activities) { const W = totalWeight(acts); return acts.reduce((s, a) => s + Number(a.weight || 0) * planFrac(a, date), 0) / W; }
function dayNo(state, date) { return Math.floor((parse(date) - parse(state.project.start)) / DAY) + 1; }
function disciplines(state) { const seen = []; state.activities.forEach(a => { if (!seen.includes(a.discipline)) seen.push(a.discipline); }); return seen; }
function siteSum(e, key) { let s = 0; if (!e) return 0; for (const an in e.areas) s += sum(e.areas[an][key]); return s; }
function byKey(e, key, list) { const out = {}; list.forEach(t => { out[t] = 0; for (const an in (e ? e.areas : {})) out[t] += Number(e.areas[an][key][t] || 0); }); return out; }
function diaryRef(state, date) { const n = Object.keys(state.entries).filter(d => d <= date && hasContent(state.entries[d])).length; return `${state.project.prefix || 'DD'}-${String(n).padStart(4, '0')}`; }

function diaryModel(state, date) {
  const e = state.entries[date];
  if (!hasContent(e)) return null;
  const prev = lastWorkingDayBefore(state, date);
  const areasIn = state.areas.map(a => a.name).filter(an => areaHasContent(e.areas[an]));
  Object.keys(e.areas).forEach(an => { if (!areasIn.includes(an) && areaHasContent(e.areas[an])) areasIn.push(an); });
  const mp = siteSum(e, 'manpower'), mpPrev = prev ? siteSum(state.entries[prev], 'manpower') : null;
  const act = actualPct(state, date), plan = planPct(state, date), actPrev = prev ? actualPct(state, prev) : 0;
  const discs = disciplines(state).map(disc => {
    const acts = state.activities.filter(a => a.discipline === disc);
    const lines = acts.map(a => {
      const q = qtyOn(e, a.id); if (!(q > 0)) return null;
      const cum = cumThrough(state, a.id, date);
      const parts = areasIn.filter(an => Number(e.areas[an].qty[a.id]) > 0).map(an => ({ area: an, q: Number(e.areas[an].qty[a.id]), rem: e.areas[an].remarks[a.id] || '' }));
      return { a, q, cum, p: Math.min(1, cum / (Number(a.scope) || 1)), parts };
    }).filter(Boolean);
    return { disc, lines, act: actualPct(state, date, acts), plan: planPct(state, date, acts) };
  }).filter(d => d.lines.length);
  const by = [...new Set(areasIn.map(an => e.areas[an].by).filter(Boolean))];
  return { e, prev, mp, mpPrev, act, plan, actPrev, discs, areasIn, by, ref: diaryRef(state, date), n: dayNo(state, date) };
}

function narrative(d) {
  const parts = d.lines.map(l => {
    const where = l.parts.map(p => `${shortArea(p.area)}${p.rem ? ' ' + p.rem : ''}${l.parts.length > 1 ? ' ' + fmtQ(p.q) : ''}`).join(', ');
    return `${l.a.name.toLowerCase()} ${fmtQ(l.q)} ${l.a.unit} at ${where} (cum. ${fmtQ(l.cum)} of ${fmtN(l.a.scope)}, ${pct(l.p)})`;
  });
  const s = parts.join('; ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

// The Daily Diary worksheet as a 2-D array, 8 columns wide.
function diaryRows(state, date) {
  const P = state.project, m = diaryModel(state, date), R = [];
  const W = 8, row = (...c) => { while (c.length < W) c.push(''); R.push(c.slice(0, W).map(v => v == null ? '' : v)); };
  row('SITE DAILY DIARY', '', '', '', m ? m.ref : '');
  row(P.name || '', '', '', '', longDate(date));
  row(`Client: ${P.client || '—'}`, '', '', '', `Contractor: ${P.contractor || '—'}`);
  row();
  if (!m) { row('No entry for this date.'); return R; }
  const { e, mp, act, plan, actPrev, discs, areasIn } = m;
  row('Project day', `Day ${m.n} · Week ${Math.ceil(m.n / 7)}`, 'Working hours', e.hours || '—');
  row('Weather AM / PM', `${e.wxAm || '—'} / ${e.wxPm || '—'}`, 'Max temp', e.temp === '' || e.temp == null ? '—' : `${e.temp} °C`);
  row('Areas reporting', `${areasIn.length} of ${state.areas.length}`, 'Entered by', m.by.join(', '));
  row();
  row('1. PROGRESS SUMMARY');
  row('Overall actual', pct(act), 'Overall planned', pct(plan), 'Variance', (act - plan >= 0 ? '+' : '−') + Math.abs((act - plan) * 100).toFixed(1) + '%', 'Manpower', mp);
  row('Progress today', '+' + (Math.max(0, act - actPrev) * 100).toFixed(2) + '%');
  row();
  row('2. WORK EXECUTED');
  discs.forEach(d => row(`${d.disc}: ${narrative(d)}`));
  row();
  row('Discipline / activity', 'Area · remark', 'Unit', 'Today', 'Cumulative', 'Scope', '%');
  discs.forEach(d => {
    row(d.disc, '', '', '', '', '', pct(d.act));
    d.lines.forEach(l => row(`   ${l.a.name}`, l.parts.map(p => shortArea(p.area) + (p.rem ? ' ' + p.rem : '') + (l.parts.length > 1 ? ' ' + fmtQ(p.q) : '')).join(' | '), l.a.unit, l.q, l.cum, Number(l.a.scope), pct(l.p)));
  });
  row();
  row('3. MANPOWER', ...areasIn.map(shortArea), 'Total');
  const mpT = byKey(e, 'manpower', state.trades);
  state.trades.filter(t => mpT[t] > 0).forEach(t => row(t, ...areasIn.map(an => Number(e.areas[an].manpower[t] || 0)), mpT[t]));
  row('Total', ...areasIn.map(an => sum(e.areas[an].manpower)), mp);
  row();
  row('4. MAJOR EQUIPMENT', ...areasIn.map(shortArea), 'Total');
  const eqT = byKey(e, 'equip', state.equipment);
  state.equipment.filter(t => eqT[t] > 0).forEach(t => row(t, ...areasIn.map(an => Number(e.areas[an].equip[t] || 0)), eqT[t]));
  const notes = (title, key, none) => { row(); row(title); const items = areasIn.filter(an => e.areas[an][key]); if (!items.length) row(none); items.forEach(an => row(shortArea(an), e.areas[an][key])); };
  notes('5. DELAYS, CONSTRAINTS AND INSTRUCTIONS', 'delays', 'None reported.');
  notes('6. HSE', 'hse', 'Not recorded.');
  notes('7. PLAN FOR NEXT WORKING DAY', 'lookahead', 'Not recorded.');
  row();
  row('Prepared by: Planning', 'Reviewed by: Construction Manager', '', 'Acknowledged by: Client Representative');
  return R;
}

// Plain-text diary for email.
function diaryText(state, date) {
  const m = diaryModel(state, date); if (!m) return '';
  const { e, mp, act, plan, discs, areasIn } = m, P = state.project, L = [];
  L.push(`SITE DAILY DIARY  ${m.ref}`, `${P.name}`, `${longDate(date)}  ·  Day ${m.n}, Week ${Math.ceil(m.n / 7)}`,
    `Weather: ${e.wxAm || '—'} / ${e.wxPm || '—'}${e.temp !== '' && e.temp != null ? `, max ${e.temp} °C` : ''}  ·  Hours: ${e.hours || '—'}  ·  Entered by: ${m.by.join(', ') || '—'}`, '',
    '1. PROGRESS SUMMARY', `Overall actual ${pct(act)} vs planned ${pct(plan)} (variance ${((act - plan) * 100).toFixed(1)}%). Manpower ${fmtN(mp)}.`, '', '2. WORK EXECUTED');
  discs.forEach(d => L.push(`${d.disc} (${pct(d.act)} vs plan ${pct(d.plan)}): ${narrative(d)}`));
  const mpT = byKey(e, 'manpower', state.trades), eqT = byKey(e, 'equip', state.equipment);
  L.push('', '3. MANPOWER'); state.trades.filter(t => mpT[t] > 0).forEach(t => L.push(`  ${t}: ${mpT[t]}`)); L.push(`  Total: ${fmtN(mp)}`, '', '4. MAJOR EQUIPMENT');
  state.equipment.filter(t => eqT[t] > 0).forEach(t => L.push(`  ${t}: ${eqT[t]}`));
  const notes = (key, none) => { const items = areasIn.filter(an => e.areas[an][key]).map(an => `  ${shortArea(an)}: ${e.areas[an][key]}`); return items.length ? items : [none]; };
  L.push('', '5. DELAYS / CONSTRAINTS', ...notes('delays', 'None reported.'), '', '6. HSE', ...notes('hse', 'Not recorded.'), '', '7. PLAN FOR NEXT WORKING DAY', ...notes('lookahead', 'Not recorded.'));
  return L.join('\n');
}

// One row for the DiaryLog table.
function diaryLogRow(state, date) {
  const m = diaryModel(state, date); if (!m) return null;
  const { e, mp, act, plan, areasIn } = m;
  return [m.ref, toSerial(date), m.n, Math.ceil(m.n / 7), e.wxAm || '', e.wxPm || '', e.temp === '' || e.temp == null ? '' : Number(e.temp), mp, act, plan, act - plan, areasIn.length,
    areasIn.filter(an => e.areas[an].delays).map(an => `${shortArea(an)}: ${e.areas[an].delays}`).join(' | '),
    areasIn.filter(an => e.areas[an].hse).map(an => `${shortArea(an)}: ${e.areas[an].hse}`).join(' | '),
    m.by.join(', ')];
}

module.exports = { DAY, parse, iso, addDays, toSerial, fromSerial, toISO, longDate, blankArea, blankEntry, areaHasContent, hasContent, isRestDay, lastWorkingDayBefore, qtyOn, cumThrough, actualPct, planPct, dayNo, disciplines, siteSum, diaryModel, diaryRows, diaryText, diaryLogRow, diaryRef, shortArea };
