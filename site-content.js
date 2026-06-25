/* site-content.js — applies manager-edited text overrides to the live site.
 *
 * Architecture (decided 2026-06-25): JSON-overrides-on-load.
 *  - Editable elements are tagged in the HTML with  data-edit="<page>.<section>.<field>".
 *  - The manager edits them in admin.html → saved into gallery-settings.json under `content`
 *    (a flat map of "<page>.<section>.<field>" → plain text, "\n" = line break).
 *  - This script fetches that JSON and swaps the text in on load. Untouched fields keep the
 *    baked HTML default (best SEO, zero flicker). Only overridden fields are replaced.
 *
 * Values are stored as PLAIN TEXT and rendered escaped (XSS-safe) with "\n" → <br>.
 * Returning visitors get an instant apply from localStorage cache, then a fresh network refresh.
 */
(function (window, document) {
  'use strict';

  var PUBLIC_URL = 'https://yardendamri.co.il/gallery-settings.json';
  var CACHE_KEY  = 'site_content_v1';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nl2br(s) { return escapeHtml(s).replace(/\r?\n/g, '<br>'); }

  // Apply one value to one tagged element, honoring its kind (meta / title / normal).
  function applyTo(el, value) {
    if (value == null) return;
    var tag = el.tagName;
    if (tag === 'META')      { el.setAttribute('content', value); return; }
    if (tag === 'TITLE')     { el.textContent = value; document.title = value; return; }
    el.innerHTML = nl2br(value);
  }

  function applyContent(content) {
    if (!content || typeof content !== 'object') return;
    var nodes = document.querySelectorAll('[data-edit]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-edit');
      if (key && Object.prototype.hasOwnProperty.call(content, key)) {
        applyTo(el, content[key]);
      }
    }
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeCache(content) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(content || {})); } catch (e) {}
  }

  function run() {
    // 1) Instant apply from cache (no flicker for returning visitors).
    var cached = readCache();
    if (cached) applyContent(cached);

    // 2) Refresh from the network and re-apply.
    fetch(PUBLIC_URL + '?t=' + Date.now(), { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var content = (data && data.content) || {};
        applyContent(content);
        writeCache(content);
      })
      .catch(function () { /* offline → baked defaults / cache stand */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // Exposed so the admin live-preview can reuse the same renderer if needed.
  window.SiteContent = { apply: applyContent };
})(window, document);
