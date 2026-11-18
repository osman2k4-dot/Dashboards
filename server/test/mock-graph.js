'use strict';
// An in-memory stand-in for the handful of Graph endpoints the server uses, so the whole
// flow can run without a tenant. Tables hold rows as arrays; worksheets hold a sparse grid.

const { T } = require('../workbook');

const HEADERS = {
  [T.project]: ['Key', 'Value'], [T.areas]: ['Area', 'Planner'], [T.activities]: ['ID', 'Discipline', 'Activity', 'Unit', 'Scope', 'Weight', 'PlanStart', 'PlanFinish'],
  [T.trades]: ['Trade'], [T.equipment]: ['Equipment'],
  [T.progress]: ['Date', 'Area', 'ActivityID', 'Discipline', 'Activity', 'Unit', 'Qty', 'Remark', 'EnteredBy', 'UpdatedAt'],
  [T.manpower]: ['Date', 'Area', 'Trade', 'Nos'], [T.equip]: ['Date', 'Area', 'Equipment', 'Units'],
  [T.notes]: ['Date', 'Area', 'WeatherAM', 'WeatherPM', 'MaxTemp', 'Hours', 'Delays', 'HSE', 'Lookahead', 'EnteredBy'],
  [T.diaryLog]: ['Ref', 'Date', 'Day', 'Week', 'WeatherAM', 'WeatherPM', 'MaxTemp', 'Manpower', 'ActualPct', 'PlanPct', 'Variance', 'AreasReporting', 'Delays', 'HSE', 'EnteredBy'],
};

const serial = (iso) => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000);

