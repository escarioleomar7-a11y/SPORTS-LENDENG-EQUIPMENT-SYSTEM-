import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

const CATEGORIES = ['Ball Sports', 'Racket Sports', 'Fitness', 'Water Sports', 'Combat Sports', 'Outdoor', 'Other'];
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
const EMPTY = { name: '', category: CATEGORIES[0], quantity: 1, condition: 'Good' };

function validateEquipment(f) {
  const e = [];
  if (f.name.trim().length < 2 || f.name.trim().length > 60) e.push('Name must be 2-60 characters');
  const q = Number(f.quantity);
  if (!Number.isInteger(q) || q < 1 || q > 1000) e.push('Quantity must be a whole number from 1 to 1000');
  return e;
}

export default function App() {
  const [tab, setTab] = useState('equipment');
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [filters, setFilters] = useState({ q: '', category: '', sort: 'name', order: 'asc', algo: 'merge' });
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [borrow, setBorrow] = useState(null); 
  const [loans, setLoans] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [exactName, setExactName] = useState('');
  const [exactResult, setExactResult] = useState(null);
  const [msg, setMsg] = useState(null);

  const notify = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000); };

  const loadEquipment = useCallback(async () => {
    try {
      const data = await api.list(filters);
      setItems(data.items); setMeta(data.meta);
    } catch (e) { notify(e.message, 'err'); }
  }, [filters]);

  const loadLoans = async () => { try { setLoans(await api.loans()); } catch (e) { notify(e.message, 'err'); } };
  const loadWaitlist = async () => { try { setWaitlist(await api.waitlist()); } catch (e) { notify(e.message, 'err'); } };

  useEffect(() => { loadEquipment(); }, [loadEquipment]);
  useEffect(() => { if (tab === 'loans') loadLoans(); if (tab === 'waitlist') loadWaitlist(); }, [tab]);

  const run = async (fn, okText) => {
    try { const r = await fn(); if (okText) notify(typeof okText === 'function' ? okText(r) : okText); await loadEquipment(); return r; }
    catch (e) { notify(e.message, 'err'); }
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const errs = validateEquipment(form);
    if (errs.length) return notify(errs.join('. '), 'err');
    const body = { ...form, quantity: Number(form.quantity) };
    const r = await run(() => (editingId ? api.update(editingId, body) : api.add(body)), editingId ? 'Equipment updated' : 'Equipment added');
    if (r) { setForm(EMPTY); setEditingId(null); }
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setForm({ name: it.name, category: it.category, quantity: it.quantity, condition: it.condition });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitBorrow = async (ev) => {
    ev.preventDefault();
    const r = await run(() => api.borrow({ equipment_id: borrow.equipment_id, borrower_name: borrow.borrower_name, days: Number(borrow.days) }),
      (x) => (x.status === 'borrowed' ? 'Borrowed successfully' : `Out of stock - added to waitlist (position ${x.position})`));
    if (r) setBorrow(null);
  };

  const giveBack = async (id) => {
    try {
      const r = await api.giveBack(id);
      notify(r.assignedTo ? `Returned. Automatically lent to ${r.assignedTo} (next in queue)` : 'Returned');
      loadLoans(); loadEquipment();
    } catch (e) { notify(e.message, 'err'); }
  };

  const doExact = async () => {
    if (!exactName.trim()) return notify('Enter an exact equipment name', 'err');
    try { setExactResult(await api.exact(exactName)); } catch (e) { notify(e.message, 'err'); }
  };

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const fmt = (d) => (d ? new Date(d).toLocaleString() : '-');

  return (
    <div className="app">
      <header>
        <h1>🏅 Sport Lending Equipment</h1>
        <nav>
          {['equipment', 'loans', 'waitlist'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'equipment' ? 'Equipment' : t === 'loans' ? 'Loan History' : 'Waitlist'}
            </button>
          ))}
        </nav>
      </header>

      {msg && <div className={`toast ${msg.type}`}>{msg.text}</div>}

      {tab === 'equipment' && (
        <>
          <section className="card">
            <h2>{editingId ? 'Update Equipment' : 'Add Equipment'}</h2>
            <form onSubmit={submit} className="grid">
              <input placeholder="Name (e.g. Basketball)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button type="submit">{editingId ? 'Save' : 'Add'}</button>
              {editingId && <button type="button" className="ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Cancel</button>}
            </form>
          </section>

          <section className="card">
            <h2>Search & Sort</h2>
            <div className="grid">
              <input placeholder="Search keyword (Linear Search)" value={filters.q} onChange={(e) => setF('q', e.target.value)} />
              <select value={filters.category} onChange={(e) => setF('category', e.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={filters.sort} onChange={(e) => setF('sort', e.target.value)}>
                <option value="name">Sort: Name</option><option value="category">Sort: Category</option>
                <option value="quantity">Sort: Quantity</option><option value="available">Sort: Available</option>
                <option value="condition">Sort: Condition</option><option value="created_at">Sort: Date added</option>
              </select>
              <select value={filters.order} onChange={(e) => setF('order', e.target.value)}>
                <option value="asc">Ascending</option><option value="desc">Descending</option>
              </select>
              <select value={filters.algo} onChange={(e) => setF('algo', e.target.value)}>
                <option value="merge">Merge Sort</option><option value="quick">Quick Sort</option>
              </select>
            </div>
            <div className="grid" style={{ marginTop: 8 }}>
              <input placeholder="Exact name (Binary Search)" value={exactName} onChange={(e) => setExactName(e.target.value)} />
              <button onClick={doExact}>Binary Search</button>
              <button className="ghost" onClick={() => run(api.undo, (r) => `Undid ${r.undone}: ${r.item}`)} disabled={!meta.undoSize}>
                ↩ Undo last action ({meta.undoSize || 0})
              </button>
            </div>
            {exactResult && (
              <p className="note">{exactResult.found ? `Found: ${exactResult.item.name} (${exactResult.item.available}/${exactResult.item.quantity} available)` : 'Not found'} — {exactResult.steps}</p>
            )}
            <p className="note">{meta.count ?? 0} result(s) • {meta.algorithm} • {meta.ms} ms</p>
          </section>

          <section className="card">
            <h2>Equipment List</h2>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Name</th><th>Category</th><th>Condition</th><th>Available</th><th>Actions</th></tr></thead>
                <tbody>
                  {items.length === 0 && <tr><td colSpan="5" className="empty">No equipment found</td></tr>}
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.name}</td><td>{it.category}</td><td>{it.condition}</td>
                      <td><span className={`pill ${it.available > 0 ? 'green' : 'red'}`}>{it.available} / {it.quantity}</span></td>
                      <td className="actions">
                        <button onClick={() => setBorrow({ equipment_id: it.id, name: it.name, borrower_name: '', days: 3, out: it.available === 0 })}>
                          {it.available > 0 ? 'Borrow' : 'Join queue'}
                        </button>
                        <button className="ghost" onClick={() => startEdit(it)}>Edit</button>
                        <button className="danger" onClick={() => window.confirm(`Delete ${it.name}?`) && run(() => api.remove(it.id), 'Equipment deleted')}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'loans' && (
        <section className="card">
          <h2>Loan History (Linked List, newest first)</h2>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Equipment</th><th>Borrower</th><th>Borrowed</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {loans.length === 0 && <tr><td colSpan="5" className="empty">No loans yet</td></tr>}
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td>{l.equipment_name}</td><td>{l.borrower_name}</td><td>{fmt(l.borrowed_at)}</td><td>{fmt(l.due_date)}</td>
                    <td>
                      {l.returned_at ? <span className="pill green">Returned</span> : (
                        <>
                          <span className={`pill ${l.overdue ? 'red' : 'yellow'}`}>{l.overdue ? 'Overdue' : 'Borrowed'}</span>{' '}
                          <button onClick={() => giveBack(l.id)}>Return</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'waitlist' && (
        <section className="card">
          <h2>Waitlist (Queue, first come first served)</h2>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Position</th><th>Equipment</th><th>Borrower</th><th>Days</th><th>Since</th></tr></thead>
              <tbody>
                {waitlist.length === 0 && <tr><td colSpan="5" className="empty">Nobody is waiting</td></tr>}
                {waitlist.map((w) => (
                  <tr key={w.id}><td>#{w.position}</td><td>{w.equipment_name}</td><td>{w.borrower_name}</td><td>{w.days}</td><td>{fmt(w.created_at)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {borrow && (
        <div className="modal" onClick={() => setBorrow(null)}>
          <form className="card" onClick={(e) => e.stopPropagation()} onSubmit={submitBorrow}>
            <h2>{borrow.out ? 'Join waitlist: ' : 'Borrow: '}{borrow.name}</h2>
            <input placeholder="Your name" value={borrow.borrower_name} onChange={(e) => setBorrow({ ...borrow, borrower_name: e.target.value })} />
            <input type="number" min="1" max="30" placeholder="Days (1-30)" value={borrow.days} onChange={(e) => setBorrow({ ...borrow, days: e.target.value })} />
            <div className="actions">
              <button type="submit">Confirm</button>
              <button type="button" className="ghost" onClick={() => setBorrow(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
    }
