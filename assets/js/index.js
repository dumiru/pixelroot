// Highlight the nav link for the section currently in view
  (function () {
    const groups = ['home', 'services', 'pricing', 'work', 'about'];
    const links = document.querySelectorAll('.nav-links a, .sp-links a');
    function update() {
      const y = window.scrollY + 120;
      let current = 'home';
      groups.forEach(g => { const el = document.getElementById(g); if (el && el.offsetTop <= y) current = g; });
      links.forEach(a => a.classList.toggle('active', a.dataset.link === current));
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  // Showreel: turn the link in #reel[data-video] into a playable embed
  (function () {
    const box = document.getElementById('reel');
    if (!box) return;
    const url = (box.dataset.video || '').trim();
    if (!url) return;
    if (!/^https:\/\//i.test(url)) return; // only https links are embedded
    let m, html = '';
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/))) {
      html = '<iframe src="https://www.youtube.com/embed/' + m[1] + '?rel=0" title="PixelRoot showreel" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>';
    } else if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
      html = '<iframe src="https://player.vimeo.com/video/' + m[1] + '" title="PixelRoot showreel" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    } else if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
      const v = document.createElement('video');
      v.src = url; v.controls = true; v.playsInline = true; v.preload = 'metadata';
      box.innerHTML = ''; box.appendChild(v); return;
    } else {
      return; // arbitrary iframes are not embedded
    }
    box.innerHTML = html;
  })();

// Remove designer photos that fail to load so the initials show instead (replaces inline onerror, which the CSP blocks).
document.addEventListener('error', e => { if (e.target.matches && e.target.matches('.dz-photo img')) e.target.remove(); }, true);