function seedTables(today) {
  const d = (n) => { const x = new Date(today + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return serial(x.toISOString().slice(0, 10)); };
  const start = d(-30);
  return {
    [T.project]: [['Project', 'Unit 400 Gas Processing Train 2'], ['Client', 'Example Energy Co.'], ['Contractor', 'Demo EPC Contractors LLC'], ['Location', 'Ras Site'], ['ProjectStart', start], ['DiaryPrefix', 'DD-U400'], ['RestDays', '5']],
    [T.areas]: [['Area 410 – Compressor shelter', 'A. Rahman'], ['Area 420 – Pipe rack PR-01', 'S. Pereira'], ['Fab shop', 'K. Nair']],
    [T.activities]: [['A01', 'Civil', 'Concrete pouring', 'm³', 4200, 9, start, d(80)], ['A05', 'Structural steel', 'Steel erection', 'MT', 1850, 12, d(-10), d(120)], ['A10', 'Piping', 'Spool fabrication', 'inch-dia', 38000, 10, d(-20), d(140)], ['A18', 'Scaffolding', 'Scaffold erection', 'm³', 95000, 4, start, d(200)]],
    [T.trades]: [['Civil labour'], ['Erector'], ['Fitter'], ['Welder'], ['Scaffolder'], ['Foreman']],
    [T.equipment]: [['Crawler crane 250T'], ['Mobile crane 50T'], ['Welding machine']],
    [T.progress]: [[d(-1), 'Area 410 – Compressor shelter', 'A01', 'Civil', 'Concrete pouring', 'm³', 120, 'F-401', 'A. Rahman', ''], [d(-1), 'Area 420 – Pipe rack PR-01', 'A05', 'Structural steel', 'Steel erection', 'MT', 18.5, 'Row B', 'S. Pereira', ''], [d(-2), 'Fab shop', 'A10', 'Piping', 'Spool fabrication', 'inch-dia', 410, '', 'K. Nair', '']],
    [T.manpower]: [[d(-1), 'Area 410 – Compressor shelter', 'Civil labour', 40], [d(-1), 'Area 410 – Compressor shelter', 'Foreman', 3], [d(-1), 'Area 420 – Pipe rack PR-01', 'Erector', 22], [d(-2), 'Fab shop', 'Fitter', 12], [d(-2), 'Fab shop', 'Welder', 10]],
    [T.equip]: [[d(-1), 'Area 420 – Pipe rack PR-01', 'Crawler crane 250T', 1], [d(-2), 'Fab shop', 'Welding machine', 8]],
    [T.notes]: [[d(-1), 'Area 410 – Compressor shelter', 'Sunny', 'Sunny', 37, '07:00–18:00', '', 'Toolbox talk: heat stress.', 'Pour F-402.', 'A. Rahman'], [d(-1), 'Area 420 – Pipe rack PR-01', 'Sunny', 'High wind', 37, '07:00–18:00', 'Crane stood down 13:00–15:00, wind.', '', 'Row C erection.', 'S. Pereira']],
    [T.diaryLog]: [],
  };
}

class MockGraph {
  constructor({ today = new Date().toISOString().slice(0, 10), seed = true } = {}) {
    this.tables = seed ? seedTables(today) : Object.fromEntries(Object.keys(HEADERS).map(k => [k, []]));
    this.sheets = { 'Daily Diary': {}, Summary: {} };
    this.calls = [];
    this.sessions = 0;
  }
  cell(sheet, a1) { return (this.sheets[sheet] || {})[a1]; }

  async fetch(url, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    const u = new URL(url);
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    this.calls.push({ method, path: u.pathname });
    const json = (status, data) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => data, text: async () => JSON.stringify(data) });

    if (u.hostname === 'login.microsoftonline.com') return json(200, { access_token: 'mock-token', expires_in: 3600 });
    const p = decodeURIComponent(u.pathname.replace(/^\/v1\.0/, ''));

    if (/^\/sites\/[^/]+:\//.test(p)) return json(200, { id: 'site1', webUrl: 'https://contoso.sharepoint.com/sites/ProjectControls' });
    if (/^\/sites\/site1\/drive\/root:\//.test(p)) {
      if (method === 'PUT') { this.uploaded = { path: p, size: init.body ? init.body.length : 0 }; return json(201, { id: 'item1', name: p.split('/').pop().replace(':/content', ''), webUrl: 'https://contoso.sharepoint.com/sites/ProjectControls/Shared%20Documents/x.xlsx' }); }
      return json(200, { id: 'item1', name: 'U400-progress-diary.xlsx', webUrl: 'https://contoso.sharepoint.com/sites/ProjectControls/Shared%20Documents/Daily%20Progress/U400-progress-diary.xlsx', parentReference: { driveId: 'drive1' } });
    }
    if (/\/users\/[^/]+\/sendMail$/.test(p)) { this.mail = body; return { ok: true, status: 202, headers: { get: () => null }, json: async () => null, text: async () => '' }; }

    const wbm = p.match(/^\/drives\/drive1\/items\/item1\/workbook(.*)$/);
    if (!wbm) return json(404, { error: { code: 'itemNotFound', message: 'unknown path ' + p } });
    const sub = wbm[1];
    if (sub === '/createSession') { this.sessions++; return json(201, { id: 'sess' + this.sessions }); }
    if (sub === '/closeSession') return json(204, null);

    let m;
    if ((m = sub.match(/^\/tables\/([^/]+)\/rows(?:\?.*)?$/)) && method === 'GET') {
      const t = this.tables[m[1]]; if (!t) return json(404, { error: { code: 'ItemNotFound', message: 'no table ' + m[1] } });
      return json(200, { value: t.map((values, index) => ({ index, values: [values] })) });
    }
    if ((m = sub.match(/^\/tables\/([^/]+)\/rows\/add$/)) && method === 'POST') {
      const t = this.tables[m[1]]; if (!t) return json(404, { error: { code: 'ItemNotFound', message: 'no table ' + m[1] } });
      const w = HEADERS[m[1]].length;
      for (const r of body.values) { if (r.length !== w) return json(400, { error: { code: 'InvalidArgument', message: `row width ${r.length} != ${w} for ${m[1]}` } }); t.push(r.slice()); }
      return json(201, { index: t.length - 1 });
    }
    if ((m = sub.match(/^\/tables\/([^/]+)\/rows\/itemAt\(index=(\d+)\)$/)) && method === 'DELETE') {
      const t = this.tables[m[1]]; const i = Number(m[2]); if (!t || i >= t.length) return json(404, { error: { code: 'ItemNotFound', message: 'no row ' + i } });
      t.splice(i, 1); return json(204, null);
    }
    if ((m = sub.match(/^\/worksheets\('([^']+)'\)\/range\(address='([A-Z]+)(\d+):?([A-Z]*)(\d*)'\)$/)) && method === 'PATCH') {
      const sheet = m[1]; if (!this.sheets[sheet]) return json(404, { error: { code: 'ItemNotFound', message: 'no sheet ' + sheet } });
      const c0 = m[2].charCodeAt(0) - 65, r0 = Number(m[3]), c1 = m[4] ? m[4].charCodeAt(0) - 65 : c0, r1 = m[5] ? Number(m[5]) : r0;
      const rows = body.values; if (rows.length !== r1 - r0 + 1 || rows.some(r => r.length !== c1 - c0 + 1)) return json(400, { error: { code: 'InvalidArgument', message: 'range/values size mismatch' } });
      rows.forEach((r, i) => r.forEach((v, j) => { this.sheets[sheet][String.fromCharCode(65 + c0 + j) + (r0 + i)] = v; }));
      return json(200, { address: m[2] + m[3] });
    }
    return json(404, { error: { code: 'itemNotFound', message: `mock has no handler for ${method} ${sub}` } });
  }
}

module.exports = { MockGraph, HEADERS, seedTables };
