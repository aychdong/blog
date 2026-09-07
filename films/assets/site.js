/* 胶片颗粒：画一次，铺满全站，静止不动 */
(function () {
  "use strict";
  var el = document.getElementById("grain");
  if (!el) return;
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) { /* 静态的，保留 */ }
  var n = 180, c = document.createElement("canvas");
  c.width = c.height = n;
  var x = c.getContext("2d"), d = x.createImageData(n, n);
  for (var i = 0; i < d.data.length; i += 4) {
    var v = 128 + (Math.random() - 0.5) * 46;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 26;
  }
  x.putImageData(d, 0, 0);
  el.style.backgroundImage = "url(" + c.toDataURL() + ")";
})();

/* 卷 Rolls —— 联系表交互：放大镜 / 看片台 / 手风琴 / 位置指示条 */
(function () {
  "use strict";
  var D = window.FILMDATA;                 // {rid: {id,en,zh,fmt,place,frames:[{n,cap,pick}]}}
  if (!D) return;
  var BASE = document.documentElement.getAttribute("data-base") || "";
  var fine = window.matchMedia("(pointer:fine)").matches;
  var mid = function (rid, n) { return BASE + "assets/mid/" + rid + "-" + n + ".webp"; };

  /* ── 放大镜 ─────────────────────────────────────── */
  var loupe = document.getElementById("loupe");
  function loupeShow(rid, f, ev) {
    if (!loupe) return;
    loupe.innerHTML =
      '<img alt="" src="' + mid(rid, f.n) + '">' +
      '<div class="lm"><b>' + rid + "·" + f.n + "</b><span>" +
      (f.cap || (f.pick ? "选用" : "未选用")) + "</span></div>";
    loupe.style.display = "block";
    loupeMove(ev);
  }
  function loupeMove(ev) {
    if (!loupe || loupe.style.display !== "block") return;
    var w = loupe.offsetWidth, h = loupe.offsetHeight, p = 20;
    var x = ev.clientX + p, y = ev.clientY + p;
    if (x + w > innerWidth - 8) x = ev.clientX - w - p;
    if (y + h > innerHeight - 8) y = Math.max(8, ev.clientY - h - p);
    loupe.style.left = x + "px";
    loupe.style.top = y + "px";
  }
  function loupeHide() { if (loupe) loupe.style.display = "none"; }

  /* ── 看片台 ─────────────────────────────────────── */
  function showFrame(box, i) {
    var rid = box.getAttribute("data-roll");
    var r = D[rid], f = r.frames[i];
    if (!f) return;
    var v = box.querySelector(".viewer");
    v.hidden = false;
    v.setAttribute("data-i", i);
    var im = v.querySelector(".stage img");
    im.src = mid(rid, f.n);
    im.alt = f.cap || ("第 " + f.n + " 格");
    v.querySelector(".fno").textContent = rid + " · " + f.n;
    var cap = v.querySelector(".cap");
    cap.textContent = f.cap || "这一格没选进版面";
    cap.className = "cap" + (f.cap ? "" : " none");
    v.querySelector(".meta").innerHTML =
      '<span class="tag ' + (f.pick ? "on" : "off") + '">' +
      (f.pick ? "选用" : "未选用") + "</span><br>" +
      r.fmt + "<br>第 " + (i + 1) + " / " + r.frames.length + " 格<br>" + r.place;
    v.querySelector('[data-d="-1"]').disabled = i === 0;
    v.querySelector('[data-d="1"]').disabled = i === r.frames.length - 1;
    var fs = box.querySelectorAll(".fr");
    for (var j = 0; j < fs.length; j++) fs[j].classList.toggle("cur", +fs[j].dataset.i === i);
  }
  function closeViewer(box) {
    var v = box.querySelector(".viewer");
    if (v) v.hidden = true;
    var fs = box.querySelectorAll(".fr.cur");
    for (var j = 0; j < fs.length; j++) fs[j].classList.remove("cur");
  }

  /* ── 位置指示条 ─────────────────────────────────── */
  function wireMinimap(box) {
    var reel = box.querySelector(".reel"), mm = box.querySelector(".minimap");
    if (!reel || !mm) return;
    var bars = mm.children, n = bars.length;
    function sync() {
      var total = reel.scrollWidth;
      if (total <= 0) return;
      var a = reel.scrollLeft / total, b = (reel.scrollLeft + reel.clientWidth) / total;
      for (var i = 0; i < n; i++) {
        var p = i / n;
        bars[i].classList.toggle("vis", p >= a - 0.004 && p <= b);
      }
    }
    reel.addEventListener("scroll", sync, { passive: true });
    addEventListener("resize", sync);
    requestAnimationFrame(sync);
    box._sync = sync;
  }

  /* ── 接线 ───────────────────────────────────────── */
  var boxes = document.querySelectorAll("[data-roll]");
  Array.prototype.forEach.call(boxes, function (box) {
    var rid = box.getAttribute("data-roll");
    if (!D[rid]) return;
    wireMinimap(box);

    box.addEventListener("click", function (e) {
      var nb = e.target.closest("[data-d]");
      if (nb) {
        var v = box.querySelector(".viewer");
        showFrame(box, (+v.getAttribute("data-i")) + (+nb.dataset.d));
        return;
      }
      if (e.target.closest(".close")) { closeViewer(box); return; }
      var b = e.target.closest(".fr");
      if (!b) return;
      e.preventDefault();
      // 手风琴：打开这一卷，收起其它卷
      Array.prototype.forEach.call(boxes, function (o) { if (o !== box) closeViewer(o); });
      showFrame(box, +b.dataset.i);
      loupeHide();
      var v = box.querySelector(".viewer");
      if (v && v.getBoundingClientRect().bottom > innerHeight)
        v.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    box.addEventListener("keydown", function (e) {
      var v = box.querySelector(".viewer");
      if (!v || v.hidden) return;
      var i = +v.getAttribute("data-i"), n = D[rid].frames.length;
      if (e.key === "ArrowLeft")  { e.preventDefault(); showFrame(box, Math.max(0, i - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); showFrame(box, Math.min(n - 1, i + 1)); }
      if (e.key === "Escape")     { closeViewer(box); }
    });
    box.tabIndex = -1;

    if (fine) {
      var host = box.querySelector(".sheet, .reel");
      if (host) {
        host.addEventListener("pointerover", function (e) {
          var b = e.target.closest(".fr");
          if (b) loupeShow(rid, D[rid].frames[+b.dataset.i], e);
        });
        host.addEventListener("pointermove", loupeMove);
        host.addEventListener("pointerleave", loupeHide);
      }
    }
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") loupeHide(); });
  addEventListener("scroll", loupeHide, { passive: true });

  /* 版面里点红框跳到大图（正文内锚点） */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a.jump");
    if (!a) return;
    var h = a.getAttribute("href");
    if (!h || h.charAt(0) !== "#") return;
    var t = document.querySelector(h);
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: "smooth", block: "center" });
    t.classList.remove("hit"); void t.offsetWidth; t.classList.add("hit");
    history.replaceState(null, "", h);
  });
})();
