/* =====================================================================
   PixelRoot - elements.js
   Shared site elements, injected into any page that includes:

     <div id="site-header"></div>    -> navigation bar + mobile side panel
     <div id="site-contact"></div>   -> "Contact us" section + contact form
     <div id="site-footer"></div>    -> footer

   Load it at the end of <body> as a normal (non-module) script:
     <script src="elements.js"></script>

   Optional: set <body data-nav="work"> to highlight a nav link
   (home | services | pricing | work | about).

   The page that uses it must include the site CSS (same styles as index.html).
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. HTML TEMPLATES
   Nav links point to index.html so they work from any page.
   --------------------------------------------------------------------- */

const SIGNED_OUT_HTML = '<a href="signin.html" class="nav-signin">Sign In</a><a href="signup.html" class="nav-cta">Get Started</a>';

/* ---- NAVIGATION BAR + MOBILE SIDE PANEL ---- */
const HEADER_HTML = `
<!-- HEADER: Navigation bar (START) -->
<header>
  <div class="wrap nav">
    <a href="index.html#home" class="logo">Pixel<span>Root</span></a>
    <ul class="nav-links" id="navLinks">
      <li><a href="index.html#home" data-link="home">Home</a></li>
      <li><a href="index.html#services" data-link="services">Services</a></li>
      <li><a href="index.html#pricing" data-link="pricing">Pricing</a></li>
      <li><a href="index.html#work" data-link="work">Our Work</a></li>
      <li><a href="index.html#about" data-link="about">Contact</a></li>
    </ul>
    <div class="nav-right">
      <div id="authArea" style="display:flex;align-items:center;gap:6px">${SIGNED_OUT_HTML}</div>
      <button class="menu-btn" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="sidePanel"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
<!-- HEADER: Navigation bar (END) -->

<!-- MOBILE MENU: Overlay + side panel (START) -->
<div class="nav-overlay" id="navOverlay"></div>
<aside class="side-panel" id="sidePanel" aria-hidden="true" aria-label="Menu">
  <div class="sp-head"><a href="index.html#home" class="logo">Pixel<span>Root</span></a><button class="sp-close" id="spClose" type="button" aria-label="Close menu">&times;</button></div>
  <ul class="sp-links">
    <li><a href="index.html#home" data-link="home">Home</a></li>
    <li><a href="index.html#services" data-link="services">Services</a></li>
    <li><a href="index.html#pricing" data-link="pricing">Pricing</a></li>
    <li><a href="index.html#work" data-link="work">Our Work</a></li>
    <li><a href="index.html#about" data-link="about">Contact</a></li>
  </ul>
  <div class="panel-auth" id="panelAuth">${SIGNED_OUT_HTML}</div>
</aside>
<!-- MOBILE MENU (END) -->
`;

/* ---- CONTACT SECTION (contact details + contact form) ---- */
const CONTACT_HTML = `
<!-- SECTION: Contact Form (START) -->
<section class="alt" id="contact">
  <div class="wrap grid-2" style="align-items:start">
    <!-- Contact details -->
    <div>
      <span class="eyebrow">Contact us</span>
      <h2>Let's talk about your brand</h2>
      <p class="lead" style="margin-bottom:30px">Questions about plans or custom needs? Send us a message and we'll reply within one business day.</p>
      <div class="info-item"><div class="icon">@</div><div><strong>Email</strong><span>hello@pixelroot.com</span></div></div>
      <div class="info-item"><div class="icon">&#9742;</div><div><strong>Phone</strong><span>+94 11 000 0000</span></div></div>
      <div class="info-item"><div class="icon">&#9719;</div><div><strong>Hours</strong><span>Monday to Friday, 9:00 to 18:00</span></div></div>
    </div>
    <!-- Contact form -->
    <div class="card" id="contactCard">
      <form class="contact" id="contactForm" novalidate>
        <div style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden" aria-hidden="true"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
        <label>Full name<input name="name" id="cName" required maxlength="100" autocomplete="name" placeholder="Jane Doe"></label>
        <div class="cf-row">
          <label>Email<input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@company.com"></label>
          <label>WhatsApp number (optional)<input type="tel" name="phone" maxlength="20" autocomplete="tel" placeholder="+94 77 123 4567"></label>
        </div>
        <label>Message<textarea name="message" required maxlength="1000" placeholder="Tell us about your brand and what you need"></textarea></label>
        <button class="btn btn-grad" id="contactBtn" type="submit">Send message</button>
        <p class="cf-fine">We reply within one business day.</p>
      </form>
    </div>
  </div>
</section>
<!-- SECTION: Contact Form (END) -->
`;

