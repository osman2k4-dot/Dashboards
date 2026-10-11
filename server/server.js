'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Graph } = require('./graph');
const { Workbook } = require('./workbook');
const D = require('./diary');

const cfg = process.env;
const log = { info: (m) => console.log(new Date().toISOString(), m), error: (m) => console.error(new Date().toISOString(), m) };

// GRAPH_MOCK=1 runs against an in-memory workbook (see test/mock-graph.js) for local development.
let fetchImpl, mock = null;
if (cfg.GRAPH_MOCK) {
  const { MockGraph } = require('./test/mock-graph'); mock = new MockGraph(); fetchImpl = mock.fetch.bind(mock);
  Object.assign(cfg, { TENANT_ID: cfg.TENANT_ID || 'mock', CLIENT_ID: cfg.CLIENT_ID || 'mock', CLIENT_SECRET: cfg.CLIENT_SECRET || 'mock', SITE_HOSTNAME: cfg.SITE_HOSTNAME || 'contoso.sharepoint.com', SITE_PATH: cfg.SITE_PATH || '/sites/ProjectControls', FILE_PATH: cfg.FILE_PATH || 'Daily Progress/U400-progress-diary.xlsx' });
  log.info('Using the in-memory mock workbook (GRAPH_MOCK=1)');
}
const graph = new Graph(cfg, fetchImpl);
const wb = new Workbook(graph, { log });

const app = express();
app.use(cors({ origin: cfg.ALLOWED_ORIGIN && cfg.ALLOWED_ORIGIN !== '*' ? cfg.ALLOWED_ORIGIN.split(',').map(s => s.trim()) : true }));
app.use(express.json({ limit: '1mb' }));

// The web app is served from the repository root, so planners open http://server/app-progress-diary.html
app.use(express.static(path.join(__dirname, '..'), { extensions: ['html'] }));

const ok = (res, data) => res.json({ ok: true, ...data });
const fail = (res, status, message) => res.status(status).json({ ok: false, error: message });
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

app.use('/api', (req, res, next) => {
  if (req.path === '/health' && req.method === 'GET' && !req.headers['x-api-key']) return next();
  if (cfg.APP_KEY && req.headers['x-api-key'] !== cfg.APP_KEY) return fail(res, 401, 'Wrong or missing access key.');
  next();
});

app.get('/api/health', async (req, res) => {
  try { const f = await graph.file(); ok(res, { file: { name: f.name, webUrl: f.webUrl }, lastWrite: wb.lastWrite, cutoff: cfg.DIARY_CUTOFF || null, mail: !!(cfg.MAIL_FROM && cfg.MAIL_TO), mock: !!mock, keyRequired: !!cfg.APP_KEY }); }
  catch (e) { fail(res, 502, 'Cannot reach the workbook: ' + e.message); }
});

app.get('/api/state', async (req, res) => {
  try { const state = await wb.readState({ fresh: req.query.fresh === '1' }); const f = await graph.file(); ok(res, { state, file: { name: f.name, webUrl: f.webUrl }, lastWrite: wb.lastWrite }); }
  catch (e) { log.error(e.stack || e.message); fail(res, 502, e.message); }
});

app.put('/api/entries/:date/:area', async (req, res) => {
  const { date } = req.params, area = decodeURIComponent(req.params.area);
  if (!isDate(date)) return fail(res, 400, 'Date must be YYYY-MM-DD.');
  const entry = req.body || {};
  try {
    const state = await wb.readState();
    if (!state.areas.some(a => a.name === area)) return fail(res, 400, `Unknown area "${area}". Add it to the Areas table in the workbook first.`);
    const counts = await wb.replaceEntry(date, area, entry);
    wb.scheduleDiary(date);
    ok(res, { date, area, counts, lastWrite: wb.lastWrite });
  } catch (e) { log.error(e.stack || e.message); fail(res, 502, e.message); }
});

app.delete('/api/entries/:date/:area', async (req, res) => {
  const { date } = req.params, area = decodeURIComponent(req.params.area);
  if (!isDate(date)) return fail(res, 400, 'Date must be YYYY-MM-DD.');
  try { const counts = await wb.deleteEntry(date, area); wb.scheduleDiary(date); ok(res, { date, area, counts }); }
  catch (e) { log.error(e.stack || e.message); fail(res, 502, e.message); }
});

app.post('/api/diary/:date/write', async (req, res) => {
  if (!isDate(req.params.date)) return fail(res, 400, 'Date must be YYYY-MM-DD.');
  try { ok(res, await wb.writeDiary(req.params.date)); } catch (e) { log.error(e.stack || e.message); fail(res, 502, e.message); }
});

app.get('/api/diary/:date/text', async (req, res) => {
  if (!isDate(req.params.date)) return fail(res, 400, 'Date must be YYYY-MM-DD.');
  try { const state = await wb.readState(); res.type('text/plain').send(D.diaryText(state, req.params.date) || 'No entry for this date.'); } catch (e) { fail(res, 502, e.message); }
});

async function emailDiary(date) {
  if (!(cfg.MAIL_FROM && cfg.MAIL_TO)) throw new Error('MAIL_FROM and MAIL_TO are not configured.');
  const state = await wb.readState({ fresh: true });
  const text = D.diaryText(state, date); if (!text) throw new Error('No entry for ' + date);
  const f = await graph.file();
  await graph.sendMail({ from: cfg.MAIL_FROM, to: cfg.MAIL_TO, subject: `Site Daily Diary ${D.diaryRef(state, date)} · ${D.longDate(date)}`, text: text + `\n\nWorkbook: ${f.webUrl}` });
  log.info(`[mail] diary ${date} sent to ${cfg.MAIL_TO}`);
}
app.post('/api/diary/:date/email', async (req, res) => {
  if (!isDate(req.params.date)) return fail(res, 400, 'Date must be YYYY-MM-DD.');
  try { await emailDiary(req.params.date); ok(res, { date: req.params.date, to: cfg.MAIL_TO }); } catch (e) { fail(res, 502, e.message); }
});

// Daily cut-off: write today's diary (and email it) once at DIARY_CUTOFF local time.
if (cfg.DIARY_CUTOFF) {
  let lastRun = '';
  setInterval(async () => {
    const now = new Date(); const hm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const today = now.toLocaleDateString('en-CA');
    if (hm !== cfg.DIARY_CUTOFF || lastRun === today) return;
    lastRun = today;
    try { await wb.writeDiary(today); if (cfg.MAIL_FROM && cfg.MAIL_TO) await emailDiary(today); } catch (e) { log.error('[cutoff] ' + e.message); }
  }, 30000);
  log.info(`Daily diary cut-off at ${cfg.DIARY_CUTOFF} (${cfg.TZ || 'server time'})`);
}

const port = Number(cfg.PORT) || 8080;
if (require.main === module) app.listen(port, () => log.info(`Progress diary server on http://localhost:${port}  (app: /app-progress-diary.html)`));
module.exports = { app, wb, graph, mock };
