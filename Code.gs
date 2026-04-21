/**
 * ============================================================
 *  מחסן · Google Apps Script backend
 *  Warehouse inventory — Google Sheets API
 * ============================================================
 *
 * Setup:
 * 1. Open Google Sheets, create a new spreadsheet named "מחסן".
 * 2. Extensions → Apps Script → paste this file.
 * 3. Run initSheets() once to create all tabs + headers + sample row.
 * 4. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (or Anyone in org)
 *    Copy the web-app URL into APPS_SCRIPT_URL in the HTML file.
 *
 * Sheet structure (all columns in order):
 *   Products:   id | sku | name | category | stock | reserved |
 *               zone | row | shelf | w | h | d | notes | image_url
 *   Events:     id | name | date | time | location | accent |
 *               contact_name | contact_role | contact_phone | contact_notes |
 *               workers (comma) | created_at
 *   EventItems: event_id | product_id | qty
 *
 * Client usage (from HTML):
 *   const API = 'https://script.google.com/macros/s/XXXXXX/exec';
 *   fetch(API + '?action=getAll').then(r => r.json()).then(data => ...);
 *   fetch(API, { method:'POST', body: JSON.stringify({action:'saveEvent', event}) });
 * ============================================================
 */

const SHEETS = {
  products:   'Products',
  events:     'Events',
  eventItems: 'EventItems',
};

const HEADERS = {
  products: ['id','sku','name','category','stock','reserved','zone','row','shelf','w','h','d','notes','image_url'],
  events:   ['id','name','date','time','location','accent','contact_name','contact_role','contact_phone','contact_notes','workers','created_at'],
  eventItems: ['event_id','product_id','qty'],
};

// ---------- Setup ----------
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(SHEETS).forEach(([key, name]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    const headers = HEADERS[key];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a1614')
      .setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  });

  // Sample seed
  const products = ss.getSheetByName(SHEETS.products);
  const sample = [
    ['CH-001','CH-001','כיסא טיפאני שקוף','chairs',120,40,'A',1,1,42,88,42,'',''],
    ['SF-001','SF-001','ספה תלת מושבית קטיפה ורוד','sofas',6,2,'B',1,1,220,85,90,'ורוד עתיק',''],
    ['TB-001','TB-001','שולחן עגול Ø160','tables',20,6,'A',3,1,160,75,160,'',''],
    ['LT-001','LT-001','פס לד RGB 5 מטר','lights',100,30,'C',1,1,500,2,2,'',''],
    ['BR-001','BR-001','בר LED לבן 2 מ\'','bars',6,3,'C',3,1,200,110,55,'',''],
    ['DC-001','DC-001','עציץ מונסטרה גדול','decor',20,4,'B',3,1,60,150,60,'',''],
  ];
  products.getRange(2, 1, sample.length, sample[0].length).setValues(sample);
}

// ---------- HTTP handlers ----------
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'getAll';
  try {
    if (action === 'getAll')     return jsonOut(getAll());
    if (action === 'getProducts') return jsonOut(getProducts());
    if (action === 'getEvents')   return jsonOut(getEvents());
    return jsonOut({ error: 'unknown action: ' + action });
  } catch (err) {
    return jsonOut({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    if (action === 'saveProduct')  return jsonOut(saveProduct(body.product));
    if (action === 'updateStock')  return jsonOut(updateStock(body.id, body.stock, body.reserved));
    if (action === 'saveEvent')    return jsonOut(saveEvent(body.event));
    if (action === 'deleteEvent')  return jsonOut(deleteEvent(body.id));
    return jsonOut({ error: 'unknown action: ' + action });
  } catch (err) {
    return jsonOut({ error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Read ----------
function getAll() {
  return { products: getProducts(), events: getEvents() };
}

function getProducts() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.products);
  const rows = sh.getDataRange().getValues();
  const headers = rows.shift();
  return rows
    .filter(r => r[0])
    .map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i]; });
      return {
        id: o.id,
        sku: o.sku,
        name: o.name,
        category: o.category,
        stock: Number(o.stock) || 0,
        reserved: Number(o.reserved) || 0,
        location: { zone: o.zone, row: Number(o.row), shelf: Number(o.shelf) },
        dims: { w: Number(o.w), h: Number(o.h), d: Number(o.d) },
        notes: o.notes || '',
        image_url: o.image_url || '',
      };
    });
}

function getEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventsSh = ss.getSheetByName(SHEETS.events);
  const itemsSh  = ss.getSheetByName(SHEETS.eventItems);

  const erows = eventsSh.getDataRange().getValues();
  const eheaders = erows.shift();
  const events = erows.filter(r => r[0]).map(r => {
    const o = {};
    eheaders.forEach((h, i) => { o[h] = r[i]; });
    return {
      id: o.id,
      name: o.name,
      date: formatDate(o.date),
      time: formatTime(o.time),
      location: o.location,
      accent: o.accent || 'pink',
      contact: {
        name: o.contact_name || '',
        role: o.contact_role || '',
        phone: o.contact_phone || '',
        notes: o.contact_notes || '',
      },
      workers: (o.workers || '').toString().split(',').map(s => s.trim()).filter(Boolean),
      items: [],
    };
  });

  const irows = itemsSh.getDataRange().getValues();
  irows.shift();
  const byEvent = {};
  irows.filter(r => r[0]).forEach(r => {
    const [eventId, productId, qty] = r;
    byEvent[eventId] = byEvent[eventId] || [];
    byEvent[eventId].push({ id: productId, qty: Number(qty) || 0 });
  });
  events.forEach(ev => { ev.items = byEvent[ev.id] || []; });

  return events;
}

