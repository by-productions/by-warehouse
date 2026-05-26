// Helpers used across the app: date/time formatting, image upload, ICS export,
// reservation-by-date-window lookups.

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const days = ['א\'','ב\'','ג\'','ד\'','ה\'','ו\'','ש\''];
  const months = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];
  return `יום ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};
const fmtDateShort = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};
const locStr = (loc) => `${loc.zone}-${loc.row}-${loc.shelf}`;
const catOf = (id) => window.WarehouseData.CATEGORIES.find(c => c.id === id);
const productOf = (id) => (window.__WH_PRODUCTS || window.WarehouseData.PRODUCTS).find(p => p.id === id);
const clientOf = (id) => (window.__WH_CLIENTS || window.WarehouseData.CLIENTS).find(c => c.id === id);

// ============================================================
// Event schema migration
// Old: setup/event/dismantle each had { date, time } or
//      event: { date, startTime, endTime }; contacts was an array; accent was a string.
// New: setup/event/dismantle each have { startDate, endDate, startTime, endTime };
//      event also has skipped:bool; contacts is { client, producer, suppliers[] };
//      clientId replaces accent; productionTasks added.
// migrateEvent leaves new events untouched and upgrades old ones in place.
// ============================================================
function migrateEvent(ev) {
  if (!ev) return ev;
  const isOldPhase = (p) => p && (p.date !== undefined) && p.startDate === undefined;
  const upgradePhase = (p, kind) => {
    if (!p) return { startDate: '', endDate: '', startTime: '', endTime: '' };
    if (!isOldPhase(p)) return { skipped: false, ...p };
    if (kind === 'event') {
      return {
        startDate: p.date || '', endDate: p.date || '',
        startTime: p.startTime || '', endTime: p.endTime || '',
        skipped: false,
      };
    }
    return {
      startDate: p.date || '', endDate: p.date || '',
      startTime: p.time || '', endTime: p.time || '',
    };
  };
  const upgradeContacts = (c) => {
    if (!c) return { client: { name: '', role: '', phone: '' }, producer: { name: '', role: '', phone: '' }, suppliers: [] };
    if (!Array.isArray(c)) {
      return {
        client: c.client || { name: '', role: '', phone: '' },
        producer: c.producer || { name: '', role: '', phone: '' },
        suppliers: c.suppliers || [],
      };
    }
    // Heuristic: first contact → client, second → producer, rest → suppliers
    const stripNotes = ({ name, role, phone }) => ({ name: name || '', role: role || '', phone: phone || '' });
    return {
      client:   c[0] ? stripNotes(c[0]) : { name: '', role: '', phone: '' },
      producer: c[1] ? stripNotes(c[1]) : { name: '', role: '', phone: '' },
      suppliers: c.slice(2).map(stripNotes),
    };
  };
  return {
    ...ev,
    setup:     upgradePhase(ev.setup, 'setup'),
    event:     upgradePhase(ev.event, 'event'),
    dismantle: upgradePhase(ev.dismantle, 'dismantle'),
    contacts:  upgradeContacts(ev.contacts),
    clientId:  ev.clientId || null,
    productionTasks: ev.productionTasks || [],
    items:     ev.items || [],
    workers:   ev.workers || [],
  };
}
function migrateEvents(arr) { return (arr || []).map(migrateEvent); }

// Convenience accessors (work on migrated events)
const eventHoldStart = (ev) => ev.setup?.startDate || ev.event?.startDate || ev.setup?.date || ev.event?.date;
const eventHoldEnd   = (ev) => ev.dismantle?.endDate || ev.dismantle?.startDate || ev.event?.endDate || ev.event?.startDate || ev.dismantle?.date || ev.event?.date;

// Recompute `reserved` on each product by summing qty across all events whose
// holding window contains today (i.e. setup.date <= today <= dismantle.date).
// Items that aren't currently held don't count toward "reserved now" — but they
// still show up via date-window queries elsewhere.
function recomputeReserved(products, events) {
  const today = new Date().toISOString().slice(0, 10);
  const sums = {};
  events.forEach(ev => {
    const s = eventHoldStart(ev);
    const e = eventHoldEnd(ev);
    if (!s || !e) return;
    if (today < s || today > e) return;
    (ev.items || []).forEach(it => { sums[it.id] = (sums[it.id] || 0) + it.qty; });
  });
  return products.map(p => ({ ...p, reserved: sums[p.id] || 0 }));
}

const availStatus = (p) => {
  const avail = p.stock - p.reserved;
  const ratio = avail / Math.max(1, p.stock);
  if (avail <= 0) return { label: 'אזל', cls: 'bad', ratio };
  if (ratio < 0.25) return { label: 'נמוך', cls: 'warn', ratio };
  return { label: 'זמין', cls: 'ok', ratio };
};

// Date-aware reservation calc:
// For each product, sum qty reserved across events whose [setup.date, dismantle.date]
// overlaps with the given window [fromISO, toISO]. If window is null, uses "now forward"
// i.e. all future reservations.
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && aEnd >= bStart;
}
function reservedInWindow(events, productId, fromISO, toISO) {
  const F = fromISO || '0000-01-01';
  const T = toISO || '9999-12-31';
  let total = 0;
  events.forEach(ev => {
    const s = eventHoldStart(ev);
    const e = eventHoldEnd(ev);
    if (!s || !e) return;
    if (!overlaps(F, T, s, e)) return;
    const it = (ev.items || []).find(i => i.id === productId);
    if (it) total += it.qty;
  });
  return total;
}
function productAvailInWindow(product, events, fromISO, toISO) {
  return product.stock - reservedInWindow(events, product.id, fromISO, toISO);
}

// Next release date for a product (earliest event dismantle date where product is reserved)
function nextRelease(product, events) {
  const today = new Date().toISOString().slice(0, 10);
  const rels = events
    .filter(ev => (ev.items || []).some(i => i.id === product.id))
    .map(ev => eventHoldEnd(ev))
    .filter(d => d && d >= today)
    .sort();
  return rels[0] || null;
}

// ============================================================
// Image upload — returns data URL
// ============================================================
function pickImage(onPicked) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Resize to max 800px wide for storage sanity
      const img = new Image();
      img.onload = () => {
        const max = 800;
        const scale = Math.min(1, max / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        onPicked(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  };
  input.click();
}

// ============================================================
// ICS / Google Calendar — event invite
// ============================================================
function pad(n) { return String(n).padStart(2, '0'); }
function toUtcStamp(dateStr, timeStr) {
  // Treats the date+time as LOCAL time, converts to UTC for ICS
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  let [h, mi] = (timeStr || '00:00').split(':').map(Number);
  const dt = new Date(y, m - 1, d, h || 0, mi || 0, 0);
  return dt.getUTCFullYear()
    + pad(dt.getUTCMonth() + 1)
    + pad(dt.getUTCDate())
    + 'T' + pad(dt.getUTCHours()) + pad(dt.getUTCMinutes()) + '00Z';
}
// Pull a contacts array (for legacy code paths) out of the structured contacts object
function contactsArray(event) {
  const c = event.contacts;
  if (!c) return [];
  if (Array.isArray(c)) return c;
  const out = [];
  if (c.client && (c.client.name || c.client.phone)) out.push({ ...c.client, _kind: 'לקוח' });
  if (c.producer && (c.producer.name || c.producer.phone)) out.push({ ...c.producer, _kind: 'מפיק/ה' });
  (c.suppliers || []).forEach(s => { if (s.name || s.phone) out.push({ ...s, _kind: 'ספק' }); });
  return out;
}

// Pull the calendar window: prefers event phase, falls back to setup→dismantle for booth-only timelines
function calendarWindow(event) {
  const ev = event.event || {};
  if (!ev.skipped && (ev.startDate || ev.date)) {
    return {
      startDate: ev.startDate || ev.date,
      endDate:   ev.endDate   || ev.startDate || ev.date,
      startTime: ev.startTime || '',
      endTime:   ev.endTime   || ev.startTime || '',
    };
  }
  const su = event.setup || {};
  const dm = event.dismantle || {};
  return {
    startDate: su.startDate || su.date || '',
    endDate:   dm.endDate || dm.startDate || dm.date || su.endDate || su.startDate || su.date || '',
    startTime: su.startTime || su.time || '',
    endTime:   dm.endTime || dm.time || su.endTime || su.time || '',
  };
}

function buildIcs(event) {
  const win = calendarWindow(event);
  const evStart = toUtcStamp(win.startDate, win.startTime);
  let endDate = win.endDate || win.startDate;
  if (win.endTime && win.startTime && win.endTime < win.startTime && endDate === win.startDate) {
    const d = new Date(win.startDate);
    d.setDate(d.getDate() + 1);
    endDate = d.toISOString().slice(0, 10);
  }
  const evEnd = toUtcStamp(endDate, win.endTime || win.startTime);
  const now = toUtcStamp(new Date().toISOString().slice(0, 10), '00:00');

  const esc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

  const fmtPhase = (label, p) => p && (p.startDate || p.date)
    ? `${label}: ${(p.startDate || p.date)}${p.endDate && p.endDate !== p.startDate ? `→${p.endDate}` : ''} · ${(p.startTime || p.time || '')}${p.endTime ? '–' + p.endTime : ''}`
    : '';
  const contacts = contactsArray(event);
  const desc = [
    event.so ? `SO: ${event.so}` : '',
    event.type ? `סוג: ${event.type === 'booth' ? 'ביתן' : 'אירוע הפקה'}` : '',
    fmtPhase('הקמה',  event.setup),
    event.event?.skipped ? '' : fmtPhase('אירוע', event.event),
    fmtPhase('פירוק', event.dismantle),
    '',
    ...contacts.map((c, i) => `${c._kind || 'קשר'} ${i + 1}: ${c.name || ''} · ${c.role || ''} · ${c.phone || ''}`),
    '',
    `צוות תפעול: ${(event.workers || []).join(', ')}`,
  ].filter(Boolean).join('\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//מחסן//BY Productions//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.id}@by-productions.local`,
    `DTSTAMP:${now}`,
    `DTSTART:${evStart}`,
    `DTEND:${evEnd}`,
    `SUMMARY:${esc(event.name)}`,
    `LOCATION:${esc(event.location)}`,
    `DESCRIPTION:${esc(desc)}`,
    'ORGANIZER;CN=BY Productions:mailto:byoffice@by-p.com',
    'ATTENDEE;CN=BY Office;RSVP=TRUE;ROLE=REQ-PARTICIPANT:mailto:byoffice@by-p.com',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
