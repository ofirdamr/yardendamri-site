(function () {
  if (localStorage.getItem('cookie_consent')) return;

  var H = 48;

  var css =
    '#ck-top{' +
      'position:fixed;top:0;left:0;right:0;' +
      'z-index:10001;' +
      'height:' + H + 'px;' +
      'background:rgba(253,248,245,0.88);' +
      'backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);' +
      'border-bottom:1px solid rgba(184,144,96,.25);' +
      'display:flex;align-items:center;' +
      'padding:0 12px;gap:8px;' +
      'direction:rtl;font-family:inherit;' +
      'box-sizing:border-box;' +
      'animation:ck-drop .3s ease forwards;' +
    '}' +
    '@keyframes ck-drop{from{transform:translateY(-100%)}to{transform:translateY(0)}}' +
    '#ck-top-text{' +
      'color:rgba(26,26,26,.72);font-size:.72rem;' +
      'flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
    '}' +
    '#ck-top-text a{color:#B89060;text-decoration:underline;}' +
    '#ck-top-accept{' +
      'background:#B89060;color:#fff;border:none;border-radius:4px;' +
      'padding:5px 13px;font-size:.7rem;cursor:pointer;font-family:inherit;' +
      'white-space:nowrap;flex-shrink:0;' +
    '}' +
    '#ck-top-accept:hover{background:#9a7848;}' +
    '#ck-top-close{' +
      'background:transparent;color:rgba(26,26,26,.35);border:none;' +
      'padding:4px 8px;font-size:1.1rem;line-height:1;cursor:pointer;' +
      'font-family:inherit;flex-shrink:0;' +
    '}' +
    '#ck-top-close:hover{color:rgba(26,26,26,.75);}' +
    '#ck-top-accept:focus-visible,#ck-top-close:focus-visible{outline:2px solid #B89060;outline-offset:2px;}' +
    'body.has-ck nav[role="navigation"]{top:' + H + 'px !important;}';

  var st = document.createElement('style');
  st.id = 'ck-style';
  st.textContent = css;
  document.head.appendChild(st);

  document.body.classList.add('has-ck');

  var banner = document.createElement('div');
  banner.id = 'ck-top';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'הסכמה לשימוש בעוגיות');
  banner.innerHTML =
    '<span id="ck-top-text">🍪 האתר משתמש בעוגיות — <a href="/cookies-policy.html">מדיניות פרטיות</a></span>' +
    '<button id="ck-top-accept">אני מסכימה</button>' +
    '<button id="ck-top-close" aria-label="סגור ודחה" title="סגור">✕</button>';

  document.body.insertBefore(banner, document.body.firstChild);

  function loadGA() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-68XM6LS4HX';
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', 'G-68XM6LS4HX');
  }

  function dismiss(choice) {
    localStorage.setItem('cookie_consent', choice);
    if (choice === 'accepted') loadGA();
    banner.style.transition = 'transform .25s ease, opacity .2s ease';
    banner.style.transform = 'translateY(-100%)';
    banner.style.opacity = '0';
    document.body.classList.remove('has-ck');
    setTimeout(function () {
      banner.remove();
      var s = document.getElementById('ck-style');
      if (s) s.remove();
    }, 270);
  }

  document.getElementById('ck-top-accept').addEventListener('click', function () { dismiss('accepted'); });
  document.getElementById('ck-top-close').addEventListener('click', function () { dismiss('declined'); });
})();
