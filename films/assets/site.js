/* ── 转片：存哪儿、怎么摆得下 ───────────────────────────────────────
   方向存两层：content.json 里的 rot 是发布出去的，localStorage 是自己临时转的。
   转 90 度之后横竖对调，得缩一下才不会顶出框，所以要量一下容器。 */
(function () {
  "use strict";
  var KEY = "rolls-rot";
  window.__rotStore = function () {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
    catch (e) { return {}; }
  };
  window.__anaPref = function () {
    try { return localStorage.getItem("rolls-ana") !== "0"; } catch (e) { return true; }
  };
  window.__anaSave = function (on) {
    try { localStorage.setItem("rolls-ana", on ? "1" : "0"); } catch (e) {}
  };
  window.__rotSave = function (o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  };
  window.__rotFit = function (img) {
    if (!img) return;
    var r = +(img.getAttribute("data-rot") || 0);
    if (!r) { img.style.transform = ""; return; }
    var box = img.parentElement;
    if (!box) { img.style.transform = "rotate(" + r + "deg)"; return; }
    var cs = getComputedStyle(box);
    var bw = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var bh = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var w = img.offsetWidth, h = img.offsetHeight, sc = 1;
    if (r % 180 !== 0 && w && h && bw > 0 && bh > 0)
      sc = Math.max(.2, Math.min(1, Math.min(bw / h, bh / w)));
    img.style.transform = "rotate(" + r + "deg) scale(" + sc.toFixed(3) + ")";
  };
  /* 先出中图（960px，快），大图（2000px）下好了悄悄换上。同一格同一方向，换的时候不跳。
     屏幕小、或者浏览器开了省流量，就只用中图。 */
  window.__hi = function (img) {
    var box = img.parentElement || img, r = box.getBoundingClientRect();
    var need = Math.max(r.width, r.height) * (window.devicePixelRatio || 1);
    var sd = navigator.connection && navigator.connection.saveData;
    return !sd && need > 1100;
  };
  window.__prog = function (img, base, id, onReady) {
    var lo = base + "assets/mid/" + id + ".webp", hi = base + "assets/lg/" + id + ".webp";
    var tok = (img.__tok = (img.__tok || 0) + 1);
    img.onerror = null;
    img.onload = function () { if (onReady) onReady(); };
    img.src = lo;
    if (!window.__hi(img)) return;
    var p = new Image();
    p.onload = function () {
      var sw = function () {
        if (img.__tok !== tok) return;          /* 已经翻到别的格了 */
        img.src = hi;
      };
      if (p.decode) p.decode().then(sw, sw); else sw();
    };
    p.src = hi;
  };
  /* 窗口大小变了，缩放系数要重算 */
  var t;
  addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () {
      document.querySelectorAll(".vw .stage img[data-rot],.ltbox img[data-rot]")
        .forEach(function (im) { window.__rotFit(im); });
    }, 120);
  });
})();

/* 本地双击 html 打开（file://）时，指向文件夹的链接补上 index.html。
   不然 Safari 会把 rolls/ 这种地址丢给访达去开，看着像做坏了。
   线上是真服务器，这段不会生效。 */
(function () {
  "use strict";
  var FILE = location.protocol === "file:";
  window.__href = function (h) {
    return (FILE && h && /\/$/.test(h) && !/^[a-z]+:/i.test(h)) ? h + "index.html" : h;
  };
  if (!FILE) return;
  var as = document.querySelectorAll('a[href]');
  for (var i = 0; i < as.length; i++) {
    var h = as[i].getAttribute("href");
    if (h) as[i].setAttribute("href", window.__href(h));
  }
})();

/* 外观开关：暗房 / 画册 —— 记在浏览器里，下次还是你选的那个 */
(function () {
  "use strict";
  var root = document.documentElement;
  function apply(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("rolls-skin", t); } catch (e) {}
    var bs = document.querySelectorAll(".skin button");
    for (var i = 0; i < bs.length; i++)
      bs[i].setAttribute("aria-pressed", bs[i].getAttribute("data-skin") === t ? "true" : "false");
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".skin button");
    if (b) apply(b.getAttribute("data-skin"));
  });
  apply(root.getAttribute("data-theme") === "album" ? "album" : "dark");
})();

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
  /* 侧栏里的色彩分析：默认展开，点标题收起；开关全站共用一个记忆 */
  function drawVana(va) {
    var id = va.getAttribute("data-for");
    if (id && window.COLORLAB && window.COLORLAB.panel) window.COLORLAB.panel(va, id);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".vana"), function (va) {
    va.open = window.__anaPref();
    va.addEventListener("toggle", function () {
      window.__anaSave(va.open);
      if (va.open) drawVana(va);
    });
  });

  function showFrame(box, i) {
    var rid = box.getAttribute("data-roll");
    var r = D[rid], f = r.frames[i];
    if (!f) return;
    var v = box.querySelector(".viewer");
    v.hidden = false;
    v.setAttribute("data-i", i);
    var im = v.querySelector(".stage img");
    var st = window.__rotStore(), fid = rid + "-" + f.n;
    im.style.transform = "";
    im.setAttribute("data-rot", fid in st ? st[fid] : (+f.rot || 0));
    window.__prog(im, BASE, rid + "-" + f.n, function () { window.__rotFit(im); });
    im.alt = f.cap || ("第 " + f.n + " 格");
    v.querySelector(".fno").textContent = rid + " · " + f.n;
    var cap = v.querySelector(".cap");
    cap.textContent = f.cap || "";   /* 没写就空着，别让访客看到作者的提示 */
    cap.className = "cap" + (f.cap ? "" : " none");
    var vn = v.querySelector(".note");
    if (vn) vn.textContent = f.note || "";
    var va = v.querySelector(".vana");
    if (va) { va.setAttribute("data-for", rid + "-" + f.n); if (va.open) drawVana(va); }
    v.querySelector(".meta").innerHTML =
      '<span class="tag ' + (f.pick ? "on" : "off") + '">' +
      (f.pick ? "选用" : "未选用") + "</span><br>" +
      r.fmt + "<br>第 " + (i + 1) + " / " + r.frames.length + " 格<br>" + r.place;
    v.querySelector('[data-d="-1"]').disabled = i === 0;
    v.querySelector('[data-d="1"]').disabled = i === r.frames.length - 1;
    var fs = box.querySelectorAll(".fr");
    for (var j = 0; j < fs.length; j++) fs[j].classList.toggle("cur", +fs[j].dataset.i === i);
    markScale(box, i);
  }
  /* 刻度尺：把第 i 格的编号点亮（-1 = 全灭） */
  function markScale(box, i) {
    var sc = box.querySelectorAll(".scale i");
    for (var j = 0; j < sc.length; j++) sc[j].classList.toggle("on", j === i);
  }

  function closeViewer(box) {
    var v = box.querySelector(".viewer");
    if (v) v.hidden = true;
    var fs = box.querySelectorAll(".fr.cur");
    for (var j = 0; j < fs.length; j++) fs[j].classList.remove("cur");
    markScale(box, -1);
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
          if (b) { loupeShow(rid, D[rid].frames[+b.dataset.i], e); markScale(box, +b.dataset.i); }
        });
        host.addEventListener("pointermove", loupeMove);
        host.addEventListener("pointerleave", function () {
          loupeHide();
          var v = box.querySelector(".viewer");
          markScale(box, v && !v.hidden ? +v.getAttribute("data-i") : -1);
        });
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

