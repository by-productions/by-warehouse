// Reports: most-used items, category distribution, low stock, availability timeline
const Reports = ({ products, events }) => {
  const { CATEGORIES, HISTORY_ITEMS } = window.WarehouseData;
  const { locStr, fmtDateShort, productOf, reservedInWindow } = window.WHui;

  const stats = useMemo(() => {
    const totalItems = products.reduce((s, p) => s + p.stock, 0);
    const reserved = products.reduce((s, p) => s + p.reserved, 0);
    return { totalItems, reserved, avail: totalItems - reserved, kinds: products.length };
  }, [products]);

  // Most-used: merge history + current events
  const mostUsed = useMemo(() => {
    const m = {};
    HISTORY_ITEMS.forEach(({ id, count }) => { m[id] = (m[id] || 0) + count; });
    events.forEach(ev => ev.items.forEach(it => { m[it.id] = (m[it.id] || 0) + it.qty; }));
    return Object.entries(m).map(([id, n]) => ({ p: productOf(id), n })).filter(x => x.p)
      .sort((a, b) => b.n - a.n).slice(0, 10);
  }, [events]);
  const maxUsed = Math.max(...mostUsed.map(x => x.n), 1);

  const catDist = useMemo(() => {
    const m = {}; CATEGORIES.forEach(c => { m[c.id] = 0; });
    products.forEach(p => { m[p.category] += p.stock; });
    const mx = Math.max(...Object.values(m), 1);
    return CATEGORIES.map(c => ({ ...c, stock: m[c.id], pct: (m[c.id] / mx) * 100 }));
  }, [products]);

  const lowItems = products.map(p => ({ p, avail: p.stock - p.reserved }))
    .filter(x => x.avail > 0 && x.avail / Math.max(1, x.p.stock) < 0.25)
    .sort((a, b) => a.avail - b.avail).slice(0, 6);

  // Availability timeline: next 8 weeks, per-week reservation %
  const weeks = useMemo(() => {
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 8; i++) {
      const from = new Date(today); from.setDate(from.getDate() + i * 7);
      const to = new Date(from); to.setDate(to.getDate() + 6);
      const fromISO = from.toISOString().slice(0, 10);
      const toISO = to.toISOString().slice(0, 10);
      let reserved = 0;
      products.forEach(p => { reserved += reservedInWindow(events, p.id, fromISO, toISO); });
      const total = products.reduce((s, p) => s + p.stock, 0);
      out.push({ label: fromISO.slice(5), pct: Math.min(100, (reserved / Math.max(1, total)) * 100), reserved });
    }
    return out;
  }, [events, products]);

  return (<>
    <div className="stats-grid">
      <div className="stat"><div className="label">סה״כ פריטים</div><div className="num">{stats.totalItems.toLocaleString()}</div><div className="trend">{stats.kinds} סוגים</div></div>
      <div className="stat accent"><div className="label">משוריינים</div><div className="num">{stats.reserved}</div><div className="trend">{((stats.reserved / Math.max(1, stats.totalItems)) * 100).toFixed(0)}% מהמלאי</div></div>
      <div className="stat teal"><div className="label">זמינים</div><div className="num">{stats.avail}</div><div className="trend">פנויים להזמנה</div></div>
      <div className="stat"><div className="label">אירועים קרובים</div><div className="num">{events.length}</div><div className="trend">במערכת</div></div>
    </div>

    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>תפוסה שבועית · 8 שבועות קדימה</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, padding: '10px 0' }}>
        {weeks.map((w, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{w.reserved}</span>
            <div style={{ width: '100%', height: `${Math.max(2, w.pct)}%`, background: w.pct > 60 ? 'var(--pink)' : w.pct > 30 ? 'var(--yellow)' : 'var(--teal)', borderRadius: '6px 6px 0 0', minHeight: 4 }} />
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{w.label}</span>
          </div>
        ))}
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>הפריטים שהכי שימשו אותנו</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mostUsed.map((x, i) => (
            <div key={x.p.id} style={{ display: 'grid', gridTemplateColumns: '24px 40px 1fr 70px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 11 }}>#{i + 1}</span>
              {x.p.image ? <img src={x.p.image} style={{ width: 40, height: 30, borderRadius: 4, objectFit: 'cover' }} /> : <div style={{ width: 40, height: 30, background: 'var(--surface-2)', borderRadius: 4 }} />}
              <div style={{ display: 'grid' }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.p.name}</div>
                <div style={{ height: 5, background: 'var(--bg)', borderRadius: 999, marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${(x.n / maxUsed) * 100}%`, background: 'var(--pink)', borderRadius: 999 }} />
                </div>
              </div>
              <span className="mono" style={{ textAlign: 'left', color: 'var(--ink-2)', fontWeight: 600 }}>{x.n.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>מלאי נמוך</div>
        {lowItems.length === 0 ? <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>אין פריטים במלאי נמוך 🎉</div> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lowItems.map(({ p, avail }) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <div style={{ flex: 1, fontWeight: 500 }}>{p.name}</div>
                <span className="badge warn"><span className="dot" /> {avail}/{p.stock}</span>
              </div>
            ))}
          </div>}
      </div>
    </div>

    <div className="card" style={{ padding: 20, marginTop: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>התפלגות מלאי לפי קטגוריה</div>
      <div className="cat-bars">
        {catDist.map(c => (
          <div key={c.id} className="cat-bar-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="chip-dot" style={{ background: c.color }} /><span style={{ fontWeight: 500 }}>{c.label}</span>
            </span>
            <div className="cat-bar"><div className="fill" style={{ width: `${c.pct}%`, background: c.color }} /></div>
            <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 11, textAlign: 'left' }}>{c.stock}</span>
          </div>
        ))}
      </div>
    </div>
  </>);
};
window.Reports = Reports;