function downloadIcs(event) {
  const ics = buildIcs(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.name.replace(/[^א-תa-zA-Z0-9]/g, '_')}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function googleCalendarUrl(event) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const dt = (date, time) => {
    if (!date) return '';
    return date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : '');
  };
  const win = calendarWindow(event);
  let endDate = win.endDate || win.startDate;
  if (win.endTime && win.startTime && win.endTime < win.startTime && endDate === win.startDate) {
    const d = new Date(win.startDate);
    d.setDate(d.getDate() + 1);
    endDate = d.toISOString().slice(0, 10);
  }
  const dates = `${dt(win.startDate, win.startTime)}/${dt(endDate, win.endTime || win.startTime)}`;

  const fmtPhase = (label, p) => p && (p.startDate || p.date)
    ? `${label}: ${(p.startDate || p.date)}${p.endDate && p.endDate !== p.startDate ? `→${p.endDate}` : ''} · ${(p.startTime || p.time || '')}${p.endTime ? '–' + p.endTime : ''}`
    : '';
  const contacts = contactsArray(event);
  const details = [
    event.so ? `SO: ${event.so}` : '',
    event.type ? `סוג: ${event.type === 'booth' ? 'ביתן' : 'אירוע הפקה'}` : '',
    fmtPhase('הקמה',  event.setup),
    event.event?.skipped ? '' : fmtPhase('אירוע', event.event),
    fmtPhase('פירוק', event.dismantle),
    '',
    ...contacts.map((c, i) => `${c._kind || 'קשר'} ${i + 1}: ${c.name || ''} · ${c.role || ''} · ${c.phone || ''}`),
  ].filter(Boolean).join('\n');
  const params = new URLSearchParams({
    text: event.name,
    dates,
    details,
    location: event.location || '',
    add: 'byoffice@by-p.com',
  });
  return `${base}&${params.toString()}`;
}

