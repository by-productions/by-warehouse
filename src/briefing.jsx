// Briefing — 3 days schedule + image + calendar buttons
const Briefing = ({ event, onBack }) => {
  if (!event) return null;
  const { productOf, locStr, fmtDate, downloadIcs, googleCalendarUrl } = window.WHui;
  const totalItems = event.items.reduce((s, it) => s + it.qty, 0);
  return (<>
    <div className="toolbar no-print">
      <button className="btn btn-ghost" onClick={onBack}>
        <Icon name="arrow" size={14} style={{ transform: 'scaleX(-1)' }} /> חזרה
      </button>
      <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
        <a className="btn btn-ghost" href={googleCalendarUrl(event)} target="_blank" rel="noopener">
          <Icon name="calendar" size={14} /> Google Calendar
        </a>
        <button className="btn btn-ghost" onClick={() => downloadIcs(event)}>
          <Icon name="download" size={14} /> .ics לעוזרים
        </button>
        <button className="btn btn-ghost" onClick={() => window.print()}>
          <Icon name="print" size={14} /> הדפסה
        </button>
      </span>
    </div>

    <div className="briefing" id="briefing-print">
      {event.image && (
        <div style={{ height: 200, background: `center/cover url(${event.image})` }} />
      )}
      <div className="briefing-head">
        <div className="briefing-eyebrow">
          {event.type === 'booth' ? '🏪 ביתן · דף הנחיה לצוות' : '🎉 אירוע הפקה · דף הנחיה לצוות'}
          {event.so && <span className="so-badge-lg">{event.so}</span>}
        </div>
        <h1 className="briefing-title">{event.name}</h1>
        <div className="briefing-date">{fmtDate(event.event.date)} · {event.event.startTime}{event.event.endTime ? `–${event.event.endTime}` : ''}</div>
      </div>

      <div className="briefing-body">
        <div className="briefing-section">
          <h3>לוחות זמנים</h3>
          <div className="info-grid">
            <div className="info-box" style={{ borderTop: '3px solid var(--teal)' }}>
              <div className="k">🔨 הקמה</div>
              <div className="v">{fmtDate(event.setup.date)}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--ink-2)' }}>{event.setup.time}</div>
            </div>
            <div className="info-box" style={{ borderTop: '3px solid var(--pink)' }}>
              <div className="k">🎉 האירוע</div>
              <div className="v">{fmtDate(event.event.date)}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--ink-2)' }}>
                {event.event.startTime}{event.event.endTime ? `–${event.event.endTime}` : ''}
              </div>
            </div>
            <div className="info-box" style={{ borderTop: '3px solid var(--yellow)' }}>
              <div className="k">📦 פירוק</div>
              <div className="v">{fmtDate(event.dismantle.date)}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--ink-2)' }}>{event.dismantle.time}</div>
            </div>
            <div className="info-box" style={{ gridColumn: 'span 3' }}>
              <div className="k"><Icon name="pin" size={11} /> מיקום</div>
              <div className="v">{event.location}</div>
            </div>
          </div>
        </div>

        <div className="briefing-section teal">
          <h3>צוות · {event.workers.length}</h3>
          <div className="worker-chips">
            {event.workers.map((w, i) => (
              <span key={i} className="worker-chip"><span className="av">{w[0]}</span>{w}</span>
            ))}
          </div>
        </div>

        <div className="briefing-section">
          <h3>פריטים · {totalItems} יח׳ · {event.items.length} סוגים</h3>
          <div className="item-list">
            {event.items.map((it, i) => {
              const p = productOf(it.id); if (!p) return null;
              return (<div key={it.id} className="row">
                <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                {p.image
                  ? <img src={p.image} alt="" className="thumb" />
                  : <div className="thumb" />}
                <div><div className="n">{p.name}</div><div className="loc">{p.sku}</div></div>
                <span className="loc"><Icon name="pin" size={11} /> {locStr(p.location)}</span>
                <span className="q">×{it.qty}</span>
              </div>);
            })}
          </div>
        </div>

        <div className="briefing-section yellow">
          <h3>אנשי קשר בשטח ({(event.contacts || []).length})</h3>
          {(event.contacts || []).map((c, i) => (
            <div key={i} className="info-grid" style={{ marginBottom: i < event.contacts.length - 1 ? 12 : 0 }}>
              <div className="info-box"><div className="k">שם</div><div className="v">{c.name || '—'}</div></div>
              <div className="info-box"><div className="k">תפקיד</div><div className="v">{c.role || '—'}</div></div>
              <div className="info-box"><div className="k">טלפון</div>
                <div className="v" style={{ fontFamily: 'JetBrains Mono, monospace', direction: 'ltr', textAlign: 'right' }}>{c.phone || '—'}</div></div>
              {c.notes && <div className="info-box" style={{ gridColumn: '1 / -1' }}>
                <div className="k">הערות</div><div className="v" style={{ fontWeight: 500, fontSize: 13 }}>{c.notes}</div></div>}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--border)', textAlign: 'center', color: 'var(--ink-4)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {event.id} · מחסן · הופק {fmtDate(new Date().toISOString().slice(0, 10))}
        </div>
      </div>
    </div>
  </>);
};
window.Briefing = Briefing;
