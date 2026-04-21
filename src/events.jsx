// Events list + Event editor (3 time windows + image + calendar sync)
const Events = ({ events, products, onOpenEvent, onCreateEvent }) => {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | production | booth

  const counts = useMemo(() => ({
    all: events.length,
    production: events.filter(e => (e.type || 'production') === 'production').length,
    booth: events.filter(e => e.type === 'booth').length,
  }), [events]);

  const filtered = events.filter(e => {
    if (typeFilter !== 'all' && (e.type || 'production') !== typeFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return e.name.toLowerCase().includes(s)
      || (e.location || '').toLowerCase().includes(s)
      || (e.so || '').toLowerCase().includes(s);
  }).sort((a, b) => (a.event?.date || '').localeCompare(b.event?.date || ''));

  return (<>
    <div className="toolbar">
      <div className="search-wrap">
        <Icon name="search" />
        <input placeholder="חיפוש שם · SO · מיקום…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="seg-toggle" style={{ flex: 'none' }}>
        <button type="button" className={typeFilter === 'all' ? 'active' : ''} onClick={() => setTypeFilter('all')}>
          הכל <span style={{ opacity: 0.6, fontSize: 11 }}>{counts.all}</span>
        </button>
        <button type="button" className={typeFilter === 'production' ? 'active' : ''} onClick={() => setTypeFilter('production')}>
          🎉 הפקות <span style={{ opacity: 0.6, fontSize: 11 }}>{counts.production}</span>
        </button>
        <button type="button" className={typeFilter === 'booth' ? 'active' : ''} onClick={() => setTypeFilter('booth')}>
          🏪 ביתנים <span style={{ opacity: 0.6, fontSize: 11 }}>{counts.booth}</span>
        </button>
      </div>
      <button className="btn btn-primary" onClick={onCreateEvent}>
        <Icon name="plus" size={14} /> אירוע חדש
      </button>
    </div>
    {filtered.length === 0 ? (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>אין אירועים.</div>
    ) : (
      <div className="events-grid">
        {filtered.map(ev => {
          const totalItems = ev.items.reduce((s, it) => s + it.qty, 0);
          const isBooth = ev.type === 'booth';
          return (
            <div key={ev.id} className={`event-card ${ev.accent} ${isBooth ? 'booth' : 'prod'}`} onClick={() => onOpenEvent(ev)}
              style={ev.image ? { backgroundImage: `linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.95)), url(${ev.image})`, backgroundSize: 'cover' } : undefined}>
              <div className="event-type-row">
                <span className={`type-badge ${isBooth ? 'booth' : 'prod'}`}>
                  {isBooth ? '🏪 ביתן' : '🎉 הפקה'}
                </span>
                {ev.so && <span className="so-badge">{ev.so}</span>}
              </div>
              <div className="event-date">
                <Icon name="calendar" /> {window.WHui.fmtDate(ev.event?.date)} · {ev.event?.startTime}
              </div>
              <div className="event-name">{ev.name}</div>
              <div className="event-where">
                <Icon name="pin" size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} />
                {ev.location}
              </div>
              <div className="event-stats">
                <span><b>{totalItems}</b> פריטים</span>
                <span><b>{ev.items.length}</b> סוגים</span>
                <span><b>{ev.workers.length}</b> עובדים</span>
                {ev.contacts && <span><b>{ev.contacts.length}</b> אנשי קשר</span>}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>);
};

const EventEditor = ({ event, cartItems, products, onClose, onSave }) => {
  const { Modal, QtyStepper, ImagePicker, productOf, locStr } = window.WHui;
  const [form, setForm] = useState(() => event || {
    id: `EV-${Date.now().toString().slice(-6)}`,
    type: 'production',
    so: '',
    name: '',
    setup:     { date: '', time: '10:00' },
    event:     { date: '', startTime: '19:00', endTime: '' },
    dismantle: { date: '', time: '10:00' },
    location: '',
    contacts: [{ name: '', role: '', phone: '', notes: '' }],
    workers: [],
    items: cartItems || [],
    accent: 'pink',
    image: null,
  });
  const [workerInput, setWorkerInput] = useState('');
  const [manualItem, setManualItem] = useState('');
  const [manualQty, setManualQty] = useState(1);

  const upd = (patch) => setForm(f => ({ ...f, ...patch }));
  const setContact = (i, patch) => setForm(f => ({
    ...f,
    contacts: f.contacts.map((c, idx) => idx === i ? { ...c, ...patch } : c),
  }));
  const addContact = () => setForm(f => ({
    ...f, contacts: [...f.contacts, { name: '', role: '', phone: '', notes: '' }],
  }));
  const removeContact = (i) => setForm(f => ({
    ...f, contacts: f.contacts.filter((_, idx) => idx !== i),
  }));
  const updTime = (key, patch) => setForm(f => ({ ...f, [key]: { ...f[key], ...patch } }));

  const addWorker = () => { if (workerInput.trim()) { upd({ workers: [...form.workers, workerInput.trim()] }); setWorkerInput(''); } };
  const removeWorker = (i) => upd({ workers: form.workers.filter((_, idx) => idx !== i) });
  const addManualItem = () => {
    if (!manualItem) return;
    const exists = form.items.find(it => it.id === manualItem);
    if (exists) upd({ items: form.items.map(it => it.id === manualItem ? { ...it, qty: it.qty + manualQty } : it) });
    else upd({ items: [...form.items, { id: manualItem, qty: manualQty }] });
    setManualItem(''); setManualQty(1);
  };
  const removeItem = (id) => upd({ items: form.items.filter(it => it.id !== id) });
  const setItemQty = (id, qty) => upd({ items: form.items.map(it => it.id === id ? { ...it, qty } : it) });

  // When event date is set, auto-fill setup/dismantle to same day if empty
  const setEventDate = (v) => {
    setForm(f => {
      const n = { ...f, event: { ...f.event, date: v } };
      if (!f.setup.date) n.setup = { ...f.setup, date: v };
      if (!f.dismantle.date) n.dismantle = { ...f.dismantle, date: v };
      return n;
    });
  };

  return (<Modal title={event ? 'עריכת אירוע' : 'אירוע חדש'} subtitle="פרטי אירוע מלאים · לוחות זמנים · פריטים" onClose={onClose} wide
    footer={<>
      <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
      <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name || !form.event.date}>
        {event ? 'שמירת שינויים' : 'יצירת אירוע'}
      </button>
    </>}>
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, marginBottom: 16 }}>
      <ImagePicker value={form.image} onChange={(v) => upd({ image: v })} aspect="4/3" label="הדמיית אירוע" />
      <div>
        <div className="field-row">
          <div className="field" style={{ flex: 1.3 }}><label>סוג פרוייקט</label>
            <div className="seg-toggle">
              <button type="button" className={form.type === 'production' ? 'active' : ''}
                onClick={() => upd({ type: 'production' })}>
                <span>🎉</span> אירוע הפקה
              </button>
              <button type="button" className={form.type === 'booth' ? 'active' : ''}
                onClick={() => upd({ type: 'booth' })}>
                <span>🏪</span> ביתן
              </button>
            </div>
          </div>
          <div className="field"><label>מס' SO</label>
            <input value={form.so} onChange={(e) => upd({ so: e.target.value })}
              placeholder="SO-24831" style={{ fontFamily: 'JetBrains Mono, monospace' }} /></div>
        </div>
        <div className="field"><label>שם {form.type === 'booth' ? 'הביתן' : 'האירוע'}</label>
          <input value={form.name} onChange={(e) => upd({ name: e.target.value })}
            placeholder={form.type === 'booth' ? 'למשל: ביתן גוגל · InfoTech' : 'למשל: חתונה גלית ואיתי'} /></div>
        <div className="field"><label>מיקום</label>
          <input value={form.location} onChange={(e) => upd({ location: e.target.value })} placeholder="כתובת + הוראות גישה" /></div>
        <div className="field"><label>צבע הדגשה</label>
          <select value={form.accent} onChange={(e) => upd({ accent: e.target.value })}>
            <option value="pink">ורוד</option><option value="teal">טורקיז</option><option value="yellow">צהוב</option>
          </select></div>
      </div>
    </div>

    <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 10, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>לוחות זמנים</div>
      <div className="field-row-3">
        <div className="field"><label style={{ color: 'var(--teal)' }}>🔨 הקמה — תאריך</label>
          <input type="date" value={form.setup.date} onChange={(e) => updTime('setup', { date: e.target.value })} /></div>
        <div className="field"><label>הקמה — שעה</label>
          <input type="time" value={form.setup.time} onChange={(e) => updTime('setup', { time: e.target.value })} /></div>
        <div />
      </div>
      <div className="field-row-3">
        <div className="field"><label style={{ color: 'var(--pink)' }}>🎉 אירוע — תאריך</label>
          <input type="date" value={form.event.date} onChange={(e) => setEventDate(e.target.value)} /></div>
        <div className="field"><label>התחלה</label>
          <input type="time" value={form.event.startTime} onChange={(e) => updTime('event', { startTime: e.target.value })} /></div>
        <div className="field"><label>סיום</label>
          <input type="time" value={form.event.endTime} onChange={(e) => updTime('event', { endTime: e.target.value })} /></div>
      </div>
      <div className="field-row-3">
        <div className="field"><label style={{ color: 'var(--yellow)', filter: 'brightness(0.75)' }}>📦 פירוק — תאריך</label>
          <input type="date" value={form.dismantle.date} onChange={(e) => updTime('dismantle', { date: e.target.value })} /></div>
        <div className="field"><label>פירוק — שעה</label>
          <input type="time" value={form.dismantle.time} onChange={(e) => updTime('dismantle', { time: e.target.value })} /></div>
        <div />
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
        הפריטים מוחזקים בשריון מיום ההקמה ועד יום הפירוק. ליומן ב-Google Calendar נשלחות רק שעות האירוע.
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>אנשי קשר ({form.contacts.length})</div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={addContact}>
        <Icon name="plus" size={13} /> איש קשר נוסף
      </button>
    </div>
    {form.contacts.map((c, i) => (
      <div key={i} className="contact-block">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>קשר #{i + 1}</span>
          {form.contacts.length > 1 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeContact(i)}>
              <Icon name="trash" size={12} /> הסרה
            </button>
          )}
        </div>
        <div className="field-row">
          <div className="field"><label>שם</label>
            <input value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} /></div>
          <div className="field"><label>תפקיד</label>
            <input value={c.role} onChange={(e) => setContact(i, { role: e.target.value })} /></div>
        </div>
        <div className="field"><label>טלפון</label>
          <input value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} placeholder="054-0000000" /></div>
        <div className="field"><label>הערות</label>
          <textarea value={c.notes} onChange={(e) => setContact(i, { notes: e.target.value })} rows={2} placeholder="הוראות גישה, מפתחות…" /></div>
      </div>
    ))}

    <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>עובדים</div>
    <div className="worker-chips" style={{ marginBottom: 10 }}>
      {form.workers.map((w, i) => (
        <span key={i} className="worker-chip"><span className="av">{w[0]}</span>{w}
          <button onClick={() => removeWorker(i)} style={{ marginInlineStart: 4, color: 'inherit' }}><Icon name="x" size={12} /></button>
        </span>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <input style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
        placeholder="הוספת שם עובד…" value={workerInput} onChange={(e) => setWorkerInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addWorker())} />
      <button className="btn btn-ghost" onClick={addWorker}><Icon name="plus" size={14} /> הוסף</button>
    </div>

    <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>פריטים נדרשים</div>
    <div className="item-list" style={{ marginBottom: 10 }}>
      {form.items.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>הוסיפו פריטים מהעגלה או ידנית למטה</div>
      ) : form.items.map((it, i) => {
        const p = productOf(it.id); if (!p) return null;
        return (<div key={it.id} className="row">
          <span className="idx">{String(i + 1).padStart(2, '0')}</span>
          <div><div className="n">{p.name}</div><div className="loc">{p.sku} · {locStr(p.location)}</div></div>
          <QtyStepper value={it.qty} max={p.stock} onChange={(v) => setItemQty(it.id, v)} />
          <button className="btn btn-ghost btn-sm" onClick={() => removeItem(it.id)}><Icon name="trash" size={13} /></button>
        </div>);
      })}
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <select style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
        value={manualItem} onChange={(e) => setManualItem(e.target.value)}>
        <option value="">בחרו מוצר להוספה ידנית…</option>
        {products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
      </select>
      <input type="number" min="1" value={manualQty} onChange={(e) => setManualQty(Math.max(1, +e.target.value))}
        style={{ width: 72, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, textAlign: 'center' }} />
      <button className="btn btn-ghost" onClick={addManualItem}><Icon name="plus" size={14} /> הוסף</button>
    </div>
  </Modal>);
};

window.Events = Events;
window.EventEditor = EventEditor;
