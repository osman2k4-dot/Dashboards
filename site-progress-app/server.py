#!/usr/bin/env python3
"""
Site Progress server: a self-hosted entry app for piping erection and field welds.

No accounts, no cloud, no extra packages: Python 3.8+ standard library only.
Run it on any PC or server on the site network:

    python server.py                    # http://<this-pc>:8080
    python server.py --import old.csv   # one-off: load existing progress (Spool ID, Erected date YYYY-MM-DD, Hold reason)
    set SITE_PIN=4821 && python server.py   (Windows)  /  SITE_PIN=4821 python server.py

Pages:
    /              entry form for planners (phone friendly)
    /4d            the Piping 4D dashboard, live-connected to this server
    /progress.csv  one row per spool (the feed the 4D dashboard reads)
    /log.csv       full site log (weld log with welders) for Excel

Master data lives in ./data as CSV files the planner maintains in Excel (Save As -> CSV):
    spools.csv   Spool ID, Area, Line, ...   (the 4D dashboard's "Progress template" works as-is)
    joints.csv   Spool ID, Joint No           (optional; without it joint numbers are typed)
    welders.csv  Name, Stamp, Active          (Active = N hides a welder)
Entries are stored in ./data/progress.db (SQLite). Back this file up.
"""
import csv, io, json, os, sqlite3, threading, time, uuid
from datetime import date, datetime
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import sys
from urllib.parse import urlparse, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get('SITE_DATA', os.path.join(HERE, 'data'))
PORT = int(os.environ.get('PORT', '8080'))
PIN = os.environ.get('SITE_PIN', '').strip()
DASHBOARD = os.path.join(HERE, '..', 'demo-piping-4d-playback.html')
ACTIVITIES = ('Field weld', 'Erected', 'Hold', 'Clear hold')
UNDO_MINUTES = 30
LOCK = threading.Lock()


# ---------- master data (CSV, reloaded when the file changes) ----------
_cache = {}

def read_csv(name):
    path = os.path.join(DATA, name)
    if not os.path.exists(path):
        return []
    mt = os.path.getmtime(path)
    if name in _cache and _cache[name][0] == mt:
        return _cache[name][1]
    with open(path, newline='', encoding='utf-8-sig') as f:
        sample = f.read(4096); f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
        except csv.Error:
            dialect = csv.excel
        rows = [{(k or '').strip().lower(): (v or '').strip() for k, v in r.items()} for r in csv.DictReader(f, dialect=dialect)]
    _cache[name] = (mt, rows)
    return rows

def pick(row, *names):
    for n in names:
        for k, v in row.items():
            if n in k and v:
                return v
    return ''

def master():
    spools = []
    for r in read_csv('spools.csv'):
        sid = pick(r, 'spool')
        if sid:
            spools.append({'id': sid, 'area': pick(r, 'area') or '(no area)', 'line': pick(r, 'line')})
    joints = {}
    for r in read_csv('joints.csv'):
        sid, j = pick(r, 'spool'), pick(r, 'joint', 'fw')
        if sid and j:
            joints.setdefault(sid, []).append(j)
    welders = [{'name': pick(r, 'name', 'welder'), 'stamp': pick(r, 'stamp', 'id')}
               for r in read_csv('welders.csv')
               if pick(r, 'name', 'welder') and not pick(r, 'active').upper().startswith('N')]
    areas = []
    for s in spools:
        if s['area'] not in areas:
            areas.append(s['area'])
    return {'areas': areas, 'spools': spools, 'joints': joints, 'welders': welders}


# ---------- site log (SQLite) ----------
def db():
    os.makedirs(DATA, exist_ok=True)
    c = sqlite3.connect(os.path.join(DATA, 'progress.db'))
    c.row_factory = sqlite3.Row
    c.execute('''CREATE TABLE IF NOT EXISTS log(
        id TEXT PRIMARY KEY, ts TEXT, work_date TEXT, area TEXT, spool TEXT, activity TEXT,
        joint TEXT, welder TEXT, hold TEXT, reporter TEXT, status TEXT DEFAULT 'OK', client TEXT)''')
    return c

def status():
    st = {}
    with db() as c:
        for r in c.execute("SELECT * FROM log WHERE status='OK' ORDER BY ts"):
            o = st.setdefault(r['spool'], {'erected': '', 'hold': '', 'welded': [], 'last': ''})
            a = r['activity']
            if a == 'Erected' and (not o['erected'] or r['work_date'] < o['erected']):
                o['erected'] = r['work_date']
            elif a == 'Hold':
                o['hold'] = r['hold'] or 'On hold'
            elif a == 'Clear hold':
                o['hold'] = ''
            elif a == 'Field weld' and r['joint'] not in o['welded']:
                o['welded'].append(r['joint'])
            o['last'] = max(o['last'], r['work_date'])
    return st

