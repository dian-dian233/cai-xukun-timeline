/* ══════════════════════════════════════════
   来时路 · 交互脚本
   1) 篮球渲染（缝线球体，可拖、可点）
   2) 漂浮字粒子
   3) 入场 / 进度条
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─────────── 篮球球体 ─────────── */
  function createBall(canvas, opt) {
    if (!canvas || !canvas.getContext) return null;
    var o = Object.assign({ spin: 0.007, tilt: -0.34, glow: 1, onClick: null }, opt || {});
    var ctx = canvas.getContext('2d');
    var dpr = 1, size = 0, cx = 0, cy = 0, R = 0;
    var ang = 0.55, boost = 0, running = false, onScreen = true;

    var MERIDIANS = [0, 60, -60, 120, -120, 180];

    function meridian(deg) {
      var lam = deg * Math.PI / 180, pts = [], N = 46, i, phi;
      for (i = 0; i <= N; i++) {
        phi = -Math.PI / 2 + Math.PI * i / N;
        pts.push([Math.cos(phi) * Math.sin(lam), Math.sin(phi), Math.cos(phi) * Math.cos(lam)]);
      }
      return pts;
    }
    function equator() {
      var pts = [], N = 64, i, u;
      for (i = 0; i <= N; i++) { u = 2 * Math.PI * i / N; pts.push([Math.cos(u), 0, Math.sin(u)]); }
      return pts;
    }
    var seams = MERIDIANS.map(meridian);
    seams.push(equator());

    function project(p) {
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var x = p[0] * ca + p[2] * sa;
      var z = -p[0] * sa + p[2] * ca;
      var y = p[1];
      var ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
      var yy = y * ct - z * st;
      var zz = y * st + z * ct;
      return [cx + x * R, cy - yy * R, zz];
    }

    function fit() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      size = rect.width;
      cx = size / 2; cy = size / 2; R = size * 0.355;
    }

    function draw() {
      if (!size) return;
      ctx.clearRect(0, 0, size, size);

      /* 外发光 */
      var halo = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.32);
      halo.addColorStop(0, 'rgba(232,121,31,' + (0.26 * o.glow).toFixed(3) + ')');
      halo.addColorStop(0.55, 'rgba(216,178,106,' + (0.10 * o.glow).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(232,121,31,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      /* 球体 */
      var base = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.42, R * 0.06, cx + R * 0.1, cy + R * 0.2, R * 1.18);
      base.addColorStop(0, '#ffc182');
      base.addColorStop(0.34, '#ef7f24');
      base.addColorStop(0.72, '#bd5711');
      base.addColorStop(1, '#6b2905');
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = base; ctx.fill();

      /* 缝线 */
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      ctx.lineWidth = Math.max(1, R * 0.058);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(40,15,4,.62)';
      seams.forEach(function (pts) {
        var pen = false, i, q;
        ctx.beginPath();
        for (i = 0; i < pts.length; i++) {
          q = project(pts[i]);
          if (q[2] > -0.02) {
            if (!pen) { ctx.moveTo(q[0], q[1]); pen = true; }
            else { ctx.lineTo(q[0], q[1]); }
          } else { pen = false; }
        }
        ctx.stroke();
      });
      ctx.restore();

      /* 边缘暗角 */
      var rim = ctx.createRadialGradient(cx - R * 0.18, cy - R * 0.24, R * 0.34, cx, cy, R * 1.02);
      rim.addColorStop(0, 'rgba(0,0,0,0)');
      rim.addColorStop(0.7, 'rgba(0,0,0,0)');
      rim.addColorStop(1, 'rgba(8,3,0,.62)');
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = rim; ctx.fill();

      /* 高光 */
      var hl = ctx.createRadialGradient(cx - R * 0.36, cy - R * 0.46, R * 0.02, cx - R * 0.3, cy - R * 0.4, R * 0.62);
      hl.addColorStop(0, 'rgba(255,240,218,' + (0.5 * Math.min(1, o.glow)).toFixed(3) + ')');
      hl.addColorStop(1, 'rgba(255,240,218,0)');
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = hl; ctx.fill();
    }

    function tick() {
      ang += o.spin + boost;
      boost *= 0.93;
      if (Math.abs(boost) < 2e-4) boost = 0;
      draw();
      running = onScreen ? window.requestAnimationFrame(tick) : false;
    }
    function start() {
      if (reduce || running) { draw(); return; }
      running = true;
      window.requestAnimationFrame(tick);
    }
    function stop() { running = false; }

    /* 尺寸 */
    fit();
    draw();
    window.addEventListener('resize', function () { fit(); draw(); }, { passive: true });
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { fit(); draw(); }).observe(canvas);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          onScreen = e.isIntersecting;
          if (onScreen && !running) start();
        });
      }, { threshold: 0.05 }).observe(canvas);
    }
    start();

    /* 拖动 / 点击 */
    var dragging = false, lastX = 0, moved = 0, vel = 0;
    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; moved = 0; vel = 0; lastX = e.clientX;
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      lastX = e.clientX;
      ang += dx * 0.009;
      vel = dx * 0.009;
      moved += Math.abs(dx);
      if (reduce) draw();
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      boost = Math.max(-0.14, Math.min(0.14, vel));
      if (moved < 6 && o.onClick) {
        var r = canvas.getBoundingClientRect();
        o.onClick(r.left + r.width / 2, r.top + r.height / 2 - 10);
      }
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && o.onClick) {
        e.preventDefault();
        var r = canvas.getBoundingClientRect();
        o.onClick(r.left + r.width / 2, r.top + r.height / 2 - 10);
      }
    });

    return { draw: function () { fit(); draw(); }, kick: function (v) { boost = v; } };
  }

  /* ─────────── 漂浮字 ─────────── */
  var CHANTS = ['只因你太美', '鸡你太美', '篮球', '中分头', '背带裤', '你干嘛~'];

  function popText(x, y, txt) {
    var el = document.createElement('span');
    el.className = 'pop';
    el.textContent = txt || CHANTS[(Math.random() * CHANTS.length) | 0];
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--dx', (Math.random() * 90 - 45).toFixed(0) + 'px');
    el.style.setProperty('--rot', (Math.random() * 34 - 17).toFixed(0) + 'deg');
    document.body.appendChild(el);
    window.setTimeout(function () { el.remove(); }, 1600);
  }

  /* ─────────── 挂载 ─────────── */
  var hits = 0;
  var hint = document.getElementById('hitHint');

  var heroBall = createBall(document.getElementById('heroBall'), { spin: 0.008, tilt: -0.36, glow: 0.85,
    onClick: function (x, y) { popText(x, y, '只因你太美'); } });

  var memeBall = createBall(document.getElementById('memeBall'), { spin: 0.012, tilt: -0.32, glow: 1.15,
    onClick: function (x, y) {
      hits++;
      popText(x, y);
      if (hint) {
        hint.textContent = hits >= 12 ? '全场最佳 · 已拍 ' + hits + ' 下'
                        : hits >= 5  ? '球感不错 · 已拍 ' + hits + ' 下'
                        : '已拍 ' + hits + ' 下';
      }
      var c = document.getElementById('memeBall');
      if (c) {
        c.classList.remove('bump');
        void c.offsetWidth;
        c.classList.add('bump');
      }
      if (memeBall) memeBall.kick(0.05);
    } });

  /* ─────────── 幕间：两年半 ─────────── */
  (function () {
    var list = document.getElementById('ilMonths');
    if (list) {
      var n = 30, i, li;
      for (i = 0; i < n; i++) {
        li = document.createElement('li');
        li.style.setProperty('--i', i);
        if (i === n - 1) li.className = 'now';
        list.appendChild(li);
      }
    }

    var days = document.getElementById('ilDays');
    if (!days) return;
    var to = parseInt(days.getAttribute('data-to'), 10) || 913;
    var done = false;

    function run() {
      if (done) return;
      done = true;
      if (reduce) { days.textContent = to; return; }
      var t0 = performance.now(), dur = 1600;
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        days.textContent = Math.round(to * e);
        if (p < 1) window.requestAnimationFrame(step);
      })(t0);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) run(); });
      }, { threshold: 0.35 }).observe(days);
    } else { run(); }
  })();

  /* ─────────── 回声：点一句飞起来 ─────────── */
  Array.prototype.forEach.call(document.querySelectorAll('.echo'), function (el) {
    var line = el.querySelector('.echo-line');
    if (!line) return;
    function fire(e) {
      var r = line.getBoundingClientRect();
      popText(r.left + r.width / 2, r.top + Math.min(r.height / 2, 40), (line.textContent || '').trim());
    }
    el.addEventListener('click', fire);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(e); }
    });
  });

  /* ─────────── 首屏光斑 ─────────── */
  var hero = document.querySelector('.hero');
  if (!reduce && hero && window.matchMedia('(hover:hover)').matches) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  }

  /* ─────────── 入场 ─────────── */
  var items = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(items, function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    Array.prototype.forEach.call(items, function (el) { io.observe(el); });
  }

  /* ─────────── 进度条 ─────────── */
  var bar = document.getElementById('bar');
  var ticking = false;
  function paint() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(paint); }
  }, { passive: true });
  window.addEventListener('resize', paint, { passive: true });
  paint();

  /* 供调试 */
  window.__kuncourt = { heroBall: heroBall, memeBall: memeBall, pop: popText };
})();