// ============================================================
// UI primitives
// ============================================================
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const CategoryChip = ({ cat, active, onClick, count }) => (
  <button className={`chip ${active ? 'active' : ''}`} onClick={onClick}>
    {cat && <span className="chip-dot" style={{ background: cat.color }} />}
    <span>{cat ? cat.label : 'כל המוצרים'}</span>
    {count != null && <span style={{ opacity: 0.6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{count}</span>}
  </button>
);

const QtyStepper = ({ value, max, min = 1, onChange }) => (
  <div className="qty">
    <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
    <input
      type="text"
      value={value}
      onChange={(e) => {
        const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10);
        onChange(Math.max(min, Math.min(max || 9999, n)));
      }}
    />
    <button onClick={() => onChange(Math.min(max || 9999, value + 1))} disabled={max != null && value >= max}>+</button>
  </div>
);

const Toast = ({ msg, variant }) => (
  <div className={`toast ${variant || ''}`}>
    <Icon name="check" size={16} />{msg}
  </div>
);

const Empty = ({ icon = 'box', title, sub }) => (
  <div className="empty-state">
    <div className="icon"><Icon name={icon} size={22} /></div>
    <div style={{ fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>{title}</div>
    {sub && <div>{sub}</div>}
  </div>
);

const Modal = ({ title, subtitle, onClose, children, footer, wide }) => (
  <div className="modal-bg" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()} style={wide ? { maxWidth: 760 } : undefined}>
      <div className="modal-head">
        <div>
          <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-0.02em' }}>{title}</h2>
          {subtitle && <p style={{ margin: '4px 0 0', color: 'var(--ink-3)', fontSize: 13 }}>{subtitle}</p>}
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><Icon name="x" size={16} /></button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </div>
  </div>
);

// Image uploader block
const ImagePicker = ({ value, onChange, aspect = '16/9', label = 'צרפו תמונה' }) => (
  <div
    onClick={() => pickImage(onChange)}
    style={{
      aspectRatio: aspect,
      background: value ? `center/cover no-repeat url(${value})` : 'var(--surface-2)',
      backgroundImage: value ? `url(${value})` : 'repeating-linear-gradient(45deg, transparent 0 12px, rgba(26,22,20,0.04) 12px 13px)',
      backgroundSize: value ? 'cover' : undefined,
      backgroundPosition: value ? 'center' : undefined,
      backgroundRepeat: value ? 'no-repeat' : undefined,
      borderRadius: 10, border: '1px dashed var(--border-strong)',
      display: 'grid', placeItems: 'center',
      cursor: 'pointer',
      color: 'var(--ink-3)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {!value && (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Icon name="plus" size={22} />
        <span style={{ fontSize: 12 }}>{label}</span>
      </div>
    )}
    {value && (
      <button
        onClick={(e) => { e.stopPropagation(); onChange(null); }}
        style={{
          position: 'absolute', top: 8, left: 8,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(26,22,20,0.72)', color: '#fff',
          display: 'grid', placeItems: 'center',
        }}
      ><Icon name="x" size={14} /></button>
    )}
  </div>
);

window.WHui = {
  fmtDate, fmtDateShort, locStr, catOf, productOf, clientOf, availStatus,
  reservedInWindow, productAvailInWindow, nextRelease, recomputeReserved,
  migrateEvent, migrateEvents, eventHoldStart, eventHoldEnd, contactsArray, calendarWindow,
  pickImage, buildIcs, downloadIcs, googleCalendarUrl,
  CategoryChip, QtyStepper, Toast, Empty, Modal, ImagePicker,
};
