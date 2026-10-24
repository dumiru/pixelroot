import { auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged } from './firebase.js';
import { $, busy, toast, errMsg, route } from './auth-common.js';

// Already signed in (or returning from a redirect sign-in)? Go straight to the dashboard.
const off = onAuthStateChanged(auth, u => { off(); if (u) route(u).catch(e => toast(errMsg(e), true)); });
getRedirectResult(auth).catch(e => toast(errMsg(e), true));

$('#f').onsubmit = e => {
  e.preventDefault();
  busy($('#go'), async () => {
    const email = $('#email').value.trim(), pw = $('#pw').value;
    if (!email || !pw) return toast('Enter your email and password.', true);
    const { user } = await signInWithEmailAndPassword(auth, email, pw);
    await route(user);
  });
};

$('#gBtn').onclick = () => busy($('#gBtn'), async () => {
  const provider = new GoogleAuthProvider();
  try {
    const { user } = await signInWithPopup(auth, provider);
    await route(user);
  } catch (e) {
    // Some phones and in-app browsers block popups: fall back to a full-page redirect.
    if (e && e.code === 'auth/popup-blocked') return signInWithRedirect(auth, provider);
    throw e;
  }
});

// Password resets are handled by the admin.
const am = $('#adminModal');
$('#forgot').onclick = () => am.classList.add('on');
$('#amClose').onclick = () => am.classList.remove('on');
am.addEventListener('click', e => { if (e.target === am) am.classList.remove('on'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') am.classList.remove('on'); });
