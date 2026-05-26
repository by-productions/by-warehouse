// Catalog grid — product cards with image + reserve button (opens dialog with qty)

const Catalog = ({ products, events, cart, onReserve, onOpen, window: timeWindow }) => {
  const { CATEGORIES } = window.WarehouseData;
  const { CategoryChip, productAvailInWindow, nextRelease } = window.WHui;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(null);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (cat && p.category !== cat) return false;
      if (q) {
        const s = q.toLowerCase();
        return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
      }
      return true;
    });
  }, [q, cat, products]);

  const countsByCat = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.category] = (m[p.category] || 0) + 1; });
    return m;
  }, [products]);

  return (
    <>
      <div className="toolbar">
        <div className="search-wrap">
          <Icon name="search" />
          <input placeholder="חיפוש מוצר או מק״ט…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 20 }}>
        <CategoryChip cat={null} active={!cat} onClick={() => setCat(null)} count={products.length} />
        {CATEGORIES.map(c => (
          <CategoryChip key={c.id} cat={c} active={cat === c.id}
            onClick={() => setCat(cat === c.id ? null : c.id)}
            count={countsByCat[c.id] || 0} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
          לא נמצאו מוצרים.
        </div>
      ) : (
        <div className="catalog-grid">
          {filtered.map(p => (
            <ProductCard key={p.id} p={p} events={events}
              timeWindow={timeWindow}
              inCart={!!cart[p.id]}
              onReserve={() => onReserve(p)}
              onOpen={() => onOpen(p)} />
          ))}
        </div>
      )}
    </>
  );
};

const ProductCard = ({ p, events, timeWindow, inCart, onReserve, onOpen }) => {
  const cat = window.WHui.catOf(p.category);
  const { productAvailInWindow, nextRelease, fmtDateShort } = window.WHui;
  const avail = timeWindow?.from
    ? productAvailInWindow(p, events, timeWindow.from, timeWindow.to)
    : p.stock - p.reserved;
  const release = nextRelease(p, events);
  const fillPct = Math.max(2, Math.round((avail / Math.max(1, p.stock)) * 100));
  const statusCls = avail <= 0 ? 'bad' : (avail / p.stock < 0.25 ? 'warn' : 'ok');

  return (
    <div className={`product-card ${inCart ? 'in-cart' : ''}`}>
      <div className="product-img" onClick={onOpen} style={{ cursor: 'pointer' }}>
        {p.image
          ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div className="ph">IMG · {p.sku}</div>}
        <div className="cat-badge">
          <span className="chip-dot" style={{ background: cat.color }} />{cat.label}
        </div>
      </div>
      <div className="product-body">
        <div className="product-name" onClick={onOpen} style={{ cursor: 'pointer' }}>{p.name}</div>
        <div className="product-meta">
          <span>{p.sku}</span>
          <span><Icon name="pin" size={11} style={{ verticalAlign: '-2px' }} /> {window.WHui.locStr(p.location)}</span>
        </div>
        {p.rentalPrice ? (
          <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-2)' }}>
            השכרה: <b style={{ color: 'var(--ink)' }}>₪{p.rentalPrice.toLocaleString()}</b> / יח׳
          </div>
        ) : null}
        <div className="stock-row">
          <div className="stock-bar">
            <div className="stock-bar-fill" style={{ width: `${fillPct}%`, background: `var(--${statusCls})` }} />
          </div>
          <div className="stock-nums"><b>{avail}</b>/{p.stock}</div>
        </div>
        {p.reserved > 0 && release && (
          <div style={{ fontSize: 10.5, color: 'var(--pink-deep)', fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="clock" size={11} /> משתחרר {fmtDateShort(release)}
          </div>
        )}
        <button className={`add-btn ${inCart ? 'added' : ''}`} onClick={onReserve} disabled={avail <= 0}>
          {inCart ? <><Icon name="check" size={14} /> בעגלה</> : <><Icon name="plus" size={14} /> שריון</>}
        </button>
      </div>
    </div>
  );
};

window.Catalog = Catalog;
