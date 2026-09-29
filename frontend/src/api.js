async function req(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  list: (params) => req('/api/equipment?' + new URLSearchParams(params)),
  exact: (name) => req('/api/equipment/exact?name=' + encodeURIComponent(name)),
  add: (b) => req('/api/equipment', 'POST', b),
  update: (id, b) => req(`/api/equipment/${id}`, 'PUT', b),
  remove: (id) => req(`/api/equipment/${id}`, 'DELETE'),
  undo: () => req('/api/undo', 'POST'),
  borrow: (b) => req('/api/borrow', 'POST', b),
  giveBack: (loanId) => req(`/api/return/${loanId}`, 'POST'),
  loans: () => req('/api/loans'),
  waitlist: () => req('/api/waitlist'),
};
