
export class HashMap {
  constructor(size = 16) { this.buckets = Array.from({ length: size }, () => []); this.count = 0; }
  _hash(key) {
    const s = String(key); let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000000007;
    return h % this.buckets.length;
  }
  set(key, val) {
    const b = this.buckets[this._hash(key)];
    for (const e of b) if (e[0] === key) { e[1] = val; return; }
    b.push([key, val]); this.count++;
    if (this.count > this.buckets.length * 0.75) this._resize();
  }
  get(key) { for (const e of this.buckets[this._hash(key)]) if (e[0] === key) return e[1]; return undefined; }
  has(key) { return this.get(key) !== undefined; }
  delete(key) {
    const b = this.buckets[this._hash(key)];
    const i = b.findIndex((e) => e[0] === key);
    if (i < 0) return false;
    b.splice(i, 1); this.count--; return true;
  }
  values() { return this.buckets.flat().map((e) => e[1]); }
  _resize() {
    const old = this.buckets.flat();
    this.buckets = Array.from({ length: this.buckets.length * 2 }, () => []);
    this.count = 0; old.forEach(([k, v]) => this.set(k, v));
  }
}


export class Queue {
  constructor() { this.head = null; this.tail = null; this.length = 0; }
  enqueue(v) {
    const n = { v, next: null };
    if (this.tail) this.tail.next = n; else this.head = n;
    this.tail = n; this.length++;
  }
  dequeue() {
    if (!this.head) return null;
    const v = this.head.v; this.head = this.head.next;
    if (!this.head) this.tail = null;
    this.length--; return v;
  }
  peek() { return this.head ? this.head.v : null; }
  isEmpty() { return this.length === 0; }
  toArray() { const out = []; for (let n = this.head; n; n = n.next) out.push(n.v); return out; }
}


export class Stack {
  constructor() { this.items = []; }
  push(v) { this.items.push(v); }
  pop() { return this.items.length ? this.items.pop() : null; }
  peek() { return this.items.length ? this.items[this.items.length - 1] : null; }
  get size() { return this.items.length; }
}


export class LinkedList {
  constructor() { this.head = null; this.size = 0; }
  prepend(v) { this.head = { v, next: this.head }; this.size++; }
  toArray() { const out = []; for (let n = this.head; n; n = n.next) out.push(n.v); return out; }
}



const FIELDS = ['name', 'category', 'quantity', 'available', 'condition', 'created_at'];
export function makeComparator(field, order = 'asc') {
  const f = FIELDS.includes(field) ? field : 'name';
  const dir = order === 'desc' ? -1 : 1;
  return (a, b) => {
    const x = a[f], y = b[f];
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).toLowerCase().localeCompare(String(y).toLowerCase()) * dir;
  };
}


export function mergeSort(arr, cmp) {
  if (arr.length <= 1) return arr;
  const mid = arr.length >> 1;
  const L = mergeSort(arr.slice(0, mid), cmp), R = mergeSort(arr.slice(mid), cmp);
  const out = []; let i = 0, j = 0;
  while (i < L.length && j < R.length) out.push(cmp(L[i], R[j]) <= 0 ? L[i++] : R[j++]);
  while (i < L.length) out.push(L[i++]);
  while (j < R.length) out.push(R[j++]);
  return out;
}


export function quickSort(arr, cmp) {
  if (arr.length <= 1) return arr;
  const pivot = arr[arr.length >> 1];
  const less = [], equal = [], more = [];
  for (const x of arr) {
    const c = cmp(x, pivot);
    (c < 0 ? less : c > 0 ? more : equal).push(x);
  }
  return [...quickSort(less, cmp), ...equal, ...quickSort(more, cmp)];
}


export function binarySearch(sorted, target, keyFn) {
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, k = keyFn(sorted[mid]);
    if (k === target) return mid;
    if (k < target) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}


export function linearSearch(arr, predicate) {
  const out = [];
  for (let i = 0; i < arr.length; i++) if (predicate(arr[i])) out.push(arr[i]);
  return out;
}
