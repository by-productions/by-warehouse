// Warehouse map — visual shelf layout
const WarehouseMap = ({ products, onPickProduct }) => {
  const { ZONES, CATEGORIES } = window.WarehouseData;
  const [zone, setZone] = useState('A');

  // Build zone map: zone -> row -> shelf -> products[]
  const layout = useMemo(() => {
    const m = {};
    ZONES.forEach(z => { m[z] = {}; });
    products.forEach(p => {
      const { zone: z, row, shelf } = p.location;
      m[z][row] = m[z][row] || {};
      m[z][row][shelf] = m[z][row][shelf] || [];
      m[z][row][shelf].push(p);
    });
    return m;
  }, [products]);

  const rows = Object.keys(layout[zone] || {}).sort((a, b) => +a - +b);

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          {ZONES.map(z => (
            <button
              key={z}
              className={`chip ${zone === z ? 'active' : ''}`}
              onClick={() => setZone(z)}
            >
              אזור {z}
            </button>
          ))}
        </div>
        <span style={{ marginInlineStart: 'auto', color: 'var(--ink-3)', fontSize: 12 }}>
          לחצו על מדף לצפייה בפריטים שבו
        </span>
      </div>

      <div className="map-wrap">
        <div className="map-legend">
          <span className="lg"><span className="swatch" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} /> מדף ריק</span>
          <span className="lg"><span className="swatch" style={{ background: '#fff', border: '1px solid var(--border-strong)' }} /> מדף תפוס</span>
          {CATEGORIES.map(c => (
            <span key={c.id} className="lg">
              <span className="swatch" style={{ background: c.color }} /> {c.label}
            </span>
          ))}
        </div>

        <div className="map-grid">
          {rows.map(r => (
            <div key={r} className="map-row">
              <div className="map-row-label">{zone}·{r}</div>
              <div className="map-shelves">
                {[1, 2, 3, 4].map(sh => {
                  const items = (layout[zone][r] || {})[sh] || [];
                  const filled = items.length > 0;
                  const firstCat = filled ? window.WHui.catOf(items[0].category) : null;
                  return (
                    <button
                      key={sh}
                      className={`shelf ${filled ? 'filled' : ''}`}
                      onClick={() => filled && onPickProduct(items[0])}
                      style={filled ? { borderColor: firstCat?.color } : undefined}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span className="shelf-id">{zone}-{r}-{sh}</span>
                        {filled && (
                          <span className="chip-dot" style={{ background: firstCat.color, width: 8, height: 8 }} />
                        )}
                      </div>
                      {filled ? (
                        <>
                          <div className="shelf-name">{items[0].name}</div>
                          <div className="shelf-count">
                            {items.length > 1 ? `${items.length} סוגים · ` : ''}
                            {items.reduce((s, p) => s + p.stock, 0)} יח׳
                          </div>
                        </>
                      ) : (
                        <div className="shelf-count" style={{ marginTop: 'auto' }}>פנוי</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

window.WarehouseMap = WarehouseMap;