/* ══════════════════════════════════════════════════════════════════
   全屏看片台 —— 一张片子压在灯箱上，方向键过片
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var BASE = document.documentElement.getAttribute("data-base") || "";
  var LIST = [];
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;

  if (window.VIEW && window.VIEW.length) {
    LIST = window.VIEW.slice();
  } else if (window.FILMDATA) {
    for (var rid in window.FILMDATA) {
      var r = window.FILMDATA[rid];
      for (var j = 0; j < r.frames.length; j++) {
        var f = r.frames[j];
        LIST.push({id: rid + "-" + f.n, rid: rid, n: f.n, cap: f.cap, b: f.b, x: f.x,
                   note: f.note, rot: f.rot,
                   pick: f.pick, place: r.place, roll: r.zh});
      }
    }
  }
  if (!LIST.length) return;

  var IX = {};
  for (var i = 0; i < LIST.length; i++) IX[LIST[i].id] = i;

  var src = function (f) { return BASE + "assets/mid/" + f.id + ".webp"; };   /* 预读用 */

  var box = null, cur = -1, prevHash = "", capOn = true;
  try { capOn = localStorage.getItem("rolls-cap") !== "0"; } catch (e) {}

  /* 工具条上的线描图标 */
  var ICON = {
    rot: '<svg viewBox="0 0 24 24"><path d="M5 12.5a7 7 0 1 0 2.2-5.1"/><path d="M5 4.2v4.3h4.3"/></svg>',
    vf: '<svg viewBox="0 0 24 24"><path d="M3.5 8V4.5H8M16 4.5h4.5V8M20.5 16v3.5H16M8 19.5H3.5V16"/><circle cx="12" cy="12" r="2.6"/></svg>',
    cap: '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h8.5"/></svg>',
    ana: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v8l6.9 4M12 12l-6.9 4"/></svg>',
    circ: '<svg viewBox="0 0 24 24"><path d="M9 4.6C4.2 6.4 3 12.4 5.8 16.3c3 4.1 10.2 4.4 13-.2 2.4-3.9.5-9.6-4.6-11-3-.8-6.4.2-8.6 2.6"/></svg>',
    pc: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1"/><rect x="14.5" y="8" width="3.5" height="4"/><path d="M6 10h5M6 13.5h5M6 16h7"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>'
  };
  /* 图标按钮：鼠标移上去马上出一个小标签（名字 + 快捷键）；手机上没有鼠标，就在图标下面写两个小字 */
  function tb(attr, key, label, short, inner) {
    return '<button type="button" class="ti" ' + attr + ' aria-label="' + label + "（" + key + '）">' + inner +
      '<span class="tl" aria-hidden="true"><b>' + label + "</b><i>" + short + "</i><kbd>" + key + "</kbd></span></button>";
  }

  function build() {
    box = document.createElement("div");
    box.className = "vw strip"; box.hidden = true; box.tabIndex = -1;
    box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "看片台");
    box.innerHTML =
      '<div class="stage">' +
        '<div class="vstrip" aria-hidden="true"><div class="vband"><i class="perf"></i><i class="perf lo"></i></div>' +
          '<div class="vl"></div><div class="vr"></div></div>' +
        '<button class="pv" type="button" aria-label="上一格">&#8592;</button>' +
        '<img alt="">' +
        '<div class="vink"></div>' +
        '<button class="nx" type="button" aria-label="下一格">&#8594;</button>' +
        /* 工具分三组：看 / 信息 / 收藏；关闭单独放 */
        '<div class="tools" role="toolbar" aria-label="看片台工具">' +
          '<div class="tg" data-g="look">' +
            tb('data-zoom aria-pressed="false"', "Z", "1:1 看颗粒", "颗粒", '<b class="zl">1:1</b>') +
            tb("data-rot", "T", "转 90°", "转", ICON.rot) +
            tb('data-vf aria-pressed="false"', "V", "取景器", "取景", ICON.vf) + "</div>" +
          '<div class="tg" data-g="info">' +
            tb('data-cap aria-pressed="true"', "C", "显示 / 隐藏说明", "说明", ICON.cap) +
            tb('data-ana aria-pressed="false"', "A", "色彩分析", "分析", ICON.ana) + "</div>" +
          '<div class="tg" data-g="keep">' +
            tb('data-vcirc aria-pressed="false"', "O", "圈这一格", "圈", ICON.circ) +
            tb("data-pc", "P", "做成明信片", "明信片", ICON.pc) + "</div>" +
          '<div class="tg" data-g="full">' + tb('data-full aria-pressed="false"', "F", "铺满全屏", "铺满", ICON.full) + "</div>" +
        "</div>" +
        '<div class="vclose"><button type="button" data-close aria-label="关闭（Esc）">' + ICON.close +
          '<span class="tl" aria-hidden="true"><b>关闭</b><i>关闭</i><kbd>Esc</kbd></span></button></div>' +
        '<div class="keys">&#8592; &#8594; 过片 · Z 看颗粒 · T 转 · V 取景器 · C 说明 · A 分析 · O 圈 · P 明信片 · Esc 退出</div>' +
        '<div class="rothint"></div>' +
        '<div class="zm" hidden><img alt="" draggable="false"><span class="zmi"></span></div>' +
      '</div>' +
      '<div class="ana"><button type="button" class="anatog"></button>' +
        '<div class="w"></div><div class="h"></div>' +
        '<div class="nums"></div></div>' +
      '<div class="bar"><span class="fno"></span>' +
        '<div class="txt"><p class="cap"></p><p class="note"></p></div>' +
        '<span class="meta"></span><div class="rail"></div></div>';
    document.body.appendChild(box);
    document.dispatchEvent(new CustomEvent("vw:build", {detail: box}));
    box.querySelector(".anatog").addEventListener("click", toggleAna);
    paintAna();

    var rail = box.querySelector(".rail");
    rail.innerHTML = LIST.map(function (f) {
      return '<i class="' + (f.pick ? "pick" : "") + '"></i>'; }).join("");

    box.querySelector(".pv").addEventListener("click", function () { go(cur - 1); });
    box.querySelector(".nx").addEventListener("click", function () { go(cur + 1); });
    box.querySelector("[data-close]").addEventListener("click", close);
    box.querySelector("[data-cap]").addEventListener("click", toggleCap);
    box.querySelector("[data-rot]").addEventListener("click", function () { rot(90); });
    box.querySelector("[data-ana]").addEventListener("click", toggleAna);
    box.querySelector("[data-full]").addEventListener("click", function () { full(box.classList.contains("embed")); });
    zoomWire();
    var st = box.querySelector(".stage");
    st.addEventListener("click", function (e) {
      if (e.target === e.currentTarget) close();
    });
    rail.addEventListener("click", function (e) {
      var bars = [].slice.call(rail.children), k = bars.indexOf(e.target);
      if (k >= 0) go(k);
    });
    /* 片条上暗着的邻格：点一下就过去 */
    box.querySelector(".vstrip").addEventListener("click", function (e) {
      var nb = e.target.closest(".nb"); if (nb) { e.stopPropagation(); go(+nb.dataset.i); }
    });
    /* 手机上用手指划：竖着拿时上下划（左右划留给系统的「返回」），横着拿时左右划 */
    var sx = null, sy = 0;
    st.addEventListener("touchstart", function (e) {
      if (box.classList.contains("zoomed") || box.classList.contains("embed") || e.touches.length > 1) { sx = null; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, {passive: true});
    st.addEventListener("touchend", function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (box.classList.contains("vert")) { if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx) * 1.3) go(cur + (dy < 0 ? 1 : -1)); }
      else if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) go(cur + (dx < 0 ? 1 : -1));
    }, {passive: true});
    if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(st);
    else addEventListener("resize", layout);
  }

  /* ── 片条：像在灯箱上把底片拉出来，当中这一格亮着，左右相邻的格暗着 ── */
  function vert() { return innerWidth <= 620 && innerHeight > innerWidth; }
  function nbFit(sp, cross, hz) {
    var im = sp.firstChild, r = +sp.dataset.rot || 0, W = im.naturalWidth || 2, H = im.naturalHeight || 3;
    if (!im.naturalWidth) { W = +sp.dataset.aw || 2; H = +sp.dataset.ah || 3; }
    var side = r % 180 !== 0, dw = side ? H : W, dh = side ? W : H, s = hz ? cross / dh : cross / dw;
    sp.style.width = (dw * s).toFixed(1) + "px"; sp.style.height = (dh * s).toFixed(1) + "px";
    im.style.width = (W * s).toFixed(1) + "px"; im.style.height = (H * s).toFixed(1) + "px";
    im.style.transform = "translate(-50%,-50%) rotate(" + r + "deg)";
  }
  function layout() {
    if (!box || box.hidden) return;
    var st = box.querySelector(".stage"), im = st.querySelector(":scope > img"), lay = st.querySelector(".vstrip");
    var hz = !vert();
    box.classList.toggle("vert", !hz);
    var S = st.getBoundingClientRect(), R = im.getBoundingClientRect();
    if (!R.width || !R.height || !im.naturalWidth) return;
    var x = R.left - S.left, y = R.top - S.top, w = R.width, h = R.height, cross = hz ? h : w;
    var m = Math.max(16, Math.min(60, cross * .095)), gap = Math.max(8, Math.min(20, cross * .028));
    var P = lay.style;
    P.setProperty("--m", m + "px"); P.setProperty("--gap", gap + "px");
    P.setProperty("--x", x + "px"); P.setProperty("--y", y + "px");
    P.setProperty("--w", w + "px"); P.setProperty("--h", h + "px");
    P.setProperty("--sw", S.width + "px"); P.setProperty("--sh", S.height + "px");
    box.style.setProperty("--sd", Math.min((hz ? w : h) + gap, innerWidth * .6) + "px");
    st.style.setProperty("--gx", (x - w * .08) + "px"); st.style.setProperty("--gy", (y - h * .08) + "px");
    st.style.setProperty("--gw", (w * 1.16) + "px"); st.style.setProperty("--gh", (h * 1.16) + "px");
    var aw = hz ? w : w, ah = h;
    if (lay.dataset.k !== String(cur)) {
      var side = function (dir) {
        var out = [];
        for (var j = 1; j <= 3; j++) {
          var f = LIST[cur + dir * j]; if (!f) break;
          out.push('<span class="nb" data-i="' + (cur + dir * j) + '" data-rot="' + rotOf(f) + '" data-aw="' + aw.toFixed(0) +
                   '" data-ah="' + ah.toFixed(0) + '" title="' + (f.rid + " · " + f.n) + '"><img alt="" draggable="false" src="' +
                   BASE + "assets/mid/" + f.id + '.webp"></span>');
        }
        return out.join("");
      };
      lay.querySelector(".vl").innerHTML = side(-1); lay.querySelector(".vr").innerHTML = side(1);
      lay.dataset.k = cur;
      [].forEach.call(lay.querySelectorAll(".nb img"), function (i) {
        i.addEventListener("load", function () { nbFit(i.parentNode, +lay.dataset.cross, !box.classList.contains("vert")); });
      });
    }
    lay.dataset.cross = cross;
    [].forEach.call(lay.querySelectorAll(".nb"), function (sp) { nbFit(sp, cross, hz); });
    box.dispatchEvent(new CustomEvent("vw:layout"));
  }

  /* 转片。先用文案里写死的方向，再用这台机器上自己转过的。
     真要永久改正，在「写文案」里转一下，那儿写进源文件，发布出去大家都看得到。 */
  var ROT = window.__rotStore(), anaOn = (function () { try { return localStorage.getItem("rolls-vwana") === "1"; } catch (e) { return false; } })();

  function rotOf(f) { return f ? (f.id in ROT ? ROT[f.id] : (+f.rot || 0)) : 0; }

  function rot(by) {
    var f = LIST[cur]; if (!f) return;
    zoomOff();
    ROT[f.id] = ((rotOf(f) + by) % 360 + 360) % 360;
    window.__rotSave(ROT);
    var im = box.querySelector(".stage > img");
    im.setAttribute("data-rot", ROT[f.id]);
    window.__rotFit(im);
    layout(); setTimeout(layout, 380);                             // 转完片条跟着重排
    box.dispatchEvent(new CustomEvent("vw:ready", {detail: f}));
    box.querySelector(".rothint").textContent = ROT[f.id]
      ? "转了 " + ROT[f.id] + "° · 只在这台机器上记着，想永久改正请在「写文案」里转"
      : "";
  }

  function paintAna() {
    box.classList.toggle("showana", anaOn);
    box.querySelector("[data-ana]").setAttribute("aria-pressed", anaOn ? "true" : "false");
    var t = box.querySelector(".anatog");
    t.innerHTML = anaOn ? '色彩分析<i>收起 &#9662;</i>' : '色彩分析<i>展开 &#9656;</i>';
    t.setAttribute("aria-expanded", anaOn ? "true" : "false");
  }
  function toggleAna() {
    anaOn = !anaOn;
    try { localStorage.setItem("rolls-vwana", anaOn ? "1" : "0"); } catch (e) {}
    paintAna();
    if (anaOn) drawAna();
  }
  function drawAna() {
    var f = LIST[cur];
    if (!f) return;
    if (!window.COLORLAB) {          /* 从链接直接打开时，色彩分析的代码还没就位：等一下再画 */
      setTimeout(function () { if (LIST[cur] === f && anaOn) drawAna(); }, 80); return;
    }
    var w = box.querySelector(".ana .w"), h = box.querySelector(".ana .h"),
        nm = box.querySelector(".ana .nums");
    window.COLORLAB.frame(f.id).then(function (d) {
      if (LIST[cur] !== f) return;                 /* 已经翻页了，别画上一格的 */
      if (!d) { w.innerHTML = ""; h.innerHTML = "";
                nm.textContent = "这一格没有分析数据"; return; }
      var L = window.COLORLAB;
      L.wheel(w, L.b64(d.f.hs), d.meta.hb, d.meta.sb,
              {alt: f.rid + " 卷第 " + f.n + " 格的色相分布"});
      L.rgbChart(h, L.b64(d.f.rgb), d.meta.rb);
      w.insertAdjacentHTML("beforeend", '<span class="anacap">色相 × 饱和度 · 往外越浓</span>');
      h.insertAdjacentHTML("beforeend", '<span class="anacap">红绿蓝三通道 · 左暗右亮</span>');
      nm.innerHTML = "明度 <b>" + d.f.v.toFixed(2) + "</b><br>饱和 <b>" +
                     d.f.s.toFixed(2) + "</b><br>有色 <b>" +
                     Math.round(d.f.n * 100) + "%</b>";
    });
  }

  /* ── 1:1 看颗粒 ──────────────────────────────────
     选用的格有原尺寸文件（每毫米 127 像素，约 3200 dpi）；其余的格用 2000px 版。
     Z / 双击 / 按钮：适屏 → 1:1 → 2:1 → 适屏。拖动、触控板双指滑动都能平移。
     「1:1」= 图上一个像素对屏幕上一个物理像素，这是看颗粒的标准看法。 */
  var zlev = 0, zx = 0, zy = 0, zw = 0, zh = 0, zr = 0, ztok = 0;
  function zq(sel) { return box.querySelector(sel); }
  function zbtn() {
    var b = zq("[data-zoom]");
    b.querySelector(".zl").textContent = ["1:1", "1:1", "2:1"][zlev];
    b.setAttribute("aria-pressed", zlev ? "true" : "false");
    b.querySelector(".tl b").textContent = ["1:1 看颗粒", "再按一次放到 2:1", "再按一次回到适屏"][zlev];
  }
  function zoomOff() {
    if (!box) return;
    ztok++;
    if (!zlev) return;
    zlev = 0;
    var z = zq(".zm"); z.hidden = true; z.classList.remove("px");
    z.querySelector("img").removeAttribute("src");
    box.classList.remove("zoomed"); zbtn();
  }
  function zclamp() {
    var S = zq(".stage"), W = S.clientWidth, H = S.clientHeight;
    var rw = zr % 180 ? zh : zw, rh = zr % 180 ? zw : zh;
    zx = rw <= W ? W / 2 : Math.min(rw / 2, Math.max(W - rw / 2, zx));
    zy = rh <= H ? H / 2 : Math.min(rh / 2, Math.max(H - rh / 2, zy));
    var im = zq(".zm img");
    im.style.width = zw + "px"; im.style.height = zh + "px";
    im.style.transform = "translate(" + (zx - zw / 2).toFixed(1) + "px," +
                         (zy - zh / 2).toFixed(1) + "px) rotate(" + zr + "deg)";
  }
  /* 屏幕上一个点（相对 stage）落在图上的哪儿（0-1），放大后让它留在原处 */
  function zpick(px, py) {
    var S = zq(".stage").getBoundingClientRect(), cx, cy, w, h, r;
    if (zlev) { cx = zx; cy = zy; w = zw; h = zh; r = zr; }
    else {
      var R = zq(".stage > img").getBoundingClientRect();
      r = rotOf(LIST[cur]);
      cx = R.left + R.width / 2 - S.left; cy = R.top + R.height / 2 - S.top;
      w = r % 180 ? R.height : R.width; h = r % 180 ? R.width : R.height;
    }
    var dx = px - cx, dy = py - cy, a = -r * Math.PI / 180;
    var ux = dx * Math.cos(a) - dy * Math.sin(a), uy = dx * Math.sin(a) + dy * Math.cos(a);
    return [Math.min(1, Math.max(0, .5 + ux / (w || 1))), Math.min(1, Math.max(0, .5 + uy / (h || 1)))];
  }
  function zinfo(f, lev, ready) {
    var t = lev === 1 ? "1:1" : "2:1";
    if (!ready) return t + " · 载入中…";
    return f.x ? t + " · 原尺寸 " + f.x[0] + "×" + f.x[1] + " · 约 3200 dpi"
               : t + " · 2000px 版 · 选用的格才有原尺寸";
  }
  function zoomSet(lev, px, py) {
    var f = LIST[cur]; if (!f) return;
    var S = zq(".stage"), main = zq(".stage > img");
    if (px == null) { px = S.clientWidth / 2; py = S.clientHeight / 2; }
    var uv = zpick(px, py), dpr = window.devicePixelRatio || 1, tok = ++ztok;
    var hi = BASE + "assets/" + (f.x ? "x/" : "lg/") + f.id + ".webp";
    var z = zq(".zm"), im = z.querySelector("img"), info = z.querySelector(".zmi");
    function place(nw, nh) {
      zw = nw / dpr * lev; zh = nh / dpr * lev; zr = rotOf(f);
      var ox = (uv[0] - .5) * zw, oy = (uv[1] - .5) * zh, a = zr * Math.PI / 180;
      zx = px - (ox * Math.cos(a) - oy * Math.sin(a));
      zy = py - (ox * Math.sin(a) + oy * Math.cos(a));
      zclamp();
    }
    function ready() {
      if (LIST[cur] !== f || !zlev) return;
      im.src = hi; info.textContent = zinfo(f, zlev, true);
      z.classList.toggle("px", zlev === 2);
    }
    zlev = lev; box.classList.add("zoomed"); z.hidden = false; zbtn();
    z.classList.toggle("px", lev === 2 && im.getAttribute("src") === hi);
    if (f.x) {                                  /* 尺寸事先知道：先拿手上的图顶着，原尺寸到了再换 */
      place(f.x[0], f.x[1]);
      if (im.getAttribute("src") === hi) { info.textContent = zinfo(f, lev, true); return; }
      im.src = main.currentSrc || main.src;
      info.textContent = zinfo(f, lev, false);
      var p = new Image(); p.onload = ready; p.src = hi;
    } else {
      var lg = (main.currentSrc || "").indexOf("/lg/") >= 0 && main.naturalWidth;
      if (lg) { place(main.naturalWidth, main.naturalHeight); ready(); return; }
      im.src = main.currentSrc || main.src;
      place(main.naturalWidth * 2000 / Math.max(main.naturalWidth, main.naturalHeight, 1),
            main.naturalHeight * 2000 / Math.max(main.naturalWidth, main.naturalHeight, 1));
      info.textContent = zinfo(f, lev, false);
      var q = new Image();
      q.onload = function () {
        if (tok !== ztok) return;
        place(q.naturalWidth, q.naturalHeight); ready();
      };
      q.src = hi;
    }
  }
  function zoomCycle() { if (zlev === 0) zoomSet(1); else if (zlev === 1) zoomSet(2); else zoomOff(); }
  function zoomWire() {
    var z = zq(".zm"), drag = null;
    zq("[data-zoom]").addEventListener("click", zoomCycle);
    zq(".stage > img").addEventListener("dblclick", function (e) {
      e.preventDefault();
      var S = zq(".stage").getBoundingClientRect();
      zoomSet(1, e.clientX - S.left, e.clientY - S.top);
    });
    z.addEventListener("dblclick", function (e) { e.preventDefault(); zoomOff(); });
    z.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      drag = {x: e.clientX, y: e.clientY, zx: zx, zy: zy, id: e.pointerId};
      try { z.setPointerCapture(e.pointerId); } catch (er) {}
      z.classList.add("drag");
    });
    z.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      zx = drag.zx + e.clientX - drag.x; zy = drag.zy + e.clientY - drag.y; zclamp();
    });
    var up = function () { drag = null; z.classList.remove("drag"); };
    z.addEventListener("pointerup", up); z.addEventListener("pointercancel", up);
    z.addEventListener("wheel", function (e) {
      e.preventDefault();
      if (e.ctrlKey) return;
      zx -= e.deltaX; zy -= e.deltaY; zclamp();
    }, {passive: false});
    addEventListener("resize", function () { if (zlev) zclamp(); });
  }

  function toggleCap() {
    capOn = !capOn;
    try { localStorage.setItem("rolls-cap", capOn ? "1" : "0"); } catch (e) {}
    box.querySelector(".bar").classList.toggle("off", !capOn);
    box.querySelector("[data-cap]").setAttribute("aria-pressed", capOn ? "true" : "false");
  }

  var slideDir = 0;
  function go(k) {
    if (k < 0 || k >= LIST.length) return;
    var f = LIST[k];
    slideDir = cur < 0 || still ? 0 : k > cur ? 1 : k < cur ? -1 : 0;
    cur = k;
    var im = box.querySelector(".stage > img");
    im.classList.remove("sw"); void im.offsetWidth; im.classList.add("sw");
    if (slideDir) im.classList.add("ld");
    zoomOff();
    im.style.transform = "";
    im.setAttribute("data-rot", rotOf(f));
    window.__prog(im, BASE, f.id, function () {
      window.__rotFit(im);
      im.classList.remove("ld");
      layout(); setTimeout(layout, 380);
      if (slideDir) {
        box.classList.remove("slide-n", "slide-p"); void box.offsetWidth;
        box.classList.add(slideDir > 0 ? "slide-n" : "slide-p"); slideDir = 0;
        clearTimeout(box._sl); box._sl = setTimeout(function () { box.classList.remove("slide-n", "slide-p"); }, 560);
      }
      box.dispatchEvent(new CustomEvent("vw:ready", {detail: f}));
    });
    im.onerror = function () { im.classList.remove("ld"); };
    box.dispatchEvent(new CustomEvent("vw:frame", {detail: f}));
    im.alt = f.cap || (f.rid + " 卷第 " + f.n + " 格");
    box.querySelector(".fno").textContent = f.rid + " · " + f.n;
    var cap = box.querySelector(".cap");
    cap.textContent = f.cap || "";   /* 没写就空着，别让访客看到作者的提示 */
    cap.className = "cap" + (f.cap ? "" : " none");
    box.querySelector(".note").textContent = f.note || "";
    box.querySelector(".rothint").textContent = "";
    if (anaOn) drawAna();
    box.querySelector(".meta").textContent =
      (f.roll || "") + (f.place ? "　" + f.place : "") + "　" + (k + 1) + " / " + LIST.length;
    box.querySelector(".pv").disabled = k === 0;
    box.querySelector(".nx").disabled = k === LIST.length - 1;
    var bars = box.querySelector(".rail").children;
    for (var j = 0; j < bars.length; j++) bars[j].classList.toggle("cur", j === k);
    try { history.replaceState(null, "", (box.classList.contains("embed") ? "#" : "#v=") + f.id); } catch (e) {}
    [k + 1, k - 1].forEach(function (n) {
      if (LIST[n]) { var p = new Image(); p.src = src(LIST[n]); }
    });
  }

  var pushed = false;
  function open(id) {
    if (!(id in IX)) return;
    if (!box) build();
    if (home) {                                                  // 看片台页：就在页面里的片条上过去
      go(IX[id]);
      if (box.classList.contains("embed")) home.scrollIntoView({block: "center", behavior: still ? "auto" : "smooth"});
      return;
    }
    if (box.hidden) {
      prevHash = location.hash && location.hash.indexOf("#v=") !== 0 ? location.hash : "";
      try {
        if (location.hash.indexOf("#v=") === 0) history.replaceState(null, "", location.pathname + location.search);
        history.pushState({vw: 1}, "", "#v=" + encodeURIComponent(id)); pushed = true;
      } catch (e) {}
      cur = -1;
    }
    box.querySelector(".bar").classList.toggle("off", !capOn);
    box.querySelector("[data-cap]").setAttribute("aria-pressed", capOn ? "true" : "false");
    box.hidden = false;
    document.documentElement.classList.add("vwon");
    requestAnimationFrame(function () { box.classList.add("in"); });
    document.documentElement.style.overflow = "hidden";
    go(IX[id]); box.focus();
  }

  function close() {
    if (!box || box.hidden) return;
    if (home) {                                                  // 看片台页：铺满时关 = 回到页面里；本来就在页面里就不动
      if (box.classList.contains("embed")) return;
      if (pushed) { pushed = false; history.back(); } else full(false);
      return;
    }
    if (pushed) { pushed = false; history.back(); return; }          // 退回打开前那一步，popstate 再来关
    shut();
    try { history.replaceState(null, "", location.pathname + location.search + prevHash); } catch (e) {}
  }
  function shut() {
    zoomOff();
    box.classList.remove("in");
    document.documentElement.style.overflow = "";
    document.documentElement.classList.remove("vwon");
    setTimeout(function () { box.hidden = true; }, 200);
  }
  addEventListener("popstate", function () {
    if (home) { if (box && !box.classList.contains("embed") && location.hash.indexOf("#v=") !== 0) { pushed = false; full(false); } return; }
    if (box && !box.hidden && location.hash.indexOf("#v=") !== 0) { pushed = false; shut(); }
  });

  /* ── 看片台页：片条直接嵌在页面里（home），「铺满」再进全屏，关掉回到页面里 ── */
  var home = null;
  function embed(el, id) {
    if (!box) build();
    home = el; el.appendChild(box);
    box.classList.add("embed", "homed", "in"); box.hidden = false;
    box.querySelector(".bar").classList.toggle("off", !capOn);
    box.querySelector("[data-cap]").setAttribute("aria-pressed", capOn ? "true" : "false");
    cur = -1; go(id in IX ? IX[id] : 0);
  }
  function full(on) {
    if (!home || !box) return;
    var isFull = !box.classList.contains("embed"), f = LIST[cur];
    if (!!on === isFull) return;
    zoomOff();
    if (on) {
      document.body.appendChild(box); box.classList.remove("embed");
      document.documentElement.style.overflow = "hidden"; document.documentElement.classList.add("vwon");
      try { history.pushState({vw: 1}, "", "#v=" + encodeURIComponent(f.id)); pushed = true; } catch (e) {}
      box.focus();
    } else {
      home.appendChild(box); box.classList.add("embed");
      document.documentElement.style.overflow = ""; document.documentElement.classList.remove("vwon");
      try { history.replaceState(null, "", "#" + f.id); } catch (e) {}
    }
    box.querySelector("[data-full]").setAttribute("aria-pressed", on ? "true" : "false");
    box.querySelector("[data-full] .tl b").textContent = on ? "回到页面里" : "铺满全屏";
    requestAnimationFrame(layout); setTimeout(layout, 120);
  }

  /* 点开的入口：精选集和版面的大图、联系表看片台里的那张 */
  document.addEventListener("click", function (e) {
    var fig = e.target.closest && e.target.closest("figure[data-v]");
    if (fig && !e.target.closest("figcaption")) { e.preventDefault(); open(fig.dataset.v); return; }
    var st = e.target.closest && e.target.closest(".viewer .stage img");
    if (st) {
      var vb = st.closest("[data-roll]"), vv = st.closest(".viewer");
      if (vb && vv) {
        var rid2 = vb.getAttribute("data-roll"),
            fr = window.FILMDATA && window.FILMDATA[rid2].frames[+vv.getAttribute("data-i")];
        if (fr) open(rid2 + "-" + fr.n);
      }
    }
  });

  addEventListener("keydown", function (e) {
    if (!box || box.hidden) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    var pcx = box.querySelector(".pc"); if (pcx && !pcx.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); if (zlev) zoomOff(); else close(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
    else if (e.key === "c" || e.key === "C") { e.preventDefault(); toggleCap(); }
    else if (e.key === "t" || e.key === "T") { e.preventDefault(); rot(90); }
    else if (e.key === "a" || e.key === "A") { e.preventDefault(); toggleAna(); }
    else if (e.key === "z" || e.key === "Z") { e.preventDefault(); zoomCycle(); }
    else if ((e.key === "f" || e.key === "F") && home && !e.metaKey && !e.ctrlKey) { e.preventDefault(); if (box.classList.contains("embed")) full(true); else close(); }
  });

  window.__vw = {open: open, close: close, zoomOff: zoomOff, rot: rotOf,
                 cur: function () { return LIST[cur]; }, box: function () { return box; },
                 has: function (id) { return id in IX; },
                 list: function () { return LIST; }, idx: function () { return cur; }, go: function (k) { go(k); },
                 jump: function (id) { if (id in IX) go(IX[id]); },
                 embed: embed, full: full, isEmbed: function () { return !!(box && box.classList.contains("embed")); }};

  function fromHash() {
    if (document.querySelector(".lt[data-embed]")) return;          // 看片台页：地址交给页面自己的那段
    var m = /^#v=(.+)$/.exec(location.hash);
    if (m && decodeURIComponent(m[1]) in IX) open(decodeURIComponent(m[1]));
  }
  fromHash();
  addEventListener("hashchange", fromHash);
})();


