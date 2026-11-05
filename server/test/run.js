'use strict';
// End-to-end check of the server against the in-memory mock workbook: state read, entry replace, diary write, email.
process.env.GRAPH_MOCK = '1'; process.env.APP_KEY = 'test-key'; process.env.MAIL_FROM = 'pc@contoso.com'; process.env.MAIL_TO = 'cm@contoso.com';
const assert = require('assert');
const { app, mock } = require('../server');
const { T } = require('../workbook');

const today = new Date().toISOString().slice(0, 10);
const AREA = 'Area 410 – Compressor shelter';

(async () => {
  const srv = app.listen(0); const port = srv.address().port;
  const api = async (method, path, body, key = 'test-key') => { const r = await fetch(`http://localhost:${port}${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Api-Key': key }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null), text: r.ok ? null : null }; };

  // auth
  assert.strictEqual((await api('GET', '/api/state', null, 'wrong')).status, 401, 'wrong key rejected');
  // state
  let s = await api('GET', '/api/state');
  assert.strictEqual(s.status, 200); const st = s.json.state;
  assert.strictEqual(st.areas.length, 3); assert.strictEqual(st.activities.length, 4); assert.ok(Object.keys(st.entries).length >= 2, 'entries read from logs');
  assert.ok(s.json.file.webUrl.includes('sharepoint'), 'file url');
  // unknown area
  assert.strictEqual((await api('PUT', `/api/entries/${today}/Nowhere`, { qty: {} })).status, 400);
  // first submit
  const entry = { by: 'A. Rahman', wxAm: 'Sunny', wxPm: 'Dust / haze', temp: 39, hours: '07:00–18:00', qty: { A01: 85, A05: 6.5 }, remarks: { A01: 'F-402' }, manpower: { 'Civil labour': 38, Foreman: 3 }, equip: { 'Mobile crane 50T': 1 }, delays: 'Pump breakdown 10:00–11:30.', hse: 'TBT: heat stress.', lookahead: 'Pour F-403.' };
  let r = await api('PUT', `/api/entries/${today}/${encodeURIComponent(AREA)}`, entry);
  assert.strictEqual(r.status, 200, JSON.stringify(r.json));
  assert.deepStrictEqual(r.json.counts[T.progress], { removed: 0, added: 2 });
  const todaySerial = Math.round((Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000);
  assert.strictEqual(mock.tables[T.progress].filter(x => x[0] === todaySerial && x[1] === AREA).length, 2);
  assert.strictEqual(mock.tables[T.notes].filter(x => x[0] === todaySerial && x[1] === AREA).length, 1);
  // resubmit with one activity dropped and another changed: rows replaced, not duplicated
  r = await api('PUT', `/api/entries/${today}/${encodeURIComponent(AREA)}`, { ...entry, qty: { A01: 90 }, manpower: { 'Civil labour': 40 } });
  assert.deepStrictEqual(r.json.counts[T.progress], { removed: 2, added: 1 });
  const prog = mock.tables[T.progress].filter(x => x[0] === todaySerial && x[1] === AREA);
  assert.strictEqual(prog.length, 1); assert.strictEqual(prog[0][6], 90); assert.strictEqual(prog[0][7], 'F-402');
  assert.strictEqual(mock.tables[T.manpower].filter(x => x[0] === todaySerial && x[1] === AREA).length, 1);
  // other area's rows untouched
  const before = mock.tables[T.progress].filter(x => x[1] !== AREA).length;
  await api('PUT', `/api/entries/${today}/${encodeURIComponent('Fab shop')}`, { by: 'K. Nair', qty: { A10: 300 }, manpower: { Fitter: 11 } });
  assert.strictEqual(mock.tables[T.progress].filter(x => x[1] !== AREA).length, before + 1);
  // state reflects both areas today
  s = await api('GET', '/api/state?fresh=1');
  const te = s.json.state.entries[today]; assert.ok(te && te.areas[AREA] && te.areas['Fab shop']); assert.strictEqual(te.areas[AREA].qty.A01, 90); assert.strictEqual(te.wxPm, 'Dust / haze');
  // diary write
  r = await api('POST', `/api/diary/${today}/write`);
  assert.strictEqual(r.status, 200, JSON.stringify(r.json)); assert.ok(r.json.rows > 20);
  assert.strictEqual(mock.cell('Daily Diary', 'A1'), 'SITE DAILY DIARY'); assert.ok(/^DD-U400-\d{4}$/.test(mock.cell('Daily Diary', 'E1')), 'ref in E1: ' + mock.cell('Daily Diary', 'E1'));
  assert.strictEqual(mock.cell('Summary', 'B1'), todaySerial, 'summary report date');
  assert.strictEqual(mock.tables[T.diaryLog].length, 1); assert.strictEqual(mock.tables[T.diaryLog][0][1], todaySerial);
  await api('POST', `/api/diary/${today}/write`); assert.strictEqual(mock.tables[T.diaryLog].length, 1, 'diary log row replaced, not duplicated');
  const diaryText = Object.entries(mock.sheets['Daily Diary']).filter(([k]) => /^A\d+$/.test(k)).map(([, v]) => v).join('\n');
  assert.ok(diaryText.includes('Civil: Concrete pouring 90 m³ at Area 410 F-402'), 'narrative line');
  // text + email
  const t = await fetch(`http://localhost:${port}/api/diary/${today}/text`, { headers: { 'X-Api-Key': 'test-key' } }).then(x => x.text()); assert.ok(t.startsWith('SITE DAILY DIARY'));
  r = await api('POST', `/api/diary/${today}/email`); assert.strictEqual(r.status, 200); assert.ok(mock.mail.message.subject.startsWith('Site Daily Diary'));
  // delete
  r = await api('DELETE', `/api/entries/${today}/${encodeURIComponent('Fab shop')}`); assert.strictEqual(r.status, 200);
  assert.strictEqual(mock.tables[T.progress].filter(x => x[0] === todaySerial && x[1] === 'Fab shop').length, 0);
  assert.strictEqual(mock.tables[T.notes].filter(x => x[0] === todaySerial && x[1] === 'Fab shop').length, 0);

  srv.close();
  console.log('server tests passed:', mock.calls.length, 'graph calls');
  process.exit(0);
})().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
