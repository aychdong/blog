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
    im.onload = function () { window.__rotFit(im); };
    im.src = mid(rid, f.n);
    im.alt = f.cap || ("第 " + f.n + " 格");
    v.querySelector(".fno").textContent = rid + " · " + f.n;
    var cap = v.querySelector(".cap");
    cap.textContent = f.cap || "这一格没写说明";
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

  if (window.VIEW && window.VIEW.length) {
    LIST = window.VIEW.slice();
  } else if (window.FILMDATA) {
    for (var rid in window.FILMDATA) {
      var r = window.FILMDATA[rid];
      for (var j = 0; j < r.frames.length; j++) {
        var f = r.frames[j];
        LIST.push({id: rid + "-" + f.n, rid: rid, n: f.n, cap: f.cap, b: f.b,
                   note: f.note, rot: f.rot,
                   pick: f.pick, place: r.place, roll: r.zh});
      }
    }
  }
  if (!LIST.length) return;

  var IX = {};
  for (var i = 0; i < LIST.length; i++) IX[LIST[i].id] = i;

  var src = function (f) {
    return BASE + (f.b ? "assets/photos/" + f.id + "-1600.webp"
                       : "assets/mid/" + f.id + ".webp");
  };

  var box = null, cur = -1, prevHash = "", capOn = true;
  try { capOn = localStorage.getItem("rolls-cap") !== "0"; } catch (e) {}

  function build() {
    box = document.createElement("div");
    box.className = "vw"; box.hidden = true; box.tabIndex = -1;
    box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "看片台");
    box.innerHTML =
      '<div class="stage">' +
        '<button class="pv" type="button" aria-label="上一格">&#8592;</button>' +
        '<img alt="">' +
        '<button class="nx" type="button" aria-label="下一格">&#8594;</button>' +
        '<div class="tools">' +
          '<button type="button" data-rot title="转 90 度">转</button>' +
          '<button type="button" data-ana aria-pressed="false">分析</button>' +
          '<button type="button" data-cap>说明</button>' +
          '<button type="button" data-close>关闭 &#10005;</button>' +
        '</div>' +
        '<div class="keys">&#8592; &#8594; 过片 · T 转 · A 分析 · C 说明 · Esc 退出</div>' +
        '<div class="rothint"></div>' +
      '</div>' +
      '<div class="ana"><button type="button" class="anatog"></button>' +
        '<div class="w"></div><div class="h"></div>' +
        '<div class="nums"></div></div>' +
      '<div class="bar"><span class="fno"></span>' +
        '<div class="txt"><p class="cap"></p><p class="note"></p></div>' +
        '<span class="meta"></span><div class="rail"></div></div>';
    document.body.appendChild(box);
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
    box.querySelector(".stage").addEventListener("click", function (e) {
      if (e.target === e.currentTarget) close();
    });
    rail.addEventListener("click", function (e) {
      var bars = [].slice.call(rail.children), k = bars.indexOf(e.target);
      if (k >= 0) go(k);
    });
  }

  /* 转片。先用文案里写死的方向，再用这台机器上自己转过的。
     真要永久改正，在「写文案」里转一下，那儿写进源文件，发布出去大家都看得到。 */
  var ROT = window.__rotStore(), anaOn = window.__anaPref();

  function rotOf(f) { return f ? (f.id in ROT ? ROT[f.id] : (+f.rot || 0)) : 0; }

  function rot(by) {
    var f = LIST[cur]; if (!f) return;
    ROT[f.id] = ((rotOf(f) + by) % 360 + 360) % 360;
    window.__rotSave(ROT);
    var im = box.querySelector(".stage img");
    im.setAttribute("data-rot", ROT[f.id]);
    window.__rotFit(im);
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
    window.__anaSave(anaOn);
    paintAna();
    if (anaOn) drawAna();
  }
  function drawAna() {
    var f = LIST[cur];
    if (!f || !window.COLORLAB) return;
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

  function toggleCap() {
    capOn = !capOn;
    try { localStorage.setItem("rolls-cap", capOn ? "1" : "0"); } catch (e) {}
    box.querySelector(".bar").classList.toggle("off", !capOn);
  }

  function go(k) {
    if (k < 0 || k >= LIST.length) return;
    var f = LIST[k]; cur = k;
    var im = box.querySelector(".stage img");
    im.classList.remove("sw"); void im.offsetWidth; im.classList.add("sw");
    im.onerror = function () {            // 万一大图不在，退回中图，别给个破图标
      im.onerror = null; im.src = BASE + "assets/mid/" + f.id + ".webp";
    };
    im.style.transform = "";
    im.setAttribute("data-rot", rotOf(f));
    im.onload = function () { window.__rotFit(im); };
    im.src = src(f);
    im.alt = f.cap || (f.rid + " 卷第 " + f.n + " 格");
    box.querySelector(".fno").textContent = f.rid + " · " + f.n;
    var cap = box.querySelector(".cap");
    cap.textContent = f.cap || "这一格没写说明";
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
    try { history.replaceState(null, "", "#v=" + f.id); } catch (e) {}
    [k + 1, k - 1].forEach(function (n) {
      if (LIST[n]) { var p = new Image(); p.src = src(LIST[n]); }
    });
  }

  function open(id) {
    if (!(id in IX)) return;
    if (!box) build();
    prevHash = location.hash && location.hash.indexOf("#v=") !== 0 ? location.hash : "";
    box.querySelector(".bar").classList.toggle("off", !capOn);
    box.hidden = false;
    requestAnimationFrame(function () { box.classList.add("in"); });
    document.documentElement.style.overflow = "hidden";
    go(IX[id]); box.focus();
  }

  function close() {
    if (!box || box.hidden) return;
    box.classList.remove("in");
    document.documentElement.style.overflow = "";
    setTimeout(function () { box.hidden = true; }, 200);
    try { history.replaceState(null, "", location.pathname + location.search + prevHash); } catch (e) {}
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
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
    else if (e.key === "c" || e.key === "C") { e.preventDefault(); toggleCap(); }
    else if (e.key === "t" || e.key === "T") { e.preventDefault(); rot(90); }
    else if (e.key === "a" || e.key === "A") { e.preventDefault(); toggleAna(); }
  });

  window.__vw = {open: open, close: close};

  function fromHash() {
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
   看片台 —— 选一卷装上台子，一格一格过
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var lt = document.querySelector(".lt");
  if (!lt || !window.FILMDATA) return;
  var BASE = document.documentElement.getAttribute("data-base") || "";
  var D = window.FILMDATA;
  var img = document.getElementById("ltimg"),
      railBox = lt.querySelector(".ltrail"), rail = railBox.querySelector(".in"),
      fno = lt.querySelector(".fno"), cap = lt.querySelector(".cap"),
      meta = lt.querySelector(".meta"), goroll = lt.querySelector("[data-goroll]"),
      lnote = lt.querySelector(".ltinfo .note");
  var list = [], cur = 0, rollKey = "";

  function flatten(rid) {
    var out = [], ids = rid === "*" ? Object.keys(D) : [rid];
    ids.forEach(function (k) {
      var r = D[k];
      r.frames.forEach(function (f) {
        out.push({id: k + "-" + f.n, rid: k, n: f.n, cap: f.cap, b: f.b,
                  note: f.note, rot: f.rot,
                  pick: f.pick, place: r.place, roll: r.zh, fmt: r.fmt});
      });
    });
    return out;
  }
  function src(f) {
    return BASE + (f.b ? "assets/photos/" + f.id + "-1600.webp"
                       : "assets/mid/" + f.id + ".webp");
  }

  function loadRoll(rid, startId) {
    rollKey = rid;
    list = flatten(rid);
    lt.querySelectorAll(".chip").forEach(function (c) {
      c.classList.toggle("on", c.getAttribute("data-roll") === rid);
    });
    railBox.classList.toggle("full", rid !== "*" && D[rid] && D[rid].fmt.indexOf("半格") < 0);
    rail.innerHTML = list.map(function (f, i) {
      return '<button type="button" data-i="' + i + '" class="' + (f.pick ? "pick" : "") +
             '" aria-label="第 ' + f.n + ' 格"><img loading="lazy" decoding="async" src="' +
             BASE + "assets/strip/" + f.id + '.webp" alt=""></button>';
    }).join("");
    var k = 0;
    if (startId) for (var j = 0; j < list.length; j++) if (list[j].id === startId) { k = j; break; }
    show(k);
  }

  function show(k) {
    if (k < 0 || k >= list.length) return;
    cur = k; var f = list[k];
    img.classList.remove("sw"); void img.offsetWidth; img.classList.add("sw");
    img.onerror = function () { img.onerror = null; img.src = BASE + "assets/mid/" + f.id + ".webp"; };
    img.style.transform = "";
    img.setAttribute("data-rot", lrotOf(f));
    img.onload = function () { window.__rotFit(img); };
    img.src = src(f);
    img.alt = f.cap || (f.rid + " 卷第 " + f.n + " 格");
    fno.textContent = f.rid + " · " + f.n;
    cap.textContent = f.cap || "这一格没写说明";
    cap.className = "cap" + (f.cap ? "" : " none");
    if (lnote) lnote.textContent = f.note || "";
    meta.textContent = f.roll + "　" + f.place + "　" + (k + 1) + " / " + list.length +
                       (f.pick ? "　· 选用" : "");
    lt.querySelector(".ltnav.pv").disabled = k === 0;
    lt.querySelector(".ltnav.nx").disabled = k === list.length - 1;
    var bs = rail.children;
    for (var j = 0; j < bs.length; j++) bs[j].classList.toggle("on", j === k);
    if (bs[k]) {                      // 只滚这条片带，别把整页也带着滚
      var el = bs[k];
      railBox.scrollTo({left: el.offsetLeft - railBox.clientWidth / 2 + el.offsetWidth / 2,
                        behavior: "smooth"});
    }
    if (goroll) goroll.href = (window.__href || function (x) { return x; })(BASE + "rolls/" + f.rid + "/");
    try { history.replaceState(null, "", "#" + f.id); } catch (e) {}
    [k + 1, k - 1].forEach(function (n) {
      if (list[n]) { var pre = new Image(); pre.src = src(list[n]); }
    });
  }

  function randomFrame() {
    var all = flatten("*"), x = all[Math.floor(Math.random() * all.length)];
    loadRoll(x.rid, x.id);
  }

  var LROT = window.__rotStore();
  function lrotOf(f) { return f ? (f.id in LROT ? LROT[f.id] : (+f.rot || 0)) : 0; }
  function ltRot() {
    var f = list[cur]; if (!f) return;
    LROT[f.id] = ((lrotOf(f) + 90) % 360 + 360) % 360;
    window.__rotSave(LROT);
    img.setAttribute("data-rot", LROT[f.id]);
    window.__rotFit(img);
  }
  lt.addEventListener("click", function (e) {
    if (e.target.closest("[data-ltrot]")) { ltRot(); return; }
    var chip = e.target.closest(".chip");
    if (chip) { loadRoll(chip.getAttribute("data-roll")); return; }
    var tb = e.target.closest(".ltrail button");
    if (tb) { show(+tb.getAttribute("data-i")); return; }
    if (e.target.closest(".ltnav.pv")) { show(cur - 1); return; }
    if (e.target.closest(".ltnav.nx")) { show(cur + 1); return; }
    if (e.target.closest("[data-rnd]")) { randomFrame(); return; }
    if (e.target.closest("[data-full]") || e.target === img) {
      if (window.__vw && list[cur]) window.__vw.open(list[cur].id);
    }
  });

  addEventListener("keydown", function (e) {
    if (document.querySelector(".vw:not([hidden])")) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); show(cur - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); show(cur + 1); }
    else if (e.key === "f" || e.key === "F") {
      e.preventDefault(); if (window.__vw && list[cur]) window.__vw.open(list[cur].id);
    } else if (e.key === "r" || e.key === "R") { e.preventDefault(); randomFrame(); }
    else if (e.key === "t" || e.key === "T") { e.preventDefault(); ltRot(); }
  });

  /* 起手：地址里指定了就开那一格；随便看就随机；否则第一卷 */
  var m = /^#(\d+-[\w]+)$/.exec(location.hash);
  if (m && m[1].split("-")[0] in D) loadRoll(m[1].split("-")[0], m[1]);
  else if (lt.getAttribute("data-surprise") === "1") randomFrame();
  else loadRoll(Object.keys(D)[0]);
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
