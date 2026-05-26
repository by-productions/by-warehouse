// Detailed table with images + quick-reserve
const InventoryTable = ({ products, events, cart, onReserve, timeWindow }) => {
  const { CATEGORIES } = window.WarehouseData;
  const { locStr, productAvailInWindow, nextRelease, fmtDateShort } = window.WHui;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(null);
  const [sort, setSort] = useState({ key: 'name', dir: 1 });

  const filtered = useMemo(() => {
    let list = products.filter(p => {
      if (cat && p.category !== cat) return false;
      if (q) {
        const s = q.toLowerCase();
        return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
      }
      return true;
    });
    list.sort((a, b) => {
      let va, vb;
      if (sort.key === 'avail') {
        va = timeWindow?.from ? productAvailInWindow(a, events, timeWindow.from, timeWindow.to) : a.stock - a.reserved;
        vb = timeWindow?.from ? productAvailInWindow(b, events, timeWindow.from, timeWindow.to) : b.stock - b.reserved;
      }
      else if (sort.key === 'loc') { va = locStr(a.location); vb = locStr(b.location); }
      else { va = a[sort.key]; vb = b[sort.key]; }
      if (va < vb) return -1 * sort.dir;
      if (va > vb) return 1 * sort.dir;
      return 0;
    });
    return list;
  }, [products, events, q, cat, sort, timeWindow]);

  const toggleSort = (k) => setSort(s => ({ key: k, dir: s.key === k ? -s.dir : 1 }));
  const Th = ({ k, children, style }) => (
    <th style={{ cursor: 'pointer', ...style }} onClick={() => toggleSort(k)}>
      {children} {sort.key === k ? (sort.dir > 0 ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <>
      <div className="toolbar">
        <div className="search-wrap">
          <Icon name="search" />
          <input placeholder="חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="chip" value={cat || ''} onChange={(e) => setCat(e.target.value || null)}
          style={{ padding: '7px 12px' }}>
          <option value="">כל הקטגוריות</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <span style={{ marginInlineStart: 'auto', color: 'var(--ink-3)', fontSize: 12 }}>
          {filtered.length} פריטים
        </span>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 56 }}></th>
              <Th k="name">שם · מק״ט</Th>
              <Th k="category">קטגוריה</Th>
              <Th k="loc">מיקום</Th>
              <Th k="stock" style={{ textAlign: 'center' }}>מלאי</Th>
              <Th k="avail" style={{ textAlign: 'center' }}>זמין</Th>
              <Th k="rentalPrice" style={{ textAlign: 'center' }}>השכרה ₪</Th>
              <th>משתחרר</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const c = window.WHui.catOf(p.category);
              const avail = timeWindow?.from ? productAvailInWindow(p, events, timeWindow.from, timeWindow.to) : p.stock - p.reserved;
              const inCart = !!cart[p.id];
              const rel = nextRelease(p, events);
              return (
                <tr key={p.id}>
                  <td>
                    {p.image
                      ? <div className="tbl-thumb" style={{ backgroundImage: `url(${p.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      : <div className="tbl-thumb" />}
                  </td>
                  <td>
                    <div className="tbl-name">{p.name}</div>
                    <div className="tbl-sku">{p.sku}</div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'transparent' }}>
                      <span className="chip-dot" style={{ background: c.color }} />{c.label}
                    </span>
                  </td>
                  <td className="nums">{locStr(p.location)}</td>
                  <td className="nums" style={{ textAlign: 'center' }}>{p.stock}</td>
                  <td className="nums" style={{ textAlign: 'center', fontWeight: 700, color: avail <= 0 ? 'var(--bad)' : 'inherit' }}>{avail}</td>
                  <td className="nums" style={{ textAlign: 'center', color: p.rentalPrice ? 'var(--ink)' : 'var(--ink-4)' }}>
                    {p.rentalPrice ? `₪${p.rentalPrice.toLocaleString()}` : '—'}
                  </td>
                  <td className="nums" style={{ color: 'var(--ink-3)', fontSize: 11 }}>{rel ? fmtDateShort(rel) : '—'}</td>
                  <td>
                    <button className={`btn btn-sm ${inCart ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => onReserve(p)} disabled={avail <= 0}>
                      {inCart ? <Icon name="check" size={13} /> : <Icon name="plus" size={13} />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

window.InventoryTable = InventoryTable;
