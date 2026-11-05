'use strict';
// Minimal Microsoft Graph client: client-credentials token, retry on throttling, workbook sessions.
// Uses the global fetch (Node 18+). No SDK needed.

const GRAPH = 'https://graph.microsoft.com/v1.0';

class GraphError extends Error {
  constructor(status, code, message, path) { super(`${status} ${code}: ${message} (${path})`); this.status = status; this.code = code; this.path = path; }
}

class Graph {
  constructor(cfg, fetchImpl) {
    this.cfg = cfg;
    this.fetch = fetchImpl || globalThis.fetch.bind(globalThis);
    this._token = null; this._tokenExp = 0;
    this._file = null;
  }

  async token() {
    if (this._token && Date.now() < this._tokenExp - 60000) return this._token;
    const body = new URLSearchParams({ client_id: this.cfg.CLIENT_ID, client_secret: this.cfg.CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' });
    const r = await this.fetch(`https://login.microsoftonline.com/${this.cfg.TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const j = await r.json();
    if (!r.ok) throw new GraphError(r.status, j.error || 'token', j.error_description || 'could not get a token', 'token');
    this._token = j.access_token; this._tokenExp = Date.now() + (Number(j.expires_in) || 3600) * 1000;
    return this._token;
  }

  // path: relative to /v1.0 or an absolute URL (for @odata.nextLink). Retries 429/503/504 with Retry-After.
  async call(method, path, { body, headers = {}, session, raw } = {}) {
    const url = path.startsWith('http') ? path : GRAPH + path;
    for (let attempt = 0; ; attempt++) {
      const h = { Authorization: 'Bearer ' + await this.token(), ...headers };
      if (session) h['workbook-session-id'] = session;
      let payload = body;
      if (body !== undefined && !(body instanceof Uint8Array) && !(typeof body === 'string')) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
      const r = await this.fetch(url, { method, headers: h, body: payload });
      if ((r.status === 429 || r.status === 503 || r.status === 504) && attempt < 5) {
        const wait = Number(r.headers.get('Retry-After') || 0) * 1000 || Math.min(8000, 500 * 2 ** attempt);
        await new Promise(res => setTimeout(res, wait)); continue;
      }
      if (r.status === 204) return null;
      if (raw) { if (!r.ok) throw new GraphError(r.status, 'http', await r.text(), path); return r; }
      const text = await r.text();
      let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) { j = { raw: text }; }
      if (!r.ok) { const err = (j && j.error) || {}; throw new GraphError(r.status, err.code || 'http', err.message || text || r.statusText, path); }
      return j;
    }
  }

  // Resolves the site and the workbook item once; returns {siteId, driveId, itemId, name, webUrl, base}.
  async file() {
    if (this._file) return this._file;
    const site = await this.call('GET', `/sites/${this.cfg.SITE_HOSTNAME}:${this.cfg.SITE_PATH}?$select=id,webUrl`);
    const p = String(this.cfg.FILE_PATH || '').replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
    const item = await this.call('GET', `/sites/${site.id}/drive/root:/${p}?$select=id,name,webUrl,parentReference`);
    this._file = { siteId: site.id, driveId: item.parentReference.driveId, itemId: item.id, name: item.name, webUrl: item.webUrl };
    this._file.base = `/drives/${this._file.driveId}/items/${this._file.itemId}/workbook`;
    return this._file;
  }

  async uploadToSite(folderPath, name, bytes) {
    const site = await this.call('GET', `/sites/${this.cfg.SITE_HOSTNAME}:${this.cfg.SITE_PATH}?$select=id`);
    const p = [...String(folderPath || '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean), name].map(encodeURIComponent).join('/');
    return this.call('PUT', `/sites/${site.id}/drive/root:/${p}:/content`, { body: bytes, headers: { 'Content-Type': 'application/octet-stream' } });
  }

  // Workbook helpers. All take the session id from openSession().
  async openSession(persist = true) { const f = await this.file(); const r = await this.call('POST', `${f.base}/createSession`, { body: { persistChanges: persist } }); return r.id; }
  async closeSession(session) { const f = await this.file(); try { await this.call('POST', `${f.base}/closeSession`, { session }); } catch (e) { /* session expiry is harmless */ } }
  async wb(method, sub, session, body) { const f = await this.file(); return this.call(method, `${f.base}${sub}`, { session, body }); }

  async sendMail({ from, to, subject, text }) {
    const toRecipients = String(to).split(/[,;]/).map(s => s.trim()).filter(Boolean).map(address => ({ emailAddress: { address } }));
    return this.call('POST', `/users/${encodeURIComponent(from)}/sendMail`, { body: { message: { subject, body: { contentType: 'Text', content: text }, toRecipients }, saveToSentItems: true } });
  }
}

module.exports = { Graph, GraphError };