def recent(reporter=''):
    out = []
    with db() as c:
        for r in c.execute('SELECT * FROM log ORDER BY ts DESC LIMIT 12'):
            ts = datetime.fromisoformat(r['ts'])
            age = (datetime.now() - ts).total_seconds() / 60
            out.append({'id': r['id'], 'spool': r['spool'], 'activity': r['activity'], 'joint': r['joint'],
                        'welder': r['welder'], 'hold': r['hold'], 'by': r['reporter'], 'void': r['status'] != 'OK',
                        'when': ts.strftime('%d-%b %H:%M'),
                        'canUndo': r['status'] == 'OK' and age < UNDO_MINUTES and bool(reporter)
                                   and r['reporter'].lower() == reporter.lower()})
    return out

def submit(e, client):
    m = master()
    spool = next((s for s in m['spools'] if s['id'] == str(e.get('spool', '')).strip()), None)
    if not spool:
        raise ValueError('Spool %s is not in spools.csv.' % e.get('spool'))
    act = e.get('activity')
    if act not in ACTIVITIES:
        raise ValueError('Choose what was done.')
    wd = str(e.get('workDate', ''))
    try:
        if date.fromisoformat(wd) > date.today():
            raise ValueError('Work date cannot be in the future.')
    except (TypeError, ValueError) as x:
        raise ValueError(str(x) if 'future' in str(x) else 'Work date is missing.')
    rep = str(e.get('reporter', '')).strip()[:60]
    if not rep:
        raise ValueError('Enter your name.')
    joint = str(e.get('joint', '')).strip().upper()[:20] if act == 'Field weld' else ''
    welder = str(e.get('welder', '')).strip()[:60] if act == 'Field weld' else ''
    hold = str(e.get('hold', '')).strip()[:200] if act == 'Hold' else ''
    if act == 'Field weld':
        if not joint: raise ValueError('Choose the field joint.')
        if welder not in [w['name'] for w in m['welders']]: raise ValueError('Choose a welder from the list.')
        known = m['joints'].get(spool['id'])
        if known and joint not in known: raise ValueError('Joint %s is not listed for %s.' % (joint, spool['id']))
    if act == 'Hold' and not hold:
        raise ValueError('Give the hold reason.')
    with LOCK:
        s = status().get(spool['id'], {'erected': '', 'welded': [], 'hold': ''})
        if act == 'Field weld' and joint in s['welded']:
            raise ValueError('Joint %s on %s is already recorded as welded.' % (joint, spool['id']))
        if act == 'Erected' and s['erected']:
            raise ValueError('%s is already recorded as erected on %s.' % (spool['id'], s['erected']))
        with db() as c:
            c.execute('INSERT INTO log(id,ts,work_date,area,spool,activity,joint,welder,hold,reporter,client) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                      (uuid.uuid4().hex[:10], datetime.now().isoformat(timespec='seconds'), wd, spool['area'],
                       spool['id'], act, joint, welder, hold, rep, client))

def undo(entry_id, reporter):
    with LOCK:
        if not any(r['id'] == entry_id and r['canUndo'] for r in recent(reporter)):
            raise ValueError('Only your own entries from the last %d minutes can be undone. Ask the planner to correct older ones.' % UNDO_MINUTES)
        with db() as c:
            c.execute("UPDATE log SET status='Void' WHERE id=?", (entry_id,))

def progress_csv():
    st, m = status(), master()
    out = io.StringIO(); w = csv.writer(out, lineterminator='\r\n')
    w.writerow(['Spool ID', 'Erected date', 'Hold reason', 'Field joints welded', 'Field joints total', 'Last update'])
    for s in m['spools']:
        o = st.get(s['id'], {'erected': '', 'hold': '', 'welded': [], 'last': ''})
        w.writerow([s['id'], o['erected'], '' if o['erected'] else o['hold'], len(o['welded']),
                    len(m['joints'].get(s['id'], [])) or '', o['last']])
    return out.getvalue()

def log_csv():
    out = io.StringIO(); w = csv.writer(out, lineterminator='\r\n')
    w.writerow(['Entered', 'Work date', 'Area', 'Spool ID', 'Activity', 'Joint No', 'Welder', 'Hold reason', 'Reported by', 'Status', 'Entry ID'])
    with db() as c:
        for r in c.execute('SELECT * FROM log ORDER BY ts'):
            w.writerow([r['ts'].replace('T', ' '), r['work_date'], r['area'], r['spool'], r['activity'], r['joint'],
                        r['welder'], r['hold'], r['reporter'], r['status'], r['id']])
    return out.getvalue()