/* ══════════════════════════════════════════════════════════════════
   显影 —— 联系表默认是没显影的负片，一格一格变出来
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var sheet = document.querySelector(".sheet");
  if (!sheet) return;
  var host = sheet.closest("[data-roll]");
  var rid = host ? host.getAttribute("data-roll") : "x";
  var frs = [].slice.call(sheet.querySelectorAll(".fr"));
  var devB = document.querySelector("[data-dev]"),
      negB = document.querySelector("[data-neg]"),
      loupe = document.getElementById("loupe");
  var running = null;

  function developed() { return sheet.querySelectorAll(".fr.dev").length; }

  function setLabel() {
    if (!devB) return;
    var n = developed();
    devB.textContent = n >= frs.length ? "变回负片" : (n ? "显影余下的" : "显影");
    devB.classList.toggle("go", n < frs.length);
  }

  function stop() { if (running) { running.forEach(clearTimeout); running = null; } }

  function developAll() {
    stop();
    var todo = frs.filter(function (f) { return !f.classList.contains("dev"); });
    // 一格一格来，整卷大约十来秒；卷越长每格间隔越短，总时长不失控
    var gap = Math.max(90, Math.min(320, 9000 / Math.max(todo.length, 1)));
    devB.disabled = true; devB.textContent = "显影中…";
    running = todo.map(function (f, i) {
      return setTimeout(function () {
        f.classList.add("dev");
        if (i === todo.length - 1) {
          running = null; devB.disabled = false; setLabel();
          try { sessionStorage.setItem("rolls-dev-" + rid, "1"); } catch (e) {}
        }
      }, i * gap);
    });
  }

  function undevelop() {
    stop();
    frs.forEach(function (f) { f.classList.remove("dev"); });
    try { sessionStorage.removeItem("rolls-dev-" + rid); } catch (e) {}
    devB.disabled = false; setLabel();
  }

  if (devB) devB.addEventListener("click", function () {
    if (developed() >= frs.length) undevelop(); else developAll();
  });

  /* 直接看正片：跳过整个过程 */
  if (negB) negB.addEventListener("click", function () {
    var raw = sheet.classList.toggle("neg");      // 有 neg = 还在负片世界里
    negB.setAttribute("aria-pressed", raw ? "false" : "true");
    negB.textContent = raw ? "直接看正片" : "看负片";
    if (devB) devB.disabled = !raw;
  });

  /* 点某一格，单独显影那一格 */
  sheet.addEventListener("click", function (e) {
    var fr = e.target.closest && e.target.closest(".fr");
    if (!fr) return;
    if (sheet.classList.contains("neg") && !fr.classList.contains("dev")) {
      e.preventDefault(); e.stopPropagation();
      fr.classList.add("dev"); setLabel();
    }
  }, true);

  /* 放大镜跟着一起是负片 */
  sheet.addEventListener("pointerover", function (e) {
    var fr = e.target.closest && e.target.closest(".fr");
    if (!fr || !loupe) return;
    loupe.classList.toggle("neg",
      sheet.classList.contains("neg") && !fr.classList.contains("dev"));
  }, true);

  /* 同一次访问里显影过就不用再来一遍 */
  var done = false;
  try { done = sessionStorage.getItem("rolls-dev-" + rid) === "1"; } catch (e) {}
  if (done || matchMedia("(prefers-reduced-motion:reduce)").matches) {
    frs.forEach(function (f) { f.classList.add("dev"); });
  }
  setLabel();
})();

