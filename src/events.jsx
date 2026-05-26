// Events list + Event editor — clients, date ranges, structured contacts, production tasks
const Events = ({ events, products, clients, onOpenEvent, onCreateEvent }) => {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | production | booth
  const [clientFilter, setClientFilter] = useState('');

  const counts = useMemo(() => ({
    all: events.length,
    production: events.filter(e => (e.type || 'production') === 'production').length,
    booth: events.filter(e => e.type === 'booth').length,
  }), [events]);

  const filtered = events.filter(e => {
    if (typeFilter !== 'all' && (e.type || 'production') !== typeFilter) return false;
    if (clientFilter && e.clientId !== clientFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    const cli = clients.find(c => c.id === e.clientId);
    return e.name.toLowerCase().includes(s)
      || (e.location || '').toLowerCase().includes(s)
      || (e.so || '').toLowerCase().includes(s)
      || (cli ? cli.name.toLowerCase().includes(s) : false);
  }).sort((a, b) => {
    const da = window.WHui.eventHoldStart(a) || '';
    const db = window.WHui.eventHoldStart(b) || '';
    return da.localeCompare(db);
  });

  return (<>
    <div className="toolbar">
      <div className="search-wrap">
        <Icon name="search" />
        <input placeholder="חיפוש שם · SO · מיקום · לקוח…" value={q} onChange={(e) => setQ(e.target.value)} />
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
      <select className="chip" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
        style={{ padding: '7px 12px' }}>
        <option value="">כל הלקוחות</option>
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button className="btn btn-primary" onClick={onCreateEvent}>
        <Icon name="plus" size={14} /> אירוע חדש
      </button>
    </div>
    {filtered.length === 0 ? (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>אין אירועים.</div>
    ) : (
      <div className="events-grid">
        {filtered.map(ev => {
          const totalItems = (ev.items || []).reduce((s, it) => s + it.qty, 0);
          const isBooth = ev.type === 'booth';
          const client = clients.find(c => c.id === ev.clientId);
          const clientColor = client?.color || 'var(--pink)';
          const start = window.WHui.eventHoldStart(ev);
          const evWin = ev.event && !ev.event.skipped ? ev.event : null;
          return (
            <div key={ev.id} className={`event-card ${isBooth ? 'booth' : 'prod'}`} onClick={() => onOpenEvent(ev)}
              style={{
                '--client-color': clientColor,
                ...(ev.image ? { backgroundImage: `linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.95)), url(${ev.image})`, backgroundSize: 'cover' } : {}),
              }}>
              <div className="event-type-row">
                <span className={`type-badge ${isBooth ? 'booth' : 'prod'}`}>
                  {isBooth ? '🏪 ביתן' : '🎉 הפקה'}
                </span>
                {client && (
                  <span className="client-chip" style={{ background: clientColor }}>
                    {client.name}
                  </span>
                )}
                {ev.so && <span className="so-badge">{ev.so}</span>}
              </div>
              <div className="event-date">
                <Icon name="calendar" /> {window.WHui.fmtDate(start)}
                {evWin && evWin.startTime ? ` · ${evWin.startTime}` : ''}
              </div>
              <div className="event-name">{ev.name}</div>
              <div className="event-where">
                <Icon name="pin" size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} />
                {ev.location}
              </div>
              <div className="event-stats">
                <span><b>{totalItems}</b> פריטים</span>
                <span><b>{(ev.items || []).length}</b> סוגים</span>
                <span><b>{(ev.workers || []).length}</b> תפעול</span>
                {ev.productionTasks?.length > 0 && (
                  <span><b>{ev.productionTasks.filter(t => !t.received).length}</b>/{ev.productionTasks.length} הפקה</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>);
};

// ---------- Editor ----------
const blankPhase = () => ({ startDate: '', endDate: '', startTime: '', endTime: '' });
const blankContact = () => ({ name: '', role: '', phone: '' });

const EventEditor = ({ event, cartItems, products, clients, onClose, onSave }) => {
  const { Modal, QtyStepper, ImagePicker, productOf, locStr } = window.WHui;
  const [form, setForm] = useState(() => {
    if (event) return event; // already migrated upstream
    return {
      id: `EV-${Date.now().toString().slice(-6)}`,
      type: 'production',
      so: '',
      name: '',
      clientId: '',
      setup:     { startDate: '', endDate: '', startTime: '10:00', endTime: '14:00' },
      event:     { startDate: '', endDate: '', startTime: '19:00', endTime: '', skipped: false },
      dismantle: { startDate: '', endDate: '', startTime: '09:00', endTime: '12:00' },
      location: '',
      contacts: {
        client:   blankContact(),
        producer: blankContact(),
        suppliers: [],
      },
      workers: [],
      items: cartItems || [],
      productionTasks: [],
      image: null,
    };
  });
  const [workerInput, setWorkerInput] = useState('');
  const [manualItem, setManualItem] = useState('');
  const [manualQty, setManualQty] = useState(1);

  const upd = (patch) => setForm(f => ({ ...f, ...patch }));
  const updPhase = (key, patch) => setForm(f => ({ ...f, [key]: { ...f[key], ...patch } }));
  const updContact = (kind, patch) => setForm(f => ({
    ...f,
    contacts: { ...f.contacts, [kind]: { ...f.contacts[kind], ...patch } },
  }));
  const setSupplier = (i, patch) => setForm(f => ({
    ...f,
    contacts: { ...f.contacts, suppliers: f.contacts.suppliers.map((s, idx) => idx === i ? { ...s, ...patch } : s) },
  }));
  const addSupplier = () => setForm(f => ({
    ...f,
    contacts: { ...f.contacts, suppliers: [...f.contacts.suppliers, blankContact()] },
  }));
  const removeSupplier = (i) => setForm(f => ({
    ...f,
    contacts: { ...f.contacts, suppliers: f.contacts.suppliers.filter((_, idx) => idx !== i) },
  }));

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

  // Production tasks
  const addTask = () => upd({
    productionTasks: [...(form.productionTasks || []), {
      id: `pt_${Date.now()}`, title: '', type: 'print',
      sentDate: '', deadline: '', received: false,
    }],
  });
  const updTask = (i, patch) => upd({
    productionTasks: form.productionTasks.map((t, idx) => idx === i ? { ...t, ...patch } : t),
  });
  const removeTask = (i) => upd({ productionTasks: form.productionTasks.filter((_, idx) => idx !== i) });

  // Auto-mirror setup start → dismantle start if empty when first date is entered
  const setSetupStart = (v) => setForm(f => {
    const n = { ...f, setup: { ...f.setup, startDate: v, endDate: f.setup.endDate || v } };
    if (!f.event.startDate && !f.event.skipped) n.event = { ...f.event, startDate: v, endDate: v };
    if (!f.dismantle.startDate) n.dismantle = { ...f.dismantle, startDate: v, endDate: v };
    return n;
  });

  // Auto-show: derived "valid to save"
  const canSave = form.name && form.setup.startDate;

  const selectedClient = clients.find(c => c.id === form.clientId);

  return (<Modal title={event && event.name ? 'עריכת אירוע' : 'אירוע חדש'}
    subtitle="פרטי לקוח · לוחות זמנים · אנשי קשר · פריטים · הפקה"
    onClose={onClose} wide
    footer={<>
      <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
      <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!canSave}>
        {event && event.name ? 'שמירת שינויים' : 'יצירת אירוע'}
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

        <div className="field"><label>לקוח</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selectedClient && (
              <span style={{ width: 16, height: 16, borderRadius: 4, background: selectedClient.color, flex: '0 0 16px', border: '1px solid var(--border)' }} />
            )}
            <select value={form.clientId} onChange={(e) => upd({ clientId: e.target.value })} style={{ flex: 1 }}>
              <option value="">— בחרו לקוח —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="field"><label>שם {form.type === 'booth' ? 'הביתן' : 'האירוע'}</label>
          <input value={form.name} onChange={(e) => upd({ name: e.target.value })}
            placeholder={form.type === 'booth' ? 'למשל: ביתן גוגל · InfoTech' : 'למשל: חתונה גלית ואיתי'} /></div>
        <div className="field"><label>מיקום</label>
          <input value={form.location} onChange={(e) => upd({ location: e.target.value })} placeholder="כתובת + הוראות גישה" /></div>
      </div>
    </div>

    {/* Timeline */}
    <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 10, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>לוחות זמנים</div>

      {/* Setup */}
      <PhaseEditor label="🔨 הקמה" color="var(--teal)"
        phase={form.setup}
        onChange={(patch) => {
          if (patch.startDate !== undefined && !form.setup.startDate) setSetupStart(patch.startDate);
          else updPhase('setup', patch);
        }} />

      {/* Event (skippable) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pink)' }}>🎉 אירוע</span>
        <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.event.skipped || false}
            onChange={(e) => updPhase('event', { skipped: e.target.checked })} />
          ללא יום אירוע (רק הקמה ופירוק)
        </label>
      </div>
      {!form.event.skipped && (
        <PhaseEditor label="" color="var(--pink)" phase={form.event}
          onChange={(patch) => updPhase('event', patch)} />
      )}

      {/* Dismantle */}
      <div style={{ marginTop: 14 }}>
        <PhaseEditor label="📦 פירוק" color="var(--yellow)"
          colorAdjust="brightness(0.75)"
          phase={form.dismantle}
          onChange={(patch) => updPhase('dismantle', patch)} />
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
        הפריטים נחשבים משוריינים מתחילת ההקמה ועד סוף הפירוק. ליומן Google נשלח חלון האירוע (או הקמה→פירוק כשאין יום אירוע).
      </div>
    </div>

    {/* Contacts — structured */}
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>אנשי קשר</div>
    <div className="contact-row">
      <ContactCard kind="לקוח" icon="👤" contact={form.contacts.client}
        onChange={(p) => updContact('client', p)} />
      <ContactCard kind="מפיק/ה" icon="🎯" contact={form.contacts.producer}
        onChange={(p) => updContact('producer', p)} />
    </div>

    {form.type === 'booth' && (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>
            ספקים נוספים ({form.contacts.suppliers.length})
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addSupplier}>
            <Icon name="plus" size={12} /> ספק
          </button>
        </div>
        {form.contacts.suppliers.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 10, background: 'var(--surface-2)', borderRadius: 8 }}>
            אין ספקים. הוסיפו ספק כשיש דפוס/נגרות/חיצוני שמשתתף בביתן.
          </div>
        )}
        {form.contacts.suppliers.map((s, i) => (
          <div key={i} className="contact-block compact">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>ספק #{i + 1}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeSupplier(i)}>
                <Icon name="trash" size={11} />
              </button>
            </div>
            <div className="field-row-3">
              <div className="field" style={{ marginBottom: 0 }}><label>שם</label>
                <input value={s.name} onChange={(e) => setSupplier(i, { name: e.target.value })} /></div>
              <div className="field" style={{ marginBottom: 0 }}><label>תפקיד</label>
                <input value={s.role} onChange={(e) => setSupplier(i, { role: e.target.value })} placeholder="דפוס · נגרות · חשמלאי" /></div>
              <div className="field" style={{ marginBottom: 0 }}><label>טלפון</label>
                <input value={s.phone} onChange={(e) => setSupplier(i, { phone: e.target.value })} placeholder="054-…" /></div>
            </div>
          </div>
        ))}
      </>
    )}

    <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

    {/* Operations workers */}
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>עובדי תפעול</div>
    <div className="worker-chips" style={{ marginBottom: 10 }}>
      {form.workers.map((w, i) => (
        <span key={i} className="worker-chip"><span className="av">{w[0]}</span>{w}
          <button onClick={() => removeWorker(i)} style={{ marginInlineStart: 4, color: 'inherit' }}><Icon name="x" size={12} /></button>
        </span>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <input style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
        placeholder="הוספת שם עובד תפעול…" value={workerInput} onChange={(e) => setWorkerInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addWorker())} />
      <button className="btn btn-ghost" onClick={addWorker}><Icon name="plus" size={14} /> הוסף</button>
    </div>

    <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

    {/* Items */}
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>פריטים מהמלאי</div>
    <div className="item-list" style={{ marginBottom: 10 }}>
      {form.items.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
          הוסיפו פריטים מהבחירה למטה (או דרך עגלת השריון מהקטלוג)
        </div>
      ) : form.items.map((it, i) => {
        const p = productOf(it.id); if (!p) return null;
        const subtotal = (p.rentalPrice || 0) * it.qty;
        return (<div key={it.id} className="row">
          <span className="idx">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <div className="n">{p.name}</div>
            <div className="loc">{p.sku} · {locStr(p.location)}{p.rentalPrice ? ` · ₪${p.rentalPrice}` : ''}</div>
          </div>
          <QtyStepper value={it.qty} max={p.stock} onChange={(v) => setItemQty(it.id, v)} />
          {subtotal > 0 && <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>₪{subtotal.toLocaleString()}</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => removeItem(it.id)}><Icon name="trash" size={13} /></button>
        </div>);
      })}
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <select style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
        value={manualItem} onChange={(e) => setManualItem(e.target.value)}>
        <option value="">בחרו מוצר להוספה…</option>
        {products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
      </select>
      <input type="number" min="1" value={manualQty} onChange={(e) => setManualQty(Math.max(1, +e.target.value))}
        style={{ width: 72, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, textAlign: 'center' }} />
      <button className="btn btn-ghost" onClick={addManualItem}><Icon name="plus" size={14} /> הוסף</button>
    </div>

    {/* Subtotal of rental */}
    {form.items.length > 0 && (() => {
      const total = form.items.reduce((s, it) => {
        const p = productOf(it.id);
        return s + ((p?.rentalPrice || 0) * it.qty);
      }, 0);
      return total > 0 ? (
        <div style={{ marginTop: 10, textAlign: 'left', fontSize: 13, color: 'var(--ink-2)' }}>
          סכום השכרה משוער: <b style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink)' }}>₪{total.toLocaleString()}</b>
        </div>
      ) : null;
    })()}

    <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

    {/* Production & Tracking */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>הפקה ומעקב — דפוס / נגרות</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={addTask}>
        <Icon name="plus" size={13} /> משימה
      </button>
    </div>
    {(form.productionTasks || []).length === 0 && (
      <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 10, background: 'var(--surface-2)', borderRadius: 8 }}>
        אין משימות הפקה. הוסיפו משימה (באנר, מיתוג, דלפק וכו') כשיש מה לעקוב.
      </div>
    )}
    {(form.productionTasks || []).map((t, i) => (
      <div key={t.id} className="task-row">
        <button type="button"
          className={`task-check ${t.received ? 'checked' : ''}`}
          onClick={() => updTask(i, { received: !t.received })}
          title={t.received ? 'התקבל ✓' : 'לא התקבל'}>
          {t.received ? '✓' : ''}
        </button>
        <div className="task-fields">
          <input className="task-title" value={t.title}
            onChange={(e) => updTask(i, { title: e.target.value })}
            placeholder="תיאור (באנר, דלפק…)" />
          <div className="task-meta">
            <select value={t.type} onChange={(e) => updTask(i, { type: e.target.value })}>
              <option value="print">📄 דפוס</option>
              <option value="carpentry">🪚 נגרות</option>
              <option value="other">📦 אחר</option>
            </select>
            <label>נשלח: <input type="date" value={t.sentDate} onChange={(e) => updTask(i, { sentDate: e.target.value })} /></label>
            <label>דד-ליין: <input type="date" value={t.deadline} onChange={(e) => updTask(i, { deadline: e.target.value })} /></label>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => removeTask(i)}><Icon name="trash" size={12} /></button>
      </div>
    ))}
  </Modal>);
};

// Sub-component: phase editor with date range + time range
const PhaseEditor = ({ label, color, colorAdjust, phase, onChange }) => (
  <div style={{ marginTop: label ? 8 : 0 }}>
    {label && (
      <div style={{ fontSize: 12, fontWeight: 700, color, filter: colorAdjust, marginBottom: 6 }}>
        {label}
      </div>
    )}
    <div className="phase-grid">
      <div className="field" style={{ marginBottom: 0 }}>
        <label>מתאריך</label>
        <input type="date" value={phase.startDate || ''}
          onChange={(e) => onChange({ startDate: e.target.value, endDate: phase.endDate || e.target.value })} />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>עד תאריך</label>
        <input type="date" value={phase.endDate || ''}
          onChange={(e) => onChange({ endDate: e.target.value })} />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>משעה</label>
        <input type="time" value={phase.startTime || ''}
          onChange={(e) => onChange({ startTime: e.target.value })} />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>עד שעה</label>
        <input type="time" value={phase.endTime || ''}
          onChange={(e) => onChange({ endTime: e.target.value })} />
      </div>
    </div>
  </div>
);

// Sub-component: compact structured contact (client / producer)
const ContactCard = ({ kind, icon, contact, onChange }) => (
  <div className="contact-card">
    <div className="contact-kind">{icon} {kind}</div>
    <div className="field-row-3">
      <div className="field" style={{ marginBottom: 0 }}><label>שם</label>
        <input value={contact.name} onChange={(e) => onChange({ name: e.target.value })} /></div>
      <div className="field" style={{ marginBottom: 0 }}><label>תפקיד</label>
        <input value={contact.role} onChange={(e) => onChange({ role: e.target.value })} /></div>
      <div className="field" style={{ marginBottom: 0 }}><label>טלפון</label>
        <input value={contact.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="054-…" /></div>
    </div>
  </div>
);

window.Events = Events;
window.EventEditor = EventEditor;
window.PhaseEditor = PhaseEditor;
