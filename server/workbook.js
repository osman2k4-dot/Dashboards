'use strict';
// Reads and writes the SharePoint workbook through Graph table operations.
// Every write goes through one queue so planners submitting at the same time never interleave row deletes.

const D = require('./diary');

const T = { project: 'Project', areas: 'Areas', activities: 'Activities', trades: 'Trades', equipment: 'Equipment', progress: 'ProgressLog', manpower: 'ManpowerLog', equip: 'EquipmentLog', notes: 'SiteNotes', diaryLog: 'DiaryLog' };
const SHEET_DIARY = 'Daily Diary', SHEET_SUMMARY = 'Summary';
const DIARY_COLS = 8, DIARY_MAX_ROWS = 300;

class Queue { constructor() { this.p = Promise.resolve(); } run(fn) { const r = this.p.then(fn, fn); this.p = r.catch(() => {}); return r; } }

const sheetRef = (name) => `/worksheets('${encodeURIComponent(name.replace(/'/g, "''"))}')`;
const num = (v) => (v === '' || v == null ? 0 : Number(v) || 0);
const str = (v) => (v == null ? '' : String(v));

class Workbook {
  constructor(graph, { log = console } = {}) { this.g = graph; this.log = log; this.q = new Queue(); this._stateCache = null; this._stateAt = 0; this.lastWrite = null; this.diaryTimers = new Map(); }

  // ---- reading ----
  async rows(table, session) {
    const out = []; let r = await this.g.wb('GET', `/tables/${table}/rows?$select=index,values`, session);
    for (;;) { (r.value || []).forEach(x => out.push({ index: x.index, values: x.values[0] })); if (!r['@odata.nextLink']) break; r = await this.g.call('GET', r['@odata.nextLink'], { session }); }
    return out;
  }

  async readState({ fresh = false } = {}) {
    if (!fresh && this._stateCache && Date.now() - this._stateAt < 20000) return this._stateCache;
    const session = await this.g.openSession(false);
    try {
      const [proj, areas, acts, trades, equipment, prog, mp, eq, notes] = await Promise.all([T.project, T.areas, T.activities, T.trades, T.equipment, T.progress, T.manpower, T.equip, T.notes].map(t => this.rows(t, session)));
      const state = { v: 2, project: { name: '', client: '', contractor: '', location: '', start: '', prefix: 'DD', restDays: '5' }, areas: [], activities: [], trades: [], equipment: [], entries: {} };
      const map = { Project: 'name', Client: 'client', Contractor: 'contractor', Location: 'location', ProjectStart: 'start', DiaryPrefix: 'prefix', RestDays: 'restDays' };
      proj.forEach(r => { const k = str(r.values[0]).trim(), v = r.values[1]; if (k === 'ProjectStart') state.project.start = D.toISO(v) || ''; else if (map[k]) state.project[map[k]] = str(v); });
      areas.forEach(r => { const name = str(r.values[0]).trim(); if (name) state.areas.push({ name, by: str(r.values[1]) }); });
      acts.forEach(r => { const id = str(r.values[0]).trim(); if (!id) return; state.activities.push({ id, discipline: str(r.values[1]), name: str(r.values[2]), unit: str(r.values[3]), scope: num(r.values[4]), weight: num(r.values[5]), planStart: D.toISO(r.values[6]) || state.project.start, planFinish: D.toISO(r.values[7]) || state.project.start }); });
      trades.forEach(r => { const t = str(r.values[0]).trim(); if (t) state.trades.push(t); });
      equipment.forEach(r => { const t = str(r.values[0]).trim(); if (t) state.equipment.push(t); });
      const ent = (d) => state.entries[d] || (state.entries[d] = D.blankEntry());
      const area = (d, an, by) => { const e = ent(d); const a = e.areas[an] || (e.areas[an] = D.blankArea('')); if (by && !a.by) a.by = by; return a; };
      prog.forEach(r => { const [dt, an, id, , , , q, rem, by] = r.values; const d = D.toISO(dt); if (!d || !str(id) || !(num(q) > 0)) return; const a = area(d, str(an) || 'Site', str(by)); a.qty[str(id)] = (a.qty[str(id)] || 0) + num(q); if (str(rem)) a.remarks[str(id)] = str(rem); });
      mp.forEach(r => { const [dt, an, t, n] = r.values; const d = D.toISO(dt); if (!d || !str(t) || !(num(n) > 0)) return; const a = area(d, str(an) || 'Site'); a.manpower[str(t)] = (a.manpower[str(t)] || 0) + num(n); });
      eq.forEach(r => { const [dt, an, t, n] = r.values; const d = D.toISO(dt); if (!d || !str(t) || !(num(n) > 0)) return; const a = area(d, str(an) || 'Site'); a.equip[str(t)] = (a.equip[str(t)] || 0) + num(n); });
      notes.forEach(r => { const [dt, an, am, pm, temp, hours, delays, hse, look, by] = r.values; const d = D.toISO(dt); if (!d) return; const e = ent(d); if (str(am)) e.wxAm = str(am); if (str(pm)) e.wxPm = str(pm); if (temp !== '' && temp != null) e.temp = Number(temp); if (str(hours)) e.hours = str(hours); const a = area(d, str(an) || 'Site', str(by)); a.delays = str(delays); a.hse = str(hse); a.lookahead = str(look); });
      if (!state.project.start) state.project.start = Object.keys(state.entries).sort()[0] || D.iso(new Date());
      this._stateCache = state; this._stateAt = Date.now();
      return state;
    } finally { await this.g.closeSession(session); }
  }
  invalidate() { this._stateCache = null; }