# ---------- HTTP ----------
class H(BaseHTTPRequestHandler):
    server_version = 'SiteProgress/1.0'

    def send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
        b = body.encode('utf-8') if isinstance(body, str) else body
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')  # lets a dashboard hosted elsewhere read /progress.csv
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(b)

    def js(self, obj, code=200):
        self.send(code, json.dumps(obj))

    def pin_ok(self):
        return not PIN or self.headers.get('X-Site-Pin', '') == PIN

    def do_GET(self):
        p = urlparse(self.path).path
        if p in ('/', '/index.html'):
            with open(os.path.join(HERE, 'Index.html'), encoding='utf-8') as f:
                return self.send(200, f.read(), 'text/html; charset=utf-8')
        if p == '/4d':
            return self.send(302, '', 'text/plain', {'Location': '/4d.html?feed=/progress.csv&every=60'})
        if p == '/4d.html' and os.path.exists(DASHBOARD):
            with open(DASHBOARD, encoding='utf-8') as f:
                return self.send(200, f.read(), 'text/html; charset=utf-8')
        if p == '/progress.csv':
            return self.send(200, progress_csv(), 'text/csv; charset=utf-8')
        if p == '/log.csv':
            if not self.pin_ok() and urlparse(self.path).query != 'pin=' + PIN:
                return self.send(403, 'PIN required: /log.csv?pin=<PIN>', 'text/plain')
            return self.send(200, '﻿' + log_csv(), 'text/csv; charset=utf-8',
                             {'Content-Disposition': 'attachment; filename="site-log-%s.csv"' % date.today()})
        if p == '/api/master':
            d = master(); d.update(status=status(), recent=recent(unquote(self.headers.get('X-Reporter', ''))),
                                   needPin=bool(PIN), today=date.today().isoformat())
            return self.js(d)
        self.send(404, 'Not found', 'text/plain')

    def do_POST(self):
        p = urlparse(self.path).path
        if not self.pin_ok():
            return self.js({'error': 'Wrong or missing site PIN.', 'pin': True}, 403)
        try:
            n = int(self.headers.get('Content-Length', '0'))
            if n > 20000: raise ValueError('Request too large.')
            body = json.loads(self.rfile.read(n) or b'{}')
            rep = str(body.get('reporter', '')).strip()
            if p == '/api/entry':
                submit(body, self.client_address[0])
            elif p == '/api/undo':
                undo(str(body.get('id', '')), rep)
            else:
                return self.send(404, 'Not found', 'text/plain')
            self.js({'status': status(), 'recent': recent(rep)})
        except ValueError as e:
            self.js({'error': str(e)}, 400)

    def log_message(self, fmt, *args):
        if os.environ.get('QUIET') != '1':
            super().log_message(fmt, *args)


def import_progress(path):
    """One-off: load existing erected dates / holds (Spool ID, Erected date, Hold reason) as the starting point."""
    known = {s['id']: s for s in master()['spools']}
    done = status(); n = skipped = 0
    with open(path, newline='', encoding='utf-8-sig') as f, db() as c:
        for r in csv.DictReader(f):
            r = {(k or '').strip().lower(): (v or '').strip() for k, v in r.items()}
            sid = pick(r, 'spool'); s = known.get(sid)
            if not s: skipped += 1; continue
            d = done.get(sid, {})
            for act, val, hold in (('Erected', pick(r, 'erect'), ''), ('Hold', pick(r, 'hold'), pick(r, 'hold'))):
                if not val or (act == 'Erected' and d.get('erected')) or (act == 'Hold' and pick(r, 'erect')):
                    continue
                wd = val if act == 'Erected' else date.today().isoformat()
                date.fromisoformat(wd)
                c.execute('INSERT INTO log(id,ts,work_date,area,spool,activity,hold,reporter,client) VALUES(?,?,?,?,?,?,?,?,?)',
                          (uuid.uuid4().hex[:10], datetime.now().isoformat(timespec='seconds'), wd, s['area'], sid, act,
                           hold, 'Import', 'import'))
                n += 1
    print('Imported %d entries (%d rows with unknown spool IDs skipped).' % (n, skipped))


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--import':
        import_progress(sys.argv[2]); sys.exit(0)
    db().close()
    m = master()
    print('Site Progress on http://0.0.0.0:%d  (form: /   4D dashboard: /4d   feed: /progress.csv)' % PORT)
    print('Data folder: %s  -> %d spools, %d welders%s' % (DATA, len(m['spools']), len(m['welders']),
          '' if m['spools'] else '  (add spools.csv!)'))
    print('PIN protection: %s' % ('on' if PIN else 'off (set SITE_PIN to require a PIN)'))
    ThreadingHTTPServer(('0.0.0.0', PORT), H).serve_forever()
