import { auth, createUserWithEmailAndPassword, updateProfile, deleteUser, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged } from './firebase.js';
import { $, busy, toast, errMsg, route, saveClient, PLANS, DASH } from './auth-common.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, MIN_PASSWORD = 8;
const getPlan = () => { const v = document.querySelector('input[name="plan"]:checked')?.value; return PLANS.includes(v) ? v : 'starter'; };

// Preselect a package from ?plan=starter|growth|pro (used by the pricing buttons).
const wanted = new URLSearchParams(location.search).get('plan');
if (PLANS.includes(wanted)) { const el = document.querySelector(`input[name="plan"][value="${wanted}"]`); if (el) el.checked = true; }

// Already signed in? Go to the dashboard instead of showing the form.
const off = onAuthStateChanged(auth, u => { off(); if (u) route(u, getPlan()).catch(e => toast(errMsg(e), true)); });
getRedirectResult(auth).catch(e => toast(errMsg(e), true));

$('#f').onsubmit = e => {
  e.preventDefault();
  busy($('#go'), async () => {
    const name = $('#name').value.trim(), email = $('#email').value.trim(), pw = $('#pw').value;
    if (!name || !email) return toast('Please fill in all fields.', true);
    if (name.length > 100) return toast('Name must be 100 characters or fewer.', true);
    if (!EMAIL_RE.test(email)) return toast('Please enter a valid email address.', true);
    if (pw.length < MIN_PASSWORD) return toast(`Password must be at least ${MIN_PASSWORD} characters.`, true);
    if (pw !== $('#pw2').value) return toast('Passwords do not match.', true);
    let user = null;
    try {
      ({ user } = await createUserWithEmailAndPassword(auth, email, pw));
      await updateProfile(user, { displayName: name });
      await saveClient(user, getPlan(), name);
    } catch (err) {
      // Roll back a half-finished signup so no login is left behind without a profile.
      if (user) await deleteUser(user).catch(() => {});
      throw err;
    }
    location.replace(DASH.client);
  });
};

$('#gBtn').onclick = () => busy($('#gBtn'), async () => {
  const provider = new GoogleAuthProvider();
  try {
    const { user } = await signInWithPopup(auth, provider);
    await route(user, getPlan()); // existing accounts go to their dashboard; new ones are created as clients
  } catch (e) {
    if (e && e.code === 'auth/popup-blocked') return signInWithRedirect(auth, provider);
    throw e;
  }
});
