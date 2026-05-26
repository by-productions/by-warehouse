// Tracking — aggregates productionTasks across all events
// Shows print/carpentry/other items with sent date, deadline, and received toggle.
const Tracking = ({ events, clients, onUpdateTask, onOpenEvent }) => {
  const { fmtDate, fmtDateShort, clientOf } = window.WHui;
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | print | carpentry | other
  const [statusFilter, setStatusFilter] = useState('open'); // open | done | all

  // Flatten: { ...task, eventId, eventName, clientId, deadline, ... }
  const allTasks = useMemo(() => {
    const out = [];
    events.forEach(ev => {
      (ev.productionTasks || []).forEach(t => {
        out.push({
          ...t,
          eventId: ev.id,
          eventName: ev.name,
          clientId: ev.clientId,
          eventType: ev.type,
        });
      });
    });
    return out;
  }, [events]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return allTasks.filter(t => {
      if (typeFilter !== 'all' && (t.type || 'other') !== typeFilter) return false;
      if (statusFilter === 'open' && t.received) return false;
      if (statusFilter === 'done' && !t.received) return false;
      if (q) {
        const s = q.toLowerCase();
        const cli = clientOf(t.clientId);
        if (!(t.title || '').toLowerCase().includes(s)
          && !(t.eventName || '').toLowerCase().includes(s)
          && !(cli ? cli.name.toLowerCase().includes(s) : false)) return false;
      }
      return true;
    }).sort((a, b) => {
      // Open ones first, then by deadline ascending (urgent first)
      if (a.received !== b.received) return a.received ? 1 : -1;
      const da = a.deadline || '9999-12-31';
      const db = b.deadline || '9999-12-31';
      return da.localeCompare(db);
    }).map(t => {
      const today_ = today;
      const isOverdue = !t.received && t.deadline && t.deadline < today_;
      const isUrgent  = !t.received && t.deadline && t.deadline >= today_ &&
        (new Date(t.deadline) - new Date(today_)) <= 7 * 86400000;
      return { ...t, isOverdue, isUrgent };
    });
  }, [allTasks, typeFilter, statusFilter, q]);

  const counts = useMemo(() => {
    const open = allTasks.filter(t => !t.received).length;
    const overdue = allTasks.filter(t => {
      if (t.received || !t.deadline) return false;
      return t.deadline < new Date().toISOString().slice(0, 10);
    }).length;
    return { open, done: allTasks.length - open, overdue, total: allTasks.length };
  }, [allTasks]);

  const handleToggle = (t) => onUpdateTask(t.eventId, t.id, { received: !t.received });

  return (<>
    <div className="stats-grid" style={{ marginBottom: 16 }}>
      <div className="stat"><div className="label">סה״כ משימות</div><div className="num">{counts.total}</div><div className="trend">בכל האירועים</div></div>
      <div className="stat accent"><div className="label">פתוחות</div><div className="num">{counts.open}</div><div className="trend">בהמתנה</div></div>
      <div className="stat" style={{ borderColor: counts.overdue > 0 ? 'var(--bad)' : undefined }}>
        <div className="label" style={{ color: counts.overdue > 0 ? 'var(--bad)' : undefined }}>חוסר עמידה בדד-ליין</div>
        <div className="num" style={{ color: counts.overdue > 0 ? 'var(--bad)' : undefined }}>{counts.overdue}</div>
        <div className="trend">דורש טיפול דחוף</div>
      </div>
      <div className="stat teal"><div className="label">הושלמו</div><div className="num">{counts.done}</div><div className="trend">חומרים התקבלו</div></div>
    </div>

    <div className="toolbar">
      <div className="search-wrap">
        <Icon name="search" />
        <input placeholder="חיפוש משימה · אירוע · לקוח…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="seg-toggle" style={{ flex: 'none' }}>
        <button type="button" className={statusFilter === 'open' ? 'active' : ''} onClick={() => setStatusFilter('open')}>פתוחות ({counts.open})</button>
        <button type="button" className={statusFilter === 'done' ? 'active' : ''} onClick={() => setStatusFilter('done')}>הושלמו ({counts.done})</button>
        <button type="button" className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>הכל ({counts.total})</button>
      </div>
      <div className="seg-toggle" style={{ flex: 'none' }}>
        <button type="button" className={typeFilter === 'all' ? 'active' : ''} onClick={() => setTypeFilter('all')}>הכל</button>
        <button type="button" className={typeFilter === 'print' ? 'active' : ''} onClick={() => setTypeFilter('print')}>📄 דפוס</button>
        <button type="button" className={typeFilter === 'carpentry' ? 'active' : ''} onClick={() => setTypeFilter('carpentry')}>🪚 נגרות</button>
      </div>
    </div>

    {filtered.length === 0 ? (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
        אין משימות הפקה להציג.<br />
        <span style={{ fontSize: 12 }}>היכנסו לאירוע ספציפי כדי להוסיף משימות מעקב.</span>
      </div>
    ) : (
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 50 }}></th>
              <th>משימה</th>
              <th>סוג</th>
              <th>אירוע · לקוח</th>
              <th>נשלח</th>
              <th>דד-ליין</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const cli = clientOf(t.clientId);
              return (
                <tr key={`${t.eventId}_${t.id}`} className={`task-tr ${t.received ? 'done' : ''} ${t.isOverdue ? 'overdue' : ''}`}>
                  <td>
                    <button className={`task-check ${t.received ? 'checked' : ''}`}
                      onClick={() => handleToggle(t)}
                      title={t.received ? 'בוטל סימון' : 'סמן שהתקבל'}>
                      {t.received ? '✓' : ''}
                    </button>
                  </td>
                  <td><div className="tbl-name">{t.title || '—'}</div></td>
                  <td>
                    <span className="badge">
                      {t.type === 'carpentry' ? '🪚 נגרות' : t.type === 'print' ? '📄 דפוס' : '📦 אחר'}
                    </span>
                  </td>
                  <td>
                    <div className="tbl-name" style={{ fontSize: 12 }}>{t.eventName}</div>
                    {cli && <span className="client-chip" style={{ background: cli.color, fontSize: 10 }}>{cli.name}</span>}
                  </td>
                  <td className="nums" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{t.sentDate ? fmtDateShort(t.sentDate) : '—'}</td>
                  <td className="nums" style={{ fontSize: 12, fontWeight: 600, color: t.isOverdue ? 'var(--bad)' : t.isUrgent ? 'var(--warn)' : 'inherit' }}>
                    {t.deadline ? fmtDateShort(t.deadline) : '—'}
                    {t.isOverdue && <div style={{ fontSize: 10, fontWeight: 500 }}>איחור</div>}
                    {!t.isOverdue && t.isUrgent && <div style={{ fontSize: 10, fontWeight: 500 }}>דחוף</div>}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      const ev = events.find(e => e.id === t.eventId);
                      if (ev) onOpenEvent(ev);
                    }} title="פתיחת האירוע">
                      <Icon name="arrow" size={13} style={{ transform: 'scaleX(-1)' }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </>);
};

window.Tracking = Tracking;
