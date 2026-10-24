import { auth, db, signOut, doc, getDoc, setDoc, serverTimestamp } from './firebase.js';

export const $ = s => document.querySelector(s);
export const DASH = { client: 'client-dashboard.html', designer: 'designer-dashboard.html', admin: 'admin-dashboard.html' };
export const PLANS = ['starter', 'growth', 'pro'];
const ERR = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/missing-password': 'Enter your password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Please contact PixelRoot.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/email-already-in-use': 'That email is already registered. Try signing in.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/popup-closed-by-user': 'Sign-in window was closed.',
  'auth/unauthorized-domain': 'This website address is not authorised for sign-in yet. Please contact PixelRoot.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email. Sign in with your password instead.',
  'auth/timeout': 'Sign-in is taking too long. Please try again.',
  'permission-denied': 'Your account could not be set up. Please contact PixelRoot.',
  'app/no-profile': 'This account could not be found. Please contact PixelRoot.',
  'app/disabled': 'This account has been suspended. Please contact PixelRoot.',
  'app/no-access': 'This account has no dashboard access. Please contact PixelRoot.'
};
const QUIET = ['auth/cancelled-popup-request', 'auth/popup-closed-by-user'];
// Never show raw Firebase/server text to people.
export const errMsg = e => { console.error('Auth error:', e); return QUIET.includes(e && e.code) ? '' : (ERR[e && e.code] || 'Something went wrong. Please try again.'); };

export function toast(m, bad) {
  if (!m) return;
  const t = document.createElement('div'); t.className = 'toast' + (bad ? ' err' : ''); t.textContent = m;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3800);
}
export async function busy(btn, fn) {
  const html = btn.innerHTML; btn.disabled = true; btn.textContent = 'Please wait…';
  try { await fn(); } catch (e) { toast(errMsg(e), true); } finally { btn.disabled = false; btn.innerHTML = html; }
}
export const withTimeout = (p, ms) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej({ code: 'auth/timeout' }), ms); })]).finally(() => clearTimeout(t)); };
const fail = code => Object.assign(new Error(code), { code });

// New self-registered accounts are always clients (the Firestore rules enforce this too).
export const saveClient = (u, plan, name) => setDoc(doc(db, 'users', u.uid), {
  uid: u.uid, name: String(name || u.displayName || u.email.split('@')[0]).trim().slice(0, 100), email: u.email,
  role: 'client', plan: PLANS.includes(plan) ? plan : 'starter', createdAt: serverTimestamp(), assignedDesignerId: null
});

let pending = null;
// Sends a signed-in user to the right dashboard. Safe to call twice at once (both calls share one run).
export function route(u, plan) { return pending || (pending = doRoute(u, plan).finally(() => { pending = null; })); }
async function doRoute(u, plan) {
  const s = await withTimeout(getDoc(doc(db, 'users', u.uid)), 12000);
  if (!s.exists()) {
    // Password accounts without a profile were removed by an admin: do not quietly re-create them.
    if (!u.providerData.some(p => p.providerId === 'google.com')) { await signOut(auth); throw fail('app/no-profile'); }
    try { await saveClient(u, plan); } catch (e) { await signOut(auth); throw e; }
    return location.replace(DASH.client);
  }
  const d = s.data();
  if (d.disabled) { await signOut(auth); throw fail('app/disabled'); }
  const dest = DASH[d.role]; // exact match: the Firestore rules compare the role exactly too
  if (!dest) { await signOut(auth); throw fail('app/no-access'); }
  location.replace(dest);
}