/* ══════════════════════════════════════════════════════════════════
   看片台页 —— 五卷连着装在台子上，片条就嵌在页面里
   上面一排卷号：点一下跳到那一卷的第一张选用；骰子 = 随便看（从全部格里抽一格）
   地址：#677-15R 停在那一格；#v=677-15R 直接铺满；#r 随机（旧的「随便看」页会跳到这里）
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var lt = document.querySelector(".lt[data-embed]");
  if (!lt || !window.__vw || !window.__vw.embed || !window.FILMDATA) return;
  var D = window.FILMDATA, V = window.__vw, home = lt.querySelector(".lthome");
  var chips = [].slice.call(lt.querySelectorAll(".ltchip")), dice = lt.querySelector("[data-rnd]");
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
  function firstPick(rid) {
    var r = D[rid]; if (!r) return null;
    var f = r.frames.filter(function (x) { return x.pick; })[0] || r.frames[0];
    return rid + "-" + f.n;
  }
  function rnd() {
    var L = V.list(), cur = V.cur(), f;
    do { f = L[Math.floor(Math.random() * L.length)]; } while (L.length > 1 && cur && f.id === cur.id);
    return f.id;
  }
  var h = location.hash, m, id = null, fullNow = false;
  if ((m = /^#v=(.+)$/.exec(h)) && V.has(decodeURIComponent(m[1]))) { id = decodeURIComponent(m[1]); fullNow = true; }
  else if ((m = /^#(\d+-[\w]+)$/.exec(h)) && V.has(m[1])) id = m[1];
  else if (h === "#r") id = rnd();
  if (!id) id = firstPick(Object.keys(D)[0]);
  V.embed(home, id);
  if (fullNow) V.full(true);

  function paint() {
    var f = V.cur();
    chips.forEach(function (c) { c.classList.toggle("on", !!f && c.getAttribute("data-roll") === f.rid); });
  }
  V.box().addEventListener("vw:frame", paint); paint();
  function roll() {
    V.jump(rnd());
    if (dice && !still) { dice.classList.remove("roll"); void dice.offsetWidth; dice.classList.add("roll"); }
  }
  lt.addEventListener("click", function (e) {
    var c = e.target.closest(".ltchip");
    if (c) { var i = firstPick(c.getAttribute("data-roll")); if (i) V.jump(i); return; }
    if (e.target.closest("[data-rnd]")) roll();
  });
  /* 同一页里改了地址（比如从别处点进来的 #v=） */
  addEventListener("hashchange", function () {
    var h = location.hash, m, cur = V.cur();
    if ((m = /^#v=(.+)$/.exec(h)) && V.has(decodeURIComponent(m[1]))) {
      if (!cur || cur.id !== decodeURIComponent(m[1])) V.jump(decodeURIComponent(m[1]));
      if (V.isEmbed()) V.full(true);
    } else if ((m = /^#(\d+-[\w]+)$/.exec(h)) && V.has(m[1])) { if (!cur || cur.id !== m[1]) V.jump(m[1]); }
    else if (h === "#r") roll();
  });
  addEventListener("keydown", function (e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var pc = document.querySelector(".vw .pc"); if (pc && !pc.hidden) return;
    if (e.key === "r" || e.key === "R") { e.preventDefault(); roll(); }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   色彩分析仪：移到点上报读数，点一下去那一格
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var dials = document.querySelectorAll(".dial");
  if (!dials.length) return;
  var BASE = document.documentElement.getAttribute("data-base") || "";
  var out = document.querySelector("[data-dialout]");
  Array.prototype.forEach.call(dials, function (d) {
    var rid = d.getAttribute("data-roll");
    d.addEventListener("pointerover", function (e) {
      var c = e.target.closest("circle.dot");
      if (!c || !out) return;
      out.innerHTML = '<span class="sw" style="background:' +
        getComputedStyle(c).fill + '"></span><span>' + rid + " · " +
        c.getAttribute("data-f") + "　" + c.getAttribute("data-hex") +
        "　彩度 " + c.getAttribute("data-c") + "</span>";
    });
    d.addEventListener("click", function (e) {
      var c = e.target.closest("circle.dot");
      if (!c) return;
      var id = rid + "-" + c.getAttribute("data-f");
      if (window.__vw) window.__vw.open(id);
      else location.href = (window.__href || function (x) { return x; })(
        BASE + "rolls/" + rid + "/") + "#v=" + id;
    });
  });
})();

/* ══════════════════════════════════════════════════════════════════
   索引：按卷筛、只看选用、按色相重排
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var grid = document.querySelector(".idx");
  if (!grid) return;
  var cels = [].slice.call(grid.children);
  var tabs = document.querySelectorAll(".idxbar .tb"),
      onlyB = document.querySelector("[data-only]"),
      sortB = document.querySelector("[data-sort]"),
      note = document.querySelector("[data-idxcount]");
  var filt = "*", only = false, byHue = false;
  var order = cels.slice();

  function apply() {
    if (byHue) {
      order = cels.slice().sort(function (a, b) {
        return (+a.getAttribute("data-h")) - (+b.getAttribute("data-h"));
      });
    } else { order = cels.slice(); }
    var frag = document.createDocumentFragment(), n = 0;
    order.forEach(function (c) {
      var ok = (filt === "*" || c.getAttribute("data-r") === filt) &&
               (!only || c.getAttribute("data-p") === "1");
      c.hidden = !ok; if (ok) n++;
      frag.appendChild(c);
    });
    grid.appendChild(frag);
    if (note) note.textContent = "显示 " + n + " 格" +
      (byHue ? " · 按色相排（红 → 黄 → 绿 → 青 → 蓝 → 品红）" : " · 按拍摄顺序") +
      (only ? " · 只看选用" : "");
  }

  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener("click", function () {
      filt = t.getAttribute("data-f");
      Array.prototype.forEach.call(tabs, function (o) { o.classList.toggle("on", o === t); });
      apply();
    });
  });
  if (onlyB) onlyB.addEventListener("click", function () {
    only = !only; onlyB.setAttribute("aria-pressed", only); apply();
  });
  if (sortB) sortB.addEventListener("click", function () {
    byHue = !byHue; sortB.setAttribute("aria-pressed", byHue); apply();
  });
  grid.addEventListener("click", function (e) {
    var c = e.target.closest(".cel");
    if (c && window.__vw) window.__vw.open(c.getAttribute("data-v"));
  });
  apply();
})();

/* ══════════════════════════════════════════════════════════════════
   航迹图：点一个地方，只亮那一卷
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var svg = document.querySelector(".usmap, .plotsvg");
  if (!svg) return;
  var BASE = document.documentElement.getAttribute("data-base") || "";
  var legend = document.querySelectorAll(".maplegend li, .mcs .mc");
  function lightUp(rid) {                 // rid 可以是一个卷号，也可以是好几个
    var set = rid ? [].concat(rid) : [];
    svg.classList.toggle("lit", set.length > 0);
    svg.querySelectorAll(".route").forEach(function (p) {
      p.classList.toggle("on", set.indexOf(p.getAttribute("data-roll")) >= 0);
    });
    svg.querySelectorAll(".pt").forEach(function (g) {
      var rs = (g.getAttribute("data-rolls") || "").split(" ");
      g.classList.toggle("on", rs.some(function (r) { return set.indexOf(r) >= 0; }));
    });
    Array.prototype.forEach.call(legend, function (li) {
      li.classList.toggle("on", set.indexOf(li.getAttribute("data-roll")) >= 0);
    });
  }
  Array.prototype.forEach.call(legend, function (li) {
    var rid = li.getAttribute("data-roll");
    li.addEventListener("pointerenter", function () { lightUp(rid); });
    li.addEventListener("pointerleave", function () { lightUp(null); });
    li.addEventListener("focus", function () { lightUp(rid); });
    li.addEventListener("blur", function () { lightUp(null); });
    if (li.tagName !== "A") li.addEventListener("click", function () {
      location.href = (window.__href || function (x) { return x; })(BASE + "rolls/" + rid + "/");
    });
  });
  svg.addEventListener("pointerover", function (e) {
    var g = e.target.closest(".pt");
    if (g) lightUp((g.getAttribute("data-rolls") || "").split(" "));
  });
  svg.addEventListener("pointerleave", function () { lightUp(null); });
  svg.addEventListener("click", function (e) {
    var g = e.target.closest(".pt");
    if (!g) return;
    var rid = (g.getAttribute("data-rolls") || "").split(" ")[0];
    if (rid) location.href = (window.__href || function (x) { return x; })(BASE + "rolls/" + rid + "/");
  });
})();

/* ══════════════════════════════════════════════════════════════════
   色彩分析 —— 画的是真实像素分布，不是「一张照片一个主色」
   每格取样约三万像素，按色相／饱和度落进 36×6 的格子里；
   另有红绿蓝三条亮度分布。数据在 assets/hist/<卷>.json。
   ══════════════════════════════════════════════════════════════════ */
window.COLORLAB = (function () {
  "use strict";
  var BASE = document.documentElement.getAttribute("data-base") || "";
  var cache = {}, pending = {};

  function b64(s) {
    var bin = atob(s), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function load(rid) {
    if (rid in cache) return Promise.resolve(cache[rid]);
    if (pending[rid]) return pending[rid];
    pending[rid] = fetch(BASE + "assets/hist/" + rid + ".json")
      .then(function (r) { if (!r.ok) throw new Error("no hist"); return r.json(); })
      .then(function (j) { cache[rid] = j; return j; })
      .catch(function () { cache[rid] = null; return null; });
    return pending[rid];
  }

  var NS = "http://www.w3.org/2000/svg";
  function el(n, at) {
    var e = document.createElementNS(NS, n);
    for (var k in at) e.setAttribute(k, at[k]);
    return e;
  }
  function txt(parent, at, s) {
    var t = el("text", at); t.textContent = s; parent.appendChild(t); return t;
  }
  /* 环形扇区。y 轴向下，所以外弧逆时针走 sweep=0 */
  function sector(cx, cy, r0, r1, a0, a1) {
    var P = function (r, a) { return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
    var A = P(r0, a0), B = P(r1, a0), C = P(r1, a1), D = P(r0, a1);
    return "M" + A[0].toFixed(2) + " " + A[1].toFixed(2) +
           "L" + B[0].toFixed(2) + " " + B[1].toFixed(2) +
           "A" + r1 + " " + r1 + " 0 0 0 " + C[0].toFixed(2) + " " + C[1].toFixed(2) +
           "L" + D[0].toFixed(2) + " " + D[1].toFixed(2) +
           (r0 > 0 ? "A" + r0 + " " + r0 + " 0 0 1 " + A[0].toFixed(2) + " " + A[1].toFixed(2) : "") + "Z";
  }
  /* 饱和度分档用的是 sqrt，画的时候要还原回去 */
  function satOf(j, SB) { var t = (j + 0.5) / SB; return t * t; }

  var HUELAB = [[0, "红"], [60, "黄"], [120, "绿"], [180, "青"], [240, "蓝"], [300, "品红"]];
  /* 和 build_site.py 里的 HUENAME 用同一套分界 */
  var HUENAME = [[15, "红"], [45, "橙"], [70, "黄"], [160, "绿"], [200, "青"],
                 [260, "蓝"], [320, "品红"], [361, "红"]];
  function hueName(h) {
    for (var i = 0; i < HUENAME.length; i++) if (h < HUENAME[i][0]) return HUENAME[i][1];
    return "红";
  }
  var SATWORD = ["几乎是灰", "很淡", "偏淡", "中等", "偏浓", "很浓"];
  function pct(x) { return x >= 0.1 ? Math.round(x * 100) + "%" : (x * 100).toFixed(1) + "%"; }

  /** 指到色轮上：说出这是什么颜色、占了多少 */
  function readout(svg, hs, HB, SB, geo, out) {
    var tot = 0, i;
    for (i = 0; i < hs.length; i++) tot += hs[i];
    if (!tot) return;
    var idle = out.innerHTML;
    function at(ev) {
      var b = svg.getBoundingClientRect();
      var x = (ev.clientX - b.left) / b.width * 200 - 100,
          y = 100 - (ev.clientY - b.top) / b.height * 200,
          r = Math.sqrt(x * x + y * y),
          deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360,
          hi = Math.min(HB - 1, Math.floor(deg / 360 * HB)),
          lo = hi * 360 / HB, up = (hi + 1) * 360 / HB, band = 0, j;
      var sw = '<i class="sw" style="background:hsl(' + ((hi + .5) * 360 / HB).toFixed(0) +
               ' 70% 52%)"></i>';
      if (r < geo.rin) { out.innerHTML = "中间是灰：几乎没颜色的像素（饱和度很低）不画在轮上"; return; }
      if (r > geo.ring) { out.innerHTML = idle; return; }
      for (j = 0; j < SB; j++) band += hs[hi * SB + j];
      if (r > geo.rout) {
        out.innerHTML = sw + "<span><b>" + hueName((lo + up) / 2) + "</b> " + lo + "°–" + up +
                        "° · 这一整条扇区占有色像素的 <b>" + pct(band / tot) + "</b></span>";
        return;
      }
      var sj = Math.max(0, Math.min(SB - 1, Math.floor((r - geo.rin) / (geo.rout - geo.rin) * SB)));
      out.innerHTML = sw + "<span><b>" + hueName((lo + up) / 2) + "</b> " + lo + "°–" + up + "° · " +
                      SATWORD[Math.min(SATWORD.length - 1, sj)] + " — 这一小格占 <b>" +
                      pct(hs[hi * SB + sj] / tot) + "</b>，整条扇区占 " + pct(band / tot) + "</span>";
    }
    svg.addEventListener("pointermove", at);
    svg.addEventListener("pointerdown", at);
    svg.addEventListener("pointerleave", function () { out.innerHTML = idle; });
  }

  /** 色轮：一圈是色相，往外是越来越浓，格子的浓淡 = 这个颜色占多少像素 */
  function wheel(box, hs, HB, SB, opt) {
    opt = opt || {};
    var mini = !!opt.mini, c = 100, RIN = 15;
    var ROUT = mini ? 78 : 70, RING = mini ? 5 : 9;
    var svg = el("svg", {viewBox: "0 0 200 200", "class": "cwheel",
                         role: "img", "aria-label": opt.alt || "色相与饱和度分布"});
    var max = 0, i, j;
    for (i = 0; i < hs.length; i++) if (hs[i] > max) max = hs[i];
    if (!max) max = 1;

    var g = el("g", {"class": "cells"});
    for (i = 0; i < HB; i++) {
      var a0 = i / HB * Math.PI * 2, a1 = (i + 1) / HB * Math.PI * 2;
      for (j = 0; j < SB; j++) {
        var v = hs[i * SB + j] / max;
        if (v <= 0.003) continue;
        var r0 = RIN + (ROUT - RIN) * (j / SB), r1 = RIN + (ROUT - RIN) * ((j + 1) / SB);
        g.appendChild(el("path", {
          d: sector(c, c, r0, r1, a0, a1),
          fill: "hsl(" + ((i + 0.5) * 360 / HB).toFixed(1) + " " +
                Math.round(satOf(j, SB) * 90 + 10) + "% 52%)",
          "fill-opacity": Math.pow(v, 0.42).toFixed(3)}));
      }
    }
    svg.appendChild(g);

    /* 两道浅圈，标出「饱和度走到哪儿了」 */
    var gl = el("g", {"class": "grid"});
    [1 / 3, 2 / 3].forEach(function (t) {
      gl.appendChild(el("circle", {cx: c, cy: c, r: (RIN + (ROUT - RIN) * t).toFixed(1),
                                   "class": "gridline"}));
    });
    gl.appendChild(el("circle", {cx: c, cy: c, r: RIN, "class": "gridline"}));
    svg.appendChild(gl);

    /* 外圈连续色环 —— 一眼知道每个方向是什么颜色 */
    var ring = el("g", {"class": "huering"});
    for (i = 0; i < 96; i++) {
      ring.appendChild(el("path", {
        d: sector(c, c, ROUT + 3, ROUT + 3 + RING,
                  i / 96 * Math.PI * 2, (i + 1.03) / 96 * Math.PI * 2),
        fill: "hsl(" + (i * 3.75 + 1.9).toFixed(1) + " 84% 55%)"}));
    }
    svg.appendChild(ring);
    if (!mini) {
      HUELAB.forEach(function (p) {
        var a = p[0] * Math.PI / 180, r = ROUT + RING + 14;
        txt(svg, {x: (c + r * Math.cos(a)).toFixed(1),
                  y: (c - r * Math.sin(a)).toFixed(1), "class": "wl"}, p[1]);
      });
      txt(svg, {x: c, y: c + 3, "class": "wc"}, "灰");
    }
    box.innerHTML = "";
    box.appendChild(svg);
    var out = opt.out || (box.closest(".dialbox") &&
                          box.closest(".dialbox").querySelector("[data-dialout]"));
    if (out) readout(svg, hs, HB, SB, {rin: RIN, rout: ROUT, ring: ROUT + 3 + RING + 6}, out);
    return svg;
  }

  /** RGB 直方图：三条曲线叠在一起，横轴是暗→亮 */
  function rgbChart(box, rgb, RB) {
    var W = 260, H = 96, PAD = 2;
    var svg = el("svg", {viewBox: "0 0 " + W + " " + H, "class": "crgb",
                         role: "img", "aria-label": "红绿蓝三个通道的明暗分布"});
    var cols = [["#E4604F", 0], ["#5FB87A", RB], ["#5C8FD6", RB * 2]];
    /* 最暗、最亮那两档常是扫描黑边或死白，高得离谱，会把整条曲线压扁。
       定高时不算它俩，超出的部分顶格画——顶格本身就是「这里有死黑／死白」的提示。 */
    var max = 1;
    for (var ch = 0; ch < 3; ch++)
      for (var i = 1; i < RB - 1; i++) if (rgb[ch * RB + i] > max) max = rgb[ch * RB + i];
    [0.25, 0.5, 0.75].forEach(function (t) {
      svg.appendChild(el("line", {x1: (W * t).toFixed(1), y1: 0,
                                  x2: (W * t).toFixed(1), y2: H - PAD, "class": "gl"}));
    });
    svg.appendChild(el("line", {x1: 0, y1: H - PAD, x2: W, y2: H - PAD, "class": "ax"}));
    cols.forEach(function (c) {
      var d = "M0 " + (H - PAD);
      for (var k = 0; k < RB; k++) {
        var x = k / (RB - 1) * W,
            y = H - PAD - Math.min(1, rgb[c[1] + k] / max) * (H - PAD * 2);
        d += "L" + x.toFixed(1) + " " + y.toFixed(1);
      }
      d += "L" + W + " " + (H - PAD) + "Z";
      svg.appendChild(el("path", {d: d, fill: c[0], "fill-opacity": ".24",
                                  stroke: c[0], "stroke-width": "1.2",
                                  "stroke-linejoin": "round"}));
    });
    box.innerHTML = "";
    box.appendChild(svg);
  }

  return {
    load: load, b64: b64, wheel: wheel, rgbChart: rgbChart,
    /** 把一个 .dial 盒子填上这一卷的色轮 */
    fillRoll: function (box) {
      var rid = box.getAttribute("data-roll");
      return load(rid).then(function (j) {
        if (!j) return null;
        wheel(box, b64(j.roll), j.hb, j.sb,
              {mini: box.classList.contains("mini"),
               alt: rid + " 卷全部像素的色相与饱和度分布"});
        return j;
      });
    },
    /** 侧栏面板：root 里要有 .w .h .nums，可选 .anaout 放悬停读数 */
    panel: function (root, id) {
      return window.COLORLAB.frame(id).then(function (d) {
        if (root.getAttribute("data-for") !== id) return;      // 已经翻到别的格了
        var w = root.querySelector(".w"), h = root.querySelector(".h"),
            nm = root.querySelector(".nums"), out = root.querySelector(".anaout");
        if (!d) { w.innerHTML = ""; h.innerHTML = ""; nm.textContent = "这一格没有分析数据"; return; }
        if (out) out.innerHTML = "移到色轮上看是哪个颜色";
        wheel(w, b64(d.f.hs), d.meta.hb, d.meta.sb, {alt: id + " 这一格的色相分布", out: out});
        rgbChart(h, b64(d.f.rgb), d.meta.rb);
        nm.innerHTML = "<span>明度 <b>" + d.f.v.toFixed(2) + "</b></span><span>饱和 <b>" +
                       d.f.s.toFixed(2) + "</b></span><span>有色 <b>" +
                       Math.round(d.f.n * 100) + "%</b></span>";
      });
    },
    /** 单独一格 */
    frame: function (id) {
      var p = id.indexOf("-"), rid = id.slice(0, p), n = id.slice(p + 1);
      return load(rid).then(function (j) {
        return j && j.frames[n] ? {meta: j, f: j.frames[n]} : null;
      });
    }
  };
})();

/* 每卷页和卷列表上的色轮：滚到了才去取数据 */
(function () {
  "use strict";
  var boxes = document.querySelectorAll(".dial[data-roll]");
  if (!boxes.length || !window.COLORLAB) return;
  if (!("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(boxes, function (b) { window.COLORLAB.fillRoll(b); });
    return;
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      window.COLORLAB.fillRoll(e.target);
    });
  }, {rootMargin: "240px"});
  Array.prototype.forEach.call(boxes, function (b) { io.observe(b); });
})();


/* 版面大图的模糊占位（20px 的缩略图拉大当底色）：图到了就撤掉 */
(function () {
  "use strict";
  Array.prototype.forEach.call(document.querySelectorAll("img[data-lq]"), function (im) {
    function off() { im.style.backgroundImage = ""; im.removeAttribute("data-lq"); }
    if (im.complete && im.naturalWidth) off(); else im.addEventListener("load", off);
  });
})();


/* ══════════════════════════════════════════════════════════════════
   手写的圈（第三轮）：干净、精致，每一格又不完全一样。
   做法参考：
   · perfect-freehand：一笔的粗细随「力道」平滑变化，起笔、收笔收尖，没有毛刺
   · Rough.js：同一个形状描两遍，两遍不完全重合；首尾不刚好接上
   · 圆相（ensō）：一笔、不封口、收笔带飞白
   · 摄影师在联系表上用红色油性铅笔（Chinagraph）圈片 / 框片
   变化只放在「大的地方」：歪一点、椭一点、从哪儿起笔、收尾多绕多少；线本身是顺的。
   style: "grease" 油性笔一圈 | "twice" 描两遍 | "enso" 圆相 | "box" 框片
   ══════════════════════════════════════════════════════════════════ */
window.INK = (function () {
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rnd(seed) { var s = seed || 1; return function () { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
  var f1 = function (v) { return v.toFixed(2); };
  var R = function (r, a, b) { return a + (b - a) * r(); };
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  var easeOut = function (x) { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  var easeInOut = function (x) { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  /* 一圈：椭圆 + 很轻的鸡蛋形 + 一点点往外绕（收尾从起笔外侧擦过去） */
  function loop(r, W, H, pad, o) {
    var cx = W / 2 + pad + R(r, -.02, .02) * W, cy = H / 2 + pad + R(r, -.02, .02) * H;
    var rx = W / 2 * o.kx * R(r, .98, 1.03), ry = H / 2 * o.ky * R(r, .98, 1.03);
    var tilt = R(r, -1, 1) * o.tilt * Math.PI / 180;
    var e1 = R(r, .012, .035), p1 = r() * 6.283, e2 = R(r, 0, .018), p2 = r() * 6.283;
    var dir = o.dir || -1, a0 = (o.a0 != null ? o.a0 : R(r, -80, -35)) * Math.PI / 180;
    var turns = o.turns, n = Math.round(140 * turns), pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, th = a0 + dir * Math.PI * 2 * turns * t;
      var k = 1 + e1 * Math.cos(th - p1) + e2 * Math.cos(2 * th - p2) + o.spiral * (t - .5);
      var x = Math.cos(th) * rx * k, y = Math.sin(th) * ry * k;
      pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt), t]);
    }
    return pts;
  }
  /* 框：圆角矩形，四条边微微鼓出来，收尾沿上边多走一段 */
  function boxPath(r, W, H, pad, o) {
    var S = Math.min(W, H), m = S * o.m, x0 = pad - m, y0 = pad - m, w = W + 2 * m, h = H + 2 * m, rr = S * o.rad;
    var base = [], seg = function (ax, ay, bx, by, bow) {           // 一条边：两端接圆角，中间鼓一点
      for (var i = 0; i < 24; i++) {
        var u = i / 24, nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny) || 1, b = bow * Math.sin(Math.PI * u);
        base.push([ax + (bx - ax) * u + nx / L * b, ay + (by - ay) * u + ny / L * b]);
      }
    };
    var arc = function (cx, cy, a1) { for (var i = 0; i < 10; i++) { var a = a1 + i / 10 * Math.PI / 2; base.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } };
    var bw = function () { return -S * R(r, .006, .02); };
    seg(x0 + rr, y0, x0 + w - rr, y0, bw()); arc(x0 + w - rr, y0 + rr, -Math.PI / 2);
    seg(x0 + w, y0 + rr, x0 + w, y0 + h - rr, bw()); arc(x0 + w - rr, y0 + h - rr, 0);
    seg(x0 + w - rr, y0 + h, x0 + rr, y0 + h, bw()); arc(x0 + rr, y0 + h - rr, Math.PI / 2);
    seg(x0, y0 + h - rr, x0, y0 + rr, bw()); arc(x0 + rr, y0 + rr, Math.PI);
    /* 沿周长走 turns 圈，一边走一边微微往外偏（收尾不和起笔重合） */
    var cum = [0];
    for (var j = 1; j < base.length; j++) cum.push(cum[j - 1] + Math.hypot(base[j][0] - base[j - 1][0], base[j][1] - base[j - 1][1]));
    var P = cum[cum.length - 1] + Math.hypot(base[0][0] - base[base.length - 1][0], base[0][1] - base[base.length - 1][1]);
    var st = R(r, .02, .1) * P, total = P * o.turns, n = 260, pts = [], ccx = pad + W / 2, ccy = pad + H / 2, ti = R(r, -1, 1) * o.tilt * Math.PI / 180;
    for (var i = 0; i <= n; i++) {
      var t = i / n, d = (st + total * t) % P, k = 0;
      while (k < cum.length - 1 && cum[k + 1] < d) k++;
      var a = base[k], b = base[(k + 1) % base.length], sl = (cum[k + 1] || P) - cum[k], u = sl ? (d - cum[k]) / sl : 0;
      var x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, g = 1 + o.spiral * (t - .5);
      x = ccx + (x - ccx) * g; y = ccy + (y - ccy) * g;
      var dx = x - ccx, dy = y - ccy;
      pts.push([ccx + dx * Math.cos(ti) - dy * Math.sin(ti), ccy + dx * Math.sin(ti) + dy * Math.cos(ti), t]);
    }
    return pts;
  }
  /* 中线 → 两侧轮廓（宽度函数给每一点的整宽） */
  function edges(pts, wf, off) {
    var Lf = [], Rt = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[Math.max(0, i - 2)], q = pts[Math.min(pts.length - 1, i + 2)];
      var tx = q[0] - p[0], ty = q[1] - p[1], d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      var w = Math.max(.25, wf(pts[i][2], i)) / 2, c = (off || 0) * w * 2;
      var x = pts[i][0] - ty * c, y = pts[i][1] + tx * c;
      Lf.push([x - ty * w, y + tx * w]); Rt.push([x + ty * w, y - tx * w]);
    }
    return Lf.concat(Rt.reverse());
  }
  function smooth(all, close) {
    var d = "M" + f1(all[0][0]) + " " + f1(all[0][1]);
    for (var j = 1; j < all.length - 1; j++) {
      var mx = (all[j][0] + all[j + 1][0]) / 2, my = (all[j][1] + all[j + 1][1]) / 2;
      d += "Q" + f1(all[j][0]) + " " + f1(all[j][1]) + " " + f1(mx) + " " + f1(my);
    }
    return d + (close ? "Z" : "");
  }
  /* 力道：起笔很快压下去，中段只有很缓的起伏，收笔慢慢提起来（像 perfect-freehand 的 taper） */
  function press(r, tin, tout, sway) {
    var ph = r() * 6.283;
    return function (t) {
      return (.18 + .82 * easeOut(t / tin)) * (.1 + .9 * easeOut((1 - t) / tout)) * (1 + sway * Math.sin(t * 6.283 * 1.3 + ph));
    };
  }
  var uid = 0;
  function make(style, id, W, H, draw) {
    var r = rnd(hash(style + ":" + id) || 7), S = Math.min(W, H), pad = S * .2, paths = [], mask = [], maskW;
    var Sw = Math.sqrt(S * 120);                                     // 线宽按尺寸的平方根长：小格不细得看不见，大图不粗得吓人
    if (style === "twice") {                                       /* 描两遍：两道细线，不完全重合 */
      var o1 = {kx: 1.14, ky: 1.1, tilt: 6, turns: 1.02, spiral: .03}, pa = loop(r, W, H, pad, o1);
      var pb = loop(r, W, H, pad, {kx: 1.18, ky: 1.13, tilt: 9, turns: .96, spiral: .05, a0: R(r, 150, 210)});
      var bw = Sw * .02, prA = press(r, .06, .12, .05), prB = press(r, .08, .2, .05);
      paths.push(smooth(edges(pa, function (t) { return bw * prA(t); }), true));
      paths.push(smooth(edges(pb, function (t) { return bw * .8 * prB(t); }), true));
      mask = [pa, pb]; maskW = bw * 3;
    } else if (style === "enso") {                                 /* 圆相：一笔、不封口、收笔飞白 */
      var pe = loop(r, W, H, pad, {kx: 1.16, ky: 1.1, tilt: 10, turns: R(r, .86, .92), spiral: .04, a0: R(r, 110, 160)});
      var be = Sw * .055, pw = function (t) { return (.35 + .65 * easeOut(t / .08)) * (1 - .35 * easeInOut((t - .3) / .7)); };
      var cut = pe.findIndex(function (p) { return p[2] >= .82; });
      paths.push(smooth(edges(pe.slice(0, cut + 1), function (t) { return be * pw(t) * (1 - .15 * easeOut((t - .7) / .12)); }), true));
      [[-.32, .96], [-.1, 1], [.14, .93], [.34, .88]].forEach(function (b) {   // 收笔散成几缕
        var sub = pe.slice(cut - 1).filter(function (p) { return p[2] <= b[1]; });
        if (sub.length < 3) return;
        paths.push(smooth(edges(sub, function (t) { return be * pw(t) * .24 * (1 - .9 * easeInOut((t - (b[1] - .1)) / .1)); }, b[0]), true));
      });
      mask = [pe]; maskW = be * 1.4;
    } else if (style === "box") {                                  /* 框片：油性笔沿格子框一圈 */
      var pbx = boxPath(r, W, H, pad, {m: .07, rad: .14, turns: 1.08, spiral: .025, tilt: 1.5});
      var bb = Sw * .042, pr = press(r, .05, .12, .06);
      paths.push(smooth(edges(pbx, function (t) { return bb * pr(t); }), true));
      mask = [pbx]; maskW = bb * 1.6;
    } else {                                                       /* grease 油性笔一圈：收尾从起笔外侧擦过去 */
      var pg = loop(r, W, H, pad, {kx: 1.15, ky: 1.1, tilt: 8, turns: R(r, 1.06, 1.12), spiral: .06});
      var bg = Sw * .045, pr2 = press(r, .05, .16, .06);
      paths.push(smooth(edges(pg, function (t) { return bg * pr2(t); }), true));
      mask = [pg]; maskW = bg * 1.6;
    }
    var id2 = "ink" + (++uid), VW = W + pad * 2, VH = H + pad * 2;
    var mk = draw ? '<mask id="' + id2 + '" maskUnits="userSpaceOnUse">' + mask.map(function (m, i) {
      return '<path d="' + smooth(m, false) + '" pathLength="1" class="ink-m" style="stroke-width:' + f1(maskW) + "px" +
        (i ? ";animation-delay:.55s" : "") + '"/>'; }).join("") + "</mask>" : "";
    return {pad: pad, svg: '<svg class="ink ink-' + style + (draw ? " draw" : "") + '" viewBox="0 0 ' + f1(VW) + " " + f1(VH) +
      '" aria-hidden="true">' + mk + '<g' + (draw ? ' mask="url(#' + id2 + ')"' : "") + ' filter="url(#ink-' + style + ')">' +
      paths.map(function (d) { return '<path class="ink-f" d="' + d + '"/>'; }).join("") + "</g></svg>"};
  }
  /* 质感：油性笔 / 框片是蜡质的细颗粒，铅笔两遍颗粒更粗一点，圆相只有很轻的墨晕 */
  var wax = function (id, f, a) {
    return '<filter id="' + id + '" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="' + f + '" numOctaves="2" seed="4" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ' + a + '" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>';
  };
  var defs = wax("ink-grease", 1.5, "-.55 1.18") + wax("ink-box", 1.5, "-.55 1.18") + wax("ink-twice", 1.9, "-.9 1.3") +
    '<filter id="ink-enso" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="9" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale=".5" xChannelSelector="R" yChannelSelector="G"/></filter>';
  return {make: make, defs: defs};
})();


/* ══════════════════════════════════════════════════════════════════
   好玩的几样
   · 进卷先拉片：第一次打开一卷，胶片从暗盒里拉出来，再展开成联系表
   · 张数：精选页右边一根细刻度尺，往下看一张走一格
   · 圈片：访客用红笔圈喜欢的格（像随手签名的一笔），记在自己的浏览器里，可以发链接给别人
   · 取景器模式、做成明信片（七种版式，字自己写）：全屏看片台里
   所有动画在「减少动态效果」时跳过。
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var BASE = document.documentElement.getAttribute("data-base") || "";
  var D = window.FILMDATA || {};
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var esc = function (t) { return String(t == null ? "" : t).replace(/[<&"]/g, function (c) { return {"<": "&lt;", "&": "&amp;", '"': "&quot;"}[c]; }); };
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rnd(seed) { var s = seed || 1; return function () { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
  /* 一格的编号：联系表 / 长卷里的 .fr 用 data-i 找，索引页的格子自己带 data-v */
  function idOf(el) {
    if (el.dataset && el.dataset.v) return el.dataset.v;
    var box = el.closest("[data-roll]"); if (!box) return null;
    var r = D[box.getAttribute("data-roll")], f = r && r.frames[+el.getAttribute("data-i")];
    return f ? r.id + "-" + f.n : null;
  }
  function stripSrc(id) { return BASE + "assets/strip/" + id + ".webp"; }

  /* ── 笔迹的质感：全页共用几个滤镜 ───────────────────── */
  var defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  defs.setAttribute("width", "0"); defs.setAttribute("height", "0");
  defs.setAttribute("aria-hidden", "true"); defs.style.position = "absolute";
  defs.innerHTML = window.INK.defs;
  document.body.appendChild(defs);

  /* 圈用哪支笔：grease 油性笔一圈 | twice 描两遍 | enso 圆相 | box 框片。想换就改这一个词 */
  var PEN = "grease";
  /* 一格的圈：按这一格的大小算好笔画，再用百分比贴上去，格子缩放时跟着走 */
  function inkHTML(id, W, H, draw) {
    var o = window.INK.make(PEN, id, W, H, draw), pw = o.pad / W * 100, ph = o.pad / H * 100;
    return o.svg.replace("<svg ", '<svg style="left:' + (-pw).toFixed(2) + "%;top:" + (-ph).toFixed(2) + "%;width:" +
      (100 + 2 * pw).toFixed(2) + "%;height:" + (100 + 2 * ph).toFixed(2) + '%" ');
  }

  /* ════════ 圈片 ════════ */
  var CIRC = ls.get("rolls-circle", []);
  if (!Array.isArray(CIRC)) CIRC = [];
  var circling = false;
  function isC(id) { return CIRC.indexOf(id) >= 0; }
  function paintRings(root, drawId) {
    (root || document).querySelectorAll(".sheet .fr, .reel .fr, .cel").forEach(function (el) {
      var id = idOf(el); if (!id) return;
      var has = el.querySelector(":scope > .ink");
      if (isC(id) && !has) {
        el.insertAdjacentHTML("beforeend", inkHTML(id, el.offsetWidth || 100, el.offsetHeight || 138, id === drawId && !still));
        el.classList.add("circled");
      } else if (!isC(id) && has) { has.remove(); el.classList.remove("circled"); }
    });
  }
  function toggleC(id) {
    if (isC(id)) CIRC = CIRC.filter(function (x) { return x !== id; });
    else CIRC.push(id);
    ls.set("rolls-circle", CIRC);
    paintRings(null, id); chip(); vwPaint(); vwInk(true);
    if (panel && !panel.hidden && panel.dataset.mode === "mine") openPanel("mine");
  }

  /* 联系表上的「圈片」开关 */
  document.querySelectorAll(".sheetbar .tools").forEach(function (t) {
    t.insertAdjacentHTML("beforeend", '<button class="tbtn circ" type="button" data-circ aria-pressed="false" title="用红笔圈出你喜欢的格，只记在你自己的浏览器里">✎ 圈片</button>');
  });
  function setCircling(on) {
    circling = on;
    document.querySelectorAll("[data-circ]").forEach(function (b) { b.setAttribute("aria-pressed", on ? "true" : "false"); });
    document.querySelectorAll(".sheet").forEach(function (s) { s.classList.toggle("circling", on); });
    document.querySelectorAll(".sheetbar .hint").forEach(function (h) {
      if (!h.dataset.orig) h.dataset.orig = h.textContent;
      h.textContent = on ? "圈片中：点一格圈上，再点一下擦掉 · 再按一次「圈片」结束" : h.dataset.orig;
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-circ]");
    if (b) { setCircling(!circling); return; }
    if (!circling) return;
    var fr = e.target.closest && e.target.closest(".sheet .fr");
    if (!fr) return;
    e.preventDefault(); e.stopPropagation();                 // 圈片时点格子不显影、不开看片台
    var id = idOf(fr); if (id) toggleC(id);
  }, true);

  /* 左下角的小签：我圈了几格 */
  var chipEl = document.createElement("button");
  chipEl.type = "button"; chipEl.className = "cchip"; chipEl.hidden = true;
  document.body.appendChild(chipEl);
  function chip() {
    chipEl.hidden = CIRC.length === 0;
    chipEl.innerHTML = '<span class="cico">' + inkHTML("chip", 16, 16, false) + "</span>我圈的 <b>" + CIRC.length + "</b>";
  }
  chip();

  /* 圈过的那几格：一张小清单，可以复制链接发给别人 */
  var panel = null;
  function openPanel(mode, ids) {
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "cpanel"; panel.hidden = true;
      panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "圈过的格");
      document.body.appendChild(panel);
      panel.addEventListener("click", function (e) {
        var t = e.target.closest("[data-go]");
        if (t) {
          var id = t.getAttribute("data-go");
          if (window.__vw && window.__vw.has && window.__vw.has(id)) { panel.hidden = true; window.__vw.open(id); }
          else location.href = BASE + "rolls/" + id.split("-")[0] + "/#v=" + encodeURIComponent(id);
          return;
        }
        if (e.target.closest("[data-x]")) { panel.hidden = true; return; }
        if (e.target.closest("[data-copy]")) {
          var url = location.origin + location.pathname.replace(/[^/]*$/, "").replace(/rolls\/\d+\/$|all\/$|table\/$|surprise\/$|map\/$/, "") + "#c=" + CIRC.join(".");
          var btn = e.target.closest("[data-copy]");
          var ok = function () { btn.textContent = "已复制，发给朋友吧"; };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { prompt("复制这个链接：", url); });
          else prompt("复制这个链接：", url);
          return;
        }
        var cl = e.target.closest("[data-clear]");
        if (cl) {
          if (cl.dataset.sure) { CIRC = []; ls.set("rolls-circle", CIRC); paintRings(); chip(); vwPaint(); panel.hidden = true; }
          else { cl.dataset.sure = "1"; cl.textContent = "真的全擦掉？再点一次"; }
          return;
        }
        if (e.target.closest("[data-adopt]")) {
          JSON.parse(panel.dataset.ids || "[]").forEach(function (id) { if (!isC(id)) CIRC.push(id); });
          ls.set("rolls-circle", CIRC); paintRings(); chip(); openPanel("mine"); return;
        }
        if (e.target === panel) panel.hidden = true;
      });
    }
    var list = mode === "mine" ? CIRC.slice() : ids;
    panel.dataset.mode = mode; panel.dataset.ids = JSON.stringify(list);
    var head = mode === "mine"
      ? "<h3>我圈的 <b>" + list.length + "</b> 格</h3><p>只记在这台设备的浏览器里。复制链接发给朋友，他打开就能看到你圈了哪几格。</p>"
      : "<h3>朋友圈了 <b>" + list.length + "</b> 格</h3><p>点任意一格去看。喜欢的话，可以把这几格也加进你自己圈的里面。</p>";
    var btns = mode === "mine"
      ? '<button type="button" class="tbtn go" data-copy>复制分享链接</button><button type="button" class="tbtn" data-clear>全部擦掉</button>'
      : '<button type="button" class="tbtn go" data-adopt>加进我圈的</button>';
    panel.innerHTML = '<div class="cpin">' + head +
      '<div class="cgrid">' + (list.length ? list.map(function (id) {
        return '<button type="button" class="cthumb" data-go="' + esc(id) + '"><span class="cimg"><img src="' + stripSrc(id) +
          '" alt="" loading="lazy">' + inkHTML(id, 72, 100, false) + '</span><i>' + esc(id.replace("-", "·")) + "</i></button>";
      }).join("") : '<p class="cnone">还没有圈。打开任意一卷，在联系表上按「✎ 圈片」。</p>') + "</div>" +
      '<div class="cbtns">' + btns + '<button type="button" class="tbtn" data-x>关上</button></div></div>';
    panel.hidden = false;
  }
  chipEl.addEventListener("click", function () { openPanel("mine"); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && panel && !panel.hidden) panel.hidden = true; });
  (function fromHash() {
    var m = /[#&]c=([\w.\-]+)/.exec(location.hash);
    if (!m) return;
    var ids = m[1].split(".").filter(function (x) { return /^\d+-\w+$/.test(x); }).slice(0, 80);
    if (ids.length) openPanel("shared", ids);
  })();
  paintRings();

  /* ════════ 进卷先拉片 ════════ */
  (function pull() {
    var sheet = document.querySelector("section[data-roll] .sheet");
    if (!sheet || still) return;
    var rid = sheet.closest("[data-roll]").getAttribute("data-roll");
    try { if (sessionStorage.getItem("rolls-pull-" + rid)) return; sessionStorage.setItem("rolls-pull-" + rid, "1"); } catch (e) {}
    if (/^#(v=|f-|c=)/.test(location.hash)) return;
    var wrap = sheet.parentNode, rows = [].slice.call(sheet.querySelectorAll(".row"));
    if (!rows.length) return;
    var imgs = [].slice.call(rows[0].querySelectorAll(".fr img")).slice(0, 14);
    var h = rows[0].querySelector(".strip").offsetHeight;
    var r = D[rid] || {};
    var ov = document.createElement("div");
    ov.className = "pull"; ov.setAttribute("aria-hidden", "true");
    ov.style.setProperty("--ph", h + "px");
    ov.style.top = (rows[0].offsetTop + sheet.offsetTop) + "px";
    ov.innerHTML =
      '<div class="pcan"><svg viewBox="0 0 90 120" aria-hidden="true">' +
        '<rect x="30" y="2" width="18" height="10" rx="2" class="knob"/>' +
        '<rect x="6" y="12" width="66" height="96" rx="9" class="body"/>' +
        '<path d="M6 30h66M6 90h66" class="rib"/>' +
        '<text x="39" y="55" text-anchor="middle" class="t1">' + esc(rid) + '</text>' +
        '<text x="39" y="72" text-anchor="middle" class="t2">' + (/全画幅/.test(r.fmt || "") ? "135 · 36" : "135 · ½") + '</text>' +
        '<rect x="28" y="108" width="22" height="9" rx="2" class="knob"/>' +
        '<path d="M72 26v68" class="lip"/></svg></div>' +
      '<div class="ptrack"><div class="ptongue"><div class="perf"></div><div class="pfs">' +
        imgs.map(function (im) { return '<img alt="" src="' + (im.currentSrc || im.getAttribute("src")) + '">'; }).join("") +
      '</div><div class="perf lo"></div></div></div>';
    rows.forEach(function (row, i) { row.style.setProperty("--ri", i); });
    sheet.classList.add("pulling");
    wrap.appendChild(ov);
    var done = false, t1, t2;
    function finish() {
      if (done) return; done = true; clearTimeout(t1); clearTimeout(t2);
      ov.classList.add("out"); sheet.classList.add("unroll"); sheet.classList.remove("pulling");
      setTimeout(function () { ov.remove(); sheet.classList.remove("unroll"); }, 1200);
    }
    requestAnimationFrame(function () { ov.classList.add("go"); });
    t1 = setTimeout(finish, 1500);
    ov.addEventListener("click", finish);
  })();

  /* ════════ 张数：片边刻度（精选页） ════════
     右边一根细刻度尺，一张一格，铜色小三角顺着往下走。平时半透明，不抢照片。
     点一下看下一张；看到底了点一下倒片回开头。 */
  (function counter() {
    var figs = [].slice.call(document.querySelectorAll(".plates figure[data-v]"));
    if (figs.length < 3) return;
    var N = figs.length, pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var ticks = "";
    for (var i = 0; i <= N + 1; i++)
      ticks += '<i style="top:' + (i / (N + 1) * 100).toFixed(2) + '%"' + (i === 0 || i === N + 1 ? ' class="se"' : i % 5 === 0 ? ' class="l"' : "") + "></i>";
    var el = document.createElement("button");
    el.type = "button"; el.className = "fcnt";
    el.setAttribute("aria-label", "张数：点一下看下一张");
    el.innerHTML = '<span class="rl">' + ticks + '<b class="mk"><em></em></b></span><span class="se t">S</span><span class="se b">E</span>';
    document.body.appendChild(el);
    var mk = el.querySelector(".mk"), num = el.querySelector(".mk em"), cur = -1;
    function at() {
      var mid = innerHeight * .55, n = 0;
      for (var k = 0; k < N; k++) { var b = figs[k].getBoundingClientRect(); if (b.top + b.height * .3 < mid) n = k + 1; }
      var sc = document.scrollingElement || document.documentElement;
      if (n >= N - 3 && sc.scrollTop + innerHeight >= sc.scrollHeight - 80) n = N + 1;   // 滚到底：卷完
      return n;
    }
    function paint() {
      var n = at(); if (n === cur) return;
      cur = n;
      mk.style.top = (n / (N + 1) * 100).toFixed(2) + "%";
      num.textContent = n === 0 ? "" : n > N ? "卷完" : pad(n);
      el.classList.toggle("end", n > N);
      el.title = n > N ? "卷完了 · 点一下倒片回开头" : n === 0 ? "共 " + N + " 张 · 点一下从第一张看" : "第 " + n + " / " + N + " 张 · 点一下看下一张";
    }
    var q = 0;
    addEventListener("scroll", function () { if (!q) q = requestAnimationFrame(function () { q = 0; paint(); }); }, {passive: true});
    addEventListener("resize", paint);
    paint();
    el.addEventListener("click", function () {
      if (cur >= N) { scrollTo({top: 0, behavior: still ? "auto" : "smooth"}); return; }   // 卷完了：倒片
      figs[Math.max(0, cur)].scrollIntoView({behavior: still ? "auto" : "smooth", block: "center"});
    });
  })();

  /* ════════ 全屏看片台：圈、取景器、明信片 ════════ */
  var vbox = null, vfOn = false, meter = {};
  function V() { return window.__vw; }
  function vwPaint() {
    if (!vbox || !V()) return;
    var f = V().cur(), b = vbox.querySelector("[data-vcirc]");
    if (f && b) {
      var on = isC(f.id), tl = b.querySelector(".tl b");
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("aria-label", on ? "擦掉这一格的圈（O）" : "圈这一格（O）");
      if (tl) tl.textContent = on ? "擦掉这一格的圈" : "圈这一格";
    }
  }
  /* 大图上的圈：跟着大图的位置和大小走；同一格同样大小就只挪位置，不打断正在画的那一笔 */
  function vwInk(draw) {
    if (!vbox || vbox.hidden || !V()) return;
    var host = vbox.querySelector(".vink"), f = V().cur(); if (!host) return;
    if (!f || !isC(f.id)) { host.innerHTML = ""; host.dataset.key = ""; return; }
    var st = vbox.querySelector(".stage"), im = st.querySelector(":scope > img");
    var S = st.getBoundingClientRect(), R = im.getBoundingClientRect();
    if (!R.width || !im.naturalWidth || im.classList.contains("ld")) return;
    var key = f.id + ":" + Math.round(R.width / 8) + ":" + Math.round(R.height / 8), sv = host.firstChild, pad;
    if (draw || host.dataset.key !== key || !sv) {
      var o = window.INK.make(PEN, f.id, R.width, R.height, draw && !still);
      host.innerHTML = o.svg; host.dataset.key = key; host.dataset.pad = o.pad; sv = host.firstChild;
    }
    pad = +host.dataset.pad;
    sv.style.left = (R.left - S.left - pad) + "px"; sv.style.top = (R.top - S.top - pad) + "px";
    sv.style.width = (R.width + 2 * pad) + "px"; sv.style.height = (R.height + 2 * pad) + "px";
  }
  document.addEventListener("vw:build", function (e) { onBuild(e.detail); });
  function onBuild(b) {
    if (vbox === b) return;
    vbox = b;
    var tools = vbox.querySelector(".tools");
    vbox.querySelector(".stage").insertAdjacentHTML("beforeend", '<div class="vfin" hidden><svg></svg><i class="shut"></i></div>');
    tools.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-vcirc]")) { var f = V().cur(); if (f) toggleC(f.id); }
      else if (ev.target.closest("[data-vf]")) setVF(!vfOn);
      else if (ev.target.closest("[data-pc]")) postcard();
    });
    vbox.addEventListener("vw:frame", function () {
      vwPaint();
      var h = vbox.querySelector(".vink"); if (h) { h.innerHTML = ""; h.dataset.key = ""; }
      if (vfOn) { var s = vbox.querySelector(".vfin .shut"); s.classList.remove("blink"); void s.offsetWidth; if (!still) s.classList.add("blink"); }
    });
    vbox.addEventListener("vw:ready", function () { if (vfOn) vfLayout(); vwInk(false); });
    vbox.addEventListener("vw:layout", function () { if (vfOn) vfLayout(); vwInk(false); });
    addEventListener("resize", function () { if (vfOn) vfLayout(); });
    vwPaint();
  }
  if (V() && V().box && V().box()) onBuild(V().box());      // 从带 #v= 的链接进来时，看片台比这段代码先打开
  document.addEventListener("keydown", function (e) {
    if (!vbox || vbox.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (pc && !pc.hidden) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); pc.hidden = true; }
      return;
    }
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    var k = e.key.toLowerCase();
    if (k === "o") { e.preventDefault(); var f = V().cur(); if (f) toggleC(f.id); }
    else if (k === "v") { e.preventDefault(); setVF(!vfOn); }
    else if (k === "p") { e.preventDefault(); postcard(); }
    else if (k === "escape" && vfOn && !vbox.classList.contains("zoomed")) { e.preventDefault(); e.stopPropagation(); setVF(false); }
  }, true);

  /* ── 取景器 ── */
  function setVF(on) {
    vfOn = on;
    if (on && V().zoomOff) V().zoomOff();
    vbox.classList.toggle("vf", on);
    vbox.querySelector(".vfin").hidden = !on;
    vbox.querySelector("[data-vf]").setAttribute("aria-pressed", on ? "true" : "false");
    if (on) vfLayout();
  }
  function vfLayout() {
    var st = vbox.querySelector(".stage"), im = st.querySelector(":scope > img"), svg = vbox.querySelector(".vfin svg");
    var S = st.getBoundingClientRect(), R = im.getBoundingClientRect();
    if (!R.width) return;
    var W = S.width, H = S.height, x = R.left - S.left, y = R.top - S.top, w = R.width, h = R.height;
    var pad = Math.min(w, h) * .05, rr = Math.min(w, h) * .06;
    var X = x - pad, Y = y - pad, WW = w + pad * 2, HH = h + pad * 2;
    var f = V().cur() || {}, bi = Math.min(w, h) * .045, cl = Math.min(w, h) * .09;
    var bx = x + bi, by = y + bi, bw = w - bi * 2, bh = h - bi * 2;
    var cx = x + w / 2, cy = y + h / 2, fr = Math.min(w, h) * .075;
    var half = /半格/.test((D[f.rid] || {}).fmt || "") || /L|R$/.test(f.n || "");
    var corner = function (px, py, sx, sy) { return "M" + (px + sx * cl) + " " + py + "H" + px + "V" + (py + sy * cl); };
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    var mx = Math.min(W - 26, X + WW + 22), my0 = Y + HH * .2, my1 = Y + HH * .8;
    svg.innerHTML =
      '<defs><mask id="vfm"><rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
        '<rect x="' + X + '" y="' + Y + '" width="' + WW + '" height="' + HH + '" rx="' + rr + '" fill="#000"/></mask>' +
        '<radialGradient id="vfv" cx="50%" cy="50%" r="60%"><stop offset="62%" stop-color="#000" stop-opacity="0"/>' +
        '<stop offset="100%" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="#050403" fill-opacity=".96" mask="url(#vfm)"/>' +
      '<rect x="' + X + '" y="' + Y + '" width="' + WW + '" height="' + HH + '" rx="' + rr + '" fill="url(#vfv)"/>' +
      '<rect x="' + X + '" y="' + Y + '" width="' + WW + '" height="' + HH + '" rx="' + rr + '" class="rim"/>' +
      '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" class="bl"/>' +
      '<path class="bl" d="' + corner(bx + bw * .06, by + bh * .06, 1, 1) + corner(bx + bw * .94, by + bh * .06, -1, 1) + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + fr + '" class="fc"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + fr * 1.9 + '" class="fr2"/>' +
      '<path d="M' + (cx - fr) + ' ' + cy + 'H' + (cx + fr) + '" class="fc"/>' +
      '<text x="' + (X + 4) + '" y="' + (Y + HH + 24) + '" class="vt">' + (half ? "½ · 18×24" : "24×36") +
        "　" + esc((f.rid || "") + "·" + (f.n || "")) + (f.place ? "　" + esc(f.place) : "") + "</text>" +
      '<g class="mt"><path d="M' + mx + ' ' + my0 + 'V' + my1 + '"/>' +
        [2, 1, 0, -1, -2].map(function (v, i) {
          var yy = my0 + (my1 - my0) * i / 4;
          return '<path d="M' + (mx - 5) + ' ' + yy + 'H' + (mx + (v ? 5 : 8)) + '"/><text x="' + (mx + 12) + '" y="' + (yy + 4) + '">' + (v > 0 ? "+" + v : v) + "</text>";
        }).join("") +
        '<text x="' + (mx - 2) + '" y="' + (my0 - 12) + '" class="mh">亮</text>' +
        '<path class="nd" d="M' + (mx - 12) + ' 0l8 -5v10z" style="transform:translateY(' + ((my0 + my1) / 2) + 'px)"/></g>';
    /* 右边那根指针：这一格的平均明度（来自色彩分析数据），不是真的测光 */
    if (window.COLORLAB && f.id) window.COLORLAB.frame(f.id).then(function (d) {
      if (!d || !vfOn || V().cur() !== f) return;
      var ev = Math.max(-2, Math.min(2, Math.log(Math.max(.02, d.f.v) / .5) / Math.LN2 * 1.6));
      var nd = svg.querySelector(".nd");
      if (nd) nd.style.transform = "translateY(" + ((my0 + my1) / 2 - ev / 2 * (my1 - my0) / 2) + "px)";
    });
  }

  /* ── 明信片 ────────────────────────────────────────────
     七种版式。标题、正文、落款自己写（回车就换行）；字体、字号、颜色、对齐都能挑。
     角上的小字（卷号地点、署名）可以改、可以关；邮票和邮戳的样式、文字、字体、颜色都能换。
     字体在打开明信片时才从 jsDelivr 载入，而且只下用到的那几个字。
     画在 canvas 上，存下来是一张 JPG。 */
  var pc = null, pcCanvas = null, pcImg = {}, TXT = {};
  var CDN = "https://cdn.jsdelivr.net/npm/@fontsource/";
  var FONTS = [
    {k: "wk", n: "霞鹜文楷", fam: "LXGW WenKai"},                                        // 页面本来就载入了
    {k: "song", n: "思源宋体", fam: "Noto Serif SC", css: ["noto-serif-sc@5/index.css", "noto-serif-sc@5/700.css"], bold: 1},
    {k: "xw", n: "站酷小薇", fam: "ZCOOL XiaoWei", css: ["zcool-xiaowei@5/index.css"]},
    {k: "msz", n: "马善政毛笔", fam: "Ma Shan Zheng", css: ["ma-shan-zheng@5/index.css"]},
    {k: "lc", n: "龙藏手写", fam: "Long Cang", css: ["long-cang@5/index.css"]},
    {k: "gar", n: "Garamond", fam: "EB Garamond", lat: 1},                              // 页面本来就载入了
    {k: "cav", n: "Caveat", fam: "Caveat", css: ["caveat@5/index.css"], lat: 1},
    {k: "typ", n: "Typewriter", fam: "Special Elite", css: ["special-elite@5/index.css"], lat: 1}
  ];
  var FK = {}; FONTS.forEach(function (f) { FK[f.k] = f; });
  var FMTS = [
    {k: "a", n: "白边照片", font: "wk", col: "ink"},
    {k: "b", n: "明信片背面", font: "lc", col: "ink"},
    {k: "c", n: "片条", font: "wk", col: "paper"},
    {k: "d", n: "拍立得", font: "lc", col: "ink"},
    {k: "e", n: "邮票", font: "song", col: "ink"},
    {k: "f", n: "杂志封面", font: "song", col: "paper"},
    {k: "g", n: "竖版书签", font: "msz", col: "red"}
  ];
  var FM = {}; FMTS.forEach(function (f) { FM[f.k] = f; });
  var COLS = [["ink", "墨", "#2A2320"], ["copper", "铜", "#9A5B2E"], ["red", "朱", "#B8341E"], ["blue", "靛", "#2B4A73"], ["paper", "纸白", "#F4EFE6"]];
  var CK = {}; COLS.forEach(function (c) { CK[c[0]] = c[2]; });
  var STAMPS = [["classic", "白边"], ["bleed", "满版"], ["vintage", "复古"]];
  var PMS = [["cds", "圆戳"], ["duplex", "圆戳 + 波浪"], ["wave", "只有波浪"], ["none", "不盖"]];
  var PMF = [["mono", "等宽"], ["typ", "打字机"], ["song", "宋体"], ["wk", "文楷"]];
  var PMC = [["ink", "黑", "#2A2622"], ["red", "红", "#A8321F"], ["blue", "蓝", "#2F4C7A"], ["violet", "紫", "#5A3E73"]];
  var PMK = {}; PMC.forEach(function (c) { PMK[c[0]] = c[2]; });
  var PCS = ls.get("rolls-pc2", null);
  if (!PCS || typeof PCS !== "object") PCS = {fmt: ls.get("rolls-pcstyle", "a"), size: 100, align: "l", per: {}};
  var PDEF = {size: 100, align: "l", per: {}, showMeta: true, showBrand: true, brandText: "卷 Rolls", stamp: "classic", pm: "duplex", pmFont: "mono", pmCol: "ink"};
  for (var pk in PDEF) if (PCS[pk] == null) PCS[pk] = PDEF[pk];
  if (!FM[PCS.fmt]) PCS.fmt = "a";
  function per() { var p = PCS.per[PCS.fmt] || {}, d = FM[PCS.fmt]; return {font: FK[p.font] ? p.font : d.font, col: CK[p.col] ? p.col : d.col}; }
  function savePCS() { ls.set("rolls-pc2", PCS); }
  var ZH = '"LXGW WenKai","Kaiti SC",KaiTi,STKaiti,serif', MONO = '"JetBrains Mono",ui-monospace,Menlo,monospace',
      LAT = '"EB Garamond",Georgia,serif';
  function fnt(k, px, bold) {
    var F = FK[k] || FK.wk;
    return (bold && F.bold ? "700 " : "") + Math.round(px) + 'px "' + F.fam + '",' + ZH;
  }
  function pmFont(k, px) { return k === "mono" ? Math.round(px) + 'px "JetBrains Mono",' + ZH : fnt(k, px); }

  var fontCss = false;
  function loadFontCss() {
    if (fontCss) return; fontCss = true;
    FONTS.forEach(function (F) {
      (F.css || []).forEach(function (c) {
        var l = document.createElement("link"); l.rel = "stylesheet"; l.href = CDN + c;
        l.onload = function () { if (pc && !pc.hidden) later(); };
        document.head.appendChild(l);
      });
    });
    if (document.fonts && document.fonts.addEventListener)
      document.fonts.addEventListener("loadingdone", function () { if (pc && !pc.hidden) later(); });
  }

  function loadImg(src) {
    return new Promise(function (ok, bad) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = bad; i.src = src; });
  }
  function paper(ctx, W, H, base) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    var r = rnd(9), n = W * H / 90;
    for (var i = 0; i < n; i++) { ctx.fillStyle = "rgba(60,40,20," + (r() * .05) + ")"; ctx.fillRect(r() * W, r() * H, 1.4, 1.4); }
  }
  function drawRot(ctx, im, deg, x, y, w, h) {       // 把照片按看片台里的方向放进 x,y,w,h
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(deg * Math.PI / 180);
    var sw = deg % 180 ? h : w, sh = deg % 180 ? w : h;
    ctx.drawImage(im, -sw / 2, -sh / 2, sw, sh); ctx.restore();
  }
  function fit(iw, ih, bw, bh) { var k = Math.min(bw / iw, bh / ih); return [iw * k, ih * k]; }
  function cover(ctx, im, deg, bx, by, bw, bh) {     // 铺满 bx,by,bw,bh，多出去的裁掉
    var iw = deg % 180 ? im.naturalHeight : im.naturalWidth, ih = deg % 180 ? im.naturalWidth : im.naturalHeight;
    var k = Math.max(bw / iw, bh / ih), w = iw * k, h = ih * k;
    ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    drawRot(ctx, im, deg, bx + (bw - w) / 2, by + (bh - h) / 2, w, h); ctx.restore();
  }
  /* 折行：先按回车分段，再按宽度断；英文单词尽量不拆；行首不放标点；超出行数用「…」收尾 */
  var NOHEAD = "，。、；：！？）》」』’”…·,.;:!?)";
  function wrap(ctx, t, maxW, maxN) {
    var out = [];
    String(t || "").replace(/\r/g, "").split("\n").forEach(function (s) {
      var line = "";
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (ctx.measureText(line + c).width > maxW && line) {
          var sp = line.lastIndexOf(" ");
          if (/[A-Za-z0-9'’]/.test(c) && sp > 0 && line.length - sp < 18) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + c; }
          else if (NOHEAD.indexOf(c) >= 0 && line.length > 1) { out.push(line.slice(0, -1)); line = line.slice(-1) + c; }
          else { out.push(line); line = c; }
        } else line += c;
      }
      out.push(line);
    });
    while (out.length > 1 && !out[out.length - 1]) out.pop();
    if (maxN && out.length > maxN) {
      out = out.slice(0, maxN);
      var l = out[maxN - 1];
      while (l && ctx.measureText(l + "…").width > maxW) l = l.slice(0, -1);
      out[maxN - 1] = l + "…";
    }
    return out;
  }
  /* 一段字：o = {font, px, lh, x, y(顶), w, n(最多几行), al: l|c|r, col}；返回画完之后的底边 */
  function block(ctx, t, o) {
    if (!t) return o.y;
    ctx.font = o.font; ctx.fillStyle = o.col; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    var ls2 = wrap(ctx, t, o.w, o.n), y = o.y, lh = o.lh || o.px * 1.5;
    ls2.forEach(function (l) {
      var w = ctx.measureText(l).width, x = o.al === "c" ? o.x + (o.w - w) / 2 : o.al === "r" ? o.x + o.w - w : o.x;
      ctx.fillText(l, x, y + lh / 2 + o.px * .36); y += lh;
    });
    return y;
  }
  function blockH(ctx, t, o) { if (!t) return 0; ctx.font = o.font; return wrap(ctx, t, o.w, o.n).length * (o.lh || o.px * 1.5); }
  /* 几段字（标题、正文、落款）排在 top..bottom 之间；放不下就一起缩小一点。anchor "b" = 贴着底边往上排 */
  function stack(ctx, items, x0, w, top, bottom, al, col, anchor) {
    var k = 1, h = 0;
    var spec = function (it) { return {font: fnt(it.fo, it.px * k, it.bold), px: it.px * k, lh: it.px * k * (it.lh || 1.5), x: x0, w: w, n: it.n, al: it.al || al, col: it.col || col}; };
    for (var tries = 0; tries < 18; tries++) {
      h = 0;
      items.forEach(function (it) { if (it.t) h += (it.gap || 0) * k + blockH(ctx, it.t, spec(it)); });
      if (h <= bottom - top) break;
      k *= .93;
    }
    var y = anchor === "b" ? bottom - h : top;
    items.forEach(function (it) { if (!it.t) return; y += (it.gap || 0) * k; var o = spec(it); o.y = y; y = block(ctx, it.t, o); });
    return y;
  }
  /* 竖排：从右往左一列一列写，回车就另起一列。标点靠右上，英文数字和括号横过来 */
  var VPUN = "，。、．", VROT = "（）《》「」『』〈〉—…～-()[]<>";
  function vcols(t, per) {
    var cols = [];
    String(t || "").replace(/\r/g, "").split("\n").forEach(function (p) {
      var ch = p.split("");
      if (!ch.length) { cols.push([]); return; }
      for (var i = 0; i < ch.length; i += per) cols.push(ch.slice(i, i + per));
    });
    while (cols.length && !cols[cols.length - 1].length) cols.pop();
    return cols;
  }
  function vtext(ctx, t, o) {                         // o = {font, px, x(最右一列的中线), y, h, col, al: l(顶)|c|r(底), minX}；返回最左一列的左边
    if (!t) return o.x + o.px * .6;
    ctx.font = o.font; ctx.fillStyle = o.col; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var step = o.px * 1.12, cols = vcols(t, Math.max(1, Math.floor(o.h / step))), x = o.x;
    cols.forEach(function (col, ci) {
      if (o.minX != null && x - o.px * .55 < o.minX) return;
      var used = col.length * step, y0 = o.al === "c" ? o.y + (o.h - used) / 2 : o.al === "r" ? o.y + o.h - used : o.y;
      col.forEach(function (c, k) {
        var cy = y0 + step * k + step / 2;
        if (VPUN.indexOf(c) >= 0) ctx.fillText(c, x + o.px * .32, cy - o.px * .3);
        else if (VROT.indexOf(c) >= 0 || c.charCodeAt(0) < 0x2E80) { ctx.save(); ctx.translate(x, cy); ctx.rotate(Math.PI / 2); ctx.fillText(c, 0, 0); ctx.restore(); }
        else ctx.fillText(c, x, cy);
      });
      if (ci < cols.length - 1) x -= o.px * 1.3;
    });
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    return x - o.px * .65;
  }
  /* 署名（默认「卷 Rolls」）：右对齐画在 xr 处；关掉或写空就不画 */
  function brand(ctx, xr, y, col, px) {
    if (!PCS.showBrand || !PCS.brandText) return;
    ctx.fillStyle = col; ctx.textAlign = "right"; ctx.font = "italic " + px + "px " + LAT.replace("serif", "") + ZH;
    ctx.fillText(PCS.brandText, xr, y); ctx.textAlign = "left";
  }
  function metaLine(ctx, T, x, y, col, px, al) {
    if (!PCS.showMeta || !T.m) return;
    ctx.fillStyle = col; ctx.font = px + 'px "JetBrains Mono",' + ZH; ctx.textAlign = al || "left";
    ctx.fillText(T.m, x, y); ctx.textAlign = "left";
  }

  /* 同一卷里前后两格的编号（片条版式用） */
  function neighbours(f) {
    var ks = null;
    if (D[f.rid]) ks = D[f.rid].frames.map(function (x) { return x.n; });
    else if (window.ALLF) (window.ALLF.split("|").forEach(function (s) { var p = s.split(":"); if (p[0] === f.rid) ks = p[1].split(","); }));
    if (!ks) return [];
    var i = ks.indexOf(f.n), out = [];
    for (var k = 1; k <= 2; k++) { if (ks[i - k]) out.push([-k, f.rid + "-" + ks[i - k]]); if (ks[i + k]) out.push([k, f.rid + "-" + ks[i + k]]); }
    return out;
  }
  function isHalf(f) { return /半格/.test((D[f.rid] || {}).fmt || "") || /[LR]$/.test(f.n || ""); }

  /* ── 邮票：齿孔 + 三种版面 ── */
  function perfs(x, sx, sy, sw, sh, bg, r) {
    x.fillStyle = bg;
    var nx = Math.max(4, Math.round(sw / (r * 2.7))), ny = Math.max(4, Math.round(sh / (r * 2.7)));
    for (var i = 0; i <= nx; i++) { var px = sx + sw * i / nx; [sy, sy + sh].forEach(function (py) { x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); }); }
    for (var j = 0; j <= ny; j++) { var py2 = sy + sh * j / ny; [sx, sx + sw].forEach(function (px2) { x.beginPath(); x.arc(px2, py2, r, 0, Math.PI * 2); x.fill(); }); }
  }
  function stamp(x, im, deg, sx, sy, sw, sh, bg, o) {         // o = {st, v 面值, iss 署名, acc 主色}
    var r = sw * .024, acc = o.acc;
    x.save();
    x.shadowColor = "rgba(60,40,20,.25)"; x.shadowBlur = sw * .03; x.shadowOffsetY = sw * .008;
    x.fillStyle = o.st === "vintage" ? "#F4ECD8" : "#FDFBF6"; x.fillRect(sx, sy, sw, sh);
    x.restore();
    if (o.st === "bleed") {                                          /* 满版：照片铺到齿孔边，面值和署名压在照片上 */
      var m0 = sw * .045;
      cover(x, im, deg, sx + m0, sy + m0, sw - 2 * m0, sh - 2 * m0);
      x.save(); x.fillStyle = "#FFFFFF"; x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = sw * .02;
      x.textAlign = "right"; x.font = "500 " + Math.round(sh * .12) + "px " + LAT; x.fillText(o.v, sx + sw - m0 * 2.2, sy + m0 + sh * .12);
      x.textAlign = "left"; x.font = Math.round(sh * .036) + "px " + MONO; x.save(); x.letterSpacing = Math.round(sh * .006) + "px";
      if (o.iss) x.fillText(o.iss.toUpperCase(), sx + m0 * 2.2, sy + sh - m0 * 2.2); x.restore(); x.restore();
    } else if (o.st === "vintage") {                                 /* 复古：米色纸、双线框、上沿署名、下沿面值 */
      var m1 = sw * .07, band = sh * .1;
      x.strokeStyle = acc; x.lineWidth = Math.max(1, sw * .006); x.strokeRect(sx + m1 * .55, sy + m1 * .55, sw - m1 * 1.1, sh - m1 * 1.1);
      x.lineWidth = Math.max(1, sw * .003); x.strokeRect(sx + m1 * .8, sy + m1 * .8, sw - m1 * 1.6, sh - m1 * 1.6);
      var ix = sx + m1 * 1.15, iy = sy + m1 * .8 + band, iw = sw - m1 * 2.3, ih = sh - m1 * 1.6 - band * 2;
      cover(x, im, deg, ix, iy, iw, ih);
      x.strokeStyle = acc; x.strokeRect(ix, iy, iw, ih);
      x.fillStyle = acc; x.textAlign = "center"; x.textBaseline = "middle";
      if (o.iss) { x.font = Math.round(band * .42) + "px " + LAT.replace("serif", "") + ZH; x.save(); x.letterSpacing = Math.round(band * .08) + "px";
        x.fillText(o.iss.toUpperCase(), sx + sw / 2, sy + m1 * .8 + band / 2); x.restore(); }
      x.font = "500 " + Math.round(band * .66) + "px " + LAT; x.fillText(o.v, sx + sw / 2, sy + sh - m1 * .8 - band / 2);
      [[sx + m1 * 1.6, sy + sh - m1 * .8 - band / 2], [sx + sw - m1 * 1.6, sy + sh - m1 * .8 - band / 2]].forEach(function (p) {   // 两边小菱形
        x.beginPath(); x.moveTo(p[0], p[1] - band * .16); x.lineTo(p[0] + band * .12, p[1]); x.lineTo(p[0], p[1] + band * .16); x.lineTo(p[0] - band * .12, p[1]); x.fill(); });
      x.textAlign = "left"; x.textBaseline = "alphabetic";
    } else {                                                         /* 白边：白纸边、细框，底下一条写署名和面值 */
      var m2 = sw * .075, band2 = sh * .13;
      var jx = sx + m2, jy = sy + m2, jw = sw - 2 * m2, jh = sh - 2 * m2 - band2;
      cover(x, im, deg, jx, jy, jw, jh);
      x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = Math.max(1, sw * .002); x.strokeRect(jx, jy, jw, jh);
      x.fillStyle = acc; x.textBaseline = "middle";
      if (o.iss) { x.font = Math.round(band2 * .3) + "px " + LAT.replace("serif", "") + ZH; x.save(); x.letterSpacing = Math.round(band2 * .05) + "px";
        x.fillText(o.iss.toUpperCase(), jx, jy + jh + band2 * .52); x.restore(); }
      x.textAlign = "right"; x.font = "500 " + Math.round(band2 * .62) + "px " + LAT; x.fillText(o.v, jx + jw, jy + jh + band2 * .5);
      x.textAlign = "left"; x.textBaseline = "alphabetic";
    }
    perfs(x, sx, sy, sw, sh, bg, r);
  }

  /* ── 邮戳：双圈，地名沿上弧、下沿沿下弧，日期在中间两道横线之间；波浪线往一边拖。
     先画在一张小画布上，再随机擦掉一些点、一边淡一点（盖章时用力不匀），最后「正片叠底」压到纸上 ── */
  function arcText(g, cx, cy, rad, text, font, px, top) {
    if (!text) return;
    var ch = String(text).split(""), sp = px * .14, tot, ws, max = 2.35;
    for (var tries = 0; tries < 8; tries++) {
      g.font = font(px); ws = ch.map(function (c) { return g.measureText(c).width; });
      tot = ws.reduce(function (a, b) { return a + b; }, 0) + sp * (ch.length - 1);
      if (tot / rad <= max) break;
      px *= .9; sp = px * .14;
    }
    var ang = tot / rad, a = top ? -Math.PI / 2 - ang / 2 : Math.PI / 2 + ang / 2, acc = 0;
    g.textAlign = "center"; g.textBaseline = "middle";
    ch.forEach(function (c, i) {
      var mid = (acc + ws[i] / 2) / rad, th = top ? a + mid : a - mid;
      g.save(); g.translate(cx + Math.cos(th) * rad, cy + Math.sin(th) * rad); g.rotate(top ? th + Math.PI / 2 : th - Math.PI / 2);
      g.fillText(c, 0, 0); g.restore();
      acc += ws[i] + sp;
    });
  }
  function postmark(ctx, cx, cy, r, o) {                      // o = {st, pa 地名, pd 日期, pb 下沿, font, col, rot, dir(波浪往哪边), seed}
    if (!o.st || o.st === "none") return;
    var pad = r * .25, L = o.st === "cds" ? 0 : o.st === "wave" ? r * 3.2 : r * 2.4;
    var W = Math.ceil(2 * r + 2 * pad + L), H = Math.ceil(2 * r + 2 * pad);
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var g = cv.getContext("2d"), ox = o.dir < 0 ? L + pad + r : pad + r, oy = pad + r, ink = PMK[o.col] || PMK.ink;
    var F = function (px) { return pmFont(o.font, px); };
    g.strokeStyle = g.fillStyle = ink; g.lineCap = "round";
    if (o.st !== "wave") {
      g.lineWidth = r * .05; g.beginPath(); g.arc(ox, oy, r * .96, 0, Math.PI * 2); g.stroke();
      g.lineWidth = r * .022; g.beginPath(); g.arc(ox, oy, r * .63, 0, Math.PI * 2); g.stroke();
      arcText(g, ox, oy, r * .79, o.pa, F, r * .2, true);
      arcText(g, ox, oy, r * .79, o.pb, F, r * .16, false);
      [0, Math.PI].forEach(function (a) { g.beginPath(); g.arc(ox + Math.cos(a) * r * .79, oy + Math.sin(a) * r * .79, r * .035, 0, Math.PI * 2); g.fill(); });
      g.lineWidth = r * .02;
      [-.2, .2].forEach(function (dy) { var hw = Math.sqrt(Math.max(0, .63 * .63 - dy * dy)) * r * .9;
        g.beginPath(); g.moveTo(ox - hw, oy + dy * r); g.lineTo(ox + hw, oy + dy * r); g.stroke(); });
      var dpx = r * .2; g.font = F(dpx);
      while (g.measureText(o.pd || "").width > r * 1.05 && dpx > r * .1) { dpx *= .92; g.font = F(dpx); }
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(o.pd || "", ox, oy + r * .01);
    }
    if (o.st !== "cds") {
      g.lineWidth = r * .045;
      var x0 = o.st === "wave" ? pad : o.dir < 0 ? pad : ox + r * 1.05, x1 = o.st === "wave" ? W - pad : o.dir < 0 ? ox - r * 1.05 : W - pad;
      for (var k = 0; k < 5; k++) {
        g.beginPath();
        for (var xx = x0; xx <= x1; xx += 3) {
          var yy = oy + (k - 2) * r * .27 + Math.sin((xx - x0) / (r * .2)) * r * .075;
          if (xx === x0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
        }
        g.stroke();
      }
    }
    var rr = rnd(o.seed || 3);
    g.globalCompositeOperation = "destination-out";
    for (var i = 0, n = W * H / 55; i < n; i++) { g.fillStyle = "rgba(0,0,0," + (rr() * .55).toFixed(2) + ")"; g.fillRect(rr() * W, rr() * H, .8 + rr() * 2.4, .8 + rr() * 2.4); }
    var ga = rr() * Math.PI * 2, gr = g.createLinearGradient(W / 2 - Math.cos(ga) * W / 2, H / 2 - Math.sin(ga) * H / 2, W / 2 + Math.cos(ga) * W / 2, H / 2 + Math.sin(ga) * H / 2);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.45)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot || 0); ctx.globalAlpha = .88; ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(cv, -ox, -oy); ctx.restore();
  }
  function pmOpts(f, T, dir) {
    return {st: PCS.pm, pa: T.pa, pd: T.pd, pb: T.pb, font: PCS.pmFont, col: PCS.pmCol,
            rot: ((hash(f.id + "pm") % 23) - 11) * Math.PI / 180, dir: dir, seed: hash(f.id) || 5};
  }

  function renderCard(fk, f, im, deg, nb) {
    var iw = deg % 180 ? im.naturalHeight : im.naturalWidth, ih = deg % 180 ? im.naturalWidth : im.naturalHeight;
    var port = ih > iw, c = document.createElement("canvas"), x = c.getContext("2d");
    var T = TXT[f.id], P = per(), sz = (PCS.size || 100) / 100, al = PCS.align || "l", col = CK[P.col], fo = P.font;
    var acc = P.col === "paper" ? "#9A5B2E" : col;
    var W, H;
    if (fk === "a") {                                            /* 白边照片 */
      W = port ? 1200 : 1800; H = port ? 1800 : 1200;
      var m = port ? 80 : 90, bot = port ? 440 : 340;
      c.width = W; c.height = H; paper(x, W, H, "#F3EFE6");
      var s = fit(iw, ih, W - m * 2, H - m - bot), px = (W - s[0]) / 2, py = m + (H - m - bot - s[1]) / 2;
      x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(px + 3, py + 5, s[0], s[1]);
      drawRot(x, im, deg, px, py, s[0], s[1]);
      var tw = Math.max(s[0], W * .6), tx = (W - tw) / 2, low = PCS.showMeta || PCS.showBrand;
      stack(x, [{t: T.t, fo: fo, px: 58 * sz, lh: 1.35, n: 3, bold: 1}, {t: T.b, fo: fo, px: 34 * sz, lh: 1.7, n: 8, gap: 10},
                {t: T.s, fo: fo, px: 34 * sz, n: 2, gap: 8, al: "r"}], tx, tw, py + s[1] + 40, H - (low ? 100 : 60), al, col);
      metaLine(x, T, tx, H - 56, "#8A7B69", 24);
      brand(x, tx + tw, H - 56, "#B4794A", 30);
    } else if (fk === "b") {                                     /* 明信片背面 */
      W = 1800; H = 1200; c.width = W; c.height = H; paper(x, W, H, "#F1EBDD");
      var s2 = fit(iw, ih, 780, 1000), p2x = 70 + (800 - s2[0]) / 2, p2y = (H - s2[1]) / 2;
      x.fillStyle = "#FFFFFF"; x.fillRect(p2x - 14, p2y - 14, s2[0] + 28, s2[1] + 28);
      x.strokeStyle = "rgba(0,0,0,.12)"; x.strokeRect(p2x - 14, p2y - 14, s2[0] + 28, s2[1] + 28);
      drawRot(x, im, deg, p2x, p2y, s2[0], s2[1]);
      x.strokeStyle = "#B8AE9C"; x.lineWidth = 2; x.beginPath(); x.moveTo(935, 150); x.lineTo(935, 1060); x.stroke();
      x.fillStyle = "#6F6457"; x.font = "34px " + LAT; x.textAlign = "center";
      x.save(); x.letterSpacing = "12px"; x.fillText("POST CARD", 1260, 118); x.restore(); x.textAlign = "left";
      stamp(x, im, deg, 1500, 150, 200, 250, "#F1EBDD", {st: PCS.stamp, v: T.v, iss: PCS.showBrand ? PCS.brandText : "", acc: acc});
      postmark(x, 1480, 400, 92, pmOpts(f, T, -1));
      /* 字写在横线上：行多了横线跟着变密、字跟着变小 */
      var k = 1, tl, bl, nL;
      for (var tries = 0; tries < 12; tries++) {
        x.font = fnt(fo, 56 * sz * k, 1); tl = T.t ? wrap(x, T.t, 720) : [];
        x.font = fnt(fo, 42 * sz * k); bl = T.b ? wrap(x, T.b, 720) : [];
        nL = tl.length + bl.length + (T.s ? 1 : 0);
        if (nL * 110 * k <= 560 || k < .45) break;
        k *= .9;
      }
      var gapL = Math.min(110, 560 / Math.max(5, nL)), y0 = 1040 - gapL * Math.max(5, nL) + gapL;
      x.strokeStyle = "#CFC5B3"; x.lineWidth = 2;
      for (var li = 0; li < Math.max(5, nL); li++) { x.beginPath(); x.moveTo(990, y0 + li * gapL); x.lineTo(1720, y0 + li * gapL); x.stroke(); }
      x.fillStyle = col; var row = 0;
      var put = function (lines, px, bold, alx) {
        x.font = fnt(fo, px, bold);
        lines.forEach(function (l) {
          var w = x.measureText(l).width, a2 = alx || al, xx = a2 === "c" ? 990 + (730 - w) / 2 : a2 === "r" ? 1720 - w : 1000;
          x.fillText(l, xx, y0 + row * gapL - 16); row++;
        });
      };
      put(tl, 56 * sz * k, 1); put(bl, 42 * sz * k);
      if (T.s) put([T.s], 40 * sz * k, 0, "r");
      metaLine(x, T, 990, 1120, "#8A7B69", 22);
    } else if (fk === "c") {                                     /* 片条 */
      W = 1800; H = 1200; c.width = W; c.height = H;
      x.fillStyle = "#100C08"; x.fillRect(0, 0, W, H);
      var s3 = fit(iw, ih, 1400, 620), fy = 110, fh = s3[1] + 150;
      var gd = x.createLinearGradient(0, fy, 0, fy + fh);
      gd.addColorStop(0, "#4E2A14"); gd.addColorStop(.1, "#6E3E22"); gd.addColorStop(.35, "#8B5330"); gd.addColorStop(.65, "#6E3E22"); gd.addColorStop(1, "#4E2A14");
      x.fillStyle = gd; x.fillRect(0, fy, W, fh);
      var p3x = (W - s3[0]) / 2, p3y = fy + 75, gap = 26;
      (nb || []).forEach(function (n) {                           // 左右相邻的格，压暗
        var ni = n[2]; if (!ni) return;
        var nw = ni.naturalWidth * s3[1] / ni.naturalHeight, off = n[0];
        var nx = off < 0 ? p3x - gap - nw - (nw + gap) * (-off - 1) : p3x + s3[0] + gap + (off - 1) * (nw + gap);
        if (nx > W || nx + nw < 0) return;
        x.save(); x.globalAlpha = .4; x.drawImage(ni, nx, p3y, nw, s3[1]); x.restore();
      });
      x.fillStyle = "#0B0806"; x.fillRect(p3x - 6, p3y - 6, s3[0] + 12, s3[1] + 12);
      drawRot(x, im, deg, p3x, p3y, s3[0], s3[1]);
      x.fillStyle = "#100C08";
      for (var hx = 14; hx < W; hx += 46) {
        x.beginPath(); if (x.roundRect) x.roundRect(hx, fy + 20, 26, 18, 5); else x.rect(hx, fy + 20, 26, 18); x.fill();
        x.beginPath(); if (x.roundRect) x.roundRect(hx, fy + fh - 38, 26, 18, 5); else x.rect(hx, fy + fh - 38, 26, 18); x.fill();
      }
      x.strokeStyle = "#E4735B"; x.lineWidth = 4; x.strokeRect(p3x - 16, p3y - 16, s3[0] + 32, s3[1] + 32);
      x.fillStyle = "rgba(255,196,110,.8)"; x.font = "22px " + MONO; x.fillText("▸ " + f.n, p3x, fy + 62);
      stack(x, [{t: T.t, fo: fo, px: 56 * sz, lh: 1.35, n: 2, bold: 1}, {t: T.b, fo: fo, px: 32 * sz, lh: 1.7, n: 6, gap: 6},
                {t: T.s, fo: fo, px: 32 * sz, n: 2, gap: 4, al: "r"}], 120, 1560, fy + fh + 44, H - ((PCS.showMeta || PCS.showBrand) ? 100 : 50), al, col);
      metaLine(x, T, 120, H - 58, "#8A7B69", 24);
      brand(x, W - 120, H - 58, "#B4794A", 36);
    } else if (fk === "d") {                                     /* 拍立得 */
      W = 1500; H = 1800; c.width = W; c.height = H;
      paper(x, W, H, "#D9D1C3");
      var vg = x.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, H * .75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(60,40,20,.28)"); x.fillStyle = vg; x.fillRect(0, 0, W, H);
      var cw = 1080, ch = 1310, tilt = ((hash(f.id) % 7) - 3) * .6 * Math.PI / 180;
      x.save(); x.translate(W / 2, H / 2 - 30); x.rotate(tilt);
      x.shadowColor = "rgba(40,25,10,.35)"; x.shadowBlur = 46; x.shadowOffsetY = 20;
      x.fillStyle = "#FBF8F1"; x.fillRect(-cw / 2, -ch / 2, cw, ch);
      x.shadowColor = "transparent";
      var pw = cw - 128, wx = -pw / 2, wy = -ch / 2 + 64;
      cover(x, im, deg, wx, wy, pw, pw);
      x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 2; x.strokeRect(wx, wy, pw, pw);
      stack(x, [{t: T.t, fo: fo, px: 70 * sz, lh: 1.25, n: 2, bold: 1}, {t: T.b, fo: fo, px: 38 * sz, lh: 1.5, n: 5, gap: 4},
                {t: T.s, fo: fo, px: 36 * sz, n: 2, gap: 2, al: "r"}], wx, pw, wy + pw + 30, ch / 2 - 30, al, col);
      x.restore();
      metaLine(x, T, W / 2, H - 60, "rgba(60,45,30,.6)", 24, "center");
    } else if (fk === "e") {                                     /* 邮票 */
      W = 1400; H = 1800; c.width = W; c.height = H; paper(x, W, H, "#EFE8DA");
      var sx = 200, sy = 100, sw2 = 1000, sh2 = 1250;
      stamp(x, im, deg, sx, sy, sw2, sh2, "#EFE8DA", {st: PCS.stamp, v: T.v, iss: PCS.showBrand ? PCS.brandText : "", acc: acc});
      /* 邮戳盖在邮票右边，避开面值：白边、复古的面值在下面，就盖偏上；满版的面值在右上，就盖偏下 */
      postmark(x, sx + sw2 - 50, sy + sh2 * (PCS.stamp === "bleed" ? .78 : .32), 136, pmOpts(f, T, 1));
      stack(x, [{t: T.t, fo: fo, px: 56 * sz, lh: 1.3, n: 2, bold: 1}, {t: T.b, fo: fo, px: 36 * sz, lh: 1.65, n: 6, gap: 8},
                {t: T.s, fo: fo, px: 34 * sz, n: 2, gap: 6, al: "r"}], sx, sw2, sy + sh2 + 70, H - (PCS.showMeta ? 90 : 50), al, col);
      metaLine(x, T, sx, H - 48, "#8A7B69", 22);
    } else if (fk === "f") {                                     /* 杂志封面 */
      W = 1200; H = 1600; c.width = W; c.height = H;
      cover(x, im, deg, 0, 0, W, H);
      var gt = x.createLinearGradient(0, 0, 0, 480); gt.addColorStop(0, "rgba(0,0,0,.55)"); gt.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = gt; x.fillRect(0, 0, W, 480);
      var gb = x.createLinearGradient(0, H * .5, 0, H); gb.addColorStop(0, "rgba(0,0,0,0)"); gb.addColorStop(1, "rgba(0,0,0,.72)");
      x.fillStyle = gb; x.fillRect(0, H * .5, W, H * .5);
      x.fillStyle = "#F4EFE6";
      var mh = 0;
      if (PCS.showBrand && PCS.brandText) {                        // 刊名 = 署名：第一个词用大号中文，后面的用 Marcellus
        var mt = PCS.brandText.split(/\s+/), first = mt.shift(), rest = mt.join(" ");
        x.font = '700 200px "Noto Serif SC",' + ZH; x.fillText(first, 64, 238);
        var fw = x.measureText(first).width;
        if (rest) { x.font = '172px Marcellus,"EB Garamond",serif'; x.save(); x.letterSpacing = "18px";
          var rw = x.measureText(rest.toUpperCase()).width, kk = Math.min(1, (W - 140 - fw - 36) / rw);
          x.font = Math.round(172 * kk) + 'px Marcellus,"EB Garamond",serif'; x.fillText(rest.toUpperCase(), 64 + fw + 36, 222); x.restore(); }
        x.fillRect(70, 272, W - 140, 3); mh = 1;
      }
      if (PCS.showMeta && T.m) { x.font = "26px " + MONO + "," + ZH; x.save(); x.letterSpacing = "4px"; x.fillText(T.m.toUpperCase(), 72, mh ? 320 : 90); x.restore(); }
      x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 16;
      stack(x, [{t: T.t, fo: fo, px: 100 * sz, lh: 1.2, n: 3, bold: 1}, {t: T.b, fo: fo, px: 38 * sz, lh: 1.6, n: 6, gap: 18},
                {t: T.s, fo: fo, px: 32 * sz, n: 2, gap: 10, al: al === "r" ? "l" : "r"}], 70, W - 140, H * .45, H - 70, al, col, "b");
      x.shadowColor = "transparent";
    } else {                                                     /* 竖版书签 */
      W = 720; H = 2100; c.width = W; c.height = H; paper(x, W, H, "#F2EDE3");
      x.strokeStyle = "#CFC5B3"; x.lineWidth = 2; x.strokeRect(30, 30, W - 60, H - 60);
      cover(x, im, deg, 60, 200, W - 120, 960);
      x.fillStyle = "#2E2620"; x.beginPath(); x.arc(W / 2, 110, 24, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "#B8AE9C"; x.lineWidth = 3; x.beginPath(); x.arc(W / 2, 110, 32, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = "#B8341E"; x.lineWidth = 7; x.lineCap = "round";
      x.beginPath(); x.moveTo(W / 2, 110); x.bezierCurveTo(W / 2 + 20, 60, W / 2 + 90, 40, W / 2 + 70, -10); x.stroke();
      x.beginPath(); x.moveTo(W / 2 - 6, 106); x.bezierCurveTo(W / 2 - 40, 50, W / 2 - 10, 20, W / 2 - 50, -10); x.stroke();
      var vA = PCS.align === "c" ? "c" : PCS.align === "r" ? "r" : "l";
      var left = vtext(x, T.t, {font: fnt(fo, 76 * sz, 1), px: 76 * sz, x: W - 60 - 76 * sz * .65, y: 1220, h: 700, col: col, al: vA, minX: 60});
      vtext(x, T.b, {font: fnt(fo, 36 * sz), px: 36 * sz, x: left - 36 * sz * .6 - 10, y: 1226, h: 690, col: col, al: vA, minX: 60});
      x.fillStyle = col; x.font = fnt(fo, 30 * sz); if (T.s) x.fillText(T.s.split("\n")[0], 64, H - 110);
      metaLine(x, T, 64, H - 62, "#8A7B69", 20);
      brand(x, W - 64, H - 62, "#B4794A", 26);
    }
    return c;
  }

  function today() { var d = new Date(); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); }
  function defaults(f) {
    return {t: f.cap || ("寄自" + (f.place || "远方")), b: (f.note || "").replace(/[ \t]+/g, " ").trim(), s: "",
            m: f.rid + " · " + f.n + (f.roll ? "　" + f.roll : "") + (f.place ? "　" + f.place : ""),
            pa: f.place || "ROLLS", pd: today(), pb: f.rid + " · " + f.n, v: isHalf(f) ? "½" : "35"};
  }
  function chips(attr, list) { return list.map(function (c) { return '<button type="button" ' + attr + '="' + c[0] + '">' + c[1] + "</button>"; }).join(""); }
  function postcard() {
    var f = V() && V().cur(); if (!f) return;
    if (V().isEmbed && V().isEmbed()) V().full(true);
    if (vfOn) setVF(false);
    if (V().zoomOff) V().zoomOff();
    loadFontCss();
    if (!pc) {
      pc = document.createElement("div"); pc.className = "pc"; pc.hidden = true;
      pc.setAttribute("role", "dialog"); pc.setAttribute("aria-label", "做成明信片");
      var ic = {l: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>',
                c: '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>',
                r: '<svg viewBox="0 0 24 24"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>'};
      pc.innerHTML = '<div class="pcin"><div class="pcv"><p class="pcw">正在做……</p></div><div class="pcs">' +
        '<div class="pch1"><h3>做成明信片</h3><button type="button" class="pcx" data-close aria-label="关上">&#10005;</button></div>' +
        '<div class="pcg"><span class="pcl">版式</span><div class="pcf" role="group" aria-label="版式">' +
          FMTS.map(function (m) { return '<button type="button" data-fm="' + m.k + '">' + m.n + "</button>"; }).join("") + "</div></div>" +
        '<label class="pcg"><span class="pcl">标题</span><textarea data-t="t" rows="1" maxlength="60" placeholder="回车可以换行"></textarea></label>' +
        '<label class="pcg"><span class="pcl">正文</span><textarea data-t="b" rows="3" maxlength="240" placeholder="想说的话，回车换行"></textarea></label>' +
        '<label class="pcg"><span class="pcl">落款</span><textarea data-t="s" rows="1" maxlength="40" placeholder="比如：阿东 · 二〇二六年秋"></textarea></label>' +
        '<div class="pcg"><span class="pcl">字体</span><div class="pcfont" role="group" aria-label="字体">' +
          FONTS.map(function (F) { return '<button type="button" data-fo="' + F.k + '" style="font-family:\'' + F.fam + '\',' + ZH.replace(/"/g, "'") + '">' + F.n + "</button>"; }).join("") +
        '</div><p class="pcn">后三种是英文字体，中文会自动用文楷。</p></div>' +
        '<div class="pcg pcrow"><span class="pcl">字号</span><input type="range" min="70" max="150" step="5" data-size aria-label="字号"><output data-size-out></output></div>' +
        '<div class="pcg pcrow"><span class="pcl">颜色</span><div class="pccol" role="group" aria-label="颜色">' +
          COLS.map(function (c) { return '<button type="button" data-co="' + c[0] + '" title="' + c[1] + '" aria-label="' + c[1] + '" style="--c:' + c[2] + '"></button>'; }).join("") + "</div></div>" +
        '<div class="pcg pcrow"><span class="pcl">对齐</span><div class="pcal" role="group" aria-label="对齐">' +
          ["l", "c", "r"].map(function (a) { return '<button type="button" data-al="' + a + '" aria-label="' + {l: "靠左", c: "居中", r: "靠右"}[a] + '">' + ic[a] + "</button>"; }).join("") + "</div></div>" +
        '<details class="pcsec" open><summary>角上的小字</summary>' +
          '<label class="pcchk"><input type="checkbox" data-opt="showMeta"><span>卷号和地点</span></label><input type="text" data-t="m" maxlength="60">' +
          '<label class="pcchk"><input type="checkbox" data-opt="showBrand"><span>署名（也用作邮票上的发行名、杂志刊名）</span></label><input type="text" data-brand maxlength="24">' +
        "</details>" +
        '<details class="pcsec pcsec-stamp" open><summary>邮票和邮戳</summary>' +
          '<div class="pcg"><span class="pcl">邮票</span><div class="pcf" data-grp="stamp">' + chips("data-st", STAMPS) + "</div></div>" +
          '<label class="pcg"><span class="pcl">面值</span><input type="text" data-t="v" maxlength="8"></label>' +
          '<div class="pcg"><span class="pcl">邮戳</span><div class="pcf" data-grp="pm">' + chips("data-pm", PMS) + "</div></div>" +
          '<div class="pcpm"><label class="pcg"><span class="pcl">上沿（地名）</span><input type="text" data-t="pa" maxlength="16"></label>' +
          '<label class="pcg"><span class="pcl">中间（日期）</span><input type="text" data-t="pd" maxlength="16"></label>' +
          '<label class="pcg"><span class="pcl">下沿</span><input type="text" data-t="pb" maxlength="16"></label>' +
          '<div class="pcg"><span class="pcl">邮戳字体</span><div class="pcf" data-grp="pmf">' + chips("data-pmf", PMF) + "</div></div>" +
          '<div class="pcg pcrow"><span class="pcl">邮戳颜色</span><div class="pccol">' +
            PMC.map(function (c) { return '<button type="button" data-pmc="' + c[0] + '" title="' + c[1] + '" aria-label="' + c[1] + '" style="--c:' + c[2] + '"></button>'; }).join("") + "</div></div></div>" +
        "</details>" +
        '<div class="pcb"><button type="button" class="tbtn go" data-save>保存图片</button>' +
        '<button type="button" class="tbtn" data-share hidden>发给朋友</button>' +
        '<button type="button" class="tbtn" data-reset>字改回原样</button></div></div></div>';
      vbox.appendChild(pc);
      var setPer = function (k, v) { PCS.per[PCS.fmt] = PCS.per[PCS.fmt] || {}; PCS.per[PCS.fmt][k] = v; };
      pc.addEventListener("click", function (e) {
        var t;
        if ((t = e.target.closest("[data-fm]"))) { PCS.fmt = t.dataset.fm; savePCS(); paintUI(); draw(); return; }
        if ((t = e.target.closest("[data-fo]"))) { setPer("font", t.dataset.fo); savePCS(); paintUI(); later(); return; }
        if ((t = e.target.closest("[data-co]"))) { setPer("col", t.dataset.co); savePCS(); paintUI(); later(); return; }
        if ((t = e.target.closest("[data-al]"))) { PCS.align = t.dataset.al; savePCS(); paintUI(); later(); return; }
        if ((t = e.target.closest("[data-st]"))) { PCS.stamp = t.dataset.st; savePCS(); paintUI(); later(); return; }
        if ((t = e.target.closest("[data-pm]"))) { PCS.pm = t.dataset.pm; savePCS(); paintUI(); later(); return; }
        if ((t = e.target.closest("[data-pmf]"))) { PCS.pmFont = t.dataset.pmf; savePCS(); paintUI(); later(); return; }
        if ((t = e.target.closest("[data-pmc]"))) { PCS.pmCol = t.dataset.pmc; savePCS(); paintUI(); later(); return; }
        if (e.target.closest("[data-reset]")) { TXT[pc._f.id] = defaults(pc._f); PCS.brandText = PDEF.brandText; savePCS(); paintUI(); later(); return; }
        if (e.target.closest("[data-close]") || e.target === pc) { pc.hidden = true; return; }
        if (e.target.closest("[data-save]")) { save(false); return; }
        if (e.target.closest("[data-share]")) { save(true); return; }
      });
      pc.addEventListener("input", function (e) {
        var t = e.target;
        if (t.dataset.t) { TXT[pc._f.id][t.dataset.t] = t.value; if (t.tagName === "TEXTAREA") grow(t); later(); }
        else if (t.hasAttribute("data-brand")) { PCS.brandText = t.value; savePCS(); later(); }
        else if (t.dataset.opt) { PCS[t.dataset.opt] = t.checked; savePCS(); paintUI(); later(); }
        else if (t.hasAttribute("data-size")) { PCS.size = +t.value; savePCS(); pc.querySelector("[data-size-out]").textContent = t.value + "%"; later(); }
      });
    }
    if (!TXT[f.id]) TXT[f.id] = defaults(f);
    pc.hidden = false; pc._f = f; paintUI(); draw();
  }
  function grow(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 2, 220) + "px"; }   // 文本框跟着行数长高
  function paintUI() {
    var P = per(), T = TXT[pc._f.id], on = function (sel, key, val) {
      pc.querySelectorAll("[" + sel + "]").forEach(function (b) { b.classList.toggle("on", b.getAttribute(sel) === val); });
    };
    on("data-fm", 0, PCS.fmt); on("data-fo", 0, P.font); on("data-co", 0, P.col); on("data-al", 0, PCS.align || "l");
    on("data-st", 0, PCS.stamp); on("data-pm", 0, PCS.pm); on("data-pmf", 0, PCS.pmFont); on("data-pmc", 0, PCS.pmCol);
    pc.querySelectorAll("[data-t]").forEach(function (i) { if (i.value !== T[i.dataset.t]) i.value = T[i.dataset.t] || ""; if (i.tagName === "TEXTAREA") grow(i); });
    var bi = pc.querySelector("[data-brand]"); if (bi.value !== PCS.brandText) bi.value = PCS.brandText;
    pc.querySelectorAll("[data-opt]").forEach(function (c) { c.checked = !!PCS[c.dataset.opt]; });
    pc.querySelector("[data-t=m]").disabled = !PCS.showMeta; bi.disabled = !PCS.showBrand;
    pc.querySelector(".pcsec-stamp").hidden = !(PCS.fmt === "b" || PCS.fmt === "e");
    pc.querySelector(".pcpm").hidden = PCS.pm === "none";
    var r = pc.querySelector("[data-size]"); r.value = PCS.size || 100; pc.querySelector("[data-size-out]").textContent = r.value + "%";
  }
  var lt = 0;
  function later() { clearTimeout(lt); lt = setTimeout(draw, 140); }
  function draw() {
    var f = pc._f, v = pc.querySelector(".pcv"), fk = PCS.fmt, T = TXT[f.id], P = per();
    if (!pcCanvas || pcImg.id !== f.id) v.innerHTML = '<p class="pcw">正在做……</p>';
    var src = BASE + (f.b ? "assets/photos/" + f.id + "-1600.webp" : "assets/lg/" + f.id + ".webp");
    var need = (T.t || "") + (T.b || "") + (T.s || "") + "卷寄自远方", small = (T.m || "") + (T.pa || "") + (T.pd || "") + (T.pb || "") + (PCS.brandText || "") + (T.v || "");
    var fonts = document.fonts ? Promise.race([Promise.all([
      document.fonts.load(fnt(P.font, 56, 1), need), document.fonts.load(fnt(P.font, 40), need), document.fonts.load("40px " + ZH, need + small),
      document.fonts.load(pmFont(PCS.pmFont, 30), small), document.fonts.load('italic 28px "EB Garamond"', small + "POST CARD ½"),
      document.fonts.load("26px " + MONO, small + "0123456789·▸"), document.fonts.load("172px Marcellus", (PCS.brandText || "").toUpperCase())]).catch(function () {}),
      new Promise(function (ok) { setTimeout(ok, 3500); })]) : Promise.resolve();
    var imgP = pcImg.id === f.id ? Promise.resolve(pcImg) : Promise.all([
      loadImg(src).catch(function () { return loadImg(BASE + "assets/mid/" + f.id + ".webp"); }),
      Promise.all(neighbours(f).map(function (n) {
        return loadImg(BASE + "assets/mid/" + n[1] + ".webp").then(function (i) { return [n[0], n[1], i]; }, function () { return [n[0], n[1], null]; });
      }))]).then(function (r) { pcImg = {id: f.id, im: r[0], nb: r[1]}; return pcImg; });
    Promise.all([imgP, fonts]).then(function (r) {
      if (pc._f !== f || PCS.fmt !== fk) return;
      pcCanvas = renderCard(fk, f, r[0].im, (V().rot(f) || 0) % 360, fk === "c" ? r[0].nb : []);
      v.innerHTML = ""; v.appendChild(pcCanvas);
      v.className = "pcv pcv-" + fk;
      var sh = pc.querySelector("[data-share]");
      try { sh.hidden = !(navigator.canShare && navigator.canShare({files: [new File(["x"], "x.jpg", {type: "image/jpeg"})]})); }
      catch (e) { sh.hidden = true; }
    }, function () { v.innerHTML = '<p class="pcw">这一格的图片没载入，稍后再试。</p>'; });
  }
  function save(share) {
    if (!pcCanvas) return;
    var f = pc._f, name = "卷-" + f.id + "-" + FM[PCS.fmt].n + ".jpg";
    pcCanvas.toBlob(function (b) {
      if (!b) return;
      if (share && navigator.share) {
        navigator.share({files: [new File([b], name, {type: "image/jpeg"})], title: (TXT[f.id].t || name).split("\n")[0]}).catch(function () {});
        return;
      }
      var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }, "image/jpeg", .92);
  }
})();
