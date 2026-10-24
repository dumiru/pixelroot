const PROJECTS = {
    cake:       { title: 'Weekend cake promo', category: 'Bakery · Instagram',  intro: 'A bright, appetising feed series that helped a local bakery fill its weekend orders.', client: 'BakeHouse Co.', platform: 'Instagram', year: '2026', deliverables: 'Feed posts and stories', cover: '', images: [] },
    motivation: { title: 'Monday motivation',  category: 'Fitness · LinkedIn',  intro: 'Weekly motivational graphics that keep a coaching brand consistent and top of mind.', client: 'FitLoop', platform: 'LinkedIn', year: '2026', deliverables: 'Weekly graphics', cover: '', images: [] },
    menu:       { title: 'New menu launch',    category: 'Cafe · Facebook',     intro: "A launch pack of posts and stories introducing a cafe's refreshed seasonal menu.", client: 'NorthStar Cafe', platform: 'Facebook', year: '2026', deliverables: 'Posts and stories', cover: '', images: [] },
    summer:     { title: 'Summer sale',        category: 'Retail · Instagram',  intro: 'Bold sale creatives with clear pricing, built to stop the scroll and drive store visits.', client: 'Retail brand', platform: 'Instagram', year: '2026', deliverables: 'Sale creatives', cover: '', images: [] },
    podcast:    { title: 'Podcast episode',    category: 'Media · TikTok',      intro: 'Cover frames and quote cards that turn each podcast episode into shareable content.', client: 'Media brand', platform: 'TikTok', year: '2026', deliverables: 'Covers and quote cards', cover: '', images: [] },
    opening:    { title: 'Grand opening',      category: 'Studio · Facebook',   intro: 'An opening-week campaign that announced a new studio across every platform.', client: 'Studio brand', platform: 'Facebook', year: '2026', deliverables: 'Campaign set', cover: '', images: [] }
  };
  (function () {
    const key = new URLSearchParams(location.search).get('p');
    const p = Object.prototype.hasOwnProperty.call(PROJECTS, key) ? PROJECTS[key] : null;
    if (!p) return;
    const canon = document.querySelector('link[rel=canonical]'); if (canon) canon.href += '?p=' + key;
    document.title = 'PixelRoot - ' + p.title;
    const words = p.title.split(' '), last = words.pop();
    const h = document.getElementById('projTitle'); h.textContent = words.length ? words.join(' ') + ' ' : '';
    const sp = document.createElement('span'); sp.textContent = last; h.appendChild(sp);
    document.getElementById('projCat').textContent = p.category;
    document.getElementById('projIntro').textContent = p.intro;
    document.getElementById('pdClient').textContent = p.client; document.getElementById('pdPlatform').textContent = p.platform;
    document.getElementById('pdYear').textContent = p.year; document.getElementById('pdDeliver').textContent = p.deliverables;
    const fill = (box, src, alt) => { if (!src) return; box.innerHTML = ''; const i = document.createElement('img'); i.src = src; i.alt = alt; i.loading = 'lazy'; box.appendChild(i); box.classList.add('filled'); };
    fill(document.getElementById('projCover'), p.cover, p.title + ' cover');
    document.querySelectorAll('#projGallery .ph').forEach((box, n) => fill(box, p.images[n], p.title + ' image ' + (n + 1)));
  })();
