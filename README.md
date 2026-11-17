# Dashboards

> **Microsoft 365?** Use [`powerapps/`](powerapps/README.md): a Power Apps phone app on SharePoint lists. The 4D
> dashboard reads it with your company sign-in.
>
> **No cloud accounts at all?** Use [`site-progress-app/`](site-progress-app/README.md): a self-hosted entry form
> (Area → Spool → Field weld / Erected / Hold) that feeds the 4D dashboard directly. Its `/progress.csv` link
> works anywhere the steps below say "published CSV link".

## Piping 4D Playback: live site progress

`demo-piping-4d-playback.html` can take progress from site so the 3D model, S-curve,
KPIs and "behind plan" list update automatically, with nothing to edit in the code.

### How the planner sends progress

1. Open the dashboard and click **⬇ Progress template**. This downloads a CSV with every
   spool in the model and its planned week.
2. Import it into a Google Sheet (File → Import → Upload). The planner keeps one row per spool:

   | Spool ID | Erected date | Hold reason |
   |---|---|---|
   | `6"-P-215001-SP03` | 2026-07-24 | |
   | `8"-CW-259001-SP01` | | Material hold: valves not received |

   * **Spool ID** must match the model (same as the isometric / spool list).
   * **Erected date**: leave blank until the spool is erected. Accepted formats are
     `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-Mon-YY` or an Excel date.
   * **Hold reason** (optional) appears on red spools in the model and in the "behind plan" list.
   * Extra columns (Line, Area, Size and so on) are ignored, so the planner can keep their own working columns.
3. Publish the sheet: **File → Share → Publish to web → select the progress sheet → CSV → Publish**,
   then copy the link.
4. On the dashboard, click **Connect sheet**, paste the link, choose a refresh interval, then click **Go live**.
   The browser remembers the link. To share a live view, add the link to the URL:
   `demo-piping-4d-playback.html?feed=<published CSV link>&every=300`

After that, the planner (or site supervisors, from the Google Sheets phone app) just types dates
into the sheet. Every viewer's dashboard re-reads it on the interval. Spools that changed
since the last check flash green in the model.

* **Data date** = the latest erected date in the sheet.
* Spool IDs that aren't in the model, unreadable dates and future dates are listed in an
  amber warning bar so the planner can fix them.
* If the sheet can't be reached, the dashboard keeps the last good data and tries again.
* With no internet connection, export the sheet as CSV and use **Load CSV** instead.

**Privacy:** "Publish to web" makes the CSV readable by anyone who has the link. If the
progress is confidential, serve the CSV from a private location instead (for example a
SharePoint or OneDrive file, or a Google Apps Script web app restricted to your domain).
Any URL that returns the same three columns as CSV will work.
