/* XCipher announcement banner — fetches the current brand announcement and shows
   a dismissible strip. Inserts into #xc-ann-slot if present, else at top of <body>. */
(function () {
  var DEV = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var HTTP = DEV ? "http://localhost:8787" : "https://xcipher.nazimtariq74074.workers.dev";
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function safeUrl(s){var v=String(s||"").trim();return /^https?:\/\//i.test(v)?v:"";}  // block javascript:/data: etc.
  fetch(HTTP + "/api/announce").then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.announcement) return;
    var a = d.announcement, seen;
    try { seen = localStorage.getItem("xc_ann_dismiss"); } catch (e) {}
    if (seen === a.id) return;
    var bar = document.createElement("div");
    bar.id = "xc-ann";
    bar.style.cssText = "position:relative;z-index:60;display:flex;align-items:center;gap:10px;justify-content:center;flex-wrap:wrap;padding:11px 42px 11px 16px;font:600 13.5px/1.4 Inter,system-ui,sans-serif;color:#04121a;background:linear-gradient(90deg,#46f3c6,#46c6ff);text-align:center";
    var lnk = safeUrl(a.link);
    bar.innerHTML = "<span>📢 " + esc(a.text) + "</span>" +
      (lnk ? ' <a href="' + esc(lnk) + '" target="_blank" rel="noopener noreferrer" style="color:#04121a;font-weight:800;text-decoration:underline">Open →</a>' : "") +
      '<button aria-label="Dismiss" style="position:absolute;right:9px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.18);border:0;color:#04121a;width:24px;height:24px;border-radius:50%;cursor:pointer;font:700 13px/1 sans-serif">✕</button>';
    bar.querySelector("button").onclick = function () { try { localStorage.setItem("xc_ann_dismiss", a.id); } catch (e) {} bar.remove(); };
    var slot = document.getElementById("xc-ann-slot");
    if (slot) slot.appendChild(bar); else document.body.insertBefore(bar, document.body.firstChild);
  }).catch(function () {});
})();