/* ---- FOOTER ---- */
const FOOTER_HTML = `
<!-- FOOTER (START) -->
<footer>
  <div class="wrap">
    <div class="foot">
      <div>
        <div class="logo" style="margin-bottom:10px">Pixel<span>Root</span></div>
        <p>Monthly social media posts, designed for you.</p>
      </div>
      <div><h4>Explore</h4><a href="index.html#services">Services</a><a href="index.html#pricing">Pricing</a><a href="index.html#work">Our Work</a></div>
      <div><h4>Company</h4><a href="index.html#about">About</a><a href="#contact">Contact</a></div>
      <div><h4>Legal</h4><a href="#">Terms of Service</a><a href="#">Privacy Policy</a></div>
    </div>
    <div class="copy">&copy; 2026 PixelRoot. All rights reserved.</div>
  </div>
</footer>
<!-- FOOTER (END) -->
`;

/* ---------------------------------------------------------------------
   2. INJECT INTO THE PAGE
   --------------------------------------------------------------------- */
const mount = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; return !!el; };
mount('site-header', HEADER_HTML);
const hasContact = mount('site-contact', CONTACT_HTML);
mount('site-footer', FOOTER_HTML);

/* ---------------------------------------------------------------------
   3. NAVIGATION BEHAVIOUR (mobile side panel + active link)
   --------------------------------------------------------------------- */
const menuBtn = document.getElementById('menuBtn'), panel = document.getElementById('sidePanel'), overlay = document.getElementById('navOverlay');
function setMenu(open) {
  if (!panel) return;
  panel.classList.toggle('open', open); overlay.classList.toggle('open', open);
  document.body.classList.toggle('no-scroll', open);
  menuBtn.setAttribute('aria-expanded', open); panel.setAttribute('aria-hidden', !open);
}
if (menuBtn && panel) {
  menuBtn.addEventListener('click', () => setMenu(true));
  overlay.addEventListener('click', () => setMenu(false));
  document.getElementById('spClose').addEventListener('click', () => setMenu(false));
  panel.querySelectorAll('.sp-links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) setMenu(false); });
}
const activeNav = document.body.dataset.nav;
if (activeNav) document.querySelectorAll('.nav-links a, .sp-links a').forEach(a => a.classList.toggle('active', a.dataset.link === activeNav));

/* ---------------------------------------------------------------------
   4. FIREBASE (sign-in state in nav + contact form)
   Loaded after the HTML is injected, so a Firebase/network problem
   can never stop the header, contact section or footer from showing.
   --------------------------------------------------------------------- */
const WHATSAPP = '94771234567'; // your WhatsApp number: country code, no + or spaces
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfToast = m => { const t = document.createElement('div'); t.className = 'cf-toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3800); };

let fb = null; // filled once Firebase has loaded: { auth, db, addDoc, collection, serverTimestamp, ... }

/* ---- Contact form -> Firestore (collection: contactMessages) ---- */
if (hasContact) {
  const cCard = document.getElementById('contactCard'), cFormHTML = cCard.innerHTML;
  const LIMITS = { name: 100, email: 254, phone: 20, message: 1000 };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/;
  const COOLDOWN_MS = 30000;
  let lastSentAt = 0;
  function bindContact() {
    const form = document.getElementById('contactForm');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      // Honeypot: real visitors never fill this hidden field, most bots do.
      if (form.elements.website && form.elements.website.value) return;
      const v = k => (form.elements[k] ? form.elements[k].value : '').trim();
      const name = v('name'), email = v('email'), phone = v('phone'), message = v('message');
      if (!name || !email || !message) return cfToast('Please fill in your name, email and message.');
      if (name.length > LIMITS.name || email.length > LIMITS.email || phone.length > LIMITS.phone || message.length > LIMITS.message)
        return cfToast('Some fields are too long. Please shorten them and try again.');
      if (!EMAIL_RE.test(email)) return cfToast('Please enter a valid email address.');
      if (phone && !PHONE_RE.test(phone)) return cfToast('Please enter a valid phone number, or leave it empty.');
      if (Date.now() - lastSentAt < COOLDOWN_MS) return cfToast('Please wait a moment before sending another message.');
      if (!fb) return cfToast('Messages are unavailable right now. Please contact us on WhatsApp.');
      const btn = document.getElementById('contactBtn'), label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…';
      lastSentAt = Date.now();
      try {
        await fb.addDoc(fb.collection(fb.db, 'contactMessages'), { name, email, phone, message, status: 'new', createdAt: fb.serverTimestamp() });
        const wa = encodeURIComponent(`Hi PixelRoot, I just sent a message through your website (${name}).`);
        cCard.innerHTML = `<div class="cf-done"><div class="cf-ok">&#10003;</div><h3>Message sent!</h3><p>Thanks, ${esc(name.split(' ')[0])}. We will reply to <b>${esc(email)}</b> within one business day.</p><a class="btn btn-wa" href="https://wa.me/${WHATSAPP}?text=${wa}" target="_blank" rel="noopener">Message us on WhatsApp</a><button type="button" class="cf-again" id="cfAgain">Send another message</button></div>`;
        document.getElementById('cfAgain').onclick = () => { cCard.innerHTML = cFormHTML; bindContact(); };
      } catch (err) {
        lastSentAt = 0;
        // Never show raw server or Firebase error text to visitors.
        cfToast(err && err.code === 'permission-denied' ? 'Messages are unavailable right now. Please contact us on WhatsApp.' : 'Something went wrong. Please try again or contact us on WhatsApp.');
        btn.disabled = false; btn.textContent = label;
      }
    });
  }
  bindContact();
}

