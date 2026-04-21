/**
 * BY Productions — Warehouse Backend
 * ====================================
 * Google Apps Script that exposes the Google Sheet as a JSON API.
 *
 * Setup:
 *   1. Create a new Google Sheet (e.g. "BY Warehouse")
 *   2. Sheet → Extensions → Apps Script
 *   3. Paste this entire file into Code.gs
 *   4. Run `setupSheets()` once (from the menu) to create all tabs + headers
 *   5. Deploy → New deployment → type "Web app"
 *        Execute as: Me
 *        Who has access: Anyone  (or "Anyone with the link")
 *   6. Copy the Web app URL → paste into the app's Settings screen
 */

// ============================================================
// CONFIG
// ============================================================
const SHEETS = {
  products:     ['id','sku','category','name','stock','reserved','zone','row','shelf','w','h','d','notes','image','updated'],
  events:       ['id','type','so','name','setupDate','setupTime','eventDate','eventStart','eventEnd','dismantleDate','dismantleTime','location','workers','accent','image','status','updated'],
  contacts:     ['eventId','name','role','phone','notes'],
  reservations: ['eventId','productId','qty'],
  history:      ['productId','count'],
};

const IMAGE_FOLDER_NAME = 'BY Warehouse Images';  // auto-created in My Drive

