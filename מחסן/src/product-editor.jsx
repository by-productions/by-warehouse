// Reserve-with-qty dialog + Product editor
const ReserveDialog = ({ product, events, timeWindow, existing, onClose, onSave }) => {
  const { productAvailInWindow, nextRelease, fmtDateShort, Modal } = window.WHui;
  const maxAvail = timeWindow?.from
    ? productAvailInWindow(product, events, timeWindow.from, timeWindow.to) + (existing || 0)
    : (product.stock - product.reserved) + (existing || 0);
  const [qty, setQty] = useState(existing || 1);
  const rel = nextRelease(product, events);

  return (
    <Modal
      title={existing ? 'עדכון כמות' : 'שריון פריט'}
      subtitle={product.name}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn btn-primary" onClick={() => onSave(qty)} disabled={qty < 1 || qty > maxAvail}>
          <Icon name="check" size={14} /> {existing ? 'עדכון' : 'הוספה לעגלה'}
        </button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 14, alignItems: 'center' }}>
        {product.image
          ? <img src={product.image} alt="" style={{ width: 100, height: 80, borderRadius: 10, objectFit: 'cover' }} />
          : <div style={{ width: 100, height: 80, borderRadius: 10, background: 'var(--surface-2)' }} />}
        <div>
          <div style={{ fontWeight: 600 }}>{product.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'JetBrains Mono, monospace' }}>
            {product.sku} · {window.WHui.locStr(product.location)}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: 12, color: 'var(--ink-2)' }}>
            <span>מלאי כולל: <b>{product.stock}</b></span>
            <span>זמין עכשיו: <b style={{ color: 'var(--pink)' }}>{maxAvail}</b></span>
          </div>
          {rel && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-3)' }}>
            שריון קרוב משתחרר: {fmtDateShort(rel)}
          </div>}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>כמה פריטים לשריין?</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <window.WHui.QtyStepper value={qty} max={maxAvail} onChange={setQty} />
        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>מתוך {maxAvail} זמינים</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
        {[1, 5, 10, 20, 50].filter(n => n <= maxAvail).map(n => (
          <button key={n} className="chip" onClick={() => setQty(n)}>{n}</button>
        ))}
        {maxAvail > 0 && <button className="chip" onClick={() => setQty(maxAvail)}>הכל ({maxAvail})</button>}
      </div>
    </Modal>
  );
};

const ProductEditor = ({ product, onClose, onSave, onDelete }) => {
  const { CATEGORIES, ZONES } = window.WarehouseData;
  const { Modal, ImagePicker } = window.WHui;
  const isNew = !product;
  const [form, setForm] = useState(() => product || {
    id: '', sku: '', name: '', category: 'chairs',
    stock: 0, reserved: 0,
    location: { zone: 'A', row: 1, shelf: 1 },
    dims: { w: 0, h: 0, d: 0 },
    notes: '', image: null,
  });
  const upd = (patch) => setForm(f => ({ ...f, ...patch }));
  const updLoc = (patch) => setForm(f => ({ ...f, location: { ...f.location, ...patch } }));
  const updDims = (patch) => setForm(f => ({ ...f, dims: { ...f.dims, ...patch } }));

  return (
    <Modal title={isNew ? 'מוצר חדש' : 'עריכת מוצר'} subtitle={product?.sku} onClose={onClose} wide
      footer={<>
        {!isNew && <button className="btn btn-ghost" onClick={() => {
          if (confirm('למחוק לצמיתות?')) { onDelete(product.id); }
        }}><Icon name="trash" size={13} /> מחיקה</button>}
        <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn btn-primary" disabled={!form.name || !form.id}
          onClick={() => onSave({ ...form, sku: form.sku || form.id })}>
          <Icon name="check" size={14} /> שמירה
        </button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        <ImagePicker value={form.image} onChange={(v) => upd({ image: v })} aspect="4/3" label="תמונת מוצר" />
        <div>
          <div className="field-row">
            <div className="field"><label>מק״ט / מזהה</label>
              <input value={form.id} onChange={(e) => upd({ id: e.target.value, sku: e.target.value })} placeholder="CH-007" /></div>
            <div className="field"><label>קטגוריה</label>
              <select value={form.category} onChange={(e) => upd({ category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select></div>
          </div>
          <div className="field"><label>שם</label>
            <input value={form.name} onChange={(e) => upd({ name: e.target.value })} /></div>
          <div className="field"><label>הערות</label>
            <textarea value={form.notes} onChange={(e) => upd({ notes: e.target.value })} /></div>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>מיקום במחסן</div>
      <div className="field-row-3">
        <div className="field"><label>אזור</label>
          <select value={form.location.zone} onChange={(e) => updLoc({ zone: e.target.value })}>
            {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
          </select></div>
        <div className="field"><label>שורה</label>
          <input type="number" min="1" max="6" value={form.location.row} onChange={(e) => updLoc({ row: +e.target.value })} /></div>
        <div className="field"><label>מדף</label>
          <input type="number" min="1" max="4" value={form.location.shelf} onChange={(e) => updLoc({ shelf: +e.target.value })} /></div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 10px' }}>מלאי ומידות</div>
      <div className="field-row">
        <div className="field"><label>כמות במלאי</label>
          <input type="number" min="0" value={form.stock} onChange={(e) => upd({ stock: +e.target.value })} /></div>
        <div className="field"><label>משוריין (ידני)</label>
          <input type="number" min="0" value={form.reserved} onChange={(e) => upd({ reserved: +e.target.value })} disabled /></div>
      </div>
      <div className="field-row-3">
        <div className="field"><label>אורך (ס״מ)</label>
          <input type="number" min="0" value={form.dims.w} onChange={(e) => updDims({ w: +e.target.value })} /></div>
        <div className="field"><label>גובה (ס״מ)</label>
          <input type="number" min="0" value={form.dims.h} onChange={(e) => updDims({ h: +e.target.value })} /></div>
        <div className="field"><label>רוחב (ס״מ)</label>
          <input type="number" min="0" value={form.dims.d} onChange={(e) => updDims({ d: +e.target.value })} /></div>
      </div>
    </Modal>
  );
};

window.ReserveDialog = ReserveDialog;
window.ProductEditor = ProductEditor;