// ---------- Write ----------
function saveProduct(p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.products);
  const rows = sh.getDataRange().getValues();
  const headers = rows.shift();
  const idCol = headers.indexOf('id');
  const row = rows.findIndex(r => r[idCol] === p.id);
  const values = [
    p.id, p.sku, p.name, p.category,
    p.stock, p.reserved,
    p.location.zone, p.location.row, p.location.shelf,
    p.dims.w, p.dims.h, p.dims.d,
    p.notes || '', p.image_url || '',
  ];
  if (row >= 0) {
    sh.getRange(row + 2, 1, 1, values.length).setValues([values]);
  } else {
    sh.appendRow(values);
  }
  return { ok: true };
}

function updateStock(id, stock, reserved) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.products);
  const rows = sh.getDataRange().getValues();
  const headers = rows.shift();
  const idCol = headers.indexOf('id');
  const row = rows.findIndex(r => r[idCol] === id);
  if (row < 0) return { error: 'not found' };
  if (stock    != null) sh.getRange(row + 2, headers.indexOf('stock')    + 1).setValue(stock);
  if (reserved != null) sh.getRange(row + 2, headers.indexOf('reserved') + 1).setValue(reserved);
  return { ok: true };
}

function saveEvent(ev) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventsSh = ss.getSheetByName(SHEETS.events);
  const itemsSh  = ss.getSheetByName(SHEETS.eventItems);
  const productsSh = ss.getSheetByName(SHEETS.products);

  // --- Release old reservation, then apply new ---
  const oldItems = getItemsForEvent(ev.id);
  oldItems.forEach(it => changeReservation(productsSh, it.id, -it.qty));
  ev.items.forEach(it => changeReservation(productsSh, it.id, +it.qty));

  // --- Upsert event row ---
  const eheaders = HEADERS.events;
  const rows = eventsSh.getDataRange().getValues();
  rows.shift();
  const idx = rows.findIndex(r => r[0] === ev.id);
  const row = [
    ev.id, ev.name, ev.date, ev.time, ev.location, ev.accent || 'pink',
    ev.contact.name, ev.contact.role, ev.contact.phone, ev.contact.notes,
    (ev.workers || []).join(', '),
    idx >= 0 ? rows[idx][eheaders.indexOf('created_at')] : new Date().toISOString(),
  ];
  if (idx >= 0) {
    eventsSh.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  } else {
    eventsSh.appendRow(row);
  }

  // --- Replace event items (delete old rows, append new) ---
  const irows = itemsSh.getDataRange().getValues();
  irows.shift();
  // Delete from bottom to keep indices stable
  for (let i = irows.length - 1; i >= 0; i--) {
    if (irows[i][0] === ev.id) itemsSh.deleteRow(i + 2);
  }
  const newRows = (ev.items || []).map(it => [ev.id, it.id, it.qty]);
  if (newRows.length) {
    itemsSh.getRange(itemsSh.getLastRow() + 1, 1, newRows.length, 3).setValues(newRows);
  }
  return { ok: true, id: ev.id };
}

function deleteEvent(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventsSh = ss.getSheetByName(SHEETS.events);
  const itemsSh  = ss.getSheetByName(SHEETS.eventItems);
  const productsSh = ss.getSheetByName(SHEETS.products);

  // Release reservations
  const oldItems = getItemsForEvent(id);
  oldItems.forEach(it => changeReservation(productsSh, it.id, -it.qty));

  // Remove event row
  const erows = eventsSh.getDataRange().getValues();
  erows.shift();
  const erow = erows.findIndex(r => r[0] === id);
  if (erow >= 0) eventsSh.deleteRow(erow + 2);

  // Remove item rows
  const irows = itemsSh.getDataRange().getValues();
  irows.shift();
  for (let i = irows.length - 1; i >= 0; i--) {
    if (irows[i][0] === id) itemsSh.deleteRow(i + 2);
  }
  return { ok: true };
}

// ---------- Helpers ----------
function getItemsForEvent(eventId) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.eventItems);
  const rows = sh.getDataRange().getValues();
  rows.shift();
  return rows.filter(r => r[0] === eventId).map(r => ({ id: r[1], qty: Number(r[2]) || 0 }));
}

function changeReservation(sh, productId, delta) {
  const rows = sh.getDataRange().getValues();
  const headers = rows.shift();
  const idCol = headers.indexOf('id');
  const resCol = headers.indexOf('reserved');
  const row = rows.findIndex(r => r[idCol] === productId);
  if (row < 0) return;
  const cur = Number(rows[row][resCol]) || 0;
  sh.getRange(row + 2, resCol + 1).setValue(Math.max(0, cur + delta));
}

function formatDate(v) {
  if (!v) return '';
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v);
}

function formatTime(v) {
  if (!v) return '';
  if (v instanceof Date) {
    const h = String(v.getHours()).padStart(2, '0');
    const m = String(v.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return String(v);
}
