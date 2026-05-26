// Main app shell
const App = () => {
  const { PRODUCTS, EVENTS, CLIENTS } = window.WarehouseData;
  const { Toast, Empty, Modal, QtyStepper, locStr, catOf, productOf, clientOf, fmtDate, fmtDateShort,
    recomputeReserved, migrateEvent, migrateEvents, eventHoldStart, eventHoldEnd, contactsArray } = window.WHui;

  const initialEvents = useMemo(() => migrateEvents(EVENTS), []);
  const [products, setProducts] = useState(() => recomputeReserved(PRODUCTS, initialEvents));
  const [events, setEvents] = useState(initialEvents);
  const [clients, setClients] = useState(CLIENTS);
  const [showClientsManager, setShowClientsManager] = useState(false);

  // Aggregate tracking tasks count for nav badge
  const openTrackingCount = useMemo(() =>
    events.reduce((s, ev) => s + (ev.productionTasks || []).filter(t => !t.received).length, 0),
    [events]);

  // Load from Sheet on mount (overrides local mock data if Sheet has data)
  useEffect(() => {
    (async () => {
      if (!window.SheetsAPI || !window.SheetsAPI.getUrl()) return;
      try {
        const data = await window.SheetsAPI.fetchAll();
        if (data.products && data.products.length) {
          const evs = (data.events && data.events.length) ? migrateEvents(data.events) : initialEvents;
          setProducts(recomputeReserved(data.products, evs));
          if (data.events && data.events.length) setEvents(evs);
        }
      } catch (err) {
        console.warn('Sheet load failed:', err.message);
      }
    })();
  }, []);
  const [tab, setTab] = useState('catalog'); // catalog | map | events | reports
  const [view, setView] = useState('grid');
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [showBriefing, setShowBriefing] = useState(null);
  const [productDetail, setProductDetail] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showProductEditor, setShowProductEditor] = useState(false);
  const [reserveTarget, setReserveTarget] = useState(null); // product to reserve
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Auto-sync helper: fires a POST to Sheets if URL is configured; silent on failure (just shows toast)
  const syncToSheet = async (action, payload) => {
    if (!window.SheetsAPI || !window.SheetsAPI.getUrl()) return;
    setSyncing(true);
    try {
      if (action === 'upsert_product') await window.SheetsAPI.upsertProduct(payload);
      if (action === 'delete_product') await window.SheetsAPI.deleteProduct(payload);
      if (action === 'upsert_event')   await window.SheetsAPI.upsertEvent(payload);
      if (action === 'delete_event')   await window.SheetsAPI.deleteEvent(payload);
    } catch (err) {
      showToast(`⚠ סנכרון לגיליון נכשל: ${err.message}`);
    }
    setSyncing(false);
  };

  const importFromSheet = (data) => {
    const evs = data.events && data.events.length ? migrateEvents(data.events) : events;
    if (data.products && data.products.length) setProducts(recomputeReserved(data.products, evs));
    if (data.events && data.events.length) setEvents(evs);
    showToast('הנתונים נטענו מהגיליון');
  };

  // Expose products + clients to helpers
  useEffect(() => { window.__WH_PRODUCTS = products; }, [products]);
  useEffect(() => { window.__WH_CLIENTS = clients; }, [clients]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // Cart ops
  const setCartQty = (p, qty) => {
    setCart(c => {
      const n = { ...c };
      if (qty <= 0) delete n[p.id]; else n[p.id] = qty;
      return n;
    });
  };
  const clearCart = () => setCart({});

  const cartItems = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
  const cartCount = cartItems.reduce((s, it) => s + it.qty, 0);

  // Save event — then recompute reservations across all events
  const saveEvent = (ev) => {
    setEvents(es => {
      const existing = es.find(e => e.id === ev.id);
      const nextEvents = existing ? es.map(e => e.id === ev.id ? ev : e) : [...es, ev];
      setProducts(ps => recomputeReserved(ps, nextEvents));
      return nextEvents;
    });
    setShowEditor(false);
    setEditingEvent(null);
    clearCart();
    setCartOpen(false);
    showToast(`אירוע "${ev.name}" נשמר · פריטים שוריינו`);
    syncToSheet('upsert_event', ev);
  };

  const startNewEventFromCart = () => {
    setEditingEvent(null);
    setShowEditor(true);
    setCartOpen(false);
  };

  const openEvent = (ev) => setViewingEvent(ev);
  const editEvent = (ev) => { setEditingEvent(ev); setShowEditor(true); setViewingEvent(null); };
  const deleteEvent = (ev) => {
    setEvents(es => {
      const next = es.filter(e => e.id !== ev.id);
      setProducts(ps => recomputeReserved(ps, next));
      return next;
    });
    setViewingEvent(null);
    showToast('האירוע נמחק · פריטים שוחררו');
    syncToSheet('delete_event', ev.id);
  };

  // Product CRUD
  const saveProduct = (p) => {
    setProducts(ps => {
      const exists = ps.find(x => x.id === p.id);
      const next = exists ? ps.map(x => x.id === p.id ? { ...x, ...p, reserved: x.reserved } : x) : [...ps, { ...p, reserved: 0 }];
      return recomputeReserved(next, events);
    });
    setShowProductEditor(false);
    setEditingProduct(null);
    showToast('המוצר נשמר');
    syncToSheet('upsert_product', p);
  };
  const deleteProduct = (id) => {
    setProducts(ps => ps.filter(p => p.id !== id));
    setShowProductEditor(false);
    setEditingProduct(null);
    showToast('המוצר נמחק');
    syncToSheet('delete_product', id);
  };

  const openReserveDialog = (p) => setReserveTarget(p);
  const commitReserve = (qty) => {
    setCartQty(reserveTarget, qty);
    showToast(`${reserveTarget.name} · ${qty} שוריינו בעגלה`);
    setReserveTarget(null);
  };

  const navItems = [
    { id: 'catalog',  label: 'קטלוג מוצרים', icon: 'grid', count: products.length },
    { id: 'map',      label: 'מפת מחסן',    icon: 'map'  },
    { id: 'events',   label: 'אירועים',     icon: 'calendar', count: events.length },
    { id: 'tracking', label: 'הפקה ומעקב',  icon: 'note', count: openTrackingCount || null },
    { id: 'reports',  label: 'דוחות',       icon: 'chart' },
  ];

  const pageTitle = { catalog: 'קטלוג מוצרים', map: 'מפת מחסן', events: 'אירועים', tracking: 'הפקה ומעקב', reports: 'דוחות וסטטיסטיקות' }[tab];
  const pageSub = {
    catalog: `${products.length} סוגי פריטים · ${products.reduce((s, p) => s + p.stock, 0)} יחידות במלאי`,
    map: 'תצוגה חזותית · 3 אזורים',
    events: `${events.length} אירועים · ${events.reduce((s, e) => s + (e.items || []).reduce((n, i) => n + i.qty, 0), 0)} פריטים משוריינים`,
    tracking: `${openTrackingCount} משימות פתוחות · מעקב דפוס ונגרות`,
    reports: 'תמונת מצב כללית',
  }[tab];

  return (
    <div className={`app ${showBriefing ? 'printing' : ''}`}>
      {/* Sidebar */}
      <aside className="sidebar no-print">
        <div className="side-head">
          <div className="logo">
            <img src="https://www.by-p.com/wp-content/uploads/2023/11/Logo-BY_new_V23-1.png"
              alt="BY Productions" className="logo-img" />
            <div>
              <div className="logo-word">מחסן</div>
              <div className="logo-sub">BY Productions</div>
            </div>
          </div>
        </div>
        <nav className="side-nav">
          <div className="nav-sec">ראשי</div>
          {navItems.map(it => (
            <button key={it.id} className={`nav-item ${tab === it.id ? 'active' : ''}`}
              onClick={() => { setTab(it.id); setShowBriefing(null); }}>
              <span className="nav-icon"><Icon name={it.icon} size={18} /></span>
              <span>{it.label}</span>
              {it.count != null && <span className="nav-count">{it.count}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8 }}
            onClick={() => setShowClientsManager(true)}>
            <Icon name="grid" size={14} />
            <span style={{ flex: 1, textAlign: 'start' }}>ניהול לקוחות</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-3)' }}>{clients.length}</span>
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 12 }}
            onClick={() => setShowSettings(true)}>
            <Icon name="settings" size={14} />
            <span style={{ flex: 1, textAlign: 'start' }}>הגדרות · גיליון</span>
            {window.SheetsAPI && window.SheetsAPI.getUrl()
              ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: syncing ? 'var(--yellow)' : 'var(--teal)' }} />
              : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-5)' }} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar">נ</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="avatar-name">נועה כהן</div>
              <div className="avatar-role">מנהלת מחסן</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar no-print">
          <div>
            <div className="page-title">{pageTitle}</div>
            <div className="page-sub">{pageSub}</div>
          </div>

          {tab === 'catalog' && (
            <div className="view-switch" style={{ marginInlineStart: 16 }}>
              <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
                <Icon name="grid" /> רשת
              </button>
              <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
                <Icon name="list" /> טבלה
              </button>
              <button onClick={() => { setEditingProduct(null); setShowProductEditor(true); }} style={{ marginInlineStart: 8 }}>
                <Icon name="plus" size={14} /> חדש
              </button>
            </div>
          )}

          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-dark" onClick={() => { setEditingEvent(null); setShowEditor(true); }}>
              <Icon name="plus" size={14} /> אירוע חדש
            </button>
            <button className={`cart-chip ${cartCount === 0 ? 'empty' : ''}`} onClick={() => setCartOpen(true)} style={{ marginInlineStart: 0 }}>
              <Icon name="cart" size={16} /> שריון מהקטלוג
              {cartCount > 0 && <span className="count">{cartCount}</span>}
            </button>
          </div>
        </header>

        <section className="content">
          {tab === 'catalog' && view === 'grid' && (
            <window.Catalog products={products} events={events} cart={cart}
              onReserve={openReserveDialog} onOpen={(p) => setProductDetail(p)} />
          )}
          {tab === 'catalog' && view === 'table' && (
            <window.InventoryTable products={products} events={events} cart={cart}
              onReserve={openReserveDialog} />
          )}
          {tab === 'map' && (
            <window.WarehouseMap products={products} onPickProduct={(p) => setProductDetail(p)} />
          )}
          {tab === 'events' && !showBriefing && (
            <window.Events events={events} products={products} clients={clients}
              onOpenEvent={openEvent}
              onCreateEvent={() => { setEditingEvent(null); setShowEditor(true); }} />
          )}
          {tab === 'events' && showBriefing && (
            <window.Briefing event={showBriefing} onBack={() => setShowBriefing(null)} />
          )}
          {tab === 'tracking' && (
            <window.Tracking events={events} clients={clients}
              onUpdateTask={(eventId, taskId, patch) => {
                setEvents(es => es.map(ev => ev.id !== eventId ? ev : ({
                  ...ev,
                  productionTasks: (ev.productionTasks || []).map(t => t.id === taskId ? { ...t, ...patch } : t),
                })));
                const ev = events.find(e => e.id === eventId);
                if (ev) syncToSheet('upsert_event', { ...ev, productionTasks: ev.productionTasks.map(t => t.id === taskId ? { ...t, ...patch } : t) });
              }}
              onOpenEvent={openEvent} />
          )}
          {tab === 'reports' && (
            <window.Reports products={products} events={events} />
          )}
        </section>
      </main>

      {/* Cart drawer */}
      {cartOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setCartOpen(false)} />
          <aside className="drawer">
            <div className="drawer-head">
              <div>
                <h2>עגלת שריון</h2>
                <p>{cartCount} פריטים נבחרו</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setCartOpen(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="drawer-body">
              {cartItems.length === 0 ? (
                <Empty icon="cart" title="העגלה ריקה" sub="הוסיפו פריטים מהקטלוג ושרינו אותם לאירוע חדש" />
              ) : cartItems.map(it => {
                const p = productOf(it.id);
                if (!p) return null;
                return (
                  <div key={it.id} className="cart-item">
                    {p.image
                      ? <img src={p.image} className="thumb" style={{ objectFit: 'cover' }} />
                      : <div className="thumb" />}
                    <div>
                      <div className="name">{p.name}</div>
                      <div className="loc">{p.sku} · {locStr(p.location)}</div>
                      <div style={{ marginTop: 6 }}>
                        <QtyStepper value={it.qty} max={p.stock} onChange={(v) => setCartQty(p, v)} />
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={() => setCartQty(p, 0)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            {cartItems.length > 0 && (
              <div className="drawer-foot">
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={clearCart}>ניקוי</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={startNewEventFromCart}>
                    <Icon name="sparkle" size={14} /> המשך ליצירת אירוע
                  </button>
                </div>
              </div>
            )}
          </aside>
        </>
      )}

      {/* Reserve dialog */}
      {reserveTarget && (
        <window.ReserveDialog
          product={reserveTarget}
          events={events}
          existing={cart[reserveTarget.id] || 0}
          onClose={() => setReserveTarget(null)}
          onSave={commitReserve}
        />
      )}

      {/* Event editor */}
      {showEditor && (
        <window.EventEditor event={editingEvent}
          cartItems={editingEvent ? null : cartItems}
          products={products}
          clients={clients}
          onClose={() => { setShowEditor(false); setEditingEvent(null); }}
          onSave={saveEvent} />
      )}

      {/* Product editor */}
      {showProductEditor && (
        <window.ProductEditor product={editingProduct}
          onClose={() => { setShowProductEditor(false); setEditingProduct(null); }}
          onSave={saveProduct} onDelete={deleteProduct} />
      )}

      {/* Event detail */}
      {viewingEvent && (() => {
        const client = clientOf(viewingEvent.clientId);
        const evWin = viewingEvent.event;
        const fmtPhase = (p) => {
          if (!p || !p.startDate) return '—';
          const dateRange = p.endDate && p.endDate !== p.startDate
            ? `${fmtDateShort(p.startDate)} → ${fmtDateShort(p.endDate)}`
            : fmtDate(p.startDate);
          const timeRange = p.startTime ? `${p.startTime}${p.endTime ? `–${p.endTime}` : ''}` : '';
          return `${dateRange}${timeRange ? ` · ${timeRange}` : ''}`;
        };
        const subtitle = evWin?.skipped
          ? `${fmtDate(eventHoldStart(viewingEvent))} (ללא יום אירוע)`
          : `${fmtDate(evWin?.startDate)}${evWin?.startTime ? ` · ${evWin.startTime}` : ''}`;
        const allContacts = contactsArray(viewingEvent);
        return (
        <Modal title={viewingEvent.name} subtitle={subtitle}
          onClose={() => setViewingEvent(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { if (confirm('למחוק את האירוע ולשחרר את הפריטים?')) deleteEvent(viewingEvent); }}>
              <Icon name="trash" size={13} /> מחיקה
            </button>
            <button className="btn btn-ghost" onClick={() => editEvent(viewingEvent)}>
              <Icon name="edit" size={13} /> עריכה
            </button>
            <button className="btn btn-primary" onClick={() => { setShowBriefing(viewingEvent); setViewingEvent(null); setTab('events'); }}>
              <Icon name="note" size={13} /> דף הנחיה
            </button>
          </>}>
          <div className="field"><label>סוג · לקוח · SO</label>
            <div style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`type-badge ${viewingEvent.type === 'booth' ? 'booth' : 'prod'}`}>
                {viewingEvent.type === 'booth' ? '🏪 ביתן' : '🎉 אירוע הפקה'}
              </span>
              {client && (
                <span className="client-chip" style={{ background: client.color }}>{client.name}</span>
              )}
              {viewingEvent.so && <span className="so-badge">{viewingEvent.so}</span>}
            </div>
          </div>
          <div className="field"><label>מיקום</label><div style={{ fontSize: 14 }}>{viewingEvent.location}</div></div>
          <div className="field"><label>לוחות זמנים</label>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.8 }}>
              <div>🔨 <b>הקמה:</b> {fmtPhase(viewingEvent.setup)}</div>
              {!evWin?.skipped && <div>🎉 <b>אירוע:</b> {fmtPhase(viewingEvent.event)}</div>}
              <div>📦 <b>פירוק:</b> {fmtPhase(viewingEvent.dismantle)}</div>
            </div>
          </div>
          <div className="field"><label>אנשי קשר</label>
            {allContacts.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>לא הוזנו אנשי קשר</div>
            ) : allContacts.map((c, i) => (
              <div key={i} style={{ fontSize: 13, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', marginInlineEnd: 6 }}>[{c._kind || 'קשר'}]</span>
                    {c.name || '—'} {c.role && <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {c.role}</span>}
                  </div>
                </div>
                <div className="mono" style={{ color: 'var(--ink-3)', fontSize: 12, direction: 'ltr' }}>{c.phone || ''}</div>
              </div>
            ))}
          </div>
          <div className="field"><label>עובדי תפעול ({(viewingEvent.workers || []).length})</label>
            <div className="worker-chips">
              {(viewingEvent.workers || []).map((w, i) => <span key={i} className="worker-chip"><span className="av">{w[0]}</span>{w}</span>)}
            </div>
          </div>
          <div className="field"><label>פריטים ({(viewingEvent.items || []).reduce((s, i) => s + i.qty, 0)})</label>
            <div className="item-list">
              {(viewingEvent.items || []).map((it, i) => {
                const p = productOf(it.id); if (!p) return null;
                return (<div key={it.id} className="row">
                  <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                  <div><div className="n">{p.name}</div><div className="loc">{p.sku}</div></div>
                  <span className="loc">{locStr(p.location)}</span>
                  <span className="q">×{it.qty}</span>
                </div>);
              })}
            </div>
          </div>
          {viewingEvent.productionTasks?.length > 0 && (
            <div className="field"><label>הפקה ומעקב ({viewingEvent.productionTasks.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {viewingEvent.productionTasks.map(t => (
                  <div key={t.id} style={{ fontSize: 12, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 16 }}>{t.received ? '✅' : '⏳'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{t.title || '—'}</div>
                      <div style={{ color: 'var(--ink-3)' }}>
                        {t.type === 'carpentry' ? '🪚 נגרות' : t.type === 'print' ? '📄 דפוס' : '📦 אחר'}
                        {t.sentDate ? ` · נשלח ${fmtDateShort(t.sentDate)}` : ''}
                        {t.deadline ? ` · דד-ליין ${fmtDateShort(t.deadline)}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      ); })()}

      {/* Product detail */}
      {productDetail && (
        <Modal title={productDetail.name}
          subtitle={`${productDetail.sku} · ${catOf(productDetail.category).label}`}
          onClose={() => setProductDetail(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setEditingProduct(productDetail); setShowProductEditor(true); setProductDetail(null); }}>
              <Icon name="edit" size={13} /> עריכה
            </button>
            <button className="btn btn-primary" onClick={() => { openReserveDialog(productDetail); setProductDetail(null); }}
              disabled={productDetail.stock - productDetail.reserved <= 0}>
              <Icon name="plus" size={14} /> שריון
            </button>
          </>}>
          {productDetail.image
            ? <img src={productDetail.image} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
            : <div style={{ aspectRatio: '16/9', background: 'var(--surface-2)', borderRadius: 12, marginBottom: 16, display: 'grid', placeItems: 'center', color: 'var(--ink-4)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>IMG · {productDetail.sku}</div>}
          <div className="field-row-3">
            <div className="info-box"><div className="k">מיקום</div><div className="v mono">{locStr(productDetail.location)}</div></div>
            <div className="info-box"><div className="k">במלאי</div><div className="v mono">{productDetail.stock}</div></div>
            <div className="info-box"><div className="k">זמין</div>
              <div className="v mono" style={{ color: 'var(--pink)' }}>{productDetail.stock - productDetail.reserved}</div>
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>מידות (א×ג×ר ס״מ)</label>
            <div className="mono" style={{ fontSize: 13 }}>
              {productDetail.dims.w} × {productDetail.dims.h} × {productDetail.dims.d}
            </div>
          </div>
          {productDetail.rentalPrice ? (
            <div className="field"><label>מחיר השכרה</label>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                ₪{productDetail.rentalPrice.toLocaleString()} <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 12 }}>/ יחידה</span>
              </div>
            </div>
          ) : null}
          {productDetail.notes && <div className="field"><label>הערות</label><div style={{ fontSize: 13 }}>{productDetail.notes}</div></div>}
        </Modal>
      )}

      {toast && <Toast msg={toast} variant="pink" />}

      {showSettings && (
        <window.SettingsModal
          products={products}
          events={events}
          onClose={() => setShowSettings(false)}
          onImport={importFromSheet}
        />
      )}

      {showClientsManager && (
        <ClientsManager
          clients={clients}
          events={events}
          onClose={() => setShowClientsManager(false)}
          onSave={(next) => { setClients(next); showToast('רשימת הלקוחות נשמרה'); }}
        />
      )}
    </div>
  );
};

// ============================================================
// Clients Manager — add / edit / delete with color per client
// ============================================================
const ClientsManager = ({ clients, events, onClose, onSave }) => {
  const { Modal } = window.WHui;
  const [list, setList] = useState(() => clients.map(c => ({ ...c })));
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#ff6b9d');

  const presetColors = ['#ff2d87', '#ff6b9d', '#ff8a4c', '#ffd93d', '#8bc34a',
    '#1ac6c6', '#06a77d', '#4a9eff', '#7b5cff', '#b76ad6',
    '#e63946', '#3d5a80', '#0b7a7a', '#f4a261', '#1a1614', '#857f77'];

  const usage = useMemo(() => {
    const m = {};
    events.forEach(ev => { if (ev.clientId) m[ev.clientId] = (m[ev.clientId] || 0) + 1; });
    return m;
  }, [events]);

  const upd = (i, patch) => setList(L => L.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const del = (i) => {
    const c = list[i];
    if (usage[c.id]) {
      if (!confirm(`לקוח "${c.name}" מקושר ל-${usage[c.id]} אירועים. למחוק?`)) return;
    }
    setList(L => L.filter((_, idx) => idx !== i));
  };
  const add = () => {
    if (!newName.trim()) return;
    const id = `cl_${Date.now().toString(36)}`;
    setList(L => [...L, { id, name: newName.trim(), color: newColor }]);
    setNewName(''); setNewColor('#ff6b9d');
  };

  return (
    <Modal title="ניהול לקוחות" subtitle="שם וצבע יחודי לכל לקוח · משמש בכרטיסי האירועים" onClose={onClose} wide
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn btn-primary" onClick={() => { onSave(list); onClose(); }}>
          <Icon name="check" size={14} /> שמירה
        </button>
      </>}>
      <div className="clients-list">
        {list.map((c, i) => (
          <div key={c.id} className="client-row">
            <input type="color" value={c.color} onChange={(e) => upd(i, { color: e.target.value })}
              className="client-color-picker" />
            <input value={c.name} onChange={(e) => upd(i, { name: e.target.value })}
              className="client-name-input" placeholder="שם לקוח" />
            <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 70, textAlign: 'center' }}>
              {usage[c.id] ? `${usage[c.id]} אירועים` : 'ללא שימוש'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => del(i)}>
              <Icon name="trash" size={12} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>הוספת לקוח חדש</div>
      <div className="client-row">
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="client-color-picker" />
        <input value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          className="client-name-input" placeholder="שם הלקוח החדש…" />
        <button className="btn btn-primary btn-sm" onClick={add} disabled={!newName.trim()}>
          <Icon name="plus" size={12} /> הוספה
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {presetColors.map(col => (
          <button key={col} type="button" onClick={() => setNewColor(col)}
            style={{ width: 22, height: 22, borderRadius: 6, background: col,
              border: newColor === col ? '2px solid var(--ink)' : '1px solid var(--border)',
              cursor: 'pointer' }} title={col} />
        ))}
      </div>
    </Modal>
  );
};

const { useState, useEffect, useMemo } = React;
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
