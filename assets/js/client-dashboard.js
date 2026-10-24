import { auth, db, onAuthStateChanged, signOut, doc, getDoc, updateDoc, addDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp } from './firebase.js';

/* ---------- Constants & helpers ---------- */
  const DEFAULT_BRIEF_LIMIT = 10;
  const DEFAULT_REVISIONS_PER_BRIEF = 2;
  const RING_C = 238.76;
  const DASH = { client: 'client-dashboard.html', designer: 'designer-dashboard.html', admin: 'admin-dashboard.html' };
  const STATUS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', revision: 'Revision Requested' };
  const CAT = { general: 'General', feedback: 'Feedback', idea: 'Idea', reference: 'Reference', urgent: 'Urgent' };
  const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok'];
  const FORMATS = ['Square', 'Story', 'Carousel'];
  const ERR = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
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
  const resetDateFmt = d => `${d.getDate()}, ${d.toLocaleString(undefined, { month: 'short' })}`;
  const nowStr = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const dayDiff = s => Math.round((new Date(s + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
  const sortNew = l => l.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const byDue = (a, b) => (a.deadline || '9').localeCompare(b.deadline || '9');
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
  const revMaxOf = b => (b.revisionLimit != null ? b.revisionLimit : DEFAULT_REVISIONS_PER_BRIEF);
  const BL = () => Number(p.briefLimit ?? DEFAULT_BRIEF_LIMIT);
  const errMsg = e => { console.error(e); return ERR[e && e.code] || 'Something went wrong. Please try again.'; };
  const fail = e => toast(errMsg(e), true);

  const ICON = {
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
  };

  /* ---------- Feedback & sheets ---------- */
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
  let u = null, p = {}, designer = null;
  let briefs = [], meetings = [], notes = [], notifications = [];
  let filter = 'all', editingBriefId = null, pendingRevId = null, editingNoteId = null, supportMode = 'request';
  let fPlatform = 'Instagram', fFormat = 'Square';

  function usedThisCycle() {
    // Briefs created since the cycle started. The admin sets briefCycleStart when the cycle is reset.
    const start = p.briefCycleStart?.toDate ? p.briefCycleStart.toDate()
      : p.briefResetAt?.toDate ? new Date(p.briefResetAt.toDate().getTime() - 31 * 864e5) : null;
    return briefs.filter(b => b.createdAt?.toDate && (!start || b.createdAt.toDate() >= start)).length;
  }

  /* ---------- Rendering ---------- */
  function renderAll() {
    renderHome();
    renderBriefs();
    renderMeetings();
    renderNotes();
    renderNotifDot();
    renderProfile();
    renderNoteBriefOptions();
  }

  function briefCard(b) {
    const pc = pct(b), ms = b.milestones || [];
    const msDone = ms.filter(m => m.done).length;
    const foot = b.status === 'completed' ? `Completed ${fmtDate(b.completedAt)}`
      : b.acceptedAt ? `Accepted ${fmtDate(b.acceptedAt)}` : 'Awaiting acceptance';
    return `<div class="bc" data-status="${esc(b.status || 'pending')}" data-open="${b.id}">
      <div class="bc-top">
        <div class="title">${esc(b.title)}${b.accepted && b.status === 'pending' ? '<span class="accepted">Accepted</span>' : ''}</div>
        ${badge(b.status || 'pending')}
      </div>
      <div class="bc-meta">
        <span class="tag">${esc(b.platform)}</span>
        <span class="tag">${esc(b.format)}</span>
        ${ms.length ? `<span class="tag">${msDone}/${ms.length} milestones</span>` : ''}
      </div>
      <div class="bar"><i style="width:${pc}%"></i></div>
      <div class="bc-foot"><span>${dueTag(b.deadline, b.status === 'completed')}</span><span>${pc}%</span></div>
      <div class="bc-foot" style="margin-top:3px"><span>${esc(foot)}</span></div>
    </div>`;
  }

  function miniCard(b) {
    return `<button class="mini" data-open="${b.id}">
      ${badge(b.status || 'pending')}
      <div class="title" style="margin-top:10px">${esc(b.title)}</div>
      <div class="bar" style="margin-top:12px"><i style="width:${pct(b)}%"></i></div>
      <div class="meta">${dueTag(b.deadline)}</div>
    </button>`;
  }

  function renderHome() {
    const o = briefs.filter(b => b.status !== 'completed').sort(byDue);
    const done = briefs.length - o.length;
    const um = upMeet(meetings);

    const first = (p.name || '').trim().split(' ')[0];
    $('#hHello').textContent = first ? `Hi, ${first}` : 'Hi there';
    $('#hSummary').textContent = briefs.length
      ? `${plural(o.length, 'active brief')} · ${done} completed`
      : 'No briefs yet. Submit your first request.';

    const bal = Number(p.balanceLKR ?? 0);
    $('#hBal').textContent = 'LKR ' + bal.toLocaleString();
    const resetAt = p.briefResetAt?.toDate ? p.briefResetAt.toDate() : null;
    $('#hDate').textContent = resetAt ? 'Resets ' + resetDateFmt(resetAt) : 'No reset date';
    $('#hResetIn').textContent = (() => {
      if (!resetAt) return '';
      const days = Math.max(0, Math.ceil((resetAt - new Date()) / 864e5));
      return days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} left` : 'Due for reset';
    })();

    const limit = BL();
    const used = usedThisCycle();
    const remaining = Math.max(0, limit - used);
    const usedPct = Math.min(100, Math.round(used / limit * 100));
    $('#ringFg').style.strokeDashoffset = RING_C * (1 - usedPct / 100);
    $('#ringFg').setAttribute('stroke', usedPct >= 100 ? '#ffb3b3' : '#bcdcff');
    $('#ringNum').textContent = remaining;
    $('#hUsed').textContent = `${used} of ${limit} briefs used this cycle`;

    $('#focus').innerHTML = o[0]
      ? `<div class="card focus" data-open="${o[0].id}">
          <div class="focus-label">Most urgent</div>
          <div class="title">${esc(o[0].title)}</div>
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(o[0].status || 'pending')}${dueTag(o[0].deadline)}</div>
          <div class="bar lg"><i style="width:${pct(o[0])}%"></i></div>
          <div class="focus-foot"><span class="small muted">${pct(o[0])}% complete</span><span class="link">Open →</span></div>
        </div>`
      : emptyBox(ICON.file, 'Nothing urgent', 'Submit a brief and it will show up here.', '<button class="btn btn-main" data-action="newBrief">New brief</button>');

    $('#rail').innerHTML = o.length
      ? o.slice(0, 8).map(miniCard).join('')
      : `<div class="muted small" style="padding:6px 2px">No active briefs right now.</div>`;

    $('#nextMeet').innerHTML = um[0]
      ? meetingRow(um[0], true)
      : emptyBox(ICON.cal, 'No meetings booked', 'Schedule a call with your designer.');

    $('#notesHome').innerHTML = notes.length
      ? sortNew([...notes]).slice(0, 2).map(n => noteCard(n, true)).join('')
      : emptyBox(ICON.note, 'No notes yet', 'Share an idea or feedback with your designer.');
  }

  function renderBriefs() {
    const F = {
      all: () => true,
      active: b => ['pending', 'in_progress'].includes(b.status),
      revision: b => b.status === 'revision',
      done: b => b.status === 'completed'
    };
    const counts = { all: briefs.length, active: 0, revision: 0, done: 0 };
    briefs.forEach(b => { if (F.active(b)) counts.active++; if (F.revision(b)) counts.revision++; if (F.done(b)) counts.done++; });
    $$('[data-count]').forEach(s => s.textContent = counts[s.dataset.count]);
    $$('.fchip').forEach(c => c.classList.toggle('on', c.dataset.filter === filter));
    $('#briefsSub').textContent = briefs.length ? `${counts.active} active · ${counts.done} completed` : 'Your submitted briefs appear here.';

    const list = sortNew([...briefs]).filter(F[filter]);
    $('#briefList').innerHTML = list.length
      ? list.map(briefCard).join('')
      : emptyBox(ICON.file, filter === 'all' ? 'No briefs yet' : 'Nothing here', filter === 'all' ? 'Submit your first request to get started.' : 'Try a different filter.',
          filter === 'all' ? '<button class="btn btn-main" data-action="newBrief">Submit a brief</button>' : '');
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
    $('#meetSub').textContent = um.length ? plural(um.length, 'upcoming meeting') : 'Plan your next call with your designer.';
    $('#meetList').innerHTML = um.length
      ? um.map(m => meetingRow(m, false)).join('')
      : emptyBox(ICON.cal, 'No upcoming meetings', 'Book a call to plan your next brief.');
  }

  function noteCard(n, compact) {
    const mine = n.authorId === u.uid;
    const when = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
    return `<div class="note">
      <div class="note-top">
        <span class="cat ${esc(n.category || 'general')}">${esc(CAT[n.category] || 'General')}</span>
        ${mine ? '<span class="mine-tag">You</span>' : `<span>${esc(n.authorName || 'Team')}</span>`}
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
      : emptyBox(ICON.note, 'No notes yet', 'Use the box to share your first note.');
  }

  function renderNoteBriefOptions() {
    const sel = $('#nBrief');
    const cur = sel.value;
    sel.innerHTML = '<option value="">No brief</option>' + briefs.map(b => `<option value="${b.id}|${esc(b.title)}">${esc(b.title)}</option>`).join('');
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
    $('#pName').textContent = p.name || 'Client';
    $('#sideName').textContent = p.name || 'Client';
    $('#pEmail').textContent = u?.email || '';
    $('#pAvatar').textContent = initial;
    $('#avatarBtn').textContent = initial;
    $('#sideAvatar').textContent = initial;
    $('#pDesigner').innerHTML = designer
      ? `<div class="person">${avatarOf(designer.name)}<div><b>${esc(designer.name)}</b><small>${esc(designer.email)}</small></div></div>`
      : '<div class="muted small">Waiting for the admin to assign a designer.</div>';
  }

  function avatarOf(name) {
    return `<span class="av">${esc((name || '?')[0].toUpperCase())}</span>`;
  }

  function emptyBox(icon, title, text, action = '') {
    return `<div class="empty">
      <div class="empty-ico">${icon}</div>
      <b>${esc(title)}</b>${esc(text)}${action ? `<div>${action}</div>` : ''}
    </div>`;
  }

  /* ---------- Navigation ---------- */
  function go(name) {
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + name));
    $$('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.go === name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Brief form ---------- */
  function renderChips() {
    $('#pChips').innerHTML = PLATFORMS.map(x => `<button type="button" class="chipopt ${x === fPlatform ? 'on' : ''}" data-pchip="${x}">${x}</button>`).join('');
    $('#fmtChips').innerHTML = FORMATS.map(x => `<button type="button" class="chipopt ${x === fFormat ? 'on' : ''}" data-fchip="${x}">${x}</button>`).join('');
  }

  function openCreateBrief() {
    editingBriefId = null;
    $('#bTitle').textContent = 'New brief';
    $('#bSub').textContent = 'Tell us what you need designed.';
    $('#bName').value = ''; $('#bDesc').value = ''; $('#bDeadline').value = '';
    $('#bDeadline').min = new Date().toISOString().slice(0, 10);
    fPlatform = 'Instagram'; fFormat = 'Square';
    renderChips();
    $('#bSave').textContent = 'Submit brief';
    openSheet('#sheetBrief');
  }

  function openEditBrief(id) {
    const b = briefs.find(x => x.id === id);
    if (!b) return;
    if (b.accepted) return toast('This brief has been accepted and can no longer be edited.', true);
    editingBriefId = id;
    $('#bTitle').textContent = 'Edit brief';
    $('#bSub').textContent = 'You can edit until your designer accepts the brief.';
    $('#bName').value = b.title || '';
    $('#bDesc').value = b.description || '';
    $('#bDeadline').value = b.deadline || '';
    fPlatform = b.platform || 'Instagram'; fFormat = b.format || 'Square';
    renderChips();
    $('#bSave').textContent = 'Save changes';
    closeSheet('#sheetDetail');
    openSheet('#sheetBrief');
  }

  function openBrief(id) {
    const b = briefs.find(x => x.id === id);
    if (!b) return;
    const ms = b.milestones || [];
    const revMax = revMaxOf(b), revUsed = b.revisionsUsed || 0;
    const pc = pct(b);
    $('#dTitle').textContent = b.title;
    $('#dStatus').innerHTML = badge(b.status || 'pending');
    $('#dBody').innerHTML = `
      <div class="dgrid">
        <div><small>Platform</small><b>${esc(b.platform)}</b></div>
        <div><small>Format</small><b>${esc(b.format)}</b></div>
        <div><small>Deadline</small><b>${esc(b.deadline || '—')}</b></div>
        <div><small>Progress</small><b>${pc}%</b></div>
      </div>
      <div class="bar lg"><i style="width:${pc}%"></i></div>
      ${ms.length ? `<div class="sec-mini"><span>Milestones</span><span>${ms.filter(m => m.done).length}/${ms.length}</span></div>
        <ul class="ms">${ms.map(m => `<li class="${m.done ? 'done' : ''}"><span class="tick">${m.done ? '✓' : ''}</span><span>${esc(m.title)}</span><em>${esc(m.due || '')}</em></li>`).join('')}</ul>` : ''}
      ${b.workLink ? `<a class="btn btn-soft full" style="margin-top:12px" href="${safeHref(b.workLink)}" target="_blank" rel="noopener noreferrer">View submitted work</a>` : ''}
      <div class="sec-mini"><span>Description</span></div>
      <div class="desc">${esc(b.description || 'No description provided.')}</div>
      ${b.accepted ? `<p class="hint">${revUsed}/${revMax} revisions used${revUsed >= revMax ? ' · limit reached' : ''}</p>` : ''}
      <p class="hint">${b.accepted
        ? 'Accepted by your designer, so it can no longer be edited or deleted.'
        : 'You can still edit or delete this brief until your designer accepts it.'}</p>`;

    const acts = [];
    if (b.status === 'completed' && revUsed < revMax) acts.push(`<button class="btn btn-main full" data-rev="${b.id}">Request revision</button>`);
    if (!b.accepted) {
      acts.push(`<button class="btn btn-soft full" data-edit="${b.id}">Edit brief</button>`);
      acts.push(`<button class="btn btn-danger full" data-del="${b.id}">Delete brief</button>`);
    }
    $('#dActions').innerHTML = acts.join('');
    openSheet('#sheetDetail');
  }

  /* ---------- Revisions ---------- */
  function openRevision(id) {
    const b = briefs.find(x => x.id === id);
    if (!b) return;
    const max = revMaxOf(b), used = b.revisionsUsed || 0;
    if (used >= max) return toast('Revision limit reached for this brief.', true);
    pendingRevId = id;
    ['#revNote', '#revExtra', '#revFb'].forEach(s => $(s).value = '');
    $('#revRemain').textContent = `${max - used} of ${max} revisions remaining for this brief.`;
    closeSheet('#sheetDetail');
    openSheet('#sheetRev');
  }

  /* ---------- Meetings ---------- */
  function openMeeting() {
    if (!designer) return toast('You need an assigned designer first.', true);
    $('#mWith').textContent = `${p.name} with ${designer.name}`;
    $('#mWhen').min = nowStr();
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

  /* ---------- Support ---------- */
  function openSupport(mode) {
    supportMode = mode;
    $('#supTitle').textContent = mode === 'request' ? 'Request another designer' : 'Report a problem';
    $('#supDesc').textContent = mode === 'request'
      ? 'Tell the admin why you would like a different designer.'
      : 'Describe the issue and the admin team will get back to you.';
    $('#supMsg').value = '';
    closeSheet('#sheetProfile');
    openSheet('#sheetSupport');
  }

  /* ---------- Account security ---------- */
  // Email and password changes are handled by the admin.
  function openAdminContact() {
    closeSheet('#sheetProfile');
    openSheet('#sheetAdminContact');
  }

  /* ---------- Click delegation ---------- */
  document.addEventListener('click', async e => {
    if (e.target.classList.contains('sheet-bg')) return e.target.classList.remove('on');
    const el = e.target.closest('button, [data-open], [data-action], a[data-go]');
    if (!el) return;
    const d = el.dataset;

    if (d.close !== undefined) return el.closest('.sheet-bg')?.classList.remove('on');
    if (d.go) return go(d.go);
    if (d.open) return openBrief(d.open);
    if (d.filter) { filter = d.filter; renderBriefs(); return; }
    if (d.pchip) { fPlatform = d.pchip; renderChips(); return; }
    if (d.fchip) { fFormat = d.fchip; renderChips(); return; }
    if (d.rev) return openRevision(d.rev);
    if (d.edit) return openEditBrief(d.edit);
    if (d.del) {
      const b = briefs.find(x => x.id === d.del);
      if (b?.accepted) return toast('This brief has been accepted and can no longer be deleted. Please contact the admin.', true);
      if (!confirm('Delete this brief permanently? This cannot be undone.')) return;
      try { await deleteDoc(doc(db, 'briefs', d.del)); closeSheet('#sheetDetail'); toast('Brief deleted.'); }
      catch (err) { fail(err); }
      return;
    }
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
    if (d.cancel) return cancelMeeting(d.cancel);
    if (d.support) return openSupport(d.support);

    switch (d.action) {
      case 'newBrief': return openCreateBrief();
      case 'newMeeting': return openMeeting();
      case 'notifs': return openSheet('#sheetNotifs');
      case 'profile': return openSheet('#sheetProfile');
      case 'changeEmail':
      case 'changePassword': return openAdminContact();
      case 'logout':
        await signOut(auth);
        return location.replace('signin.html');
    }
  });

  /* ---------- Form submit handlers ---------- */
  $('#bSave').onclick = () => busy($('#bSave'), async () => {
    const title = $('#bName').value.trim();
    const description = $('#bDesc').value.trim();
    const deadline = $('#bDeadline').value;
    if (!title || !description || !deadline) return toast('Please fill in the title, description and deadline.', true);
    const wasEdit = !!editingBriefId;
    if (wasEdit) {
      const b = briefs.find(x => x.id === editingBriefId);
      if (!b || b.accepted) return toast('This brief can no longer be edited.', true);
      await updateDoc(doc(db, 'briefs', editingBriefId), { title, platform: fPlatform, format: fFormat, description, deadline });
    } else {
      if (usedThisCycle() >= BL()) return toast('You have reached your brief limit for this cycle.', true);
      await addDoc(collection(db, 'briefs'), {
        clientId: u.uid, clientName: p.name, clientEmail: p.email,
        designerId: designer?.uid || null,
        title, platform: fPlatform, format: fFormat, description, deadline,
        status: 'pending', accepted: false, workLink: '', milestones: [],
        revisionLimit: Number(p.revisionsPerBrief ?? DEFAULT_REVISIONS_PER_BRIEF),
        revisionsUsed: 0,
        createdAt: serverTimestamp()
      });
    }
    editingBriefId = null;
    closeSheet('#sheetBrief');
    toast(wasEdit ? 'Brief updated.' : 'Brief submitted.');
  });

  $('#revOk').onclick = () => busy($('#revOk'), async () => {
    const note = $('#revNote').value.trim();
    if (!note) return toast('Please add a revision note.', true);
    if (!pendingRevId) return;
    const b = briefs.find(x => x.id === pendingRevId);
    const max = b ? revMaxOf(b) : DEFAULT_REVISIONS_PER_BRIEF;
    const used = b?.revisionsUsed || 0;
    if (used >= max) return toast('Revision limit reached for this brief.', true);
    await updateDoc(doc(db, 'briefs', pendingRevId), {
      status: 'revision',
      revisionNote: note,
      revisionExtraNote: $('#revExtra').value.trim(),
      revisionFeedback: $('#revFb').value.trim(),
      revisionsUsed: used + 1
    });
    pendingRevId = null;
    closeSheet('#sheetRev');
    toast('Revision requested.');
  });

  $('#mOk').onclick = () => busy($('#mOk'), async () => {
    const title = $('#mTitleIn').value.trim();
    const when = $('#mWhen').value;
    const link = $('#mLink').value.trim();
    if (!designer || !title || !when) return toast('Add a title and a date/time.', true);
    if (when < nowStr()) return toast('Choose a future date and time.', true);
    if (link && !/^https?:\/\//i.test(link)) return toast('Meeting link must start with http(s)://', true);
    await addDoc(collection(db, 'meetings'), {
      clientId: u.uid, clientName: p.name,
      designerId: designer.uid, designerName: designer.name,
      title, when, link, notes: $('#mNotes').value.trim(),
      status: 'scheduled', createdBy: u.uid, createdByRole: 'client', createdAt: serverTimestamp()
    });
    ['#mTitleIn', '#mWhen', '#mLink', '#mNotes'].forEach(s => $(s).value = '');
    closeSheet('#sheetMeet');
    toast('Meeting scheduled.');
  });

  $('#nAdd').onclick = () => busy($('#nAdd'), async () => {
    const text = $('#nText').value.trim();
    if (!text) return toast('Write something first.', true);
    const [briefId, briefTitle] = $('#nBrief').value ? $('#nBrief').value.split('|') : ['', ''];
    await addDoc(collection(db, 'notes'), {
      clientId: u.uid, clientName: p.name,
      designerId: designer?.uid || null,
      authorId: u.uid, authorRole: 'client', authorName: p.name,
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
      clientId: u.uid, clientName: p.name, clientEmail: p.email,
      designerId: designer?.uid || null, designerName: designer?.name || '',
      type: supportMode === 'request' ? 'request_designer' : 'report_problem',
      message: msg, status: 'open', createdAt: serverTimestamp()
    });
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin', role: 'admin',
        title: supportMode === 'request' ? 'Designer request' : 'Problem report',
        body: `${p.name}: ${msg.slice(0, 80)}`,
        read: false, createdAt: serverTimestamp()
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
    if (data.role !== 'client') return location.replace(DASH[data.role] || 'signin.html');
    document.documentElement.classList.remove('gate'); // role confirmed: reveal the page
    p = data;
    startListeners();
  });

  function startListeners() {
    onSnapshot(doc(db, 'users', u.uid), async s => {
      const data = s.data();
      if (!data) return;
      p = { ...p, ...data };
      designer = null;
      if (data.assignedDesignerId) {
        try {
          const ds = await getDoc(doc(db, 'users', data.assignedDesignerId));
          if (ds.exists()) designer = { ...ds.data(), uid: ds.id };
        } catch (e) {}
      }
      renderAll();
    });

    const q = c => query(collection(db, c), where('clientId', '==', u.uid));
    onSnapshot(q('briefs'), s => { briefs = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); }, fail);
    onSnapshot(q('meetings'), s => { meetings = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); }, fail);
    onSnapshot(q('notes'), s => { notes = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); }, fail);
    onSnapshot(query(collection(db, 'notifications'), where('userId', '==', u.uid)), s => {
      notifications = s.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderNotifDot();
    }, () => {});
  }

  renderChips();
