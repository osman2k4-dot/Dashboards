'use strict';
// Builds the master workbook with the tables the server expects, optionally seeded from the
// web app's JSON backup, and optionally uploads it to the SharePoint folder in .env.
//
//   node scripts/init-workbook.js                       -> writes ./U400-progress-diary.xlsx (empty tables)
//   node scripts/init-workbook.js --seed backup.json    -> seeded from "Copy all data as JSON" in the app
//   node scripts/init-workbook.js --upload              -> also uploads to SITE_PATH / FILE_PATH
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { HEADERS } = require('../test/mock-graph');
const { T } = require('../workbook');
const D = require('../diary');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const seedPath = opt('--seed'), upload = !!opt('--upload');
const outName = path.basename(process.env.FILE_PATH || 'U400-progress-diary.xlsx');
const outPath = opt('--out') || path.join(process.cwd(), outName);

const SHEETS = { [T.project]: 'Project', [T.areas]: 'Areas', [T.activities]: 'Activities', [T.trades]: 'Trades', [T.equipment]: 'Equipment', [T.progress]: 'Progress Log', [T.manpower]: 'Manpower Log', [T.equip]: 'Equipment Log', [T.notes]: 'Site Notes', [T.diaryLog]: 'Diary Log' };
const WIDTHS = { Date: 12, Area: 30, ActivityID: 11, Discipline: 20, Activity: 26, Unit: 10, Qty: 10, Remark: 30, EnteredBy: 16, UpdatedAt: 22, Trade: 18, Nos: 8, Equipment: 22, Units: 8, WeatherAM: 14, WeatherPM: 14, MaxTemp: 9, Hours: 14, Delays: 50, HSE: 40, Lookahead: 40, Key: 16, Value: 40, Planner: 20, ID: 8, Scope: 12, Weight: 9, PlanStart: 12, PlanFinish: 12, Ref: 13, Day: 6, Week: 6, Manpower: 10, ActualPct: 10, PlanPct: 10, Variance: 10, AreasReporting: 8 };
const DATE_COLS = new Set(['Date', 'PlanStart', 'PlanFinish']);
const PCT_COLS = new Set(['ActualPct', 'PlanPct', 'Variance']);

function rowsFromSeed(state) {
  const serial = D.toSerial, out = Object.fromEntries(Object.keys(HEADERS).map(k => [k, []]));
  const P = state.project || {};
  out[T.project] = [['Project', P.name || ''], ['Client', P.client || ''], ['Contractor', P.contractor || ''], ['Location', P.location || ''], ['ProjectStart', P.start ? serial(P.start) : ''], ['DiaryPrefix', P.prefix || 'DD'], ['RestDays', P.restDays == null ? '5' : String(P.restDays)]];
  out[T.areas] = (state.areas || []).map(a => [a.name, a.by || '']);
  out[T.activities] = (state.activities || []).map(a => [a.id, a.discipline, a.name, a.unit, Number(a.scope) || 0, Number(a.weight) || 0, a.planStart ? serial(a.planStart) : '', a.planFinish ? serial(a.planFinish) : '']);
  out[T.trades] = (state.trades || []).map(t => [t]); out[T.equipment] = (state.equipment || []).map(t => [t]);
  const actById = Object.fromEntries((state.activities || []).map(a => [a.id, a]));
  Object.keys(state.entries || {}).sort().forEach(dt => { const e = state.entries[dt], s = serial(dt);
    Object.entries(e.areas || {}).forEach(([an, ar]) => { if (!D.areaHasContent(ar)) return;
      Object.entries(ar.qty || {}).forEach(([id, q]) => { const a = actById[id]; if (a && Number(q) > 0) out[T.progress].push([s, an, id, a.discipline, a.name, a.unit, Number(q), (ar.remarks || {})[id] || '', ar.by || '', '']); });
      Object.entries(ar.manpower || {}).forEach(([t, n]) => { if (Number(n) > 0) out[T.manpower].push([s, an, t, Number(n)]); });
      Object.entries(ar.equip || {}).forEach(([t, n]) => { if (Number(n) > 0) out[T.equip].push([s, an, t, Number(n)]); });
      out[T.notes].push([s, an, e.wxAm || '', e.wxPm || '', e.temp === '' || e.temp == null ? '' : Number(e.temp), e.hours || '', ar.delays || '', ar.hse || '', ar.lookahead || '', ar.by || '']);
    }); });
  return out;
}

