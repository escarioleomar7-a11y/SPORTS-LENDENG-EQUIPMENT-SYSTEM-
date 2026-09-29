import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { HashMap, Queue, Stack, LinkedList, mergeSort, quickSort, binarySearch, linearSearch, makeComparator } from './dsa.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const app = express();
app.use(cors());
app.use(express.json());

const CATEGORIES = ['Ball Sports', 'Racket Sports', 'Fitness', 'Water Sports', 'Combat Sports', 'Outdoor', 'Other'];
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];


const equipmentMap = new HashMap(); 
const waitQueues = new HashMap();   
const undoStack = new Stack();      


const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

async function loadAll() {
  must(await sb.from('equipment').select('*')).forEach((e) => equipmentMap.set(e.id, e));
  must(await sb.from('waitlist').select('*').order('created_at', { ascending: true })).forEach((w) => {
    if (!waitQueues.has(w.equipment_id)) waitQueues.set(w.equipment_id, new Queue());
    waitQueues.get(w.equipment_id).enqueue(w);
  });
}

function validateEquipment(b, ignoreId = null) {
  const errors = [];
  const name = String(b.name ?? '').trim();
  const quantity = Number(b.quantity);
  if (name.length < 2 || name.length > 60) errors.push('Name must be 2-60 characters');
  if (!CATEGORIES.includes(b.category)) errors.push('Invalid category');
  if (!CONDITIONS.includes(b.condition)) errors.push('Invalid condition');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) errors.push('Quantity must be a whole number from 1 to 1000');
  const dup = linearSearch(equipmentMap.values(), (e) => e.id !== ignoreId && e.name.toLowerCase() === name.toLowerCase());
  if (dup.length) errors.push('Equipment name already exists');
  if (errors.length) throw bad(errors.join('. '));
  return { name, category: b.category, condition: b.condition, quantity };
}

async function createLoan(eq, borrower, days) {
  const due = new Date(Date.now() + days * 86400000).toISOString();
  must(await sb.from('loans').insert({ equipment_id: eq.id, borrower_name: borrower, due_date: due }));
}


app.get('/api/equipment', wrap(async (req, res) => {
  const { q = '', category = '', sort = 'name', order = 'asc', algo = 'merge' } = req.query;
  const t0 = performance.now();
  let list = equipmentMap.values();
  if (category) list = linearSearch(list, (e) => e.category === category);
  const kw = q.trim().toLowerCase();
  if (kw) list = linearSearch(list, (e) => [e.name, e.category, e.condition].some((f) => f.toLowerCase().includes(kw)));
  const cmp = makeComparator(sort, order);
  list = algo === 'quick' ? quickSort(list, cmp) : mergeSort(list, cmp);
  res.json({
    items: list,
    meta: { algorithm: algo === 'quick' ? 'Quick Sort' : 'Merge Sort', count: list.length, ms: +(performance.now() - t0).toFixed(3), undoSize: undoStack.size, undoTop: undoStack.peek()?.type ?? null },
  });
}));


app.get('/api/equipment/exact', wrap(async (req, res) => {
  const name = String(req.query.name ?? '').trim().toLowerCase();
  const byName = (a, b) => { const x = a.name.toLowerCase(), y = b.name.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; };
  const sorted = mergeSort(equipmentMap.values(), byName);
  const idx = binarySearch(sorted, name, (e) => e.name.toLowerCase());
  res.json({ found: idx >= 0, item: idx >= 0 ? sorted[idx] : null, steps: 'Binary Search O(log n)' });
}));


app.post('/api/equipment', wrap(async (req, res) => {
  const v = validateEquipment(req.body);
  const row = must(await sb.from('equipment').insert({ ...v, available: v.quantity }).select().single());
  equipmentMap.set(row.id, row);
  undoStack.push({ type: 'add', item: row });
  res.status(201).json(row);
}));

app.put('/api/equipment/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const old = equipmentMap.get(id);
  if (!old) throw bad('Equipment not found', 404);
  const v = validateEquipment(req.body, id);
  const borrowed = old.quantity - old.available;
  if (v.quantity < borrowed) throw bad(`Quantity cannot be lower than currently borrowed (${borrowed})`);
  const row = must(await sb.from('equipment').update({ ...v, available: v.quantity - borrowed }).eq('id', id).select().single());
  equipmentMap.set(id, row);
  undoStack.push({ type: 'update', item: old });
  res.json(row);
}));

