import { auth, db, firebaseConfig, initializeApp, deleteApp, getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut,
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp, Timestamp } from './firebase.js';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
class UErr extends Error {}                       // errors whose text is safe to show
const msg = e => e instanceof UErr ? e.message : (console.error(e), e && e.code === 'permission-denied' ? 'Permission denied. Sign in again as an admin.' : 'Something went wrong. Please try again.');
function toast(m, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' err' : ''); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3400); }
const dv = t => { const d = t?.toDate ? t.toDate() : t ? new Date(t) : null; return d && !isNaN(d) ? d : null; };
const fd = t => { const d = dv(t); return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const iso = d => d.toISOString().slice(0, 10), today = () => iso(new Date());
const num = v => Number(v) || 0;
let cfg = { company: 'PixelRoot', cycleDays: 30 };
const TONE = { paid: 'ok', completed: 'ok', done: 'ok', resolved: 'ok', active: 'ok', scheduled: 'info', in_progress: 'info', doing: 'info', contacted: 'info', sent: 'info', pending: 'warn', new: 'warn', open: 'warn', todo: 'warn', revision: 'warn', high: 'bad', overdue: 'bad', cancelled: 'bad', void: 'bad', suspended: 'bad' };
const bd = s => s ? `<span class="b ${TONE[s] || ''}">${E(String(s).replace(/_/g, ' '))}</span>` : '';
const opts = a => a.map(x => [x, x[0].toUpperCase() + x.slice(1).replace(/_/g, ' ')]);

/* ---------- live data ---------- */
const COLS = ['users', 'briefs', 'meetings', 'notes', 'supportRequests', 'contactMessages', 'tasks'];
const S = Object.fromEntries([...COLS, 'notifications', 'auditLog'].map(c => [c, []]));
let me = null, meDoc = {}, cur = { id: 'overview' }, shown = 0;
const clients = () => S.users.filter(u => u.role === 'client'), designers = () => S.users.filter(u => u.role === 'designer');
const nm = id => S.users.find(u => u.id === id)?.name || '—';
const byNew = (a, b) => (dv(b.createdAt)?.getTime() || 0) - (dv(a.createdAt)?.getTime() || 0);
const refC = () => clients().map(u => [u.id, u.name + ' (' + u.email + ')']), refD = () => designers().map(u => [u.id, u.name]);
const used = c => { const s = dv(c.briefCycleStart) || (dv(c.briefResetAt) && new Date(dv(c.briefResetAt) - 31 * 864e5)); return S.briefs.filter(b => b.clientId === c.id && (!s || dv(b.createdAt) >= s)).length; };

async function audit(action, col, id, label) {
  try { await addDoc(collection(db, 'auditLog'), { actorId: me.uid, actorName: meDoc.name || 'Admin', action, col, targetId: id, label: String(label || '').slice(0, 120), createdAt: serverTimestamp() }); } catch (e) { console.error(e); }
}

/* ---------- module definitions ---------- */
const T = (k, l, t, x = {}) => ({ k, l, t, ...x });
const userBase = role => [T('name', 'Name', 'text', { req: 1, max: 100 }), T('email', 'Email', 'email', { req: 1, max: 254, e: 0 }), T('password', 'Temporary password (min 8)', 'password', { req: 1, c: 1 }), T('phone', 'Phone', 'text', { max: 30 })];
async function makeUser(d) {
  if (d.password.length < 8) throw new UErr('Password must be at least 8 characters.');
  const aux = initializeApp(firebaseConfig, 'aux' + Date.now());   // second app so the admin stays signed in
  try {
    const au = getAuth(aux), { user } = await createUserWithEmailAndPassword(au, d.email, d.password);
    await signOut(au);
    const { password, ...p } = d;
    await setDoc(doc(db, 'users', user.uid), { ...p, uid: user.uid, createdAt: serverTimestamp() });
    return user.uid;
  } catch (e) { if (e.code === 'auth/email-already-in-use') throw new UErr('That email already has a login.'); if (e.code === 'auth/invalid-email') throw new UErr('Enter a valid email.'); throw e; }
  finally { deleteApp(aux).catch(() => {}); }
}
const userActs = r => [
  ['Send password reset', async () => { await sendPasswordResetEmail(auth, r.email); toast('Reset email sent to ' + r.email); }],
  [r.disabled ? 'Reactivate account' : 'Suspend account', async () => { await updateDoc(doc(db, 'users', r.id), { disabled: !r.disabled }); audit(r.disabled ? 'reactivate' : 'suspend', 'users', r.id, r.name); toast('Updated.'); closeModal(); }]
];
const M = {
  clients: { t: 'Clients', col: 'users', g: 'People', rows: () => clients(), role: 'client', make: makeUser,
    cols: [['Name', r => E(r.name)], ['Email', r => E(r.email)], ['Plan', r => E(r.plan || '—')], ['Designer', r => E(nm(r.assignedDesignerId))], ['Briefs used', r => used(r) + '/' + (r.briefLimit ?? 10)], ['Account balance', r => 'LKR ' + num(r.balanceLKR).toLocaleString(), 'r'], ['Status', r => bd(r.disabled ? 'suspended' : 'active')]],
    fields: [...userBase(), T('company', 'Company', 'text', { max: 100 }), T('plan', 'Plan', 'text', { max: 60 }), T('assignedDesignerId', 'Designer', 'select', { o: refD, none: 'Unassigned' }),
      T('briefLimit', 'Briefs per cycle', 'number', { def: 10 }), T('revisionsPerBrief', 'Revisions per brief', 'number', { def: 2 }), T('balanceLKR', 'Account balance shown to client (LKR)', 'number', { def: 0 }),
      T('briefResetAt', 'Next cycle reset', 'date', { get: r => dv(r.briefResetAt) ? iso(dv(r.briefResetAt)) : '' })],
    pre: d => { d.role = 'client'; d.assignedDesignerId = d.assignedDesignerId || null; d.plan = d.plan || 'starter'; if (d.briefResetAt) d.briefResetAt = Timestamp.fromDate(new Date(d.briefResetAt + 'T00:00:00')); else delete d.briefResetAt; return d; },
    acts: r => [...userActs(r), ['Start new cycle', async () => { await updateDoc(doc(db, 'users', r.id), { briefCycleStart: serverTimestamp(), briefResetAt: Timestamp.fromDate(new Date(Date.now() + cfg.cycleDays * 864e5)) }); audit('reset-cycle', 'users', r.id, r.name); toast('New cycle started.'); closeModal(); }]] },
  designers: { t: 'Designers', col: 'users', g: 'People', rows: () => designers(), role: 'designer', make: makeUser,
    cols: [['Name', r => E(r.name)], ['Email', r => E(r.email)], ['Specialty', r => E(r.specialty || '—')], ['Clients', r => clients().filter(c => c.assignedDesignerId === r.id).length], ['Open briefs', r => S.briefs.filter(b => b.designerId === r.id && b.status !== 'completed').length], ['Status', r => bd(r.disabled ? 'suspended' : 'active')]],
    fields: [...userBase(), T('specialty', 'Specialty', 'text', { max: 100 }), T('monthlyPay', 'Monthly pay', 'number', { def: 0 })],
    pre: d => { d.role = 'designer'; return d; }, acts: userActs },
  briefs: { t: 'Briefs', col: 'briefs', g: 'Work', rows: () => S.briefs, sort: byNew,
    filters: [['status', 'All statuses', ['pending', 'in_progress', 'revision', 'completed']], ['late', 'Overdue', ['yes']]],
    cols: [['Title', r => E(r.title)], ['Client', r => E(r.clientName)], ['Designer', r => E(nm(r.designerId))], ['Platform', r => E(r.platform || '—')], ['Due', r => `<span class="${r.deadline && r.deadline < today() && r.status !== 'completed' ? 'late' : ''}">${E(r.deadline || '—')}</span>`], ['Status', r => bd(r.status) + (r.accepted ? '' : ' <span class="mu">unaccepted</span>')]],
    fields: [T('title', 'Title', 'text', { req: 1, max: 120, w: 1 }), T('clientId', 'Client', 'select', { o: refC, req: 1 }), T('designerId', 'Designer', 'select', { o: refD, none: 'Client default' }),
      T('platform', 'Platform', 'select', { o: () => opts(['Instagram', 'Facebook', 'LinkedIn', 'TikTok']).map(([a]) => [a, a]) }), T('format', 'Format', 'select', { o: () => ['Square', 'Story', 'Carousel'].map(a => [a, a]) }),
      T('deadline', 'Deadline', 'date'), T('status', 'Status', 'select', { o: () => opts(['pending', 'in_progress', 'revision', 'completed']), def: 'pending' }),
      T('revisionLimit', 'Revision limit', 'number', { def: 2 }), T('revisionsUsed', 'Revisions used', 'number', { def: 0 }), T('workLink', 'Work link', 'url', { max: 500, w: 1 }),
      T('accepted', 'Accepted by designer', 'check'), T('description', 'Description', 'textarea', { max: 3000, w: 1, rows: 5 })],
    pre: (d, r) => { const c = S.users.find(u => u.id === d.clientId); if (!c) throw new UErr('Choose a client.'); d.clientName = c.name; d.clientEmail = c.email; d.designerId = d.designerId || c.assignedDesignerId || null;
      if (d.accepted && !r?.acceptedAt) d.acceptedAt = serverTimestamp(); if (d.status === 'completed' && !r?.completedAt) d.completedAt = serverTimestamp();
      if (!r) { d.milestones = []; } return d; } },
  meetings: { t: 'Meetings', col: 'meetings', g: 'Work', rows: () => S.meetings, sort: (a, b) => (b.when || '').localeCompare(a.when || ''),
    cols: [['Title', r => E(r.title)], ['When', r => E((r.when || '').replace('T', ' '))], ['Client', r => E(r.clientName)], ['Designer', r => E(r.designerName)], ['Status', r => bd(r.status)]],
    fields: [T('title', 'Title', 'text', { req: 1, max: 120, w: 1 }), T('clientId', 'Client', 'select', { o: refC, req: 1 }), T('designerId', 'Designer', 'select', { o: refD, none: 'Client default' }), T('when', 'Date & time', 'datetime-local', { req: 1 }), T('status', 'Status', 'select', { o: () => opts(['scheduled', 'cancelled']), def: 'scheduled' }),
      T('link', 'Meeting link', 'url', { max: 500, w: 1 }), T('notes', 'Notes', 'textarea', { max: 1000, w: 1 })],
    pre: (d, r) => { const c = S.users.find(u => u.id === d.clientId); if (!c) throw new UErr('Choose a client.'); d.clientName = c.name; d.designerId = d.designerId || c.assignedDesignerId || null; d.designerName = d.designerId ? nm(d.designerId) : '';
      if (!r) { d.createdBy = me.uid; d.createdByRole = 'admin'; } return d; } },
  notes: { t: 'Notes', col: 'notes', g: 'Work', rows: () => S.notes, sort: byNew,
    cols: [['Note', r => E(r.text)], ['Category', r => bd(r.category)], ['Client', r => E(r.clientName)], ['Author', r => E(r.authorName)], ['Date', r => fd(r.createdAt)]],
    fields: [T('clientId', 'Client', 'select', { o: refC, req: 1, c: 1 }), T('category', 'Category', 'select', { o: () => opts(['general', 'feedback', 'idea', 'reference', 'urgent']) }), T('text', 'Note', 'textarea', { req: 1, max: 2000, w: 1, rows: 5 })],
    pre: (d, r) => { if (!r) { const c = S.users.find(u => u.id === d.clientId); d.clientName = c?.name || ''; d.designerId = c?.assignedDesignerId || null; d.designerName = d.designerId ? nm(d.designerId) : ''; d.authorId = me.uid; d.authorRole = 'admin'; d.authorName = meDoc.name || 'Admin'; } return d; } },
  tasks: { t: 'Tasks', col: 'tasks', g: 'Work', rows: () => S.tasks, sort: (a, b) => (a.due || '9').localeCompare(b.due || '9'),
    filters: [['status', 'All statuses', ['todo', 'doing', 'done']]],
    cols: [['Task', r => E(r.title)], ['Assignee', r => E(r.assigneeId ? nm(r.assigneeId) : '—')], ['Due', r => E(r.due || '—')], ['Priority', r => bd(r.priority)], ['Status', r => bd(r.status)]],
    fields: [T('title', 'Task', 'text', { req: 1, max: 160, w: 1 }), T('assigneeId', 'Assignee', 'select', { o: refD, none: 'Unassigned' }), T('due', 'Due date', 'date'), T('priority', 'Priority', 'select', { o: () => opts(['low', 'normal', 'high']), def: 'normal' }), T('status', 'Status', 'select', { o: () => opts(['todo', 'doing', 'done']), def: 'todo' }), T('note', 'Details', 'textarea', { max: 1000, w: 1 })] },
  leads: { t: 'Leads', col: 'contactMessages', g: 'Inbox', rows: () => S.contactMessages, sort: byNew, noAdd: 1, filters: [['status', 'All statuses', ['new', 'contacted', 'closed']]],
    cols: [['Name', r => E(r.name)], ['Email', r => E(r.email)], ['Message', r => E(r.message)], ['Date', r => fd(r.createdAt)], ['Status', r => bd(r.status)]],
    fields: [T('name', 'Name', 'text', { ro: 1 }), T('email', 'Email', 'text', { ro: 1 }), T('phone', 'Phone', 'text', { ro: 1 }), T('status', 'Status', 'select', { o: () => opts(['new', 'contacted', 'closed']) }), T('message', 'Message', 'textarea', { ro: 1, w: 1, rows: 5 })],
    acts: r => [['Reply by email', () => { location.href = 'mailto:' + encodeURIComponent(r.email); }], ...(String(r.phone || '').replace(/\D/g, '').length > 5 ? [['WhatsApp', () => window.open('https://wa.me/' + String(r.phone).replace(/\D/g, ''), '_blank', 'noopener')]] : [])] },
  support: { t: 'Support', col: 'supportRequests', g: 'Inbox', rows: () => S.supportRequests, sort: byNew, noAdd: 1, filters: [['status', 'All statuses', ['open', 'resolved']]],
    cols: [['From', r => E(r.clientName || r.designerName)], ['Type', r => bd(r.type)], ['Message', r => E(r.message)], ['Date', r => fd(r.createdAt)], ['Status', r => bd(r.status)]],
    fields: [T('status', 'Status', 'select', { o: () => opts(['open', 'resolved']) }), T('message', 'Message', 'textarea', { ro: 1, w: 1, rows: 6 })] },
  notifications: { t: 'Notifications', col: 'notifications', g: 'Inbox', rows: () => S.notifications,
    cols: [['To', r => E(r.userId === 'admin' ? 'Admin' : nm(r.userId))], ['Title', r => E(r.title)], ['Message', r => E(r.body || '')], ['Date', r => fd(r.createdAt)], ['Read', r => r.read ? 'Yes' : 'No']],
    fields: [T('read', 'Marked as read', 'check'), T('userId', 'Send to', 'select', { o: () => S.users.map(u => [u.id, u.name + ' (' + u.role + ')']), req: 1, c: 1 }), T('title', 'Title', 'text', { req: 1, max: 120, w: 1 }), T('body', 'Message', 'textarea', { req: 1, max: 300, w: 1 })],
    pre: (d, r) => { if (!r) { d.role = S.users.find(u => u.id === d.userId)?.role || 'client'; d.read = false; } return d; } },
  audit: { t: 'Audit log', col: 'auditLog', g: 'System', rows: () => S.auditLog, noAdd: 1, noEdit: 1, noDel: 1,
    cols: [['When', r => (dv(r.createdAt) || new Date()).toLocaleString()], ['Admin', r => E(r.actorName)], ['Action', r => bd(r.action)], ['Area', r => E(r.col)], ['Item', r => E(r.label)]] }
};

/* ---------- forms ---------- */
function fieldHTML(f, v) {
  const val = v ?? f.def ?? '';
  let i;
  if (f.t === 'select') { const o = typeof f.o === 'function' ? f.o() : f.o; i = `<select name="${f.k}">${f.none ? `<option value="">${E(f.none)}</option>` : ''}${o.map(([a, b]) => `<option value="${E(a)}"${String(a) === String(val) ? ' selected' : ''}>${E(b)}</option>`).join('')}</select>`; }
  else if (f.t === 'textarea') i = `<textarea name="${f.k}" rows="${f.rows || 3}" maxlength="${f.max || 2000}"${f.ro ? ' readonly' : ''}>${E(val)}</textarea>`;
  else if (f.t === 'check') i = `<label class="chk"><input type="checkbox" name="${f.k}"${val ? ' checked' : ''}> Yes</label>`;
  else i = `<input name="${f.k}" type="${f.t}" value="${E(val)}" maxlength="${f.max || 200}"${f.t === 'number' ? ' step="any"' : ''}${f.ro ? ' readonly' : ''}${f.t === 'password' ? ' autocomplete="new-password"' : ''}>`;
  return `<div class="f${f.w ? ' w' : ''}"><label>${E(f.l)}${f.req && !f.ro ? ' *' : ''}</label>${i}</div>`;
}
function collect(form, fields) {
  const d = {};
  for (const f of fields) {
    const el = form.elements[f.k]; if (!el || f.ro) continue;
    let v = f.t === 'check' ? el.checked : f.t === 'password' ? el.value : el.value.trim();
    if (f.t === 'number') v = v === '' ? 0 : Number(v);
    if (f.req && (v === '' || v == null)) throw new UErr(f.l.replace(/ \(.*/, '') + ' is required.');
    if (f.t === 'url' && v && !/^https?:\/\/\S+$/i.test(v)) throw new UErr('Links must start with http:// or https://');
    if (f.t === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new UErr('Enter a valid email.');
    d[f.k] = v;
  }
  return d;
}
function openModal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.add('on'); }
function closeModal() { $('#modal').classList.remove('on'); $('#modalBox').innerHTML = ''; }
let actFns = [];
function editor(id, row) {
  const m = M[id], fields = m.fields.filter(f => row ? !f.c : !f.e).map(f => row && m.col === 'users' && f.k === 'email' ? { ...f, ro: 1 } : f), acts = row && m.acts ? m.acts(row) : []; actFns = acts.map(a => a[1]);
  const val = f => row ? (f.get ? f.get(row) : row[f.k]) : undefined;
  openModal(`<h2>${row ? 'Edit' : 'New'} ${E(m.t.replace(/s$/, '').toLowerCase())}</h2><p class="sub">${row ? 'Changes save instantly for everyone.' : 'Fill in the details below.'}</p>
    ${acts.length ? `<div class="acts">${acts.map((a, i) => `<button type="button" class="btn sm" data-act="${i}">${E(a[0])}</button>`).join('')}</div>` : ''}
    <form id="ef" novalidate><div class="fg">${fields.map(f => fieldHTML(f, val(f))).join('')}</div>
    <div class="foot"><span>${row && !m.noDel ? '<button type="button" class="btn dng" id="del">Delete</button>' : ''}</span><span><button type="button" class="btn" id="cancel">Close</button> ${m.noEdit ? '' : `<button class="btn pri" type="submit">${row ? 'Save changes' : 'Create'}</button>`}</span></div></form>`);
  const form = $('#ef');
  $('#cancel').onclick = closeModal;
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => run(b, actFns[b.dataset.act]));
  if ($('#del')) $('#del').onclick = () => run($('#del'), async () => {
    if (!confirm(m.col === 'users' ? 'Delete this profile? They will no longer be able to use the portal. Their login can be removed later in Firebase Authentication.' : 'Delete this record permanently?')) return;
    await deleteDoc(doc(db, m.col, row.id)); audit('delete', m.col, row.id, row.name || row.title || row.number || row.vendor || ''); toast('Deleted.'); closeModal();
  });
  form.onsubmit = e => { e.preventDefault(); run(form.querySelector('[type=submit]'), async () => {
    let d = collect(form, fields); if (m.pre) d = m.pre(d, row) || d;
    if (row) { await updateDoc(doc(db, m.col, row.id), d); audit('update', m.col, row.id, d.name || d.title || row.name || row.title || ''); toast('Saved.'); }
    else { const nid = m.make ? await m.make(d) : (await addDoc(collection(db, m.col), { ...d, createdAt: serverTimestamp() })).id; audit('create', m.col, nid, d.name || d.title || d.vendor || ''); toast('Created.'); }
    closeModal(); }); };
}
async function run(btn, fn) { const t = btn.textContent; btn.disabled = true; try { await fn(); } catch (e) { toast(msg(e), true); } finally { btn.disabled = false; btn.textContent = t; } }

/* ---------- module table ---------- */
function mount(id) {
  const m = M[id], fl = m.filters || [];
  $('#view').innerHTML = `<div class="head"><div><h1>${E(m.t)}</h1><p class="sub" id="sub"></p></div><div class="tools">${fl.map(([k, l, o]) => `<select data-f="${k}" aria-label="${E(l)}"><option value="">${E(l)}</option>${o.map(x => `<option value="${x}">${E(x.replace(/_/g, ' '))}</option>`).join('')}</select>`).join('')}
    <button class="btn" id="csv" type="button">Export CSV</button>${m.noAdd ? '' : `<button class="btn pri" id="add" type="button">+ New</button>`}</div></div><div class="tw"><table><thead><tr>${m.cols.map(c => `<th class="${c[2] || ''}">${E(c[0])}</th>`).join('')}</tr></thead><tbody id="tb"></tbody></table></div><p class="cnt" id="cnt"></p>`;
  if ($('#add')) $('#add').onclick = () => editor(id, null);
  $('#csv').onclick = () => exportCsv(id);
  document.querySelectorAll('[data-f]').forEach(s => s.onchange = () => { cur.f = cur.f || {}; cur.f[s.dataset.f] = s.value; refresh(); });
  $('#tb').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (!tr || e.target.closest('a')) return; const r = rowsOf(id).find(x => x.id === tr.dataset.id); if (r && m.fields) editor(id, r); };
}
function rowsOf(id) {
  const m = M[id], q = ($('#gsearch').value || '').toLowerCase().trim(), f = cur.f || {};
  let r = [...m.rows()];
  if (m.sort) r.sort(m.sort);
  if (q) r = r.filter(x => Object.values(x).filter(v => typeof v !== 'object').join(' ').toLowerCase().includes(q) || m.cols.some(c => String(c[1](x)).toLowerCase().includes(q)));
  for (const k in f) if (f[k]) r = r.filter(x => k === 'late' ? x.deadline && x.deadline < today() && x.status !== 'completed' : (m.state ? m.state(x) : x[k]) === f[k]);
  return r;
}
function refresh() {
  if (cur.id === 'overview') return overview();
  if (cur.id === 'settings') return;
  const m = M[cur.id], tb = $('#tb'); if (!m || !tb) return;
  const all = rowsOf(cur.id), rows = all.slice(0, 300);
  tb.innerHTML = rows.length ? rows.map(r => `<tr data-id="${E(r.id)}">${m.cols.map(c => `<td class="${c[2] || ''}">${c[1](r)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${m.cols.length}" class="empty">${E(m.empty || 'Nothing here yet.')}</td></tr>`;
  $('#cnt').textContent = all.length + ' record' + (all.length === 1 ? '' : 's') + (all.length > 300 ? ' (showing the first 300, use search or export)' : '');
}
function exportCsv(id) {
  const m = M[id], strip = h => String(h).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const cell = v => { v = strip(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }; // neutralises spreadsheet formulas
  const csv = [m.cols.map(c => cell(c[0])).join(','), ...rowsOf(id).map(r => m.cols.map(c => cell(c[1](r))).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = `pixelroot-${id}-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/* ---------- overview ---------- */
function overview() {
  const open = S.briefs.filter(b => b.status !== 'completed');
  const attention = [
    ['briefs', ...[S.briefs.filter(b => !b.accepted && b.status !== 'completed').length, 'briefs awaiting acceptance']],
    ['briefs', ...[open.filter(b => b.deadline && b.deadline < today()).length, 'overdue briefs']],
    ['clients', ...[clients().filter(c => !c.assignedDesignerId && !c.disabled).length, 'clients without a designer']],
    ['leads', ...[S.contactMessages.filter(x => x.status === 'new').length, 'new leads']],
    ['support', ...[S.supportRequests.filter(x => x.status === 'open').length, 'open support requests']],
    ['tasks', ...[S.tasks.filter(t => t.status !== 'done' && t.due && t.due < today()).length, 'overdue tasks']]
  ].filter(a => a[1]);
  const pending = S.briefs.filter(b => b.status === 'pending').length;
  const inProgress = S.briefs.filter(b => b.status === 'in_progress').length;
  const revisions = S.briefs.filter(b => b.status === 'revision').length;
  const completed = S.briefs.filter(b => b.status === 'completed').length;
  const firstName = String(meDoc.name || 'Admin').trim().split(/\s+/)[0];
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('#view').innerHTML = `<div class="head overview-head"><div><p class="eyebrow">ADMIN WORKSPACE</p><h1>Welcome back, ${E(firstName)}</h1><p class="sub">${E(cfg.company)} <span aria-hidden="true">·</span> ${E(dateLabel)}</p></div>
      <div class="overview-actions"><button class="btn" type="button" data-create="clients">Add client</button><button class="btn btn-main" type="button" data-create="briefs">+ New brief</button></div></div>
    <div class="admin-hero"><div class="admin-hero-copy"><p class="eyebrow">YOUR WORKSPACE</p><h2>Keep your team moving.</h2><p>Check project progress, support requests, and what needs your attention.</p><button class="btn hero-btn" type="button" data-go="briefs">View all briefs <span aria-hidden="true">→</span></button></div>
      <div class="admin-hero-stats"><div><b>${open.length}</b><span>Active briefs</span></div><div><b>${clients().filter(c => !c.disabled).length}</b><span>Active clients</span></div><div><b>${designers().filter(d => !d.disabled).length}</b><span>Designers</span></div></div></div>
    <div class="kpis">
      <a class="kpi" href="#briefs"><small>Awaiting acceptance</small><b>${S.briefs.filter(b => !b.accepted && b.status !== 'completed').length}</b><span>Briefs needing review</span></a>
      <a class="kpi" href="#briefs"><small>In progress</small><b>${inProgress}</b><span>Currently being worked on</span></a>
      <a class="kpi" href="#briefs"><small>Revisions requested</small><b>${revisions}</b><span>Briefs with revision requests</span></a>
      <a class="kpi" href="#briefs"><small>Completed briefs</small><b>${completed}</b><span>Finished projects</span></a>
      <a class="kpi" href="#leads"><small>New leads</small><b>${S.contactMessages.filter(x => x.status === 'new').length}</b><span>Messages waiting for a reply</span></a>
      <a class="kpi" href="#support"><small>Open support</small><b>${S.supportRequests.filter(x => x.status === 'open').length}</b><span>Requests waiting for a response</span></a>
    </div>
    <div class="cols"><div class="card attention-card"><div class="card-heading"><div><p class="eyebrow">QUICK CHECK</p><h2>Needs attention</h2></div><span class="attention-count">${attention.length}</span></div>${attention.map(a => `<a class="li" href="#${a[0]}"><span><b>${a[1]}</b> ${a[2]}</span><small>View <span aria-hidden="true">→</span></small></a>`).join('') || '<p class="mu">All caught up.</p>'}</div>
      <div><div class="card"><div class="card-heading"><div><p class="eyebrow">PROJECT STATUS</p><h2>Briefs at a glance</h2></div></div>
        <a class="status-row" href="#briefs"><span><i class="status-dot pending"></i>Pending</span><b>${pending}</b></a>
        <a class="status-row" href="#briefs"><span><i class="status-dot progress"></i>In progress</span><b>${inProgress}</b></a>
        <a class="status-row" href="#briefs"><span><i class="status-dot revision"></i>Revision</span><b>${revisions}</b></a>
        <a class="status-row" href="#briefs"><span><i class="status-dot completed"></i>Completed</span><b>${completed}</b></a></div>
      <div class="card"><div class="card-heading"><div><p class="eyebrow">LATEST UPDATES</p><h2>Recent activity</h2></div><a class="link" href="#audit">View all</a></div>${S.auditLog.slice(0, 5).map(a => `<div class="li"><span>${E(a.actorName)} ${E(a.action)} ${E(a.col)} <small>${E(a.label)}</small></span><small>${(dv(a.createdAt) || new Date()).toLocaleDateString()}</small></div>`).join('') || '<p class="mu">No activity yet.</p>'}</div></div></div>`;
}
function settings() {
  const F = [T('company', 'Company name', 'text', { max: 80 }), T('cycleDays', 'Billing cycle (days)', 'number')];
  $('#view').innerHTML = `<div class="head"><div><p class="eyebrow">ADMIN WORKSPACE</p><h1>Settings</h1><p class="sub">Company details and client billing cycle.</p></div></div><form id="sf" class="set card"><div class="fg">${F.map(f => fieldHTML(f, cfg[f.k])).join('')}</div><button class="btn btn-main" type="submit">Save settings</button></form>`;
  $('#sf').onsubmit = e => { e.preventDefault(); run($('#sf [type=submit]'), async () => { const d = collect($('#sf'), F);
    await setDoc(doc(db, 'settings', 'company'), d, { merge: true }); audit('update', 'settings', 'company', 'Settings'); toast('Settings saved.'); }); };
}

/* ---------- navigation ---------- */
const NAV = [['Overview', [['overview', 'Overview']]], ['People', ['clients', 'designers']], ['Work', ['briefs', 'meetings', 'notes', 'tasks']], ['Inbox', ['leads', 'support', 'notifications']], ['System', [['settings', 'Settings'], 'audit']]];
const NAV_PATHS = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.5a3.5 3.5 0 0 1 0 6.8M17 14a6 6 0 0 1 4.5 5.8"/>',
  designers: '<circle cx="12" cy="8" r="3.5"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  briefs: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  meetings: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  notes: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  tasks: '<path d="m5 12 4 4L19 6"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  leads: '<path d="M4 4h16v13H5l-3 3V6a2 2 0 0 1 2-2z"/><path d="M8 9h8M8 13h5"/>',
  support: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.2 1-1.8 1.2-1.8 2.7M12 17h.01"/>',
  notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10 21h4"/>',
  settings: '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6"/>',
  audit: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'
};
function badge(id) { return ({ leads: S.contactMessages.filter(x => x.status === 'new').length, support: S.supportRequests.filter(x => x.status === 'open').length, briefs: S.briefs.filter(b => !b.accepted && b.status !== 'completed').length })[id] || 0; }
function drawNav() {
  $('#nav').innerHTML = NAV.map(([g, items]) => `<div class="grp">${g}</div><div class="nav-group">${items.map(i => { const [id, l] = Array.isArray(i) ? i : [i, M[i].t], n = badge(id); return `<button class="nl${cur.id === id ? ' on' : ''}" data-go="${id}"${cur.id === id ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_PATHS[id]}</svg><span>${E(l)}</span>${n ? `<em aria-label="${n} items need attention">${n}</em>` : ''}</button>`; }).join('')}</div>`).join('');
  $('#topTitle').textContent = cur.id === 'overview' ? 'Overview' : cur.id === 'settings' ? 'Settings' : M[cur.id]?.t || 'Audit log';
  const un = S.notifications.filter(n => n.userId === 'admin' && !n.read).length; $('#bellDot').hidden = !un;
}
function go(id) {
  if (!M[id] && !['overview', 'settings'].includes(id)) id = 'overview';
  cur = { id, f: {} }; $('#gsearch').value = ''; $('#side').classList.remove('open'); $('#scrim').classList.remove('on');
  if (id === 'settings') settings(); else if (M[id]) mount(id);
  refresh(); drawNav(); window.scrollTo(0, 0);
}
let raf = 0; const sched = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { refresh(); drawNav(); }); };
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
$('#nav').onclick = e => { const b = e.target.closest('[data-go]'); if (b) { if (location.hash.slice(1) === b.dataset.go) go(b.dataset.go); else location.hash = b.dataset.go; } };
$('#view').onclick = e => { const b = e.target.closest('[data-create]'); if (b) editor(b.dataset.create, null); };
$('#gsearch').oninput = refresh;
$('#quickClient').onclick = () => editor('clients', null);
$('#menuBtn').onclick = () => { $('#side').classList.add('open'); $('#scrim').classList.add('on'); };
$('#scrim').onclick = () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); };
$('#bellBtn').onclick = () => { location.hash = 'notifications'; };
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && !e.target.isContentEditable) {
    e.preventDefault();
    $('#gsearch').focus();
  }
});
$('#meBtn').onclick = async () => { await signOut(auth); location.replace('signin.html'); };

/* ---------- start: only role "admin" gets in ---------- */
const DASH = { client: 'client-dashboard.html', designer: 'designer-dashboard.html' };
onAuthStateChanged(auth, async user => {
  if (!user) return location.replace('signin.html');
  let d = null;
  try { const s = await getDoc(doc(db, 'users', user.uid)); d = s.exists() ? s.data() : null; } catch (e) { console.error(e); }
  if (!d || d.disabled) { await signOut(auth); return location.replace('signin.html'); }
  if (d.role !== 'admin') return location.replace(DASH[d.role] || 'signin.html');
  me = user; meDoc = d; document.documentElement.classList.remove('gate');
  $('#meName').textContent = d.name || 'Admin'; $('#meAv').textContent = (d.name || 'A')[0].toUpperCase();
  const bad = e => { console.error(e); };
  COLS.forEach(c => onSnapshot(collection(db, c), s => { S[c] = s.docs.map(x => ({ id: x.id, ...x.data() })); sched(); }, bad));
  onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(150)), s => { S.notifications = s.docs.map(x => ({ id: x.id, ...x.data() })); sched(); }, bad);
  onSnapshot(query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(200)), s => { S.auditLog = s.docs.map(x => ({ id: x.id, ...x.data() })); sched(); }, bad);
  onSnapshot(doc(db, 'settings', 'company'), s => { if (s.exists()) cfg = { ...cfg, ...s.data() }; sched(); }, bad);
  go(location.hash.slice(1));
});
