// Google Sheets sync layer
// Stores the Web App URL in localStorage under "sheetsUrl"
// Exposes window.SheetsAPI = { getUrl, setUrl, ping, fetchAll, upsertProduct, deleteProduct, upsertEvent, deleteEvent, uploadImage, bulkSyncProducts }

const LS_URL = 'by_sheets_url';
const LS_LAST = 'by_sheets_last_sync';

// Default URL hardcoded so the app works out of the box for everyone without manual setup
const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbx-fsDBA8K5d08gLl5O-HLwg8FvU8N25KkN-JBcY5pjx5E3t71iE3XR4OLIgfIg_loz/exec';

const getUrl = () => localStorage.getItem(LS_URL) || DEFAULT_URL;
const setUrl = (u) => localStorage.setItem(LS_URL, u || '');
const getLastSync = () => localStorage.getItem(LS_LAST) || null;
const setLastSync = () => localStorage.setItem(LS_LAST, new Date().toISOString());

async function get(action) {
  const url = getUrl();
  if (!url) throw new Error('לא הוגדר URL של הגיליון');
  const res = await fetch(`${url}?action=${action}`, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'שגיאה לא ידועה');
  return data;
}

async function post(body) {
  const url = getUrl();
  if (!url) throw new Error('לא הוגדר URL של הגיליון');
  // Apps Script web apps don't accept preflighted JSON; use text/plain to avoid preflight
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'שגיאה לא ידועה');
  return data;
}

const ping         = () => get('ping');
const fetchAll     = () => get('all').then(r => r.data);
const upsertProduct = (product) => post({ action: 'upsert_product', product });
const deleteProduct = (id) => post({ action: 'delete_product', id });
const upsertEvent   = (event) => post({ action: 'upsert_event', event });
const deleteEvent   = (id) => post({ action: 'delete_event', id });
const uploadImage   = (filename, dataUrl) => post({ action: 'upload_image', filename, dataUrl }).then(r => r.url);
const bulkSyncProducts = (products) => post({ action: 'bulk_upsert_products', products });

window.SheetsAPI = {
  getUrl, setUrl, getLastSync,
  ping, fetchAll,
  upsertProduct, deleteProduct,
  upsertEvent, deleteEvent,
  uploadImage, bulkSyncProducts,
};

// ============================================================
// Settings Modal
// ============================================================
const SettingsModal = ({ onClose, products, events, onImport }) => {
  const { Modal } = window.WHui;
  const [url, setUrlState] = React.useState(getUrl());
  const [status, setStatus] = React.useState({ type: 'idle', msg: '' });
  const [busy, setBusy] = React.useState(false);
  const lastSync = getLastSync();

  const testConnection = async () => {
    setUrl(url);
    setBusy(true); setStatus({ type: 'idle', msg: 'בודק חיבור…' });
    try {
      const r = await ping();
      setStatus({ type: 'ok', msg: `✓ מחובר · השרת הגיב ב־${new Date(r.time).toLocaleTimeString('he-IL')}` });
    } catch (err) {
      setStatus({ type: 'err', msg: `✗ ${err.message}` });
    }
    setBusy(false);
  };

  const uploadCurrent = async () => {
    setUrl(url);
    if (!confirm(`יועלו לגיליון ${products.length} מוצרים ו־${events.length} אירועים. להמשיך?`)) return;
    setBusy(true); setStatus({ type: 'idle', msg: 'מעלה מוצרים…' });
    try {
      await bulkSyncProducts(products);
      setStatus({ type: 'idle', msg: `מוצרים הועלו (${products.length}). מעלה אירועים…` });
      for (const ev of events) await upsertEvent(ev);
      setLastSync();
      setStatus({ type: 'ok', msg: `✓ סונכרן בהצלחה · ${products.length} מוצרים, ${events.length} אירועים` });
    } catch (err) {
      setStatus({ type: 'err', msg: `✗ ${err.message}` });
    }
    setBusy(false);
  };

  const pullFromSheet = async () => {
    setUrl(url);
    if (!confirm('ייטענו כל הנתונים מהגיליון וידרסו את מה שמוצג באפליקציה. להמשיך?')) return;
    setBusy(true); setStatus({ type: 'idle', msg: 'מושך נתונים מהגיליון…' });
    try {
      const data = await fetchAll();
      onImport(data);
      setLastSync();
      setStatus({ type: 'ok', msg: `✓ נטען · ${(data.products || []).length} מוצרים, ${(data.events || []).length} אירועים` });
    } catch (err) {
      setStatus({ type: 'err', msg: `✗ ${err.message}` });
    }
    setBusy(false);
  };

  return (
    <Modal title="הגדרות · חיבור לגוגל שיטס" subtitle="סנכרון נתונים עם 2byproduction@gmail.com" onClose={onClose}
      footer={<button className="btn btn-primary" onClick={onClose}>סגור</button>}>

      <div className="field">
        <label>URL של Web App (מ־Apps Script)</label>
        <input className="input mono" dir="ltr" placeholder="https://script.google.com/macros/s/.../exec"
          value={url} onChange={e => setUrlState(e.target.value)} />
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6, lineHeight: 1.6 }}>
          עקבי אחרי <code>SETUP_GUIDE.md</code> כדי להפיק את ה־URL. הכתובת נשמרת מקומית בדפדפן בלבד.
        </div>
      </div>

      {status.msg && (
        <div style={{
          padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14,
          background: status.type === 'ok' ? 'color-mix(in srgb, var(--teal) 12%, white)'
                    : status.type === 'err' ? 'color-mix(in srgb, var(--pink) 12%, white)'
                    : 'var(--surface-2)',
          color: status.type === 'ok' ? 'var(--teal)'
              : status.type === 'err' ? 'var(--pink)'
              : 'var(--ink-2)',
          border: `1px solid ${status.type === 'ok' ? 'var(--teal)' : status.type === 'err' ? 'var(--pink)' : 'var(--border)'}`,
        }}>{status.msg}</div>
      )}

      <div className="field">
        <label>פעולות</label>
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn btn-ghost" disabled={busy || !url} onClick={testConnection}>
            <Icon name="check" size={14} /> בדיקת חיבור
          </button>
          <button className="btn btn-ghost" disabled={busy || !url} onClick={uploadCurrent}>
            <Icon name="upload" size={14} /> העלאה ראשונית לגיליון ({products.length} מוצרים · {events.length} אירועים)
          </button>
          <button className="btn btn-ghost" disabled={busy || !url} onClick={pullFromSheet}>
            <Icon name="download" size={14} /> משיכת נתונים מהגיליון (דריסת האפליקציה)
          </button>
        </div>
      </div>

      {lastSync && (
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
          סנכרון אחרון: {new Date(lastSync).toLocaleString('he-IL')}
        </div>
      )}

      <div style={{ marginTop: 18, padding: 12, background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>
        <strong>איך זה עובד:</strong><br/>
        • כל שמירה של מוצר/אירוע באפליקציה תישלח אוטומטית לגיליון (אחרי הגדרת URL).<br/>
        • כל שינוי ידני בגיליון ייטען באפליקציה בלחיצה על "משיכת נתונים".<br/>
        • תמונות מועלות לתיקיית <code>BY Warehouse Images</code> ב־Drive ונשמרות עם קישור ציבורי.
      </div>
    </Modal>
  );
};

window.SettingsModal = SettingsModal;
