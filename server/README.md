# Progress diary server (SharePoint edition)

Area planners enter progress in `app-progress-diary.html`. This small Node service receives each entry, writes it
into the master workbook on SharePoint through the Microsoft Graph API, and writes the **Daily Diary** sheet from
the log tables. Nobody edits the workbook by hand during the day; nobody writes the diary.

```
Area planner (browser) ──PUT /api/entries/{date}/{area}──▶ server ──Graph API──▶ workbook on SharePoint
                                                              │                    ├─ ProgressLog / ManpowerLog / EquipmentLog / SiteNotes (tables)
                                                              │                    ├─ Summary (SUMIFS formulas, report date in B1)
                                                              └─ a few seconds later, and at the cut-off ──▶ Daily Diary sheet + DiaryLog row (+ email)
```

## How the daily cycle works

1. During the day each area planner opens the app, picks their area and enters quantities, manpower, equipment and notes. Every change is sent 1.5 s after the last keystroke. The server **replaces** that planner's rows for the day, so re-entering never duplicates, and other areas' rows are untouched. Submissions from several planners are queued one after another.
2. Eight seconds after the last change for a date, the server rewrites the **Daily Diary** sheet for that date, upserts the **DiaryLog** row and sets **Summary!B1** to that date. Anyone opening the workbook sees the current diary.
3. At `DIARY_CUTOFF` (e.g. 18:30 site time) the server writes the diary for today once more and, if `MAIL_TO` is set, emails the text diary to the distribution list with a link to the workbook.
4. The next morning the dashboard (same app, Dashboard tab) shows the S-curve and discipline progress read from the workbook.

Master data (Activities, Areas, Trades, Equipment, Project) lives in the workbook's tables. Edit them in Excel; the app reads them.

## Setup (about 30 minutes, needs a Microsoft 365 admin for step 1)

### 1. App registration in Microsoft Entra (Azure AD)

1. Entra admin center → **App registrations** → **New registration**. Name: `Progress diary server`. Single tenant. No redirect URI.
2. **Certificates & secrets** → new client secret. Copy the **value** (shown once) into `CLIENT_SECRET`.
3. **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**:
   - `Sites.Selected` (recommended: access to one site only) **or** `Files.ReadWrite.All` (quick: all SharePoint files).
   - `Mail.Send` only if you want the cut-off email.
   - Click **Grant admin consent**.
4. If you chose `Sites.Selected`, an admin grants the app write access to the site once (Graph Explorer or PowerShell):
   ```
   POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions
   { "roles": ["write"], "grantedToIdentities": [ { "application": { "id": "<CLIENT_ID>", "displayName": "Progress diary server" } } ] }
   ```
   Find `{site-id}` with `GET https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/ProjectControls`.
5. Copy **Directory (tenant) ID** and **Application (client) ID** into `.env`.

### 2. The workbook

```bash
cd server
npm install
cp .env.example .env        # fill in TENANT_ID, CLIENT_ID, CLIENT_SECRET, SITE_HOSTNAME, SITE_PATH, FILE_PATH, APP_KEY
node scripts/init-workbook.js --seed backup.json --upload
```

`--seed backup.json` is optional: in the app, Setup → **Copy all data as JSON**, paste into `backup.json`, and the workbook starts with your activities, areas and history. Without it you get an empty workbook with one example activity; edit the Activities / Areas / Trades / Equipment tables in Excel afterwards. `--upload` puts the file at `SITE_PATH` + `FILE_PATH`; without it the file is written next to the script for you to upload yourself.

The workbook has these sheets. The five **log/master tables** are Excel tables with fixed names (`ProgressLog`, `ManpowerLog`, `EquipmentLog`, `SiteNotes`, `DiaryLog`, `Activities`, `Areas`, `Trades`, `Equipment`, `Project`); do not rename them or their columns.

| Sheet | Who writes it | Contents |
|---|---|---|
| Daily Diary | server | The diary for the last written date, laid out for printing |
| Summary | formulas | Type any date in B1: cumulative qty, % complete, plan %, variance per activity, manpower |
| Progress Log, Manpower Log, Equipment Log, Site Notes | server | One row per entry (date, area, …) |
| Diary Log | server | One row per diary: ref, weather, manpower, actual vs plan, delays |
| Activities, Areas, Trades, Equipment, Project | you, in Excel | Master data the app reads |

### 3. Run the server

```bash
npm start                   # http://localhost:8080  → app at /app-progress-diary.html
```

Then in the app: **Setup → SharePoint sync** → Server URL (leave empty when the app is opened from the server itself), Access key = `APP_KEY` → **Connect**. The header pill shows `SharePoint · synced hh:mm`.

Local try-out without a tenant: `npm run dev` starts the server against an in-memory mock workbook with example data. `npm test` runs the end-to-end check against that mock.

### 4. Hosting

Any place that runs Node 18+ and can reach `graph.microsoft.com`:

- **Azure App Service** (natural fit for an M365 shop): create a Linux Web App (Node 20), set the `.env` values as *Application settings*, deploy the repository (`server/` is the app root, but it serves `../app-progress-diary.html`, so deploy the whole repo or use the Dockerfile).
- **Docker**: `docker build -f server/Dockerfile -t progress-diary .` then `docker run --env-file server/.env -p 8080:8080 progress-diary`.
- **A PC on site**: `npm start` in a terminal, or run it as a Windows service with `nssm`.

Put it behind HTTPS (App Service does this for you) and set `ALLOWED_ORIGIN` to the app's URL if you host the app elsewhere (e.g. GitHub Pages).

## API

All `/api` routes need the header `X-Api-Key: <APP_KEY>` (except `GET /api/health` without a key, which only reports whether the workbook is reachable).

| Method & path | What it does |
|---|---|
| `GET /api/health` | Workbook name and link, last write time, whether email and cut-off are configured |
| `GET /api/state` | The whole project as the app's JSON (cached 20 s; `?fresh=1` to bypass) |
| `PUT /api/entries/{date}/{area}` | Replace the area's rows for that date. Body: `{by, wxAm, wxPm, temp, hours, qty:{id:n}, remarks:{id:text}, manpower:{trade:n}, equip:{name:n}, delays, hse, lookahead}` |
| `DELETE /api/entries/{date}/{area}` | Remove the area's rows for that date |
| `POST /api/diary/{date}/write` | Write the Daily Diary sheet, DiaryLog row and Summary!B1 for that date now |
| `GET /api/diary/{date}/text` | The diary as plain text |
| `POST /api/diary/{date}/email` | Email the text diary to `MAIL_TO` |

## Notes and limits

- One server instance at a time: writes are serialised in memory. Run one instance (that is all a project needs).
- Graph's table API deletes rows one at a time; a resubmission with 20 rows takes a few seconds. The app shows "saving…" meanwhile.
- The workbook may be open in Excel while the server writes (Graph edits it server-side), but someone editing the *same* table rows in Excel at the same moment can collide; keep daytime editing to the app and master data edits to the morning.
- Dates in the log tables are real Excel dates (serials with a `yyyy-mm-dd` format), so `SUMIFS` by date works in the Summary sheet.
- If Graph answers `404` on `DELETE .../rows/itemAt(index=n)` in your tenant, change the delete path in `workbook.js` to `/tables/{name}/rows/{n}` (both forms exist in Graph's docs).