  // ---- writing ----
  // Replaces every row for (date, area) in the four log tables with the submitted entry.
  replaceEntry(date, areaName, entry) {
    return this.q.run(async () => {
      const serial = D.toSerial(date), now = new Date().toISOString();
      const state = await this.readState();
      const actById = Object.fromEntries(state.activities.map(a => [a.id, a]));
      const by = str(entry.by);
      const P = [], M = [], E = [];
      Object.entries(entry.qty || {}).forEach(([id, q]) => { const a = actById[id]; if (!a || !(num(q) > 0)) return; P.push([serial, areaName, id, a.discipline, a.name, a.unit, num(q), str((entry.remarks || {})[id]), by, now]); });
      Object.entries(entry.manpower || {}).forEach(([t, n]) => { if (num(n) > 0) M.push([serial, areaName, t, num(n)]); });
      Object.entries(entry.equip || {}).forEach(([t, n]) => { if (num(n) > 0) E.push([serial, areaName, t, num(n)]); });
      const N = [[serial, areaName, str(entry.wxAm), str(entry.wxPm), entry.temp === '' || entry.temp == null ? '' : Number(entry.temp), str(entry.hours), str(entry.delays), str(entry.hse), str(entry.lookahead), by]];
      const session = await this.g.openSession(true);
      const counts = {};
      try {
        for (const [table, rows] of [[T.progress, P], [T.manpower, M], [T.equip, E], [T.notes, N]]) {
          const existing = await this.rows(table, session);
          // rows for this date+area, plus blank placeholder rows left by the workbook template
          const victims = existing.filter(r => (Math.round(num(r.values[0])) === serial && str(r.values[1]) === areaName) || str(r.values[0]).trim() === '').map(r => r.index).sort((a, b) => b - a);
          for (const idx of victims) await this.g.wb('DELETE', `/tables/${table}/rows/itemAt(index=${idx})`, session);
          if (rows.length) await this.g.wb('POST', `/tables/${table}/rows/add`, session, { index: null, values: rows });
          counts[table] = { removed: victims.length, added: rows.length };
        }
      } finally { await this.g.closeSession(session); }
      this.invalidate(); this.lastWrite = now;
      this.log.info(`[workbook] ${date} ${areaName}: ${JSON.stringify(counts)}`);
      return counts;
    });
  }

  deleteEntry(date, areaName) { return this.replaceEntry(date, areaName, { qty: {}, manpower: {}, equip: {}, delays: '', hse: '', lookahead: '' }).then(async (c) => { await this.q.run(async () => { const s = await this.g.openSession(true); try { const ex = await this.rows(T.notes, s); const serial = D.toSerial(date); for (const r of ex.filter(r => Math.round(num(r.values[0])) === serial && str(r.values[1]) === areaName).sort((a, b) => b.index - a.index)) await this.g.wb('DELETE', `/tables/${T.notes}/rows/itemAt(index=${r.index})`, s); } finally { await this.g.closeSession(s); } this.invalidate(); }); return c; }); }

  // Writes the Daily Diary sheet, the DiaryLog row and the Summary report date for one date.
  writeDiary(date) {
    return this.q.run(async () => {
      const state = await this.readState({ fresh: true });
      const rows = D.diaryRows(state, date);
      const grid = rows.concat(Array.from({ length: Math.max(0, DIARY_MAX_ROWS - rows.length) }, () => Array(DIARY_COLS).fill('')));
      const session = await this.g.openSession(true);
      try {
        const addr = `A1:${String.fromCharCode(64 + DIARY_COLS)}${DIARY_MAX_ROWS}`;
        await this.g.wb('PATCH', `${sheetRef(SHEET_DIARY)}/range(address='${addr}')`, session, { values: grid });
        await this.g.wb('PATCH', `${sheetRef(SHEET_SUMMARY)}/range(address='B1')`, session, { values: [[D.toSerial(date)]] });
        const logRow = D.diaryLogRow(state, date);
        const existing = await this.rows(T.diaryLog, session);
        const serial = D.toSerial(date);
        for (const r of existing.filter(r => Math.round(num(r.values[1])) === serial || str(r.values[1]).trim() === '').sort((a, b) => b.index - a.index)) await this.g.wb('DELETE', `/tables/${T.diaryLog}/rows/itemAt(index=${r.index})`, session);
        if (logRow) await this.g.wb('POST', `/tables/${T.diaryLog}/rows/add`, session, { index: null, values: [logRow] });
      } finally { await this.g.closeSession(session); }
      this.lastWrite = new Date().toISOString();
      this.log.info(`[workbook] diary written for ${date} (${rows.length} rows)`);
      return { date, rows: rows.length, ref: D.diaryRef(state, date) };
    });
  }

  // Debounced: several planners saving within a few seconds produce one diary write.
  scheduleDiary(date, delayMs = 8000) {
    clearTimeout(this.diaryTimers.get(date));
    this.diaryTimers.set(date, setTimeout(() => { this.diaryTimers.delete(date); this.writeDiary(date).catch(e => this.log.error('[workbook] diary write failed: ' + e.message)); }, delayMs));
  }
}

module.exports = { Workbook, T, SHEET_DIARY, SHEET_SUMMARY, DIARY_COLS, DIARY_MAX_ROWS };
