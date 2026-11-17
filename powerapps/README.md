# Site Progress on Microsoft 365 (Power Apps + SharePoint)

Planners open a **Power Apps** app on their phone (or in Teams) and pick
**Area → Spool → Field weld / Erected / Hold / Clear hold**. Field welds also take the
**FW joint no.** and **welder**. The app writes to SharePoint lists, and the
**Piping 4D dashboard** reads the `Spools` list with the viewer's company login, so the model,
S-curve and KPIs update with no manual steps.

Everything uses standard Microsoft 365 licences: SharePoint and Power Apps for M365 need no
premium connectors.

```
Phone (Power Apps) ──► SharePoint lists ──► 4D dashboard (Microsoft sign-in, Graph API)
  Area/Spool/FW/Welder     Spools  (live status, one row per spool)
                           Joints  (one row per field joint: weld date + welder)
                           SiteLog (every entry, with who entered it: the audit trail)
```

---

## Step 1: Create the SharePoint lists (about 20 minutes, done once)

Create, or reuse, a SharePoint team site for the project, for example *Orion Construction*.
Then, for each file in [`lists/`](lists/): **Site → New → List → From CSV**, upload the file,
and set the column types as shown below. Keep the list names exactly as written, because the
app formulas use them.

| List (file) | Column | Type |
|---|---|---|
| **Areas** (`Areas.csv`) | Title | Single line of text *(area name)* |
| | SortOrder | Number |
| **Spools** (`Spools.csv`) | Title | Single line of text *(Spool ID)* |
| | Area, Line, HoldReason | Single line of text |
| | SizeIn, PlannedWeek, JointsTotal, JointsWelded | Number |
| | ErectedDate, LastUpdate | Date and time → *Date only* |
| **Joints** (`Joints.csv`) | Title | Single line of text *(Joint No, e.g. FW-01)* |
| | SpoolID, Welder | Single line of text |
| | SizeIn | Number |
| | WeldDate | Date and time → *Date only* |
| **Welders** (`Welders.csv`) | Title | Single line of text *(welder name)* |
| | Stamp | Single line of text |
| | Active | Yes/No |
| **SiteLog** (`SiteLog.csv`) | Title | Single line of text *(Spool ID)* |
| | Area, Activity, JointNo, Welder, HoldReason | Single line of text |
| | WorkDate | Date and time → *Date only* |

* In the import screen, make sure the **Title** column of the CSV becomes the list's Title column.
* `SiteLog.csv` has one sample row so the import works. Delete that row afterwards.
* **Index the filter columns** (List settings → Indexed columns): `Spools.Area`, `Joints.SpoolID`.
  This keeps the app fast and avoids the 5,000-item list view threshold.
* The CSVs contain the demo "Orion" spools. For your project, use the 4D dashboard's
  **⬇ Progress template** export (or your spool list from the isometrics / MTO) in the same
  columns. Each joint needs its own row in `Joints`. If a spool has no joints listed, the app
  lets planners type the FW number and adds the joint itself.
* **Permissions:** planners need *Edit* on the site; dashboard viewers only need *Read*.

## Step 2: Build the app (about 15 minutes)

1. Go to **make.powerapps.com → Create → Blank app → Blank canvas app → Phone** layout.
   Name it *Site Progress*.
2. **Data** (left bar) → **Add data → SharePoint** → choose your site → tick
   **Areas, Spools, Joints, Welders, SiteLog**.
3. **Settings → General → Data row limit = 2000.**
4. Select **Screen1** in the Tree view and set its **OnVisible** property to the formula in
   [`formulas/Screen-OnVisible.txt`](formulas/Screen-OnVisible.txt).
5. Open [`SiteProgressScreen.pa.yaml`](SiteProgressScreen.pa.yaml), copy **all** of its text,
   select **Screen1** in the Tree view and press **Ctrl+V**. Studio creates all 28 controls:
   the header, area and date pickers, spool search and list, the four activity buttons,
   the joint, welder and hold pickers, and the Save button.
6. Press **F5** (Preview) and record a test weld. Check that the row appears in the
   `Joints`, `Spools` and `SiteLog` lists.
7. **Save → Publish → Share** it with your planners or site team (a Microsoft 365 group works
   well). They open it from the **Power Apps mobile app**, or you can add it as a tab in the
   project's **Teams** channel.

**If the paste is refused:** the code format follows Power Apps' YAML source format, but
Studio versions differ (for example, the blank vertical gallery type). In that case, add the
controls by hand using the same names. Every property is listed in the `.pa.yaml` file (it is
readable as a checklist), and the two long formulas are in [`formulas/`](formulas/).
If the gallery is the only part that fails, insert a **Blank vertical gallery** named `galSpools`
and paste its two labels inside it.

### What the app does

* Your name is taken from your Microsoft 365 login (shown in the header, and recorded
  automatically as *Created By* on every `SiteLog` row).
* The spool list shows erected, hold and FW `welded/total` for each spool.
* **Field weld:** only joints not yet welded can be chosen. The welder must be from the
  `Welders` list (Active = Yes). The app updates the joint, recalculates `JointsWelded` on the
  spool, and logs the entry.
* **Erected:** sets `ErectedDate` and clears any hold. It is disabled if the spool is already erected.
* **Hold / Clear hold:** sets or clears `HoldReason`, which the 4D model shows on red spools.
* The work date can't be in the future. Duplicate welds and erections are blocked again at
  save time, in case two people enter the same thing at once.
* **Corrections:** the planner edits the item directly in the `Spools` or `Joints` list
  (SharePoint version history keeps the old value). `SiteLog` stays as the record of what was entered.

## Step 3: Connect the 4D dashboard (IT, about 10 minutes, done once)

The dashboard reads the `Spools` list through Microsoft Graph, signed in as the person viewing
it. It never holds a password or secret.

1. **Host** `demo-piping-4d-playback.html` and `auth.html` together in the same folder, over
   **https**. Any of these work: Azure Static Web Apps (free tier), an internal IIS or web server,
   or GitHub Pages.
2. **Entra admin center → App registrations → New registration**
   * Name: *Piping 4D Dashboard*. Supported account types: *this organisation only*.
   * Redirect URI: platform **Single-page application (SPA)**, URI
     `https://<your-host>/<folder>/auth.html`
   * After creating it: **API permissions → Add → Microsoft Graph → Delegated → `Sites.Read.All`**,
     then **Grant admin consent**.
3. Put the IDs at the top of the dashboard's live-feed code (search for `var SP={`):
   ```js
   site:'https://<tenant>.sharepoint.com/sites/<YourSite>',
   clientId:'<Application (client) ID>',
   tenantId:'<Directory (tenant) ID>',
   list:'Spools',
   ```
   Or, without editing the file, open
   `…/demo-piping-4d-playback.html?spSite=<site URL>&spClient=<client id>&spTenant=<tenant id>`
4. Open the dashboard and click **Sign in with Microsoft** once. After that it refreshes every
   5 minutes (add `&every=60` to the link for every minute). Spools that changed since the last
   check flash green in the model.

**Data date** = the latest `ErectedDate` in the list. Spools in the list that aren't in the 3D
model are listed in the amber warning bar.

## Limits to know

* **2,000 spools per area** in the app's search list (Power Apps' data row limit). If an area is
  bigger, split it into sub-areas in the `Areas`/`Spools` lists.
* Power Apps needs a signal to save. With no coverage, planners can note entries and save them
  once back in range. Offline mode is possible but is a larger build.
* The **Welder** column stores the welder's name. The `Joints` list (weld date + welder for each
  joint) gives you a welder productivity report directly, for example in Excel or Power BI.