async function build(seedState) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Progress diary server'; wb.calcProperties.fullCalcOnLoad = true;
  const rows = seedState ? rowsFromSeed(seedState) : Object.fromEntries(Object.keys(HEADERS).map(k => [k, []]));
  if (!seedState) { rows[T.project] = [['Project', 'My project'], ['Client', ''], ['Contractor', ''], ['Location', ''], ['ProjectStart', D.toSerial(new Date().toISOString().slice(0, 10))], ['DiaryPrefix', 'DD'], ['RestDays', '5']]; rows[T.areas] = [['Area 1', '']]; rows[T.activities] = [['A01', 'Civil', 'Concrete pouring', 'm³', 1000, 1, D.toSerial(new Date().toISOString().slice(0, 10)), D.toSerial(new Date().toISOString().slice(0, 10)) + 90]]; rows[T.trades] = [['Civil labour']]; rows[T.equipment] = [['Mobile crane 50T']]; }

  for (const table of Object.keys(HEADERS)) {
    const ws = wb.addWorksheet(SHEETS[table]);
    const cols = HEADERS[table];
    cols.forEach((c, i) => { const col = ws.getColumn(i + 1); col.width = WIDTHS[c] || 14; if (DATE_COLS.has(c)) col.numFmt = 'yyyy-mm-dd'; if (PCT_COLS.has(c)) col.numFmt = '0.0%'; });
    // Excel needs at least one data row in a table; a blank row is dropped by the server on the first real write.
    const data = rows[table].length ? rows[table] : [cols.map(() => '')];
    ws.addTable({ name: table, ref: 'A1', headerRow: true, style: { theme: 'TableStyleMedium2', showRowStripes: true }, columns: cols.map(name => ({ name, filterButton: true })), rows: data });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // Summary: formulas over the logs, driven by the report date in B1 (the server sets B1 to the last diary date).
  const ws = wb.addWorksheet('Summary');
  ws.getCell('A1').value = 'Report date'; ws.getCell('B1').value = { formula: 'TODAY()', result: new Date() }; ws.getCell('B1').numFmt = 'yyyy-mm-dd'; ws.getCell('C1').value = '← type any date here; everything below recalculates';
  ws.getCell('A2').value = 'Overall'; ws.getCell('I2').value = 'Actual %'; ws.getCell('J2').value = 'Plan %'; ws.getCell('K2').value = 'Variance'; ws.getCell('O2').value = 'Manpower';
  const head = ['ID', 'Discipline', 'Activity', 'Unit', 'Scope', 'Weight', 'Plan start', 'Plan finish', 'Cum. qty to date', 'Qty on date', 'Cum. %', 'Plan %', 'Weighted actual', 'Weighted plan', 'Manpower on date'];
  head.forEach((h, i) => { ws.getCell(3, i + 1).value = h; ws.getCell(3, i + 1).font = { bold: true }; });
  [8, 22, 28, 10, 12, 8, 12, 12, 16, 12, 10, 10, 14, 14, 16].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const nAct = Math.max(rows[T.activities].length, 1), first = 4, last = 3 + nAct;
  for (let i = 0; i < nAct; i++) {
    const r = first + i, a = rows[T.activities][i] || ['', '', '', '', 0, 0, '', ''];
    ws.getCell(`A${r}`).value = { formula: `IFERROR(INDEX(Activities[ID],${i + 1}),"")`, result: a[0] };
    ws.getCell(`B${r}`).value = { formula: `IFERROR(INDEX(Activities[Discipline],${i + 1}),"")`, result: a[1] };
    ws.getCell(`C${r}`).value = { formula: `IFERROR(INDEX(Activities[Activity],${i + 1}),"")`, result: a[2] };
    ws.getCell(`D${r}`).value = { formula: `IFERROR(INDEX(Activities[Unit],${i + 1}),"")`, result: a[3] };
    ws.getCell(`E${r}`).value = { formula: `IFERROR(INDEX(Activities[Scope],${i + 1}),0)`, result: a[4] };
    ws.getCell(`F${r}`).value = { formula: `IFERROR(INDEX(Activities[Weight],${i + 1}),0)`, result: a[5] };
    ws.getCell(`G${r}`).value = { formula: `IFERROR(INDEX(Activities[PlanStart],${i + 1}),"")`, result: a[6] }; ws.getCell(`G${r}`).numFmt = 'yyyy-mm-dd';
    ws.getCell(`H${r}`).value = { formula: `IFERROR(INDEX(Activities[PlanFinish],${i + 1}),"")`, result: a[7] }; ws.getCell(`H${r}`).numFmt = 'yyyy-mm-dd';
    ws.getCell(`I${r}`).value = { formula: `SUMIFS(ProgressLog[Qty],ProgressLog[ActivityID],$A${r},ProgressLog[Date],"<="&$B$1)`, result: 0 };
    ws.getCell(`J${r}`).value = { formula: `SUMIFS(ProgressLog[Qty],ProgressLog[ActivityID],$A${r},ProgressLog[Date],$B$1)`, result: 0 };
    ws.getCell(`K${r}`).value = { formula: `IF(E${r}>0,MIN(1,I${r}/E${r}),0)`, result: 0 }; ws.getCell(`K${r}`).numFmt = '0.0%';
    ws.getCell(`L${r}`).value = { formula: `IF(AND(ISNUMBER(G${r}),ISNUMBER(H${r}),H${r}>G${r}),MAX(0,MIN(1,($B$1-G${r})/(H${r}-G${r}))),IF(AND(ISNUMBER(H${r}),$B$1>=H${r}),1,0))`, result: 0 }; ws.getCell(`L${r}`).numFmt = '0.0%';
    ws.getCell(`M${r}`).value = { formula: `F${r}*K${r}`, result: 0 };
    ws.getCell(`N${r}`).value = { formula: `F${r}*L${r}`, result: 0 };
  }
  ws.getCell('I2').value = { formula: `IF(SUM(F${first}:F${last})>0,SUM(M${first}:M${last})/SUM(F${first}:F${last}),0)`, result: 0 }; ws.getCell('I2').numFmt = '0.0%';
  ws.getCell('J2').value = { formula: `IF(SUM(F${first}:F${last})>0,SUM(N${first}:N${last})/SUM(F${first}:F${last}),0)`, result: 0 }; ws.getCell('J2').numFmt = '0.0%';
  ws.getCell('K2').value = { formula: 'I2-J2', result: 0 }; ws.getCell('K2').numFmt = '+0.0%;-0.0%';
  ws.getCell(`O${first}`).value = { formula: 'SUMIFS(ManpowerLog[Nos],ManpowerLog[Date],$B$1)', result: 0 };
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  ws.getCell('A2').font = { bold: true }; ws.getCell('I2').font = { bold: true }; ws.getCell('J2').font = { bold: true }; ws.getCell('K2').font = { bold: true };

  const dd = wb.addWorksheet('Daily Diary');
  [34, 34, 12, 10, 12, 10, 8, 8].forEach((w, i) => { dd.getColumn(i + 1).width = w; });
  dd.getCell('A1').value = 'SITE DAILY DIARY'; dd.getCell('A1').font = { bold: true, size: 14 };
  dd.getCell('A3').value = 'Written automatically by the progress server after each entry and at the daily cut-off.';

  wb.worksheets.forEach(s => { if (s.name !== 'Daily Diary') s.getRow(1).font = { bold: true }; });
  // Put the working sheets first for the people who open the file.
  const order = ['Daily Diary', 'Summary', 'Progress Log', 'Manpower Log', 'Equipment Log', 'Site Notes', 'Diary Log', 'Activities', 'Areas', 'Trades', 'Equipment', 'Project'];
  wb.worksheets.forEach(s => { s.orderNo = order.indexOf(s.name); });
  return wb;
}

(async () => {
  let seed = null;
  if (seedPath && seedPath !== true) { seed = JSON.parse(fs.readFileSync(seedPath, 'utf8')); if (!seed.activities || !seed.entries) throw new Error('Seed must be the JSON copied from the app (Setup > Copy all data as JSON).'); }
  const wb = await build(seed);
  await wb.xlsx.writeFile(outPath);
  const size = fs.statSync(outPath).size;
  console.log(`Wrote ${outPath} (${(size / 1024).toFixed(0)} KB)${seed ? `, seeded with ${Object.keys(seed.entries).length} days` : ''}`);
  if (upload) {
    const { Graph } = require('../graph');
    const g = new Graph(process.env);
    const folder = path.dirname(process.env.FILE_PATH || '').replace(/^\.$/, '');
    const item = await g.uploadToSite(folder, outName, fs.readFileSync(outPath));
    console.log(`Uploaded to SharePoint: ${item.webUrl}`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