app.delete('/api/equipment/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const old = equipmentMap.get(id);
  if (!old) throw bad('Equipment not found', 404);
  if (old.available < old.quantity) throw bad('Cannot delete: some items are still borrowed');
  must(await sb.from('equipment').delete().eq('id', id));
  equipmentMap.delete(id);
  waitQueues.delete(id);
  undoStack.push({ type: 'delete', item: old });
  res.json({ ok: true });
}));


app.post('/api/undo', wrap(async (req, res) => {
  const a = undoStack.pop();
  if (!a) throw bad('Nothing to undo');
  if (a.type === 'add') {
    must(await sb.from('equipment').delete().eq('id', a.item.id));
    equipmentMap.delete(a.item.id);
  } else if (a.type === 'delete') {
    const row = must(await sb.from('equipment').insert(a.item).select().single());
    equipmentMap.set(row.id, row);
  } else if (a.type === 'update') {
    const { id, ...rest } = a.item;
    const row = must(await sb.from('equipment').update(rest).eq('id', id).select().single());
    equipmentMap.set(id, row);
  }
  res.json({ undone: a.type, item: a.item.name });
}));


app.post('/api/borrow', wrap(async (req, res) => {
  const id = Number(req.body.equipment_id);
  const borrower = String(req.body.borrower_name ?? '').trim();
  const days = Number(req.body.days);
  const eq = equipmentMap.get(id);
  if (!eq) throw bad('Equipment not found', 404);
  if (borrower.length < 2 || borrower.length > 50) throw bad('Borrower name must be 2-50 characters');
  if (!Number.isInteger(days) || days < 1 || days > 30) throw bad('Days must be a whole number from 1 to 30');

  if (eq.available > 0) {
    await createLoan(eq, borrower, days);
    const row = must(await sb.from('equipment').update({ available: eq.available - 1 }).eq('id', id).select().single());
    equipmentMap.set(id, row);
    return res.status(201).json({ status: 'borrowed' });
  }
  const w = must(await sb.from('waitlist').insert({ equipment_id: id, borrower_name: borrower, days }).select().single());
  if (!waitQueues.has(id)) waitQueues.set(id, new Queue());
  const q = waitQueues.get(id);
  q.enqueue(w);
  res.status(201).json({ status: 'waitlisted', position: q.length });
}));


app.post('/api/return/:loanId', wrap(async (req, res) => {
  const loan = must(await sb.from('loans').select('*').eq('id', Number(req.params.loanId)).is('returned_at', null).maybeSingle());
  if (!loan) throw bad('Loan not found or already returned');
  must(await sb.from('loans').update({ returned_at: new Date().toISOString() }).eq('id', loan.id));
  const eq = equipmentMap.get(loan.equipment_id);
  const q = waitQueues.get(loan.equipment_id);
  if (q && !q.isEmpty()) {
    const next = q.dequeue();
    must(await sb.from('waitlist').delete().eq('id', next.id));
    await createLoan(eq, next.borrower_name, next.days);
    return res.json({ status: 'returned', assignedTo: next.borrower_name });
  }
  const row = must(await sb.from('equipment').update({ available: eq.available + 1 }).eq('id', eq.id).select().single());
  equipmentMap.set(eq.id, row);
  res.json({ status: 'returned' });
}));


app.get('/api/loans', wrap(async (req, res) => {
  const rows = must(await sb.from('loans').select('*').order('borrowed_at', { ascending: true }));
  const history = new LinkedList();
  const now = new Date();
  rows.forEach((r) => history.prepend({
    ...r,
    equipment_name: equipmentMap.get(r.equipment_id)?.name ?? '(deleted)',
    overdue: !r.returned_at && new Date(r.due_date) < now,
  }));
  res.json(history.toArray());
}));


app.get('/api/waitlist', wrap(async (req, res) => {
  const out = [];
  waitQueues.values().forEach((q) => q.toArray().forEach((w, i) => out.push({
    ...w, position: i + 1, equipment_name: equipmentMap.get(w.equipment_id)?.name ?? '(deleted)',
  })));
  res.json(out);
}));

app.get('/api/meta', (req, res) => res.json({ categories: CATEGORIES, conditions: CONDITIONS }));

const dist = path.join(__dirname, '../frontend/dist');
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));

await loadAll();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
