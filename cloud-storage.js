/* cloud-storage-temp.js — admin storage via Cloudflare Worker → GitHub
 *
 * Security refactor: replaces raw password header with session tokens.
 * Login flow: POST /login → receive token → store in sessionStorage → send as Bearer.
 *
 * Paired with worker-temp.js (requires SESSIONS KV binding on the Worker).
 */
(function(window){
  const WORKER_URL = 'https://api.yardendamri.co.il';
  const PUBLIC_URL = 'https://yardendamri.co.il/gallery-settings.json';
  const CACHE_KEY  = 'cloud_state_v2';
  const TOKEN_KEY  = 'yd_session_token'; // sessionStorage key for Bearer token

  let _cache = null;
  let _ready = false;
  let _readyResolve;
  const _readyPromise = new Promise(r => _readyResolve = r);

  // ── Token storage (sessionStorage — cleared on tab close) ─────

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || null; } catch(e) { return null; }
  }
  function setToken(t) {
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch(e) {}
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch(e) {}
  }

  // ── Local cache ───────────────────────────────────────────────

  function loadCache() {
    if (_cache) return _cache;
    try { _cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch(e) {}
    return _cache;
  }
  function saveCache(d) {
    _cache = d;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch(e) {}
  }

  // ── Remote read ───────────────────────────────────────────────

  let _fetchPromise = null;
  async function fetchRemote() {
    if (_fetchPromise) return _fetchPromise;
    _fetchPromise = (async () => {
      try {
        const r = await fetch(WORKER_URL + '/settings', { cache: 'no-cache' });
        if (!r.ok) throw new Error('fetch ' + r.status);
        const data = await r.json();
        saveCache(data);
        _ready = true;
        _readyResolve();
        return { ok: true, data };
      } catch(e) {
        console.warn('[cloud-storage] fetch failed:', e.message);
        return { ok: false, data: loadCache() || {}, error: e.message };
      } finally {
        _fetchPromise = null;
      }
    })();
    return _fetchPromise;
  }

  async function fetchPublic() {
    try {
      const r = await fetch(PUBLIC_URL + '?t=' + Date.now(), { cache: 'no-cache' });
      if (r.ok) {
        const data = await r.json();
        saveCache(data);
        _ready = true;
        _readyResolve();
        return { ok: true, data };
      }
    } catch(e) {}
    return fetchRemote();
  }

  // ── Authentication ────────────────────────────────────────────

  async function login(password) {
    try {
      const r = await fetch(WORKER_URL + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.status === 429) {
        const d = await r.json().catch(() => ({}));
        return { ok: false, error: 'too_many_attempts', retryAfter: d.retryAfter || 900 };
      }
      if (r.status === 401) return { ok: false, error: 'invalid_password' };
      if (!r.ok) return { ok: false, error: 'server_error_' + r.status };
      const data = await r.json();
      if (!data.token) return { ok: false, error: 'no_token' };
      setToken(data.token);
      return { ok: true };
    } catch(e) {
      return { ok: false, error: e.message || 'network_error' };
    }
  }

  async function logout() {
    const token = getToken();
    clearToken();
    if (!token) return;
    try {
      await fetch(WORKER_URL + '/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      });
    } catch(e) { /* best-effort logout */ }
  }

  // ── Admin write ───────────────────────────────────────────────

  let _writeQueue = Promise.resolve();
  async function update(partial) {
    if (!_ready) return { ok: false, error: 'not_synced' };
    const token = getToken();
    if (!token) return { ok: false, error: 'no_session' };

    const current = loadCache() || {};
    const merged = deepMerge(current, partial);
    saveCache(merged);

    const myWrite = _writeQueue.then(async () => {
      try {
        const r = await fetch(WORKER_URL + '/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify(partial),
        });
        if (r.status === 401 || r.status === 403) {
          clearToken();
          return { ok: false, error: 'session_expired' };
        }
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          return { ok: false, error: 'http ' + r.status + ': ' + text.slice(0, 200) };
        }
        const d = await r.json();
        return { ok: !!d.ok };
      } catch(e) {
        return { ok: false, error: e.message };
      }
    });
    _writeQueue = myWrite.catch(() => {});
    return myWrite;
  }

  // ── Helpers ───────────────────────────────────────────────────

  function deepMerge(target, source) {
    const out = Object.assign({}, target);
    for (const k of Object.keys(source)) {
      if (
        source[k] && typeof source[k] === 'object' && !Array.isArray(source[k]) &&
        target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])
      ) {
        out[k] = deepMerge(target[k], source[k]);
      } else {
        out[k] = source[k];
      }
    }
    return out;
  }

  // ── Public API ────────────────────────────────────────────────

  window.RemoteState = {
    // Auth
    login,
    logout,
    hasToken: () => !!getToken(),

    // Backward-compat shims (cloud-storage.js used getPwd/setPwd — keep callers working)
    getPwd:   getToken,
    setPwd:   setToken,
    clearPwd: clearToken,
    hasPwd:   () => !!getToken(),

    // Data
    fetch:       fetchPublic,
    fetchPublic: fetchPublic,
    update,
    isReady:    () => _ready,
    ready:      () => _readyPromise,
    getCached:  loadCache,
    forceReload: async () => {
      _cache = null;
      _ready = false;
      try { localStorage.removeItem(CACHE_KEY); } catch(e) {}
      return fetchRemote();
    },
    getAdmin: () => {
      const s = loadCache() || {};
      const a = s.admin || {};
      return {
        hidden:      a.hidden      || [],
        pinned:      a.pinned      || [],
        order:       a.order       || [],
        cats:        a.cats        || {},
        catList:     a.catList     || [],
        rotations:   a.rotations   || {},
        privateCats: a.privateCats || [],
      };
    },
    getHeroVideo: () => (loadCache() || {}).heroVideo || null,
    getHeroImage: () => (loadCache() || {}).heroImage || null,
    getReviews:   () => (loadCache() || {}).reviews   || [],
    getPricing:   () => (loadCache() || {}).pricing   || null,
  };
})(window);
