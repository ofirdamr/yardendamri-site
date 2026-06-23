/* a11y.js — Israeli IS 5568 accessibility widget
 * Adds the floating ♿ trigger + panel to any page that includes this script.
 * Persists settings across pages via localStorage (a11y_prefs_v1).
 * Apply preferences ASAP on page load to avoid FOUC.
 */
(function(){
  // ── 1. Apply saved prefs ASAP (before paint) ─────────────────────────
  try {
    const p = JSON.parse(localStorage.getItem('a11y_prefs_v1')) || {};
    const c = document.documentElement.classList;
    if (p.contrast) c.add('a11y-contrast');
    if (p.textLg) c.add('a11y-text-lg');
    if (p.textXl) c.add('a11y-text-xl');
    if (p.links) c.add('a11y-links');
    if (p.noAnim) c.add('a11y-no-anim');
  } catch(e){}

  // ── 2. Inject widget HTML once DOM is ready ──────────────────────────
  function inject(){
    // Avoid double-injection (in case index.html still has inline widget)
    if (document.getElementById('a11y-trigger')) return;

    const tpl = `
      <button id="a11y-trigger"
        aria-label="פתיחת תפריט נגישות. קיצור מקלדת: Alt+A"
        aria-expanded="false"
        aria-controls="a11y-panel"
        aria-keyshortcuts="Alt+A"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="4" r="2"/><path d="M10 7h4l2 5h3v2h-4l-1-2.5V17h2l1 4h-2l-1-3h-3l-1 3H8l1-4h2v-5.5L10 14H7v-2h2z"/></svg></button>
      <button id="scroll-top" aria-label="חזרה לראש הדף" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>
      <div id="a11y-panel" role="dialog" aria-modal="false" aria-label="הגדרות נגישות">
        <h3>הגדרות נגישות</h3>
        <div class="a11y-row">
          <span class="a11y-label">ניגודיות גבוהה</span>
          <button class="a11y-btn" data-a11y-pref="contrast" aria-pressed="false">הפעלה</button>
        </div>
        <div class="a11y-row">
          <span class="a11y-label">הגדלת טקסט</span>
          <button class="a11y-btn" data-a11y-pref="textLg" aria-pressed="false">גדול</button>
          <button class="a11y-btn" data-a11y-pref="textXl" aria-pressed="false">גדול מאוד</button>
        </div>
        <div class="a11y-row">
          <span class="a11y-label">הדגשת קישורים</span>
          <button class="a11y-btn" data-a11y-pref="links" aria-pressed="false">הפעלה</button>
        </div>
        <div class="a11y-row">
          <span class="a11y-label">הפסקת אנימציות</span>
          <button class="a11y-btn" data-a11y-pref="noAnim" aria-pressed="false">הפסקה</button>
        </div>
        <button id="a11y-reset">♻️ איפוס הגדרות</button>
        <p style="color:rgba(255,255,255,.35);font-size:.75rem;text-align:center;margin-top:8px;">
          <a href="accessibility-statement.html" style="color:var(--blush);text-decoration:underline;font-size:.75rem;">הצהרת נגישות</a>
        </p>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" class="sr-only" id="a11y-live"></div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = tpl;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    wireUp();
  }

  // ── 3. Wire up behaviour ─────────────────────────────────────────────
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem('a11y_prefs_v1')) || {}; } catch(e){}

  const classMap = {
    contrast: 'a11y-contrast',
    textLg: 'a11y-text-lg',
    textXl: 'a11y-text-xl',
    links: 'a11y-links',
    noAnim: 'a11y-no-anim'
  };

  function applyPrefs(){
    Object.entries(classMap).forEach(([key, cls]) => {
      document.documentElement.classList.toggle(cls, !!prefs[key]);
    });
    localStorage.setItem('a11y_prefs_v1', JSON.stringify(prefs));
  }

  function syncButtons(){
    document.querySelectorAll('[data-a11y-pref]').forEach(btn => {
      const key = btn.dataset.a11yPref;
      btn.classList.toggle('active', !!prefs[key]);
      btn.setAttribute('aria-pressed', !!prefs[key]);
    });
  }

  function togglePanel(){
    const panel = document.getElementById('a11y-panel');
    const trigger = document.getElementById('a11y-trigger');
    if (!panel || !trigger) return;
    const isOpen = panel.classList.toggle('open');
    trigger.setAttribute('aria-expanded', isOpen);
    if (isOpen) { const f = panel.querySelector('button'); f && f.focus(); }
  }

  function togglePref(key){
    if (key === 'textLg' && prefs.textXl) prefs.textXl = false;
    if (key === 'textXl' && prefs.textLg) prefs.textLg = false;
    prefs[key] = !prefs[key];
    applyPrefs();
    syncButtons();
    const live = document.getElementById('a11y-live');
    if (live) {
      live.textContent = prefs[key] ? 'הגדרה הופעלה' : 'הגדרה כובתה';
      setTimeout(() => { if (live) live.textContent = ''; }, 2000);
    }
  }

  function resetPrefs(){
    prefs = {};
    applyPrefs();
    syncButtons();
    const live = document.getElementById('a11y-live');
    if (live) {
      live.textContent = 'כל ההגדרות אופסו';
      setTimeout(() => { if (live) live.textContent = ''; }, 2000);
    }
  }

  function wireUp(){
    const trigger = document.getElementById('a11y-trigger');
    if (trigger) trigger.addEventListener('click', togglePanel);
    document.querySelectorAll('[data-a11y-pref]').forEach(btn => {
      btn.addEventListener('click', () => togglePref(btn.dataset.a11yPref));
    });
    const reset = document.getElementById('a11y-reset');
    if (reset) reset.addEventListener('click', resetPrefs);
    syncButtons();
    applyPrefs();
  }

  // ── 4. Alt+A keyboard shortcut ───────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyA') {
      e.preventDefault();
      togglePanel();
    }
  });

  // Inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  // scroll-top visibility (for subpages where index.html JS doesn't run)
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-top');
    if (!btn) return;
    const show = window.scrollY > 400;
    btn.style.opacity = show ? '1' : '0';
    btn.style.pointerEvents = show ? 'auto' : 'none';
  }, { passive: true });
})();
