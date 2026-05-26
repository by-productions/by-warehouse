// Briefing — schedule (3 phases) + items + structured contacts + production tasks
const Briefing = ({ event, onBack }) => {
  if (!event) return null;
  const { productOf, locStr, fmtDate, fmtDateShort, downloadIcs, googleCalendarUrl,
    contactsArray, clientOf, eventHoldStart } = window.WHui;
  const totalItems = (event.items || []).reduce((s, it) => s + it.qty, 0);
  const client = clientOf(event.clientId);
  const allContacts = contactsArray(event);

  const phaseLine = (p) => {
    if (!p || !p.startDate) return { date: '—', time: '' };
    const date = p.endDate && p.endDate !== p.startDate
      ? `${fmtDateShort(p.startDate)} → ${fmtDateShort(p.endDate)}`
      : fmtDate(p.startDate);
    const time = p.startTime ? `${p.startTime}${p.endTime ? `–${p.endTime}` : ''}` : '';
    return { date, time };
  };

  const setup = phaseLine(event.setup);
  const evPhase = phaseLine(event.event);
  const dismantle = phaseLine(event.dismantle);
  const eventSkipped = event.event?.skipped;

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
      <div className="briefing-head" style={client ? { borderBottom: `4px solid ${client.color}` } : undefined}>
        <div className="briefing-eyebrow">
          {event.type === 'booth' ? '🏪 ביתן · דף הנחיה לצוות' : '🎉 אירוע הפקה · דף הנחיה לצוות'}
          {client && <span className="client-chip" style={{ background: client.color, marginInlineStart: 8 }}>{client.name}</span>}
          {event.so && <span className="so-badge-lg">{event.so}</span>}
        </div>
        <h1 className="briefing-title">{event.name}</h1>
        <div className="briefing-date">
          {eventSkipped ? `${setup.date} → ${dismantle.date}` : `${evPhase.date}${evPhase.time ? ` · ${evPhase.time}` : ''}`}
        </div>
      </div>

      <div className="briefing-body">
        <div className="briefing-section">
          <h3>לוחות זמנים</h3>
          <div className="info-grid">
            <div className="info-box" style={{ borderTop: '3px solid var(--teal)' }}>
              <div className="k">🔨 הקמה</div>
              <div className="v">{setup.date}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--ink-2)' }}>{setup.time}</div>
            </div>
            {!eventSkipped && (
              <div className="info-box" style={{ borderTop: '3px solid var(--pink)' }}>
                <div className="k">🎉 האירוע</div>
                <div className="v">{evPhase.date}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--ink-2)' }}>{evPhase.time}</div>
              </div>
            )}
            <div className="info-box" style={{ borderTop: '3px solid var(--yellow)' }}>
              <div className="k">📦 פירוק</div>
              <div className="v">{dismantle.date}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--ink-2)' }}>{dismantle.time}</div>
            </div>
            <div className="info-box" style={{ gridColumn: `span ${eventSkipped ? 2 : 3}` }}>
              <div className="k"><Icon name="pin" size={11} /> מיקום</div>
              <div className="v">{event.location}</div>
            </div>
          </div>
        </div>

        <div className="briefing-section teal">
          <h3>צוות תפעול · {(event.workers || []).length}</h3>
          <div className="worker-chips">
            {(event.workers || []).map((w, i) => (
              <span key={i} className="worker-chip"><span className="av">{w[0]}</span>{w}</span>
            ))}
          </div>
        </div>

        <div className="briefing-section">
          <h3>פריטים · {totalItems} יח׳ · {(event.items || []).length} סוגים</h3>
          <div className="item-list">
            {(event.items || []).map((it, i) => {
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
          <h3>אנשי קשר בשטח ({allContacts.length})</h3>
          {allContacts.length === 0 ? (
            <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>לא הוגדרו אנשי קשר</div>
          ) : allContacts.map((c, i) => (
            <div key={i} className="info-grid" style={{ marginBottom: i < allContacts.length - 1 ? 12 : 0 }}>
              <div className="info-box"><div className="k">{c._kind || 'קשר'}</div><div className="v">{c.name || '—'}</div></div>
              <div className="info-box"><div className="k">תפקיד</div><div className="v">{c.role || '—'}</div></div>
              <div className="info-box"><div className="k">טלפון</div>
                <div className="v" style={{ fontFamily: 'JetBrains Mono, monospace', direction: 'ltr', textAlign: 'right' }}>{c.phone || '—'}</div></div>
            </div>
          ))}
        </div>

        {(event.productionTasks || []).length > 0 && (
          <div className="briefing-section">
            <h3>הפקה ומעקב · {event.productionTasks.length}</h3>
            <div className="item-list">
              {event.productionTasks.map((t, i) => (
                <div key={t.id} className="row" style={{ gridTemplateColumns: '32px 1fr auto auto' }}>
                  <span style={{ fontSize: 18 }}>{t.received ? '✅' : '⏳'}</span>
                  <div>
                    <div className="n">{t.title || '—'}</div>
                    <div className="loc">{t.type === 'carpentry' ? '🪚 נגרות' : t.type === 'print' ? '📄 דפוס' : '📦 אחר'}</div>
                  </div>
                  <span className="loc">{t.sentDate ? `נשלח ${fmtDateShort(t.sentDate)}` : '—'}</span>
                  <span className="q" style={{ color: t.received ? 'var(--ok)' : 'var(--pink)' }}>
                    {t.deadline ? fmtDateShort(t.deadline) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--border)', textAlign: 'center', color: 'var(--ink-4)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {event.id} · מחסן · הופק {fmtDate(new Date().toISOString().slice(0, 10))}
        </div>
      </div>
    </div>
  </>);
};
window.Briefing = Briefing;
