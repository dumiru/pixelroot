// Clickjacking protection (GitHub Pages cannot send X-Frame-Options / frame-ancestors headers).
if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) { document.documentElement.style.display = 'none'; } }