/* ---- Load Firebase, then show sign-in state in the nav ---- */
(async function initFirebase() {
  try {
    const base = 'https://www.gstatic.com/firebasejs/13.1.0/';
    const [appM, authM, fsM] = await Promise.all([
      import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')
    ]);
    const app = appM.initializeApp({
      apiKey: "AIzaSyAIQVEXNrIu3ZhhQ0qJKMZpOSKZ2EPD25E", authDomain: "pixelroot-9da60.firebaseapp.com", projectId: "pixelroot-9da60",
      storageBucket: "pixelroot-9da60.firebasestorage.app", messagingSenderId: "320500176338", appId: "1:320500176338:web:033d785c5f716779eb240b", measurementId: "G-WBE5F8ZKSF"
    });
    const auth = authM.getAuth(app), db = fsM.getFirestore(app);
    fb = { db, addDoc: fsM.addDoc, collection: fsM.collection, serverTimestamp: fsM.serverTimestamp };

    const DASH = { client: 'client-dashboard.html', designer: 'designer-dashboard.html', admin: 'admin-dashboard.html' };
    const area = document.getElementById('authArea'), pArea = document.getElementById('panelAuth');
    if (!area || !pArea) return;
    authM.onAuthStateChanged(auth, async user => {
      if (!user || !user.emailVerified) { area.innerHTML = SIGNED_OUT_HTML; pArea.innerHTML = SIGNED_OUT_HTML; return; }
      let href = 'signin.html';
      try { const s = await fsM.getDoc(fsM.doc(db, 'users', user.uid)); if (s.exists()) href = DASH[s.data().role] || href; } catch (e) {}
      const html = `<a href="${href}" class="nav-cta">Go to Dashboard</a><button type="button" class="nav-signin logout-btn">Log Out</button>`;
      area.innerHTML = html; pArea.innerHTML = html;
      document.querySelectorAll('.logout-btn').forEach(b => b.onclick = () => authM.signOut(auth));
    });
  } catch (err) {
    console.warn('PixelRoot: Firebase could not be loaded.', err);
  }
})();
