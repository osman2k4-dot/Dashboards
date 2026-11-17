# Site Progress app

A phone-friendly web form where planners record piping progress. It needs no Google or
Microsoft accounts and nothing in the cloud: it is one Python file that runs on a company
PC or server on the site network.

Planners pick **Area → Spool number → What was done**:

| Activity | Also asks for |
|---|---|
| Field weld | Field joint (FW) no. and welder |
| Erected | – |
| Hold | Hold reason |
| Clear hold | – |

Every entry is saved to a site log. The **Piping 4D dashboard** reads the result automatically,
so the model, S-curve and KPIs update with no further steps.

## Run it

1. Install Python 3.8 or newer (on Windows, from python.org; tick "Add to PATH").
2. Copy this `site-progress-app` folder, plus `demo-piping-4d-playback.html` from the folder
   above it, to the PC that will act as the server.
3. Put your master data in `data/` (files you can edit in Excel; save them as **CSV UTF-8**):
   * `spools.csv`: **Spool ID, Area, Line** (any extra columns are ignored). The dashboard's
     **⬇ Progress template** button exports exactly this from the model.
   * `joints.csv`: **Spool ID, Joint No**. This is optional; without it, planners type the joint number.
   * `welders.csv`: **Name, Stamp, Active**. Set Active to `N` to hide a welder who has left.
   Edits to these files are picked up straight away, with no restart.
4. Start it with a site PIN so only your team can submit entries:
   ```
   set SITE_PIN=4821
   python server.py
   ```
   (Linux/Mac: `SITE_PIN=4821 python3 server.py`)
5. On a phone connected to the site Wi-Fi/LAN, open `http://<server-PC-IP>:8080`, then use
   "Add to Home Screen" so it works like an app.
   * `http://<server-PC-IP>:8080/4d` opens the 4D dashboard, already live-connected.
   * `http://<server-PC-IP>:8080/progress.csv` gives one row per spool (the feed).
   * `http://<server-PC-IP>:8080/log.csv?pin=4821` gives the full weld/erection log for Excel
     (including which welder did which joint).

Starting with existing progress? Load it once before going live:
```
python server.py --import current-progress.csv
```
(columns: Spool ID, Erected date `YYYY-MM-DD`, Hold reason)

## Built-in checks

* Spool, joint and welder must come from the master lists.
* The same joint can't be welded twice, and a spool can't be erected twice.
* The work date can't be in the future, and a name is required.
* A wrong entry can be undone by the same person within 30 minutes. Older corrections are
  done by the planner.
* Entries live in `data/progress.db` (SQLite). **Back this file up daily**, for example by
  copying it to a network drive.

## Making it reachable off site

The server listens on port 8080 of the PC it runs on. To reach it from the office as well as
the site, ask IT to either host it on a company server or VPN, or put it behind your existing
reverse proxy with HTTPS. Do not expose it directly to the internet. The PIN is a simple shared
code, not a full login system.