// ============================================================
// ENTRY POINTS (Web App)
// ============================================================
function doGet(e) {
  const action = (e.parameter.action || 'all').toLowerCase();
  try {
    if (action === 'all')      return json({ ok: true, data: readAll() });
    if (action === 'products') return json({ ok: true, data: readSheet('products') });
    if (action === 'events')   return json({ ok: true, data: readEvents() });
    if (action === 'ping')     return json({ ok: true, time: new Date().toISOString() });
    return json({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = (body.action || '').toLowerCase();

    if (action === 'upsert_product')  return json({ ok: true, data: upsertRow('products', body.product, 'id') });
    if (action === 'delete_product')  return json({ ok: true, data: deleteRow('products', 'id', body.id) });
    if (action === 'upsert_event')    return json({ ok: true, data: upsertEvent(body.event) });
    if (action === 'delete_event')    return json({ ok: true, data: deleteEvent(body.id) });
    if (action === 'upload_image')    return json({ ok: true, url: uploadImage(body.filename, body.dataUrl) });
    if (action === 'bulk_upsert_products') {
      body.products.forEach(p => upsertRow('products', p, 'id'));
      return json({ ok: true, count: body.products.length });
    }
    return json({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

// ============================================================
// READ
// ============================================================
function readAll() {
  return {
    products:     readSheet('products'),
    events:       readEvents(),
    history:      readSheet('history'),
  };
}

function readSheet(name) {
  const sh = getSheet(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(r => r[0] !== '').map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    // Reshape products: location object + dims object
    if (name === 'products') {
      obj.location = { zone: obj.zone, row: obj.row, shelf: obj.shelf };
      obj.dims = { w: obj.w || 0, h: obj.h || 0, d: obj.d || 0 };
      delete obj.zone; delete obj.row; delete obj.shelf;
      delete obj.w; delete obj.h; delete obj.d;
    }
    return obj;
  });
}

function readEvents() {
  const events = readSheet('events');
  const contacts = readSheet('contacts');
  const reservations = readSheet('reservations');
  return events.map(ev => ({
    id: ev.id,
    type: ev.type,
    so: ev.so,
    name: ev.name,
    setup:     { date: ev.setupDate,     time: ev.setupTime },
    event:     { date: ev.eventDate,     startTime: ev.eventStart, endTime: ev.eventEnd },
    dismantle: { date: ev.dismantleDate, time: ev.dismantleTime },
    location: ev.location,
    workers: String(ev.workers || '').split(',').map(s => s.trim()).filter(Boolean),
    accent: ev.accent || 'pink',
    image: ev.image || null,
    status: ev.status || 'confirmed',
    contacts: contacts.filter(c => c.eventId === ev.id).map(c => ({
      name: c.name, role: c.role, phone: c.phone, notes: c.notes
    })),
    items: reservations.filter(r => r.eventId === ev.id).map(r => ({
      id: r.productId, qty: Number(r.qty) || 0
    })),
  }));
}

// ============================================================
// WRITE
// ============================================================
function upsertRow(sheetName, obj, idField) {
  const sh = getSheet(sheetName);
  const headers = SHEETS[sheetName];
  const values = sh.getDataRange().getValues();
  const idCol = headers.indexOf(idField);
  const row = buildRow(sheetName, obj);
  // find existing
  let foundRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === obj[idField]) { foundRow = i + 1; break; }
  }
  if (foundRow > 0) {
    sh.getRange(foundRow, 1, 1, headers.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return obj;
}

function buildRow(sheetName, obj) {
  const headers = SHEETS[sheetName];
  // Flatten product location + dims
  const flat = Object.assign({}, obj);
  if (sheetName === 'products') {
    if (flat.location) {
      flat.zone = flat.location.zone;
      flat.row  = flat.location.row;
      flat.shelf = flat.location.shelf;
    }
    if (flat.dims) {
      flat.w = flat.dims.w; flat.h = flat.dims.h; flat.d = flat.dims.d;
    }
    flat.updated = new Date();
  }
  return headers.map(h => flat[h] !== undefined && flat[h] !== null ? flat[h] : '');
}

function deleteRow(sheetName, idField, idValue) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();
  const idCol = SHEETS[sheetName].indexOf(idField);
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === idValue) { sh.deleteRow(i + 1); return { deleted: idValue }; }
  }
  return { deleted: null };
}

function upsertEvent(ev) {
  // Flatten the nested event object for the "events" sheet
  const flat = {
    id: ev.id, type: ev.type, so: ev.so, name: ev.name,
    setupDate: ev.setup && ev.setup.date, setupTime: ev.setup && ev.setup.time,
    eventDate: ev.event && ev.event.date, eventStart: ev.event && ev.event.startTime, eventEnd: ev.event && ev.event.endTime,
    dismantleDate: ev.dismantle && ev.dismantle.date, dismantleTime: ev.dismantle && ev.dismantle.time,
    location: ev.location,
    workers: (ev.workers || []).join(', '),
    accent: ev.accent || 'pink',
    image: ev.image || '',
    status: ev.status || 'confirmed',
    updated: new Date(),
  };
  upsertRow('events', flat, 'id');

  // Replace contacts for this event
  deleteByField('contacts', 'eventId', ev.id);
  (ev.contacts || []).forEach(c => {
    getSheet('contacts').appendRow(['contacts', 'name', 'role', 'phone', 'notes'].map((_, i, a) => {
      const key = SHEETS.contacts[i];
      if (key === 'eventId') return ev.id;
      return c[key] !== undefined ? c[key] : '';
    }));
  });

  // Replace reservations for this event
  deleteByField('reservations', 'eventId', ev.id);
  (ev.items || []).forEach(it => {
    getSheet('reservations').appendRow([ev.id, it.id, it.qty]);
  });

  return ev;
}

function deleteEvent(id) {
  deleteRow('events', 'id', id);
  deleteByField('contacts', 'eventId', id);
  deleteByField('reservations', 'eventId', id);
  return { deleted: id };
}

function deleteByField(sheetName, field, value) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();
  const col = SHEETS[sheetName].indexOf(field);
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][col] === value) sh.deleteRow(i + 1);
  }
}

// ============================================================
// IMAGE UPLOAD (to Drive)
// ============================================================
function uploadImage(filename, dataUrl) {
  const folder = getOrCreateFolder(IMAGE_FOLDER_NAME);
  // dataUrl format: "data:image/png;base64,..."
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('invalid dataUrl');
  const mime = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, mime, filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const id = file.getId();
  // Return a direct-viewable URL
  return `https://lh3.googleusercontent.com/d/${id}`;
}

function getOrCreateFolder(name) {
  const iter = DriveApp.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return DriveApp.createFolder(name);
}

// ============================================================
// SETUP (run once from the editor)
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f0f0f0');
    sh.setFrozenRows(1);
  });
  SpreadsheetApp.getUi().alert('✓ כל הלשוניות נוצרו בהצלחה.\n\nעכשיו Deploy → New deployment → Web app.');
}

// ============================================================
// HELPERS
// ============================================================
function getSheet(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name + '. Run setupSheets() first.');
  return sh;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
