    function applyHeroCropToPage(pos, zoom) {
      const els = [document.getElementById('heroVideo'), document.getElementById('heroImage')];
      const isMobile = window.innerWidth <= 1080;
      if (!isMobile) {
        // Desktop: the portrait video is massively scaled by object-fit:cover.
        // The stored heroPosition is tuned for mobile. Do NOT apply it on desktop.
        // The HTML inline object-position:50% 0% (face from top) is the correct value.
        // Never apply heroZoom scale — it only further crops the portrait video.
        els.forEach(el => { if (el) { el.style.transform = 'none'; } });
        return;
      }
      // Mobile only
      const x = (pos && /^\d/.test(pos)) ? pos.split(' ')[0] : '50%';
      const safePos = x + ' 20%';
      els.forEach(el => {
        if (!el) return;
        el.style.objectPosition = safePos;
        el.style.transform = 'none';
      });
    }

    function applyHeroMediaFromState(state) {
      const imgUrl = state.heroImage || null;
      const vidUrl = state.heroVideo || null;
      const videoEl = document.getElementById('heroVideo');
      const imgEl   = document.getElementById('heroImage');
      applyHeroCropToPage(state.heroPosition, state.heroZoom);
      if (imgUrl && imgEl && videoEl) {
        const cloudImg = imgUrl.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_1920,c_fill/');
        imgEl.src = cloudImg;
        imgEl.style.display = 'block';
        videoEl.style.display = 'none';
        videoEl.pause();
      } else if (vidUrl && videoEl) {
        const s = document.getElementById('heroVideoSource');
        if (!s) return;
        // Compare by item ID only — NOT the full filename. The baked-in source may be a
        // _mobile.mp4 / _hd.mp4 variant of the same video; those are the SAME hero and must
        // not trigger a reload (a reload here is exactly the old/new double-flash). Only swap
        // when the admin actually chose a DIFFERENT video.
        const idOf = (u) => { const m = (u || '').match(/yarden_(\d+)/); return m ? m[1] : ''; };
        const newId = idOf(vidUrl);
        const curId = idOf(videoEl.currentSrc || videoEl.src || s.getAttribute('src') || '');
        if (!newId || (curId && newId === curId)) { return; } // same hero — let native autoplay handle it
        // Derive poster from images bucket
        const itemId = newId;
        const poster = `https://images.yardendamri.co.il/yarden_${itemId}_thumb.jpg`;
        videoEl.setAttribute('poster', poster);
        s.src = vidUrl;
        videoEl.src = vidUrl;
        videoEl.load();
        videoEl.play().catch(()=>{});
      }
    }

    // Desktop only: upgrade the hero to its crisp ~1080p copy (yarden_<id>_hd.<ext>) if it
    // exists on R2; otherwise stay on the light (mobile-optimized) file. Mobile never loads
    // the heavy HD file. Preload-then-swap so the hero is never left broken/blank.
    function hdVariant(u){ return (u || '').split('?')[0].replace(/\.(mp4|webp|jpg|jpeg|png)$/i, '_hd.$1'); }
    function upgradeHeroToHD(){
      if (window.matchMedia('(max-width:1080px)').matches) return;
      const video = document.getElementById('heroVideo');
      const img   = document.getElementById('heroImage');
      const src   = document.getElementById('heroVideoSource');
      // Image heroes already load the Instagram-max file (yarden_<id>.webp) — nothing to upgrade.
      // Only the video hero has a heavier _hd variant worth swapping in on desktop. Detect an image
      // hero by the VIDEO being hidden (heroImage is now always present as the still behind the video).
      const imageShown = video && video.style.display === 'none';
      if (imageShown || !video || !src) return;
      const cur = video.currentSrc || src.getAttribute('src') || '';
      if (!cur || /_hd\.mp4/i.test(cur)) return;
      const hd = hdVariant(cur);
      const probe = document.createElement('video');
      probe.muted = true; probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        if (src.getAttribute('src') === hd) return;
        src.src = hd; video.src = hd; video.load(); video.play().catch(()=>{});
      };
      probe.src = hd; // metadata-only probe; onerror → keep light
    }

    (async function applyHeroVideo(){
      if (!window.RemoteState) { upgradeHeroToHD(); return; }
      try {
        await window.RemoteState.fetch();
        const fresh = window.RemoteState.getCached() || {};
        applyHeroMediaFromState(fresh);
        upgradeHeroToHD();
        let rt;
        window.addEventListener('resize', () => {
          clearTimeout(rt);
          rt = setTimeout(() => { applyHeroCropToPage(fresh.heroPosition, fresh.heroZoom); upgradeHeroToHD(); }, 150);
        });
      } catch(e) { console.warn('heroVideo error:', e); }
    })();
    window.addEventListener('load', upgradeHeroToHD);
