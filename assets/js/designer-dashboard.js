import { auth, db, onAuthStateChanged, signOut, doc, getDoc, updateDoc, addDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp } from './firebase.js';

/* ---------- Constants & helpers ---------- */
  const DASH = { client: 'client-dashboard.html', designer: 'designer-dashboard.html', admin: 'admin-dashboard.html' };
  const STATUS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', revision: 'Revision Requested' };
  const CAT = { general: 'General', feedback: 'Feedback', idea: 'Idea', reference: 'Reference', urgent: 'Urgent' };
  const ERR = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'permission-denied': 'You do not have permission to do that.',
    'auth/requires-recent-login': 'Please sign in again before changing this.'
  };

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeHref = s => { const v = String(s ?? '').trim(); return /^https?:\/\//i.test(v) ? esc(v) : '#'; };
  const badge = s => `<span class="badge ${esc(s)}">${esc(STATUS[s] || s)}</span>`;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const fmtDate = t => t?.toDate ? t.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const shortDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—';
  const nowStr = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const dayDiff = s => Math.round((new Date(s + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
  const sortNew = l => l.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const byDue = (a, b) => (a.deadline || '9').localeCompare(b.deadline || '9');
  const errMsg = e => { console.error(e); return ERR[e && e.code] || 'Something went wrong. Please try again.'; };
  const fail = e => toast(errMsg(e), true);
  const isHttp = s => /^https?:\/\//i.test(s);

  const pct = b => {
    const m = b.milestones || [];
    if (b.status === 'completed') return 100;
    if (m.length) return Math.round(m.filter(x => x.done).length / m.length * 100);
    if (b.status === 'in_progress' && b.workLink) return 75;
    if (b.status === 'in_progress' || b.status === 'revision') return 50;
    if (b.accepted) return 25;
    return 0;
  };
  const dueInfo = (s, done) => {
    if (!s) return { t: 'No deadline', c: '' };
    if (done) return { t: shortDate(s), c: '' };
    const d = dayDiff(s);
    return { t: d < 0 ? plural(-d, 'day') + ' overdue' : d === 0 ? 'Due today' : plural(d, 'day') + ' left', c: d < 0 ? 'late' : d <= 3 ? 'soon' : '' };
  };
  const dueTag = (s, done) => { const d = dueInfo(s, done); return `<span class="due ${d.c}">${esc(d.t)}</span>`; };
  const upMeet = l => l.filter(m => m.status === 'scheduled' && m.when >= nowStr()).sort((a, b) => a.when.localeCompare(b.when));
  const isAwaiting = b => !b.accepted && b.status !== 'completed';
  const isActive = b => b.accepted && (b.status === 'pending' || b.status === 'in_progress');

  const ICON = {
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
  };

  function toast(m, bad) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' err' : '');
    t.textContent = m;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }
  async function busy(btn, fn) {
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Please wait…';
    try { await fn(); } catch (e) { fail(e); }
    btn.disabled = false; btn.textContent = label;
  }
  const openSheet = id => $(id).classList.add('on');
  const closeSheet = id => $(id).classList.remove('on');

  /* ---------- State ---------- */
  let u = null, p = {};
  let briefs = [], clients = [], meetings = [], notes = [], notifications = [];
  let filter = 'all', currentBriefId = null, currentClientId = null, editingNoteId = null;

  const clientById = id => clients.find(c => c.uid === id);
  const briefsOf = clientId => briefs.filter(b => b.clientId === clientId);

  /* ---------- Rendering ---------- */
  function renderAll() {
    renderOverview();
    renderBriefs();
    renderClients();
    renderMeetings();
    renderNotes();
    renderNotifDot();
    renderProfile();
    renderClientSelects();
  }

  function emptyBox(icon, title, text, action = '') {
    return `<div class="empty">
      <div class="empty-ico">${icon}</div>
      <b>${esc(title)}</b>${esc(text)}${action ? `<div>${action}</div>` : ''}
    </div>`;
  }

  function briefCard(b) {
    const pc = pct(b), ms = b.milestones || [];
    const msDone = ms.filter(m => m.done).length;
    const client = clientById(b.clientId);
    const who = esc(b.clientName || client?.name || 'Client');
    const flag = isAwaiting(b)
      ? '<span class="tag warn">Awaiting your acceptance</span>'
      : b.status === 'revision' ? '<span class="tag warn">Revision requested</span>' : '';
    return `<div class="bc" data-status="${esc(b.status || 'pending')}" data-open="${b.id}">
      <div class="bc-top">
        <div class="title">${esc(b.title)}</div>
        ${badge(b.status || 'pending')}
      </div>
      <div class="bc-meta">
        <span class="tag">${who}</span>
        <span class="tag">${esc(b.platform)}</span>
        <span class="tag">${esc(b.format)}</span>
        ${ms.length ? `<span class="tag">${msDone}/${ms.length} milestones</span>` : ''}
        ${flag}
      </div>
      <div class="bar"><i style="width:${pc}%"></i></div>
      <div class="bc-foot"><span>${dueTag(b.deadline, b.status === 'completed')}</span><span>${pc}%</span></div>
    </div>`;
  }

  function renderOverview() {
    const open = briefs.filter(b => b.status !== 'completed').sort(byDue);
    const awaiting = briefs.filter(isAwaiting);
    const inProg = briefs.filter(b => b.status === 'in_progress');
    const rev = briefs.filter(b => b.status === 'revision');
    const um = upMeet(meetings);

    const first = (p.name || '').trim().split(' ')[0];
    $('#hHello').textContent = first ? `Hi, ${first}` : 'Hi there';
    $('#hSummary').textContent = briefs.length
      ? `${plural(awaiting.length, 'brief')} awaiting acceptance · ${plural(rev.length, 'revision')} requested`
      : 'No projects assigned yet.';

    $('#sAwait').textContent = awaiting.length;
    $('#sActive').textContent = inProg.length;
    $('#sRev').textContent = rev.length;
    $('#sClients').textContent = clients.length;

    const attention = briefs
      .filter(b => isAwaiting(b) || b.status === 'revision' || (b.deadline && dayDiff(b.deadline) < 0 && b.status !== 'completed'))
      .sort(byDue);
    $('#attention').innerHTML = attention.length
      ? attention.slice(0, 6).map(briefCard).join('')
      : emptyBox(ICON.file, 'All caught up', 'No briefs are waiting on you right now.');

    $('#deadlines').innerHTML = open.length
      ? open.slice(0, 5).map(b => `<div class="trow" data-open="${b.id}">
          <span><b>${esc(b.title)}</b>${dueTag(b.deadline)}</span>${badge(b.status || 'pending')}
        </div>`).join('')
      : emptyBox(ICON.cal, 'No deadlines', 'Upcoming deadlines appear here.');

    $('#nextMeet').innerHTML = um[0]
      ? meetingRow(um[0], true)
      : emptyBox(ICON.cal, 'No meetings booked', 'Schedule a call with a client.');

    $('#notesHome').innerHTML = notes.length
      ? sortNew([...notes]).slice(0, 2).map(n => noteCard(n, true)).join('')
      : emptyBox(ICON.note, 'No notes yet', 'Share an update with a client.');
  }

  function renderBriefs() {
    const F = {
      all: () => true,
      awaiting: isAwaiting,
      active: isActive,
      revision: b => b.status === 'revision',
      done: b => b.status === 'completed'
    };
    const counts = {};
    Object.keys(F).forEach(k => counts[k] = briefs.filter(F[k]).length);
    $$('[data-count]').forEach(s => s.textContent = counts[s.dataset.count]);
    $$('.fchip').forEach(c => c.classList.toggle('on', c.dataset.filter === filter));
    $('#briefsSub').textContent = briefs.length ? `${counts.awaiting} awaiting · ${counts.done} completed` : 'Projects assigned to you appear here.';

    const list = sortNew([...briefs]).filter(F[filter]);
    $('#briefList').innerHTML = list.length
      ? list.map(briefCard).join('')
      : emptyBox(ICON.file, briefs.length ? 'Nothing here' : 'No projects yet', briefs.length ? 'Try a different filter.' : 'Projects assigned to you will appear here.');
  }

  function renderClients() {
    $('#clientsSub').textContent = clients.length ? plural(clients.length, 'assigned client') : 'Clients assigned by the admin appear here.';
    $('#clientList').innerHTML = clients.length
      ? clients.map(c => {
          const bs = briefsOf(c.uid);
          const active = bs.filter(b => b.status !== 'completed').length;
          const awaiting = bs.filter(isAwaiting).length;
          return `<button class="cc" data-client="${c.uid}">
            ${avatarOf(c.name)}
            <div class="info">
              <b>${esc(c.name || 'Client')}</b>
              <small>${esc(c.company || c.email || '')}</small>
              <div class="counts">
                <span class="tag">${active} active</span>
                ${awaiting ? `<span class="tag warn">${awaiting} awaiting</span>` : ''}
              </div>
            </div>
          </button>`;
        }).join('')
      : emptyBox(ICON.user, 'No clients yet', 'The admin team will assign clients to you.');
  }

  function meetingRow(m, compact) {
    const d = new Date(m.when);
    const canCancel = m.createdBy === u.uid;
    return `<div class="tl">
      <div class="tl-date"><b>${d.getDate()}</b><small>${d.toLocaleString(undefined, { month: 'short' })}</small></div>
      <div class="tl-card">
        <div class="tl-title">${esc(m.title)}</div>
        <div class="muted small">${d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</div>
        ${compact ? '' : `<div class="muted small">${esc(m.clientName)} with ${esc(m.designerName)}</div>`}
        ${m.notes && !compact ? `<div class="small" style="margin-top:6px">${esc(m.notes)}</div>` : ''}
        ${(m.link || canCancel) ? `<div class="tl-actions">
          ${m.link ? `<a class="btn btn-soft sm" href="${safeHref(m.link)}" target="_blank" rel="noopener noreferrer">Join call</a>` : ''}
          ${canCancel ? `<button class="btn btn-ghost sm" data-cancel="${m.id}">Cancel</button>` : ''}
        </div>` : ''}
      </div>
    </div>`;
  }

  function renderMeetings() {
    const um = upMeet(meetings);
    $('#meetSub').textContent = um.length ? plural(um.length, 'upcoming meeting') : 'Your calls with clients appear here.';
    $('#meetList').innerHTML = um.length
      ? um.map(m => meetingRow(m, false)).join('')
      : emptyBox(ICON.cal, 'No upcoming meetings', 'Schedule a call with one of your clients.');
  }

  function noteCard(n, compact) {
    const mine = n.authorId === u.uid;
    const when = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
    return `<div class="note">
      <div class="note-top">
        <span class="cat ${esc(n.category || 'general')}">${esc(CAT[n.category] || 'General')}</span>
        ${mine ? '<span class="mine-tag">You</span>' : `<span>${esc(n.authorName || 'Client')}</span>`}
        <span>· ${esc(n.clientName || '')}</span>
        <span>· ${when}</span>
        ${n.briefTitle ? `<span>· ${esc(n.briefTitle)}</span>` : ''}
      </div>
      <p>${esc(compact && n.text.length > 120 ? n.text.slice(0, 120) + '…' : n.text)}</p>
      ${mine && !compact ? `<div class="note-acts">
        <button class="btn btn-ghost sm" data-note-edit="${n.id}">Edit</button>
        <button class="btn btn-danger sm" data-note-del="${n.id}">Delete</button>
      </div>` : ''}
    </div>`;
  }

  function renderNotes() {
    $('#noteList').innerHTML = notes.length
      ? sortNew([...notes]).map(n => noteCard(n, false)).join('')
      : emptyBox(ICON.note, 'No notes yet', 'Post an update for a client using the box.');
  }

  function renderClientSelects() {
    const opts = clients.map(c => `<option value="${c.uid}">${esc(c.name || c.email || 'Client')}</option>`).join('');
    const emptyOpt = '<option value="">No clients assigned</option>';
    ['#nClient', '#mClient'].forEach(sel => {
      const el = $(sel);
      const cur = el.value;
      el.innerHTML = clients.length ? opts : emptyOpt;
      if ([...el.options].some(o => o.value === cur)) el.value = cur;
    });
    const sel = $('#nBrief');
    const cur = sel.value;
    sel.innerHTML = '<option value="">No project</option>' + briefs.map(b => `<option value="${b.id}|${esc(b.title)}">${esc(b.title)}</option>`).join('');
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  }

  function renderNotifDot() {
    const unread = notifications.filter(n => !n.read);
    $('#notifDot').classList.toggle('show', unread.length > 0);
    $('#notifList').innerHTML = notifications.length
      ? notifications.slice(0, 30).map(n => `<div class="notif ${n.read ? '' : 'unread'}">
          <span class="n-ico">${ICON.bell}</span>
          <div><b>${esc(n.title)}</b><small>${esc(n.body || '')}</small>
          <small>${n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : ''}</small></div>
        </div>`).join('')
      : '<div class="empty" style="border:0">No notifications yet.</div>';
  }

  function renderProfile() {
    const initial = (p.name || '?')[0].toUpperCase();
    $('#pName').textContent = p.name || 'Designer';
    $('#sideName').textContent = p.name || 'Designer';
    $('#pEmail').textContent = u?.email || '';
    $('#pAvatar').textContent = initial;
    $('#avatarBtn').textContent = initial;
    $('#sideAvatar').textContent = initial;
    $('#pClients').textContent = clients.length;
    $('#pDone').textContent = briefs.filter(b => b.status === 'completed').length;
    $('#pActive').textContent = briefs.filter(b => b.status !== 'completed').length;
  }

  function avatarOf(name) {
    return `<span class="av">${esc((name || '?')[0].toUpperCase())}</span>`;
  }

  /* ---------- Navigation ---------- */
  function go(name, filterName) {
    if (filterName) filter = filterName;
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + name));
    $$('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.go === name));
    if (name === 'briefs') renderBriefs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Project detail ---------- */
  function openBrief(id) {
    const b = briefs.find(x => x.id === id);
    if (!b) return;
    currentBriefId = id;
    const ms = b.milestones || [];
    const pc = pct(b);
    $('#dTitle').textContent = b.title;
    $('#dStatus').innerHTML = badge(b.status || 'pending');
    $('#dBody').innerHTML = `
      <div class="dgrid">
        <div><small>Client</small><b>${esc(b.clientName || 'Client')}</b></div>
        <div><small>Deadline</small><b>${esc(b.deadline || '—')}</b></div>
        <div><small>Platform</small><b>${esc(b.platform)}</b></div>
        <div><small>Format</small><b>${esc(b.format)}</b></div>
      </div>
      <div class="bar lg"><i style="width:${pc}%"></i></div>
      <div class="sec-mini"><span>Description</span></div>
      <div class="desc">${esc(b.description || 'No description provided.')}</div>
      ${b.status === 'revision' ? `<div class="alert" style="margin-top:12px"><b>Revision requested.</b><br>${esc(b.revisionNote || '')}${b.revisionExtraNote ? '<br><br>' + esc(b.revisionExtraNote) : ''}${b.revisionFeedback ? '<br><br>Feedback: ' + esc(b.revisionFeedback) : ''}</div>` : ''}
      ${b.accepted ? `<p class="hint">Accepted ${fmtDate(b.acceptedAt)} · Revisions used ${b.revisionsUsed || 0}/${b.revisionLimit ?? 2}</p>` : ''}`;

    $('#dMsCount').textContent = ms.length ? `${ms.filter(m => m.done).length}/${ms.length}` : '';
    $('#dMs').innerHTML = ms.length
      ? ms.map((m, i) => `<li class="${m.done ? 'done' : ''}">
          <input type="checkbox" data-ms="${i}" ${m.done ? 'checked' : ''}>
          <span class="t">${esc(m.title)}</span>
          <em>${esc(m.due || '')}</em>
          <button class="ms-x" data-ms-del="${i}" aria-label="Remove">×</button>
        </li>`).join('')
      : '<li class="muted" style="border:0;background:none;padding:4px 0">No milestones yet.</li>';

    $('#dLink').value = b.workLink || '';
    $('#msTitle').value = ''; $('#msDue').value = '';

    const acts = [];
    if (!b.accepted && b.status !== 'completed') acts.push(`<button class="btn btn-ok full" data-act="accept">Accept brief</button>`);
    if (b.accepted && b.status === 'pending') acts.push(`<button class="btn btn-main full" data-act="start">Start work</button>`);
    if (b.status === 'revision') acts.push(`<button class="btn btn-main full" data-act="resume">Resume work</button>`);
    if ((b.status === 'in_progress' || b.status === 'revision') && b.accepted) acts.push(`<button class="btn btn-ok full" data-act="complete">Mark as completed</button>`);
    if (b.status === 'completed') acts.push(`<button class="btn btn-soft full" data-act="reopen">Reopen project</button>`);
    $('#dActions').innerHTML = acts.join('') || '<p class="hint" style="text-align:center">No actions available for this status.</p>';

    openSheet('#sheetBrief');
  }

  async function saveBrief(fields) {
    if (!currentBriefId) return;
    await updateDoc(doc(db, 'briefs', currentBriefId), fields);
  }

  /* ---------- Client detail ---------- */
  function openClient(id) {
    const c = clientById(id);
    if (!c) return;
    currentClientId = id;
    const bs = briefsOf(id);
    const initial = (c.name || '?')[0].toUpperCase();
    $('#cAvatar').textContent = initial;
    $('#cName').textContent = c.name || 'Client';
    $('#cCompany').textContent = c.company || c.email || '';
    $('#cInfo').innerHTML = `
      <div><small>Email</small><b>${esc(c.email || '—')}</b></div>
      <div><small>Phone</small><b>${esc(c.phone || '—')}</b></div>
      <div><small>Projects</small><b>${bs.length}</b></div>
      <div><small>Awaiting acceptance</small><b>${bs.filter(isAwaiting).length}</b></div>`;
    $('#cBriefs').innerHTML = bs.length
      ? sortNew([...bs]).slice(0, 6).map(b => `<div class="trow" data-open="${b.id}"><span><b>${esc(b.title)}</b>${dueTag(b.deadline, b.status === 'completed')}</span>${badge(b.status || 'pending')}</div>`).join('')
      : '<div class="muted small">No projects from this client yet.</div>';
    openSheet('#sheetClient');
  }

  /* ---------- Meetings ---------- */
  function openMeeting(presetClientId) {
    if (!clients.length) return toast('You have no assigned clients yet.', true);
    $('#mClient').value = presetClientId || clients[0].uid;
    $('#mWhen').min = nowStr();
    ['#mTitleIn', '#mWhen', '#mLink', '#mNotes'].forEach(s => $(s).value = '');
    openSheet('#sheetMeet');
  }

  async function cancelMeeting(id) {
    if (!confirm('Cancel this meeting?')) return;
    try { await updateDoc(doc(db, 'meetings', id), { status: 'cancelled' }); toast('Meeting cancelled.'); }
    catch (e) { fail(e); }
  }

  /* ---------- Notes ---------- */
  function openNoteEdit(id) {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    if (n.authorId !== u.uid) return toast('You can only edit your own notes.', true);
    editingNoteId = id;
    $('#neText').value = n.text;
    $('#neCat').value = n.category || 'general';
    openSheet('#sheetNote');
  }

  /* ---------- Click delegation ---------- */
  document.addEventListener('click', async e => {
    if (e.target.classList.contains('sheet-bg')) return e.target.classList.remove('on');
    const el = e.target.closest('button, [data-open], [data-client], [data-filter-go], [data-action], a[data-go]');
    if (!el || el.tagName === 'INPUT') return;
    const d = el.dataset;

    if (d.close !== undefined) return el.closest('.sheet-bg')?.classList.remove('on');
    if (d.go) return go(d.go);
    if (d.filterGo) { filter = d.filterGo; return go('briefs'); }
    if (d.filter) { filter = d.filter; renderBriefs(); return; }
    if (d.open) return openBrief(d.open);
    if (d.client) return openClient(d.client);
    if (d.cancel) return cancelMeeting(d.cancel);
    if (d.noteEdit) return openNoteEdit(d.noteEdit);
    if (d.noteDel) {
      const n = notes.find(x => x.id === d.noteDel);
      if (!n) return;
      if (n.authorId !== u.uid) return toast('You can only delete your own notes.', true);
      if (!confirm('Delete this note?')) return;
      try { await deleteDoc(doc(db, 'notes', d.noteDel)); toast('Note deleted.'); }
      catch (err) { fail(err); }
      return;
    }

    const act = d.act;
    if (act) {
      const b = briefs.find(x => x.id === currentBriefId);
      if (!b) return;
      try {
        if (act === 'accept') {
          if (!confirm(`Accept "${b.title}"? The client will see that you've taken it on.`)) return;
          await saveBrief({ accepted: true, acceptedAt: serverTimestamp() });
          toast('Brief accepted.');
        }
        if (act === 'start') { await saveBrief({ status: 'in_progress' }); toast('Work started.'); }
        if (act === 'resume') { await saveBrief({ status: 'in_progress' }); toast('Work resumed.'); }
        if (act === 'complete') {
          if (!confirm('Mark this project as completed?')) return;
          await saveBrief({ status: 'completed', completedAt: serverTimestamp() });
          closeSheet('#sheetBrief');
          toast('Project completed.');
        }
        if (act === 'reopen') { await saveBrief({ status: 'in_progress', completedAt: null }); toast('Project reopened.'); }
        if (act === 'save-link') {
          const link = $('#dLink').value.trim();
          if (link && !isHttp(link)) return toast('Link must start with http(s)://', true);
          await saveBrief({ workLink: link });
          toast('Work link saved.');
        }
        if (act === 'add-ms') {
          const title = $('#msTitle').value.trim();
          if (!title) return toast('Give the milestone a name.', true);
          const ms = (b.milestones || []).map(x => ({ ...x }));
          ms.push({ title, due: $('#msDue').value || '', done: false });
          await saveBrief({ milestones: ms });
          $('#msTitle').value = ''; $('#msDue').value = '';
        }
      } catch (err) { fail(err); }
      return;
    }

    switch (d.action) {
      case 'newMeeting': return openMeeting(null);
      case 'notifs': return openSheet('#sheetNotifs');
      case 'profile': return openSheet('#sheetProfile');
      case 'support': closeSheet('#sheetProfile'); $('#supMsg').value = ''; return openSheet('#sheetSupport');
      case 'logout': await signOut(auth); return location.replace('signin.html');
    }
  });

  /* Milestone checkbox toggle & remove */
  document.addEventListener('change', async e => {
    const i = e.target.dataset?.ms;
    if (i === undefined || !e.target.matches('input[type=checkbox]')) return;
    const b = briefs.find(x => x.id === currentBriefId);
    if (!b) return;
    const ms = (b.milestones || []).map(x => ({ ...x }));
    ms[+i].done = e.target.checked;
    try { await saveBrief({ milestones: ms }); }
    catch (err) { fail(err); }
  });
  document.addEventListener('click', async e => {
    const i = e.target.dataset?.msDel;
    if (i === undefined) return;
    const b = briefs.find(x => x.id === currentBriefId);
    if (!b) return;
    const ms = (b.milestones || []).filter((_, k) => k !== +i);
    try { await saveBrief({ milestones: ms }); }
    catch (err) { fail(err); }
  });

  /* ---------- Form handlers ---------- */
  $('#mOk').onclick = () => busy($('#mOk'), async () => {
    const c = clientById($('#mClient').value);
    const title = $('#mTitleIn').value.trim();
    const when = $('#mWhen').value;
    const link = $('#mLink').value.trim();
    if (!c || !title || !when) return toast('Choose a client and add a title and date/time.', true);
    if (when < nowStr()) return toast('Choose a future date and time.', true);
    if (link && !isHttp(link)) return toast('Meeting link must start with http(s)://', true);
    await addDoc(collection(db, 'meetings'), {
      clientId: c.uid, clientName: c.name || '',
      designerId: u.uid, designerName: p.name || '',
      title, when, link, notes: $('#mNotes').value.trim(),
      status: 'scheduled', createdBy: u.uid, createdByRole: 'designer', createdAt: serverTimestamp()
    });
    closeSheet('#sheetMeet');
    toast('Meeting scheduled.');
  });

  $('#cMeet').onclick = () => { closeSheet('#sheetClient'); openMeeting(currentClientId); };
  $('#cNote').onclick = () => { closeSheet('#sheetClient'); $('#nClient').value = currentClientId; go('notes'); $('#nText').focus(); };

  $('#nAdd').onclick = () => busy($('#nAdd'), async () => {
    const text = $('#nText').value.trim();
    const c = clientById($('#nClient').value);
    if (!c) return toast('Pick a client first.', true);
    if (!text) return toast('Write something first.', true);
    const [briefId, briefTitle] = $('#nBrief').value ? $('#nBrief').value.split('|') : ['', ''];
    await addDoc(collection(db, 'notes'), {
      clientId: c.uid, clientName: c.name || '',
      designerId: u.uid, designerName: p.name || '',
      authorId: u.uid, authorRole: 'designer', authorName: p.name || 'Designer',
      text, category: $('#nCat').value,
      briefId: briefId || null, briefTitle: briefTitle || null,
      createdAt: serverTimestamp()
    });
    $('#nText').value = ''; $('#nCat').value = 'general'; $('#nBrief').value = '';
    toast('Note posted.');
  });

  $('#neOk').onclick = () => busy($('#neOk'), async () => {
    const text = $('#neText').value.trim();
    if (!text) return toast('Note cannot be empty.', true);
    if (!editingNoteId) return;
    await updateDoc(doc(db, 'notes', editingNoteId), { text, category: $('#neCat').value, editedAt: serverTimestamp() });
    editingNoteId = null;
    closeSheet('#sheetNote');
    toast('Note updated.');
  });

  $('#supOk').onclick = () => busy($('#supOk'), async () => {
    const msg = $('#supMsg').value.trim();
    if (!msg) return toast('Write a message first.', true);
    await addDoc(collection(db, 'supportRequests'), {
      designerId: u.uid, designerName: p.name || '', designerEmail: p.email || '',
      type: 'report_problem', fromRole: 'designer',
      message: msg, status: 'open', createdAt: serverTimestamp()
    });
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin', role: 'admin', title: 'Designer message',
        body: `${p.name || 'Designer'}: ${msg.slice(0, 80)}`, read: false, createdAt: serverTimestamp()
      });
    } catch (e) {}
    closeSheet('#sheetSupport');
    toast('Message sent to admin.');
  });

  $('#notifClear').onclick = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})));
  };

  /* ---------- Auth guard & live data ---------- */
  onAuthStateChanged(auth, async user => {
    if (!user) return location.replace('signin.html');
    u = user;
    let data = null;
    try { const s = await getDoc(doc(db, 'users', u.uid)); data = s.exists() ? s.data() : null; } catch (e) { fail(e); }
    if (!data || data.disabled) { await signOut(auth); return location.replace('signin.html'); }
    if (data.role !== 'designer') return location.replace(DASH[data.role] || 'signin.html');
    document.documentElement.classList.remove('gate'); // role confirmed: reveal the page
    p = data;
    startListeners();
  });

  function startListeners() {
    onSnapshot(doc(db, 'users', u.uid), s => {
      const data = s.data();
      if (!data) return;
      p = { ...p, ...data };
      renderAll();
    }, fail);

    // Clients the admin assigned to this designer
    onSnapshot(query(collection(db, 'users'), where('assignedDesignerId', '==', u.uid)), s => {
      clients = s.docs.map(d => ({ uid: d.id, ...d.data() })).filter(c => c.role === 'client');
      renderAll();
    }, fail);

    // Projects assigned to this designer
    onSnapshot(query(collection(db, 'briefs'), where('designerId', '==', u.uid)), s => {
      briefs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
      if (currentBriefId && $('#sheetBrief').classList.contains('on')) openBrief(currentBriefId);
    }, fail);

    onSnapshot(query(collection(db, 'meetings'), where('designerId', '==', u.uid)), s => {
      meetings = s.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, fail);

    onSnapshot(query(collection(db, 'notes'), where('designerId', '==', u.uid)), s => {
      notes = s.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, fail);

    onSnapshot(query(collection(db, 'notifications'), where('userId', '==', u.uid)), s => {
      notifications = s.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderNotifDot();
    }, () => {});
  }
