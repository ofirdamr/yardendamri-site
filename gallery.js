    // ── MOBILE MENU ──────────────────────────────
    function toggleMobileMenu() {
      const menu = document.getElementById('mobileMenu');
      const btn = document.getElementById('navHamburger');
      const overlay = document.getElementById('mobileOverlay');
      const isOpen = menu.classList.contains('open');
      menu.classList.toggle('open');
      btn.classList.toggle('open');
      overlay.classList.toggle('open');
      btn.setAttribute('aria-expanded', !isOpen);
      menu.setAttribute('aria-hidden', isOpen);
    }
    function closeMobileMenu() {
      document.getElementById('mobileMenu').classList.remove('open');
      document.getElementById('navHamburger').classList.remove('open');
      document.getElementById('mobileOverlay').classList.remove('open');
      document.getElementById('navHamburger').setAttribute('aria-expanded', 'false');
      document.getElementById('mobileMenu').setAttribute('aria-hidden', 'true');
    }

    // ── SCROLL TOP ────────────────────────────────
    const scrollBtn = document.getElementById('scroll-top');
    const mainNav = document.querySelector('nav[role="navigation"]');
    window.addEventListener('scroll', () => {
      const show = window.scrollY > 400;
      scrollBtn.style.opacity = show ? '1' : '0';
      scrollBtn.style.pointerEvents = show ? 'auto' : 'none';
      if (mainNav) mainNav.classList.toggle('scrolled', window.scrollY > 80);
    }, { passive: true });

    // ── GALLERY ───────────────────────────────────
    function getAdminSettings() {
      // Prefer remote (public, synced). Fallback to legacy localStorage for backward compat during transition.
      if (window.RemoteState && window.RemoteState.getAdmin) {
        return window.RemoteState.getAdmin();
      }
      try { return JSON.parse(localStorage.getItem('gallery_admin') || '{}'); } catch(e) { return {}; }
    }
    function applyAdminSettings(images) {
      const s = getAdminSettings();
      const hidden = new Set(s.hidden || []);
      const privateCatsSet = new Set(s.privateCats || []);
      const catMap = s.cats || {};
      const hiddenCats = new Set([...privateCatsSet, 'מוסתרות']);
      let filtered = images.filter(img => !img.hidden && !hidden.has(img.u) && !hiddenCats.has(catMap[img.u]));
      const order = s.order || [];
      if (order.length) {
        // Apply admin's custom order. Items NOT in the saved order are newly-synced
        // posts the admin hasn't arranged yet — keep them in natural (newest-first)
        // order at the TOP so new content (often video) stays visible, then the
        // explicitly-arranged items follow.
        const idx = new Map(order.map((u, i) => [u, i]));
        filtered = filtered.map((img, natural) => ({ img, natural })).sort((a, b) => {
          const ia = idx.has(a.img.u) ? idx.get(a.img.u) : -1;
          const ib = idx.has(b.img.u) ? idx.get(b.img.u) : -1;
          if (ia === -1 && ib === -1) return a.natural - b.natural;
          if (ia === -1) return -1;
          if (ib === -1) return 1;
          return ia - ib;
        }).map(x => x.img);
      }
      return filtered;
    }

    // Collapse carousel children into one cover tile (Instagram-style)
    function collapseCarousels(images) {
      const out = [], seen = {};
      for (const img of images) {
        if (img.carousel && img.post_id) {
          if (!seen[img.post_id]) { seen[img.post_id] = true; out.push(img); }
        } else out.push(img);
      }
      return out;
    }

    const PER_PAGE = 48;
    let currentPage = 1;
    let lbAll = typeof GALLERY_IMAGES !== 'undefined' ? applyAdminSettings(GALLERY_IMAGES) : []; // expanded (carousel children individual) — for lightbox swipe
    let filteredImages = collapseCarousels(lbAll); // collapsed (one cover per carousel) — for the grid

    const gallery = document.getElementById('ig-gallery');
    const pagination = document.getElementById('pagination');

    // Load remote state (admin settings, hero video, reviews). On success, re-render with applied settings.
    (async () => {
      if (!window.RemoteState) return;
      await window.RemoteState.fetchPublic();
      // Re-apply settings and re-render gallery
      if (typeof GALLERY_IMAGES !== 'undefined') {
        lbAll = applyAdminSettings(GALLERY_IMAGES);
        filteredImages = collapseCarousels(lbAll);
        if (typeof renderPage === 'function') renderPage(currentPage);
      }
    })();

    

    let lbItems = [];
    let lbIdx = 0;

    // On desktop the media is contained+centered (not full-screen), so the fixed right:10px
    // action bar floats off to the right of the photo. This measures the media's actual right
    // edge and snaps the actions next to it.
    function _repositionLbActionsDesktop() {
      if (window.innerWidth < 1081) return;
      requestAnimationFrame(function() {
        var lb = document.getElementById('lightbox');
        var actions = document.getElementById('hpLbActions');
        if (!lb || !actions) return;
        var vid = lb.querySelector('video');
        var img = lb.querySelector('img');
        var media = (vid && vid.style.display !== 'none' && vid.src) ? vid
                  : (img && img.style.display !== 'none' && img.src) ? img : null;
        if (!media) return;
        var rect = media.getBoundingClientRect();
        if (rect.width < 10) { setTimeout(_repositionLbActionsDesktop, 120); return; }
        actions.style.right = Math.max(8, window.innerWidth - rect.right - 10) + 'px';
      });
    }

    function openLightbox(url, alt, idx) {
      trackEvent('gallery_open', 'engagement', alt ? alt.substring(0,50) : 'gallery');
      if (typeof idx === 'number') lbIdx = idx;
      _showLightboxContent(url, alt);
      const lb = document.getElementById('lightbox');
      lb.style.display = 'flex';
      document.body.classList.add('lb-open');
      document.body.style.overflow = 'hidden';
      lb.focus();
      _updateLbNav();
      updateHpLbActions();
      _repositionLbActionsDesktop();
    }

    function _showLightboxContent(url, alt) {
      const isVideo = url.includes('/video/upload/') || url.includes('.mp4');
      const lb = document.getElementById('lightbox');
      lb.classList.toggle('lb-video-on', isVideo);
      if (isVideo) {
        lb.querySelector('img').style.display = 'none';
        let vid = lb.querySelector('video');
        if (!vid) {
          vid = document.createElement('video');
          vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border-radius:0;';
          vid.controls = true; vid.playsInline = true;
          lb.insertBefore(vid, lb.querySelector('.lb-caption'));
        }
        const cur = lbItems[lbIdx];
        vid.poster = (cur && cur.thumb) || '';   // thumbnail instead of black while buffering
        vid.muted = false;
        vid.preload = 'auto';
        vid.src = url;
        vid.style.display = 'block';
        vid.load();
        vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
      } else {
        let vid = lb.querySelector('video');
        if (vid) { vid.pause(); vid.src = ''; vid.style.display = 'none'; }
        const img = lb.querySelector('img');
        img.style.display = 'block';
        img.src = url; // full Instagram-max image (the grid uses the small thumb instead)
        img.alt = alt;
        img.onload = _repositionLbActionsDesktop;
      }
      lb.querySelector('.lb-caption').textContent = alt.substring(0, 120);
    }

    function _updateLbNav() {
      const counter = document.getElementById('lb-counter');
      const cur = lbItems[lbIdx];
      if (counter) {
        let label = lbItems.length > 1 ? `${lbIdx + 1} / ${lbItems.length}` : '';
        if (cur && cur.carousel && cur.ccount > 1) label = `◻ ${(cur.cidx||0)+1}/${cur.ccount} · ${label}`;
        counter.textContent = label;
      }
      const prev = document.getElementById('lb-prev');
      const next = document.getElementById('lb-next');
      if (prev) prev.style.opacity = lbIdx > 0 ? '1' : '.2';
      if (next) next.style.opacity = lbIdx < lbItems.length - 1 ? '1' : '.2';
    }

    function navigateLightbox(dir) {
      const newIdx = lbIdx + dir;
      if (newIdx < 0 || newIdx >= lbItems.length) return;
      lbIdx = newIdx;
      const item = lbItems[lbIdx];
      _showLightboxContent(item.u, item.a || '');
      _updateLbNav();
      updateHpLbActions();
      _repositionLbActionsDesktop();
    }

    function closeLightbox() {
      const lb = document.getElementById('lightbox');
      const vid = lb.querySelector('video');
      if (vid) vid.pause();
      lb.style.display = 'none';
      document.body.classList.remove('lb-open');
      document.body.style.overflow = '';
    }

    // ── FAVORITES (saved per device) ──
    function getFavorites() { try { return JSON.parse(localStorage.getItem('gallery_favorites')||'[]'); } catch(e) { return []; } }
    function isFav(url) { return getFavorites().includes(url); }
    function toggleFav(url) {
      let f = getFavorites();
      if (f.includes(url)) f = f.filter(u => u !== url);
      else f.push(url);
      try { localStorage.setItem('gallery_favorites', JSON.stringify(f)); } catch(e) {}
      return f.includes(url);
    }
    function hpLbToast(msg) {
      const t = document.getElementById('hpLbToast');
      t.textContent = msg; t.classList.add('show');
      clearTimeout(window._hpToastT);
      window._hpToastT = setTimeout(() => t.classList.remove('show'), 1800);
    }
    function shareLink(item) {
      const id = String(item.item_id || item.post_id || '').replace(/[^0-9]/g, '');
      const isVideo = item.video || /\.mp4/i.test(item.u) || item.u.includes('/video/upload/');
      return 'https://api.yardendamri.co.il/s/' + (isVideo ? 'v' : 'p') + '/' + id;
    }
    async function shareItem() {
      const item = lbItems[lbIdx];
      if (!item) return;
      const link = shareLink(item);
      // Share the link only → clean card (thumbnail + "לחצי כאן לצפייה" + domain).
      try {
        if (navigator.share) { await navigator.share({ url: link }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      window.open('https://wa.me/?text=' + encodeURIComponent(link), '_blank', 'noopener');
    }
    function updateHpLbActions() {
      const item = lbItems[lbIdx];
      if (!item) return;
      const key = btoa(item.u).substring(0,12);
      const igStats = getIgStats(item);
      const totalLikes = (igStats?igStats.likes:0) + (getLikes()[key]||0);
      const cmtCount = (igStats?(igStats.comments_count||igStats.comments?.length||0):0) + ((getComments()[key]||[]).length);
      document.getElementById('hpLbLike').classList.toggle('liked', hasLiked(key));
      document.getElementById('hpLbLikeCnt').textContent = totalLikes || '';
      document.getElementById('hpLbCmtCnt').textContent = cmtCount || '';
      document.getElementById('hpLbSave').classList.toggle('saved', isFav(item.u));
    }
    document.getElementById('hpLbLike').addEventListener('click', async () => {
      await toggleLike(lbItems[lbIdx].u); updateHpLbActions();
    });
    document.getElementById('hpLbComment').addEventListener('click', () => {
      const it = lbItems[lbIdx];
      openComments(it.u, (it.a||'').substring(0,30).replace(/['"\\\n\r]/g,' ').trim());
    });
    document.getElementById('hpLbShare').addEventListener('click', shareItem);
    document.getElementById('hpLbSave').addEventListener('click', () => {
      const saved = toggleFav(lbItems[lbIdx].u);
      updateHpLbActions();
      hpLbToast(saved ? '💾 נשמר למועדפים' : 'הוסר מהמועדפים');
    });
    document.addEventListener('keydown', e => {
      const lb = document.getElementById('lightbox');
      if (lb.style.display === 'flex') {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(1);
        if (e.key === 'ArrowRight') navigateLightbox(-1);
      }
    });
    // Mobile swipe — CAPTURE phase on document so it works even over a playing <video>
    (function() {
      const lbOpen = () => document.getElementById('lightbox').style.display === 'flex';
      let x0 = 0, y0 = 0, active = false;
      document.addEventListener('touchstart', e => {
        if (!lbOpen()) return;
        const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; active = true;
      }, { capture: true, passive: true });
      document.addEventListener('touchmove', e => {
        if (!active || !lbOpen()) return;
        const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) e.preventDefault();
      }, { capture: true, passive: false });
      document.addEventListener('touchend', e => {
        if (!active) return; active = false;
        if (!lbOpen()) return;
        const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) navigateLightbox(dx < 0 ? 1 : -1);
        else if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx)) closeLightbox();  // swipe up/down to dismiss
      }, { capture: true, passive: true });
    })();


    // ── SOCIAL (web-wide likes + comments via Worker) ──
    const SOCIAL_URL = 'https://api.yardendamri.co.il/social';
    let _socialCache = null;

    async function loadSocial() {
      if (_socialCache) return _socialCache;
      try {
        const r = await fetch(SOCIAL_URL + '?v=' + Math.floor(Date.now()/60000));
        if (r.ok) _socialCache = await r.json();
      } catch(e) {}
      if (!_socialCache) _socialCache = {likes:{}, comments:{}};
      return _socialCache;
    }

    async function saveSocial() {
      try {
        await fetch(SOCIAL_URL, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({likes: _socialCache.likes, comments: _socialCache.comments})
        });
      } catch(e) {}
    }

    function getLikes() { return (_socialCache||{}).likes || {}; }
    function getComments() { return (_socialCache||{}).comments || {}; }
    // Per-session liked tracking (show filled heart for this user this session)
    function hasLiked(key) { try { return !!sessionStorage.getItem('liked_'+key); } catch(e) { return false; } }
    function setLiked(key) { try { sessionStorage.setItem('liked_'+key,'1'); } catch(e) {} }
    function clearLiked(key) { try { sessionStorage.removeItem('liked_'+key); } catch(e) {} }


    function igIdFromUrl(url) {
      const m = url.match(/yarden_makeup_(\d+)/);
      return m ? m[1] : null;
    }

    // Optimize Cloudinary URLs: auto format (WebP/AVIF), quality, resize
    function cdnUrl(url, w) {
      if (!url) return url;
      return url.replace('/upload/', `/upload/f_auto,q_auto,w_${w},c_fill/`);
    }
    function cdnVideo(url, w) {
      if (!url) return url;
      // q_auto = Cloudinary analyzes each video and picks optimal quality
      // f_auto = serves WebP/best format for the browser
      return url.replace('/video/upload/', `/video/upload/q_auto:good,w_480,c_fill,f_auto/`);
    }
    function cdnVideoPoster(url) {
      if (!url) return '';
      return url.replace('/video/upload/', '/video/upload/so_auto,f_jpg,w_480,h_480,c_fill,q_auto/').replace(/\.(mp4|mov|webm)$/i, '.jpg');
    }

    let igStatsCache = JSON.parse(sessionStorage.getItem('ig_stats')||'{}');
    let igCaptionMap = {}; // caption_key → stats

    function captionKey(str) {
      return (str||'').substring(0,40).replace(/\s+/g,'').toLowerCase();
    }

    function getIgStats(item) {
      if (item.post_id && igStatsCache[item.post_id]) return igStatsCache[item.post_id];
      if (item.item_id && igStatsCache[item.item_id]) return igStatsCache[item.item_id];
      if (item.id && igStatsCache[item.id]) return igStatsCache[item.id];
      return null;
    }

    // Load from instagram-stats.json (pre-built by GitHub Actions every 6 hours)
    async function loadIgFeed() {
      if (Object.keys(igStatsCache).length > 0) return;
      try {
        const res = await fetch('instagram-stats.json?v=' + Math.floor(Date.now()/3600000));
        if (!res.ok) return;
        const stats = await res.json();
        Object.assign(igStatsCache, stats);
        sessionStorage.setItem('ig_stats', JSON.stringify(igStatsCache));
        renderPage(currentPage);
      } catch(e) {}
    }

    async function loadIgStats(images) {
      // Fire and forget — don't await, gallery shows immediately.
      // Defer the heavy stats fetch (~1.8MB) off the critical path.
      if ('requestIdleCallback' in window) requestIdleCallback(() => loadIgFeed().catch(()=>{}), { timeout: 2500 });
      else setTimeout(() => loadIgFeed().catch(()=>{}), 1200);
      loadSocial().then(()=>renderPage(currentPage)).catch(()=>{});
    }

    async function toggleLike(url) {
      await loadSocial();
      const key = btoa(url).substring(0,12);
      const liked = hasLiked(key);
      if (liked) { _socialCache.likes[key] = Math.max(0,(_socialCache.likes[key]||1)-1); clearLiked(key); }
      else { _socialCache.likes[key] = (_socialCache.likes[key]||0)+1; setLiked(key); }
      saveSocial();
      renderPage(currentPage);
    }

    function openComments(url, alt) {
      const key = btoa(url).substring(0,12);
      const igStats = getIgStats({u: url, a: alt});
      const igComments = igStats ? (igStats.comments || []) : [];
      const localComments = getComments()[key]||[];
      const allComments = [
        ...igComments.map(c=>({name:'@'+(c.username||c.user||''), text:c.text||'', date: c.timestamp ? new Date(c.timestamp).toLocaleDateString('he-IL') : (c.date||''), ig:true})),
        ...localComments
      ];
      const modal = document.createElement('div');
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      modal.setAttribute('aria-label','תגובות');
      modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.85);display:flex;align-items:flex-end;justify-content:center;';
      modal.innerHTML = `<div style="background:#231815;border-radius:20px 20px 0 0;width:100%;max-width:500px;padding:24px;max-height:70vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <strong style="color:#E8C8B0;font-size:1.05rem;">תגובות</strong>
          <button onclick="this.closest('div[role=dialog]').remove()" aria-label="סגרי תגובות" style="background:none;border:none;color:#E8C8B0;font-size:1.4rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
          ${allComments.length ? allComments.map(c=>`
            <div style="background:rgba(255,255,255,.05);border-radius:10px;padding:10px 12px;">
              <strong style="color:var(--blush);font-size:.88rem">${c.name}${c.ig?' <span style="font-size:.7rem;opacity:.5">📸 IG</span>':''}</strong>
              <p style="font-size:.92rem;color:rgba(240,230,220,.8);margin-top:4px;">${c.text}</p>
            </div>`).join('') : '<p style="opacity:.5;font-size:.9rem">אין תגובות עדיין</p>'}
        </div>
        <label for="cmt-name" style="display:block;font-size:.8rem;opacity:.6;margin-bottom:4px;">שמך</label>
        <input id="cmt-name" placeholder="שם" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(232,200,176,.2);background:rgba(255,255,255,.06);color:#F0E6DC;font-size:.95rem;margin-bottom:8px;font-family:inherit;" />
        <label for="cmt-text" style="display:block;font-size:.8rem;opacity:.6;margin-bottom:4px;">תגובה</label>
        <textarea id="cmt-text" placeholder="כתבי תגובה..." style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(232,200,176,.2);background:rgba(255,255,255,.06);color:#F0E6DC;font-size:.95rem;min-height:70px;resize:none;margin-bottom:10px;font-family:inherit;"></textarea>
        <button onclick="(()=>{const n=document.getElementById('cmt-name').value.trim(),t=document.getElementById('cmt-text').value.trim();if(!n||!t)return;const c=getComments();if(!c['${key}'])c['${key}']=[];c['${key}'].push({name:n,text:t,date:new Date().toLocaleDateString('he-IL')});if(!_socialCache.comments)_socialCache.comments={};if(!_socialCache.comments['${key}'])_socialCache.comments['${key}']=[];_socialCache.comments['${key}'].push({name:n,text:t,date:new Date().toLocaleDateString('he-IL')});saveSocial();this.closest('div[role=dialog]').remove();renderPage(currentPage);})()" style="width:100%;padding:13px;border-radius:10px;border:none;background:#C4805A;color:#fff;font-weight:700;cursor:pointer;font-size:1rem;font-family:inherit;">שלחי 💬</button>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#cmt-name').focus();
    }

    const catAltMap = {
      'כלות': 'איפור כלה מקצועי', 'ערב': 'איפור ערב אלגנטי',
      'אירועים/הפקות': 'איפור הפקה', 'מוסתרות': 'איפור מקצועי'
    };
    function getAutoAlt(item) {
      const cat = catAltMap[item.cat] || 'איפור מקצועי';
      const isVid = item.video || /\.mp4|\/video\//.test(item.u||'');
      const credit = item.cat === 'כלות'
        ? 'מאת ירדן דמרי, מאפרת כלות מקצועית, מגיעה לכל הארץ'
        : 'מאת ירדן דמרי, מאפרת כלות וערב באילת';
      const base = `${isVid ? 'סרטון' : 'תמונת'} ${cat} ${credit}`;
      const cap = (item.a||'').replace(/[#@]\S+/g,'').replace(/https?:\S+/g,'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,70);
      return cap ? `${cap}, ${base}` : base;
    }

    function renderPage(page) {
      const start = (page - 1) * PER_PAGE;
      const items = filteredImages.slice(start, start + PER_PAGE);
      lbItems = lbAll; // lightbox swipes the full expanded list (incl. carousel children)
      gallery.innerHTML = '';

      items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.setAttribute('role', 'listitem');
        div.style.cssText = 'position:relative;overflow:hidden;border-radius:16px;aspect-ratio:1;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.08);transition:transform .3s,box-shadow .3s;touch-action:manipulation;background:#efe7df;background-image:linear-gradient(100deg,#efe7df 30%,#faf5f0 50%,#efe7df 70%);background-size:200% 100%;animation:shimmer 1.5s linear infinite;';

        const isVideo = item.video || item.u.includes('.mp4') || item.u.includes('/video/upload/');
        const _rot = (getAdminSettings().rotations || {})[item.u] || 0;
        const _rotStyle = _rot ? `transform:rotate(${_rot}deg);` : '';

        // Video tiles: prefer the small derived _thumb.webp (R2 backfill); onerror falls back to
        // the _thumb.jpg, then the brown placeholder. Images keep their own derive below.
        const _vid2 = item.item_id || (String(item.u).match(/yarden_(\d+)/) || [])[1] || '';
        const _thumb2 = _vid2 ? `https://images.yardendamri.co.il/yarden_${_vid2}_thumb.webp` : (item.thumb || '');
        const mediaEl = isVideo
          ? `<img src="${_thumb2}" data-video="${item.u}" loading="lazy" decoding="async"
               alt="${getAutoAlt(item).substring(0,120)}"
               aria-label="${item.a ? item.a.substring(0,80) : 'סרטון'}"
               style="width:100%;height:100%;object-fit:cover;display:block;animation:tilefade .5s ease-out both;${_rotStyle}"
               onerror="if(!this.dataset.fb&&this.src.indexOf('_thumb.webp')>-1){this.dataset.fb=1;this.src=this.src.replace('_thumb.webp','_thumb.jpg');}">`
          : `<img src="${item.thumb || item.u.replace(/\.(webp|jpe?g|png)(\?.*)?$/i, '_thumb.webp')}" alt="${getAutoAlt(item).substring(0,120)}" loading="lazy" decoding="async"
               style="width:100%;height:100%;object-fit:cover;display:block;animation:tilefade .5s ease-out both;transition:transform .4s;${_rotStyle}"
               onerror="this.onerror=null;this.src='${item.u}'" />`;

        const badge = (item.carousel || item.ccount > 1)
          ? `<div class="media-badge" aria-label="פוסט עם מספר תמונות"><svg viewBox="0 0 48 48"><path d="M34.8 29.7V11c0-2.9-2.3-5.2-5.2-5.2H11c-2.9 0-5.2 2.3-5.2 5.2v18.7c0 2.9 2.3 5.2 5.2 5.2h18.7c2.8-.1 5.1-2.4 5.1-5.2zM39.2 15v16.1c0 4.5-3.7 8.2-8.2 8.2H14.9c-.6 0-.9.7-.5 1.1 1 1.1 2.4 1.8 4.1 1.8h12.7c5.5 0 9.9-4.4 9.9-9.9V18.6c0-1.6-.8-3.1-1.8-4.1-.5-.4-1.1 0-1.1.5z"/></svg></div>`
          : (isVideo ? `<div class="media-badge" aria-label="סרטון"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>` : '');
        div.innerHTML = `${mediaEl}${badge}
          <div class="overlay" style="position:absolute;inset:0;background:linear-gradient(to top,rgba(44,32,24,.88) 0%,transparent 55%);opacity:0;transition:opacity .3s;pointer-events:none;" aria-hidden="true">
            <p style="position:absolute;bottom:14px;left:0;right:0;color:#fff;font-size:.82rem;line-height:1.5;padding:6px 12px;margin:0;">${item.a ? item.a.substring(0,60) : ''}</p>
          </div>`;

        div.setAttribute('tabindex', '0');
        div.setAttribute('aria-label', `תמונה ${idx+1}: ${item.a ? item.a.substring(0,60) : 'עבודת איפור'}. לחצי לצפייה מוגדלת.`);

        // Desktop hover
        div.onmouseenter = () => { if (window.matchMedia('(hover:none)').matches) return;
          div.style.transform = 'scale(1.02)';
          div.querySelector('.overlay').style.opacity = '1';
          const imgEl = div.querySelector('img');
          if (imgEl) imgEl.style.transform = 'scale(1.05)';
        };
        div.onmouseleave = () => { if (window.matchMedia('(hover:none)').matches) return;
          div.style.transform = 'scale(1)';
          div.querySelector('.overlay').style.opacity = '0';
          const imgEl = div.querySelector('img');
          if (imgEl) imgEl.style.transform = 'scale(1)';
        };

        // Click / keyboard open lightbox (map cover → its position in the expanded list)
        const lbi = lbAll.indexOf(item);
        div.onclick = () => openLightbox(item.u, item.a || '', lbi);
        div.onkeypress = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(item.u, item.a || '', lbi); } };

        gallery.appendChild(div);
      });

      renderPagination();
      if (page > 1) window.scrollTo({top: document.getElementById('gallery').offsetTop - 80, behavior: 'smooth'});
      observeGalleryVideos();
    }

    // VIDEO PREVIEW: the thumbnail <img> ALWAYS stays. When a tile is in view we lay an autoplaying
    // <video> ON TOP and reveal it only once it actually starts playing ('playing' event). If iOS
    // can't autoplay (Low Power Mode, too many at once, throttling), the thumbnail stays — a tile
    // can never go blank. Tap still opens the lightbox for the full video.
    let _galleryVidObserver = null;
    function observeGalleryVideos() {
      if (!_galleryVidObserver) {
        _galleryVidObserver = new IntersectionObserver(entries => {
          entries.forEach(e => {
            const el = e.target;
            if (el.tagName !== 'IMG' || !el.dataset.video) return;
            if (e.isIntersecting) {
              if (el._ov) { el._ov.play().catch(()=>{}); return; }
              const v = document.createElement('video');
              v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'metadata';
              v.setAttribute('muted',''); v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline','');
              v.src = el.dataset.video;
              v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .35s;z-index:1;animation:none;' + (el.style.transform ? ('transform:'+el.style.transform+';') : '');
              v.addEventListener('playing', () => { v.style.opacity = '1'; });
              el.parentNode.appendChild(v);
              el._ov = v;
              v.play().catch(()=>{});
            } else if (el._ov) {
              try { el._ov.pause(); } catch(_){}
              el._ov.style.opacity = '0';
            }
          });
        }, { threshold: 0.2 });
      }
      document.querySelectorAll('#ig-gallery img[data-video]').forEach(el => {
        if (!el.dataset._obs) { el.dataset._obs = '1'; _galleryVidObserver.observe(el); }
      });
    }

    function renderPagination() {
      const total = Math.ceil(filteredImages.length / PER_PAGE);
      if (total <= 1) {
        pagination.innerHTML = `<a href="gallery.html" style="display:inline-block;margin-top:12px;padding:12px 32px;border-radius:30px;border:1px solid var(--blush);color:var(--blush);text-decoration:none;font-size:.85rem;font-weight:600;letter-spacing:.06em;transition:all .25s;" onmouseover="this.style.background='var(--blush)';this.style.color='#fff'" onmouseout="this.style.background='';this.style.color='var(--blush)'">לכל הגלריה ←</a>`;
        return;
      }
      let html = '';
      const btn = 'padding:10px 18px;margin:4px;border-radius:10px;border:1.5px solid rgba(196,134,106,.4);background:#fff;cursor:pointer;font-size:.9rem;transition:all .2s;';
      const active = 'padding:10px 18px;margin:4px;border-radius:10px;border:none;background:var(--rose);color:#fff;cursor:pointer;font-size:.9rem;font-weight:700;';
      if (currentPage > 1) html += `<button style="${btn}" onclick="goPage(${currentPage-1})" aria-label="עמוד קודם">→ הקודם</button>`;
      let start = Math.max(1, currentPage-2), end = Math.min(total, start+4);
      if (end - start < 4) start = Math.max(1, end-4);
      for (let i = start; i <= end; i++) html += `<button style="${i===currentPage?active:btn}" onclick="goPage(${i})" aria-label="עמוד ${i}" aria-current="${i===currentPage?'page':'false'}">${i}</button>`;
      if (currentPage < total) html += `<button style="${btn}" onclick="goPage(${currentPage+1})" aria-label="עמוד הבא">← הבא</button>`;
      html += `<p style="margin-top:12px;font-size:.85rem;opacity:.5;" aria-live="polite">עמוד ${currentPage} מתוך ${total} | ${filteredImages.length} תמונות</p>`;
      pagination.innerHTML = html;
    }

    function goPage(p) { currentPage = p; renderPage(p); }

    // Init
    if (filteredImages.length) {
      renderPage(1);
      loadIgStats(filteredImages.slice(0, PER_PAGE));
    }

    // Scroll reveal
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


    // ── REVIEWS ───────────────────────────────────
    function loadGoogleReviews() { /* strip reserved for future Google Places API integration */ }


    let chosenRating = 0;
    function setRev(n) {
      chosenRating = n;
      document.querySelectorAll('.star-opt').forEach(s => s.style.opacity = s.dataset.v <= n ? '1' : '.4');
    }

    const JSONBIN_KEY = '$2a$10$EUS8yhBdm130KXj7GB56iOGDZEB4Nlkid81ccEKHu/E6x1F6Sxdcm';
    const JSONBIN_BIN = '69f88e09aaba8821976cbc68';
    const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN}`;
    let reviewsCache = [];

    async function loadReviews() {
      try {
        if (window.RemoteState) {
          await window.RemoteState.fetchPublic();
          reviewsCache = window.RemoteState.getReviews();
        } else {
          const r = await fetch(JSONBIN_URL + '/latest', { headers: { 'X-Master-Key': JSONBIN_KEY } });
          const d = await r.json();
          reviewsCache = d.record?.reviews || [];
        }
      } catch(e) {
        reviewsCache = JSON.parse(localStorage.getItem('site_reviews')||'[]');
      }
      renderManualReviews();
    }

    async function submitReview() {
      const name = document.getElementById('rev-name').value.trim();
      const text = document.getElementById('rev-text').value.trim();
      if (!name || !text || !chosenRating) {
        const live = document.getElementById('a11y-live');
        live.textContent = 'יש למלא שם, דירוג וטקסט';
        setTimeout(() => live.textContent = '', 3000);
        return;
      }
      const newReview = { name, text, rating: chosenRating, date: new Date().toLocaleDateString('he-IL') };
      reviewsCache.unshift(newReview);
      localStorage.setItem('site_reviews', JSON.stringify(reviewsCache));
      try {
        if (window.RemoteState) {
          await window.RemoteState.update({ reviews: reviewsCache });
        } else {
          await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY },
            body: JSON.stringify({ reviews: reviewsCache })
          });
        }
      } catch(e) {}
      document.getElementById('rev-name').value = '';
      document.getElementById('rev-text').value = '';
      chosenRating = 0;
      document.querySelectorAll('.star-opt').forEach(s => s.style.opacity = '.4');
      const msg = document.getElementById('rev-msg');
      msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 3000);
      renderManualReviews();
    }

    function renderManualReviews() {
      const grid = document.getElementById('reviews-grid');
      grid.innerHTML = reviewsCache.length ? reviewsCache.map(r => `
        <article style="background:#fff;border:1px solid #ede8e3;border-radius:2px;padding:28px 24px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <strong style="color:var(--text);font-size:.9rem;font-family:'Rubik',sans-serif;">${r.name}</strong>
            <span style="color:var(--gold);font-size:.85rem;letter-spacing:2px;" aria-label="${r.rating} כוכבים">${'★'.repeat(r.rating)}</span>
          </div>
          <p style="font-size:.9rem;line-height:1.8;color:#555;">${r.text}</p>
          <p style="font-size:.72rem;color:var(--blush);margin-top:12px;letter-spacing:.05em;">${r.date}</p>
        </article>`).join('')
        : '<p style="opacity:.6;font-size:.9rem;text-align:center;font-family:Rubik,sans-serif;">אהבת את התוצאה? <a href=\"https://g.page/r/CfrXGS6nwqdXEBE/review\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color:var(--gold);text-decoration:underline;\">שתפי ב-Google</a>, זה עוזר לכלות נוספות למצוא אותי</p>';
    }

    document.addEventListener('DOMContentLoaded', () => {
      loadGoogleReviews();
      loadReviews();
      observeGalleryVideos();
    });

    setTimeout(observeGalleryVideos, 1000);

    // ── IS 5568 ACCESSIBILITY WIDGET ─────────────
    let a11yPrefs = {};
    try { a11yPrefs = JSON.parse(localStorage.getItem('a11y_prefs_v1')) || {}; } catch(e) {}

    const a11yClassMap = {
      contrast: 'a11y-contrast',
      textLg: 'a11y-text-lg',
      textXl: 'a11y-text-xl',
      links: 'a11y-links',
      noAnim: 'a11y-no-anim'
    };

    function applyA11yPrefs() {
      Object.entries(a11yClassMap).forEach(([key, cls]) => {
        document.documentElement.classList.toggle(cls, !!a11yPrefs[key]);
      });
      localStorage.setItem('a11y_prefs_v1', JSON.stringify(a11yPrefs));
    }

    function syncA11yButtons() {
      const map = { contrast:'btn-contrast', textLg:'btn-text-lg', textXl:'btn-text-xl', links:'btn-links', noAnim:'btn-no-anim' };
      Object.entries(map).forEach(([key, btnId]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.classList.toggle('active', !!a11yPrefs[key]);
          btn.setAttribute('aria-pressed', !!a11yPrefs[key]);
        }
      });
    }

    function toggleA11y() {
      const panel = document.getElementById('a11y-panel');
      const trigger = document.getElementById('a11y-trigger');
      const isOpen = panel.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen);
      if (isOpen) { panel.querySelector('button') && panel.querySelector('button').focus(); }
    }

    function toggleA11yPref(key, btnId) {
      // textLg and textXl are mutually exclusive
      if (key === 'textLg' && a11yPrefs.textXl) a11yPrefs.textXl = false;
      if (key === 'textXl' && a11yPrefs.textLg) a11yPrefs.textLg = false;
      a11yPrefs[key] = !a11yPrefs[key];
      applyA11yPrefs();
      syncA11yButtons();
      const live = document.getElementById('a11y-live');
      live.textContent = a11yPrefs[key] ? 'הגדרה הופעלה' : 'הגדרה כובתה';
      setTimeout(() => live.textContent = '', 2000);
    }

    function resetA11y() {
      a11yPrefs = {};
      applyA11yPrefs();
      syncA11yButtons();
      document.getElementById('a11y-live').textContent = 'כל ההגדרות אופסו';
      setTimeout(() => document.getElementById('a11y-live').textContent = '', 2000);
    }

    // Keyboard shortcut Alt+A to open/close accessibility panel
    document.addEventListener('keydown', e => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        toggleA11y();
      }
    });

    // Init accessibility state
    syncA11yButtons();
    applyA11yPrefs();

    function sharesite() {
      var u = 'https://yardendamri.co.il/';
      var t = 'ירדן דמרי, מאפרת כלות וערב מאיילת';
      if (navigator.share) {
        navigator.share({ title: 'ירדן דמרי', text: t, url: u }).catch(function(){});
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(t + '\n' + u), '_blank');
      }
    }

