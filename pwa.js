/* Xnipertools PWA — service worker registration + install button (Android/Chrome prompt + iOS guide).
   Self-injects its UI so pages only need to include this script. */
(function () {
  'use strict';

  /* ---- register service worker ---- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) return; // already installed — nothing to show

  /* don't nag: respect a recent dismissal (7 days) */
  try {
    var ts = parseInt(localStorage.getItem('xt_pwa_dismiss') || '0', 10);
    if (ts && (Date.now() - ts) < 7 * 24 * 60 * 60 * 1000) return;
  } catch (e) {}

  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var deferredPrompt = null;

  /* ---- styles ---- */
  var css = document.createElement('style');
  css.textContent =
    '#xtPwa{position:fixed;right:16px;bottom:16px;z-index:2000;display:none;align-items:center;gap:10px;' +
      'padding:11px 16px;border-radius:50px;cursor:pointer;border:none;font:600 .92rem Inter,system-ui,sans-serif;color:#fff;' +
      'background:linear-gradient(135deg,#6f97f5,#3f63d8);box-shadow:0 10px 30px rgba(63,99,216,.45);' +
      'transform:translateY(20px);opacity:0;transition:transform .3s,opacity .3s;padding-bottom:calc(11px + env(safe-area-inset-bottom,0px))}' +
    '#xtPwa.in{display:inline-flex;transform:none;opacity:1}' +
    '#xtPwa .x{margin-left:4px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;' +
      'background:rgba(255,255,255,.2);font-size:.9rem;line-height:1}' +
    '#xtPwa .x:hover{background:rgba(255,255,255,.32)}' +
    '#xtPwaOv{position:fixed;inset:0;z-index:2100;background:rgba(5,7,12,.74);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);' +
      'display:none;align-items:center;justify-content:center;padding:20px}' +
    '#xtPwaOv.in{display:flex}' +
    '#xtPwaOv .card{max-width:360px;width:100%;background:linear-gradient(180deg,#171a22,#0e1016);border:1px solid rgba(255,255,255,.14);' +
      'border-radius:20px;padding:26px 22px;text-align:center;color:#f2f4f8;box-shadow:0 24px 70px rgba(0,0,0,.6)}' +
    '#xtPwaOv h3{font:700 1.25rem Space Grotesk,Inter,sans-serif;margin:10px 0 14px}' +
    '#xtPwaOv ol{text-align:left;color:#b4b9c9;font-size:.95rem;line-height:1.7;margin:0 0 18px 20px}' +
    '#xtPwaOv .k{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;' +
      'background:rgba(94,139,255,.2);color:#bcd0ff;font-weight:700;font-size:.8rem;vertical-align:middle;margin:0 2px}' +
    '#xtPwaOv button{cursor:pointer;border:none;border-radius:12px;padding:12px 24px;font:600 .95rem Inter,sans-serif;color:#fff;' +
      'background:linear-gradient(135deg,#6f97f5,#3f63d8);width:100%}' +
    '[data-theme="light"] #xtPwaOv{background:rgba(20,26,40,.42)}' +
    '[data-theme="light"] #xtPwaOv .card{background:#fff;border-color:rgba(11,15,26,.12);color:#10131a;box-shadow:0 24px 70px rgba(16,24,40,.25)}' +
    '[data-theme="light"] #xtPwaOv ol{color:#444c5c}' +
    '[data-theme="light"] #xtPwaOv .k{background:rgba(59,107,239,.12);color:#2d54d8}';
  document.head.appendChild(css);

  /* ---- button ---- */
  var btn = document.createElement('button');
  btn.id = 'xtPwa';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Install Xnipertools app');
  btn.innerHTML = '<span>📲 Install app</span><span class="x" role="button" aria-label="Dismiss">×</span>';

  function show() { document.body.appendChild(btn); void btn.offsetWidth; btn.classList.add('in'); }
  function hide() { btn.classList.remove('in'); setTimeout(function () { if (btn.parentNode) btn.parentNode.removeChild(btn); }, 300); }
  function dismiss() { try { localStorage.setItem('xt_pwa_dismiss', String(Date.now())); } catch (e) {} hide(); }

  /* iOS Add-to-Home-Screen instructions */
  function iosGuide() {
    var ov = document.createElement('div');
    ov.id = 'xtPwaOv';
    ov.innerHTML =
      '<div class="card"><div style="font-size:2.4rem">📲</div><h3>Install Xnipertools</h3>' +
      '<ol><li>Tap the <b>Share</b> button <span class="k">↑</span> in Safari\'s toolbar.</li>' +
      '<li>Scroll and tap <b>Add to Home Screen</b> <span class="k">+</span>.</li>' +
      '<li>Tap <b>Add</b> — done! Open it like any app.</li></ol>' +
      '<button type="button">Got it 👍</button></div>';
    document.body.appendChild(ov);
    void ov.offsetWidth;
    ov.classList.add('in');
    function close() { ov.classList.remove('in'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 200); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('button').addEventListener('click', close);
  }

  btn.addEventListener('click', function (e) {
    if (e.target && e.target.classList.contains('x')) { dismiss(); return; }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; hide(); });
    } else if (isIOS) {
      iosGuide();
    }
  });

  /* Android / Chrome / Edge */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    show();
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    try { localStorage.setItem('xt_pwa_dismiss', String(Date.now())); } catch (e) {}
    hide();
  });

  /* iOS Safari: no beforeinstallprompt — show the guide button after a short delay */
  if (isIOS) {
    window.addEventListener('load', function () { setTimeout(show, 2500); });
  }
})();
