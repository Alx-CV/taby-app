/**
 * Taby blob: a living, shape-shifting companion drawn on a <canvas>.
 * Incorporates:
 * - TabyBlob: Mathematical spline-based blob with spring physics, expressions & gaze
 * - TabySense: Passive typing cadence & resting heart rate activation estimator
 * - TabyDirector: Safe action script validator, animator and router
 * - TabyHeart: Web Bluetooth LE Heart Rate monitor
 *
 * Extended with reactive states for interactive stress-relief guidance.
 */

(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }

  var COLORS = {
    teal: [74, 201, 192],
    tense: [95, 181, 176],
    amber: [242, 166, 90],
    sage: [127, 217, 168],
    indigo: [110, 140, 240],
    orchid: [179, 111, 195],
    lime: [203, 232, 112],
    dark: [11, 15, 20]
  };

  // Each mood is a target for shape, motion and face
  var MOODS = {
    calm:     { R: 1.00, sx: 1.00, sy: 1.00, spike: 0.0, speed: 1.0, glow: 1.0, tint: 0.0, expr: 'calm' },
    happy:    { R: 1.00, sx: 0.94, sy: 1.08, spike: 0.0, speed: 1.5, glow: 1.2, tint: 0.0, expr: 'happy' },
    curious:  { R: 1.00, sx: 0.96, sy: 1.06, spike: 0.0, speed: 1.2, glow: 1.0, tint: 0.0, expr: 'listen' },
    wobbly:   { R: 0.92, sx: 1.05, sy: 0.95, spike: 0.6, speed: 2.4, glow: 0.6, tint: 0.5, expr: 'worried' },
    tense:    { R: 0.84, sx: 1.08, sy: 0.90, spike: 1.0, speed: 3.2, glow: 0.3, tint: 1.0, expr: 'worried' },
    relieved: { R: 1.00, sx: 1.18, sy: 0.84, spike: 0.0, speed: 0.8, glow: 1.1, tint: 0.0, expr: 'calm' },
    proud:    { R: 1.02, sx: 1.00, sy: 1.02, spike: 0.0, speed: 1.2, glow: 1.4, tint: 0.0, expr: 'proud' },
    sleepy:   { R: 1.00, sx: 1.25, sy: 0.72, spike: 0.0, speed: 0.5, glow: 0.5, tint: 0.0, expr: 'sleep' }
  };
  var NUM_KEYS = ['R', 'sx', 'sy', 'spike', 'speed', 'glow', 'tint'];

  function TabyBlob(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.cur = {}; this.tgt = {};
    var start = MOODS[opts.mood] || MOODS.calm;
    for (var i = 0; i < NUM_KEYS.length; i++) { this.cur[NUM_KEYS[i]] = start[NUM_KEYS[i]]; }
    this.mood = opts.mood || 'calm';
    this.expr = start.expr;
    this.base = opts.color || COLORS.teal;
    this.reduceMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.motion = this.reduceMotion ? 0.35 : 1;
    this.squash = 0; this.squashV = 0;      // spring for poke
    this.hopY = 0; this.hopV = 0;           // spring for hop
    this.blinkAt = 1.5; this.blinkT = -1;
    this.gaze = { x: 0, y: 0, tx: 0, ty: 0 };
    this.nextWander = 3;
    this.tilt = 0;
    this.breath = null;
    this.bubble = null;
    this.tempExpr = null; this.tempUntil = 0;
    this.stars = 0;
    this.hooks = { update: null, before: null, after: null };
    this.ov = { dx: 0, dy: 0, scale: 1 };
    this.shakeUntil = 0;
    this.isThinking = false;
    this._last = 0;
    this._running = false;
    this._phase = [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU, Math.random() * TAU];
    this._bind();
    this.resize();
    this.start();
  }

  TabyBlob.prototype._bind = function () {
    var self = this;
    this._onMove = function (e) {
      if (!self.canvas || !self.canvas.offsetParent) return;
      var r = self.canvas.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      var y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      self.gaze.tx = clamp(x, -1, 1);
      self.gaze.ty = clamp(y, -1, 1);
      self.nextWander = self.t + 4;
    };
    this._onDown = function () { self.poke(); };
    global.addEventListener('pointermove', this._onMove, { passive: true });
    this.canvas.addEventListener('pointerdown', this._onDown);
    if (global.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self.resize(); });
      this._ro.observe(this.canvas);
    }
    this._onVis = function () { if (document.hidden) { self.stop(); } else { self.start(); } };
    document.addEventListener('visibilitychange', this._onVis);
  };

  TabyBlob.prototype.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.W = w; this.H = h; this.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  TabyBlob.prototype.setMood = function (name) {
    if (!MOODS[name] || name === this.mood) { return; }
    this.mood = name;
    this.blinkT = this.t;
    var self = this;
    setTimeout(function () { self.expr = MOODS[name].expr; }, 90);
    if (name === 'proud') { this.stars = this.t; }
    if (name === 'happy' || name === 'proud') { this.hop(); }
  };

  TabyBlob.prototype.getMood = function () { return this.mood; };
  TabyBlob.prototype.poke = function () {
    this.squashV += 5 * this.motion;
    this.tempExpr = 'happy';
    this.tempUntil = this.t + 0.7;
    this.blinkT = this.t;
  };
  TabyBlob.prototype.hop = function () { this.hopV -= 260 * this.motion; };
  TabyBlob.prototype.shake = function (sec) { if (!this.reduceMotion) { this.shakeUntil = this.t + (sec || 1); } };
  TabyBlob.prototype.nod = function () { this.hopV += 140 * this.motion; };
  TabyBlob.prototype.tiltBy = function (a) { this.tilt = a; this.nextWander = this.t + 2.5; };
  TabyBlob.prototype.lookAt = function (x, y, sec) {
    this.gaze.tx = clamp(x, -1, 1);
    this.gaze.ty = clamp(y, -1, 1);
    this.nextWander = this.t + (sec || 2);
  };
  TabyBlob.prototype.say = function (text, seconds) {
    this.bubble = { text: text, until: this.t + (seconds || 3) };
  };

  // Thinking state when LLM is generating a response
  TabyBlob.prototype.setThinking = function (isThinking) {
    this.isThinking = !!isThinking;
    if (this.isThinking) {
      this.setMood('curious');
      this.tempExpr = 'listen';
      this.tempUntil = this.t + 30; // will be cancelled on completion
    } else {
      this.tempExpr = null;
      this.setMood('calm');
    }
  };

  // Guided breathing: blob swells on inhale, holds, shrinks on exhale
  TabyBlob.prototype.breathe = function (o) {
    o = o || {};
    this.breath = {
      inhale: o.inhale || 2,
      hold: o.hold === undefined ? 1 : o.hold,
      exhale: o.exhale || 3,
      cycles: o.cycles || 1,
      start: this.t,
      onDone: o.onDone,
      onPhase: o.onPhase,
      phase: ''
    };
    this.tempExpr = 'sleep';
    this.tempUntil = this.t + (this.breath.inhale + this.breath.hold + this.breath.exhale) * this.breath.cycles;
  };

  TabyBlob.prototype._breathScale = function () {
    var b = this.breath; if (!b) { return 1; }
    var cyc = b.inhale + b.hold + b.exhale, u = this.t - b.start;
    if (u >= cyc * b.cycles) {
      var done = b.onDone;
      this.breath = null;
      if (done) { done(); }
      return 1;
    }
    var m = u % cyc, ph, s;
    if (m < b.inhale) {
      ph = 'inhale'; s = 1 + 0.32 * ease(m / b.inhale);
    } else if (m < b.inhale + b.hold) {
      ph = 'hold'; s = 1.32;
    } else {
      ph = 'exhale'; s = 1.32 - 0.36 * ease((m - b.inhale - b.hold) / b.exhale);
    }
    if (ph !== b.phase) {
      b.phase = ph;
      if (b.onPhase) { b.onPhase(ph); }
    }
    return s;
  };
  TabyBlob.prototype.isBreathing = function () { return !!this.breath; };

  TabyBlob.prototype.start = function () {
    if (this._running) { return; }
    this._running = true; this._last = 0; var self = this;
    this._raf = global.requestAnimationFrame(function loop(ts) {
      if (!self._running) { return; }
      var dt = self._last ? Math.min(0.05, (ts - self._last) / 1000) : 0.016;
      self._last = ts;
      self.update(dt);
      self.draw();
      self._raf = global.requestAnimationFrame(loop);
    });
  };

  TabyBlob.prototype.stop = function () {
    this._running = false;
    if (this._raf) { global.cancelAnimationFrame(this._raf); }
  };

  TabyBlob.prototype.destroy = function () {
    this.stop();
    global.removeEventListener('pointermove', this._onMove);
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this._onDown);
    }
    document.removeEventListener('visibilitychange', this._onVis);
    if (this._ro) { this._ro.disconnect(); }
  };

  TabyBlob.prototype.update = function (dt) {
    this.t += dt;
    var tgt = MOODS[this.mood] || MOODS.calm, k = 1 - Math.exp(-dt / 0.45);
    for (var i = 0; i < NUM_KEYS.length; i++) {
      var key = NUM_KEYS[i];
      this.cur[key] += (tgt[key] - this.cur[key]) * k;
    }

    // Thinking state micro-wobble
    if (this.isThinking) {
      this.tilt = Math.sin(this.t * 3.5) * 0.08;
      this.cur.glow = 1.4 + Math.sin(this.t * 5) * 0.3;
    }

    // Springs
    var acc = -60 * this.squash - 7 * this.squashV;
    this.squashV += acc * dt; this.squash += this.squashV * dt;
    var acc2 = -50 * this.hopY - 6 * this.hopV;
    this.hopV += acc2 * dt; this.hopY += this.hopV * dt;

    // Blink
    if (this.t > this.blinkAt) {
      this.blinkT = this.t;
      this.blinkAt = this.t + 2.2 + Math.random() * 3.2;
    }

    // Gaze
    if (this.t > this.nextWander) {
      this.gaze.tx = (Math.random() - 0.5) * 1.4;
      this.gaze.ty = (Math.random() - 0.5) * 0.8;
      this.nextWander = this.t + 3 + Math.random() * 4;
      if (!this.isThinking) {
        this.tilt = (Math.random() - 0.5) * 0.08;
      }
    }
    var gk = 1 - Math.exp(-dt / 0.18);
    this.gaze.x += (this.gaze.tx - this.gaze.x) * gk;
    this.gaze.y += (this.gaze.ty - this.gaze.y) * gk;
    this.tiltCur = (this.tiltCur || 0) + (this.tilt - (this.tiltCur || 0)) * (1 - Math.exp(-dt / 0.6));

    if (this.tempExpr && this.t > this.tempUntil) { this.tempExpr = null; }
    if (this.bubble && this.t > this.bubble.until) { this.bubble = null; }
    if (this.hooks.update) { this.hooks.update(dt); }
  };

  TabyBlob.prototype._path = function (cx, cy, R, sx, sy, spike, tm) {
    var ctx = this.ctx, N = 72, pts = [], p = this._phase, m = this.motion;
    for (var i = 0; i < N; i++) {
      var a = TAU * i / N;
      var r = R * (1 + 0.05 * Math.sin(2 * a + p[0] + tm * 0.9 * m) + 0.04 * Math.sin(3 * a + p[1] + tm * 1.3 * m)
                 + spike * (0.09 * Math.sin(7 * a + p[2] + tm * 3 * m) + 0.06 * Math.sin(5 * a + p[3] + tm * 2.2 * m)));
      pts.push([cx + sx * r * Math.cos(a), cy + sy * r * Math.sin(a)]);
    }
    ctx.beginPath();
    var mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    var m0 = mid(pts[N - 1], pts[0]); ctx.moveTo(m0[0], m0[1]);
    for (var j = 0; j < N; j++) {
      var nx = pts[(j + 1) % N], mm = mid(pts[j], nx);
      ctx.quadraticCurveTo(pts[j][0], pts[j][1], mm[0], mm[1]);
    }
    ctx.closePath();
  };

  TabyBlob.prototype.draw = function () {
    var ctx = this.ctx, c = this.cur, W = this.W, H = this.H, t = this.t;
    ctx.clearRect(0, 0, W, H);
    var size = Math.min(W, H), baseR = size * 0.26;
    var bs = this._breathScale(), idle = 1 + 0.025 * Math.sin(t * TAU / 6) * this.motion;
    var R = baseR * c.R * bs * idle * this.ov.scale;
    var sq = this.squash * 0.18 * this.motion, sx = c.sx * (1 + sq), sy = c.sy * (1 - sq);
    var shake = this.t < this.shakeUntil ? Math.sin(t * 42) * size * 0.04 * this.motion : 0;
    var cx = W / 2 + this.ov.dx * size * 0.5 + shake;
    var cy = H / 2 + this.hopY * 0.35 * size / 300 + this.ov.dy * size * 0.5;
    var col = mix(this.base, COLORS.tense, c.tint);
    var frame = { cx: cx, cy: cy, R: R, W: W, H: H, size: size, t: t };

    if (this.hooks.before) { this.hooks.before(ctx, frame); }
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate((this.tiltCur || 0) * this.motion); ctx.translate(-cx, -cy);

    // Breathing ring
    if (this.breath) {
      ctx.strokeStyle = rgba(COLORS.teal, 0.45);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5 * Math.max(sx, sy), 0, TAU);
      ctx.stroke();
    }

    // Glow
    var gl = [[1.9, 0.06], [1.5, 0.1], [1.22, 0.18]];
    for (var g = 0; g < gl.length; g++) {
      ctx.fillStyle = rgba(col, gl[g][1] * c.glow);
      this._path(cx, cy, R * gl[g][0], sx, sy, c.spike, t);
      ctx.fill();
    }

    // Body
    ctx.fillStyle = rgba(col, 1);
    this._path(cx, cy, R, sx, sy, c.spike, t);
    ctx.fill();

    // Shading highlight & depth
    ctx.save();
    this._path(cx, cy, R, sx, sy, c.spike, t);
    ctx.clip();
    ctx.fillStyle = 'rgba(11,15,20,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + R * 0.9 * sy, R * 1.6, R * 0.9 * sy, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.35 * sx, cy - R * 0.55 * sy, R * 0.27 * sx, R * 0.24 * sy, -0.4, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Face
    this._face(cx, cy, R * Math.min(sx, 1.12) * Math.min(1, sy + 0.3));
    ctx.restore();

    if (this.hooks.after) { this.hooks.after(ctx, frame); }
    if (this.expr === 'proud' || this.mood === 'proud') { this._stars(cx, cy, R); }
    if (this.mood === 'sleepy') {
      ctx.fillStyle = rgba(COLORS.teal, 0.8);
      ctx.font = 'italic ' + (size * 0.07 | 0) + 'px Georgia, serif';
      ctx.fillText('z', cx + R * 0.9, cy - R * 0.9 + Math.sin(t * 1.5) * 4);
      ctx.fillText('Z', cx + R * 1.15, cy - R * 1.25 + Math.sin(t * 1.5 + 1) * 4);
    }
    if (this.bubble) { this._bubble(cx, cy - R * 1.7, this.bubble.text); }
  };

  TabyBlob.prototype._face = function (cx, cy, R) {
    var ctx = this.ctx, expr = this.tempExpr || this.expr, dark = rgba(COLORS.dark, 1);
    var blinking = this.t - this.blinkT < 0.13 && this.t - this.blinkT >= 0;
    var gx = this.gaze.x * R * 0.07, gy = this.gaze.y * R * 0.05;
    var ex = 0.3 * R, ey = cy - 0.12 * R + gy, er = 0.09 * R, lw = Math.max(1.5, R * 0.06);

    ctx.strokeStyle = dark; ctx.fillStyle = dark; ctx.lineWidth = lw; ctx.lineCap = 'round';
    var closed = expr === 'sleep' || blinking;

    // Eyes
    for (var s = -1; s <= 1; s += 2) {
      var x = cx + s * ex + gx;
      if (closed) {
        ctx.beginPath();
        ctx.arc(x, ey + er * 0.4, er * 1.5, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, ey, er * (expr === 'worried' ? 0.85 : (expr === 'listen' ? 1.15 : 1)), 0, TAU);
        ctx.fill();
      }
    }

    // Brows for worried
    if (expr === 'worried') {
      for (var b = -1; b <= 1; b += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + b * (ex + 0.16 * R) + gx, ey - 0.2 * R);
        ctx.lineTo(cx + b * (ex - 0.14 * R) + gx, ey - 0.3 * R);
        ctx.stroke();
      }
    }

    // Mouth
    var my = cy + 0.18 * R;
    ctx.beginPath();
    if (expr === 'happy' || expr === 'proud') {
      ctx.moveTo(cx - 0.22 * R, my);
      ctx.quadraticCurveTo(cx, my + 0.5 * R, cx + 0.22 * R, my);
      ctx.closePath();
      ctx.fill();
    } else if (expr === 'listen') {
      ctx.arc(cx, my + 0.08 * R, 0.07 * R, 0, TAU);
      ctx.stroke();
    } else if (expr === 'worried') {
      for (var i = 0; i <= 4; i++) {
        var xx = cx - 0.2 * R + i * 0.1 * R;
        var yy = my + (i % 2 ? -0.04 * R : 0.02 * R);
        if (i === 0) { ctx.moveTo(xx, yy); } else { ctx.lineTo(xx, yy); }
      }
      ctx.stroke();
    } else {
      ctx.arc(cx, my - 0.1 * R, 0.22 * R, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }

    // Cheeks
    ctx.fillStyle = 'rgba(255,154,168,0.35)';
    for (var c2 = -1; c2 <= 1; c2 += 2) {
      ctx.beginPath();
      ctx.arc(cx + c2 * 0.52 * R, cy + 0.1 * R, 0.12 * R, 0, TAU);
      ctx.fill();
    }
  };

  TabyBlob.prototype._stars = function (cx, cy, R) {
    var ctx = this.ctx, age = this.t - this.stars;
    if (age > 5) { return; }
    var a = clamp(1 - age / 5, 0, 1);
    for (var i = 0; i < 5; i++) {
      var ang = i * 1.25 + this.t * 0.8;
      var rr = R * (1.5 + 0.15 * Math.sin(this.t * 3 + i));
      var x = cx + rr * Math.cos(ang);
      var y = cy + rr * Math.sin(ang) * 0.85;
      ctx.fillStyle = rgba(i % 2 ? COLORS.lime : [255, 255, 255], a);
      ctx.beginPath();
      for (var k = 0; k < 10; k++) {
        var ra = k % 2 ? R * 0.05 : R * 0.12;
        var an = -Math.PI / 2 + k * Math.PI / 5;
        ctx.lineTo(x + ra * Math.cos(an), y + ra * Math.sin(an));
      }
      ctx.closePath(); ctx.fill();
    }
  };

  TabyBlob.prototype._bubble = function (x, y, text) {
    var ctx = this.ctx;
    ctx.font = '600 15px Inter, Arial, sans-serif';
    var w = ctx.measureText(text).width + 28, h = 34;
    ctx.fillStyle = 'rgba(234,240,245,0.96)';
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x - w / 2, y - h, w, h, 17); }
    else { ctx.rect(x - w / 2, y - h, w, h); }
    ctx.fill();
    ctx.fillStyle = '#0B0F14';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - h / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  };

  /* ---------------------------------------------------------------------------
     TabySense: typing rhythm + heart rate -> activation score & mood
  --------------------------------------------------------------------------- */
  function TabySense(opts) {
    opts = opts || {};
    this.restHr = opts.restHr || 68;
    this.initialRest = this.restHr;
    this.hr = null; this.hrAt = 0;
    this.gaps = [];
    this.backspaces = [];
    this.lastKey = 0;
    this.base = this._load() || { gap: 230, sd: 90, n: 0 };
    this.act = 0.15;
    this.reported = 0; this.reportedUntil = 0;
    this.mood = 'calm';
    this.moodSince = 0; this.lastNudge = 0; this.dismissed = 0;
    this.listeners = { mood: [], nudge: [], activation: [] };
    this._timer = null;
    this.sim = !!opts.simulate;
  }
  TabySense.prototype.on = function (ev, fn) { if (this.listeners[ev]) { this.listeners[ev].push(fn); } return this; };
  TabySense.prototype._emit = function (ev, v) { var a = this.listeners[ev] || []; for (var i = 0; i < a.length; i++) { a[i](v); } };
  TabySense.prototype._load = function () { try { return JSON.parse(global.localStorage.getItem('taby_typing_baseline')); } catch (e) { return null; } };
  TabySense.prototype._save = function () { try { global.localStorage.setItem('taby_typing_baseline', JSON.stringify(this.base)); } catch (e) {} };

  TabySense.prototype.attachTyping = function (el) {
    if (!el) return this;
    var self = this;
    el.addEventListener('keydown', function (e) {
      var now = Date.now();
      if (e.key === 'Backspace') { self.backspaces.push(now); }
      if (self.lastKey && now - self.lastKey < 2000) { self.gaps.push([now, now - self.lastKey]); }
      self.lastKey = now;
    });
    return this;
  };

  TabySense.prototype.setHeartRate = function (bpm) {
    var now = Date.now(); this.hr = bpm; this.hrAt = now;
    this.hrHist = (this.hrHist || []).filter(function (x) { return now - x[0] < 15 * 60 * 1000; });
    if (!this.hrHist.length || now - this.hrHist[this.hrHist.length - 1][0] > 4000) { this.hrHist.push([now, bpm]); }
    if (!this.restFixed && this.hrHist.length > 1 && now - this.hrHist[0][0] > 8 * 60 * 1000) {
      var v = this.hrHist.map(function (x) { return x[1]; }).sort(function (a, b) { return a - b; });
      this.restHr = clamp(v[Math.floor(v.length * 0.2)], 45, Math.min(90, (this.initialRest || 68) + 12));
    }
  };

  TabySense.prototype.setRestHr = function (bpm) { this.restHr = bpm; this.restFixed = true; };
  TabySense.prototype.selfReport = function (kind) {
    var bias = { good: -0.2, much: 0.25, overwhelmed: 0.4, flat: 0 }[kind] || 0;
    this.reported = bias; this.reportedUntil = Date.now() + 10 * 60 * 1000;
  };
  TabySense.prototype.dismissNudge = function () { this.dismissed++; this.lastNudge = Date.now(); };
  TabySense.prototype.acceptNudge = function () { this.dismissed = 0; this.lastNudge = Date.now(); };

  TabySense.prototype.features = function () {
    var now = Date.now(), win = 20000, i, g = [];
    this.gaps = this.gaps.filter(function (x) { return now - x[0] < win; });
    this.backspaces = this.backspaces.filter(function (x) { return now - x < win; });
    for (i = 0; i < this.gaps.length; i++) { g.push(this.gaps[i][1]); }
    var out = { typing: null, hr: null };
    if (g.length >= 8) {
      var mean = g.reduce(function (a, b) { return a + b; }, 0) / g.length;
      var sd = Math.sqrt(g.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / g.length);
      var speedZ = (this.base.gap - mean) / Math.max(40, this.base.sd);
      var cv = sd / Math.max(1, mean);
      var fixes = this.backspaces.length / Math.max(1, g.length);
      out.typing = clamp(0.6 * clamp(speedZ / 2, 0, 1) + 0.25 * clamp((cv - 0.5) / 0.7, 0, 1) + 0.15 * clamp(fixes / 0.25, 0, 1), 0, 1);
      if (this.act < 0.35) {
        var n = Math.min(this.base.n + 1, 200);
        this.base.gap = lerp(this.base.gap, mean, 1 / n);
        this.base.sd = lerp(this.base.sd, Math.max(40, sd), 1 / n);
        this.base.n = n;
        if (n % 20 === 0) { this._save(); }
      }
    }
    if (this.hr && now - this.hrAt < 30000) { out.hr = clamp((this.hr - this.restHr) / (this.restHr * 0.35), 0, 1); }
    return out;
  };

  TabySense.prototype.tick = function (dt) {
    var f = this.features(), now = Date.now(), raw;
    if (f.typing !== null && f.hr !== null) { raw = 0.55 * f.hr + 0.45 * f.typing; }
    else if (f.hr !== null) { raw = 0.8 * f.hr; }
    else if (f.typing !== null) { raw = 0.8 * f.typing; }
    else { raw = 0.15; }
    if (now < this.reportedUntil) { raw += this.reported; }
    raw = clamp(raw, 0, 1);
    this.act += (raw - this.act) * (1 - Math.exp(-dt / 8));
    this._emit('activation', this.act);

    var m = this.mood, a = this.act, want = m;
    if (m === 'calm' || m === 'happy' || m === 'relieved') {
      if (a > 0.7) { want = 'tense'; } else if (a > 0.45) { want = 'wobbly'; }
    } else if (m === 'wobbly') {
      if (a > 0.7) { want = 'tense'; } else if (a < 0.35) { want = 'calm'; }
    } else if (m === 'tense') {
      if (a < 0.55) { want = 'wobbly'; } if (a < 0.3) { want = 'calm'; }
    }

    if (want !== m) {
      this._pending = this._pending && this._pending.mood === want ? this._pending : { mood: want, since: now };
      if (now - this._pending.since > (want === 'calm' ? 8000 : 5000)) {
        this.setMood(want);
        this._pending = null;
      }
    } else {
      this._pending = null;
    }

    var wait = 15 * 60 * 1000 * (1 + this.dismissed);
    if (this.mood === 'tense' && now - this.moodSince > 20000 && now - this.lastNudge > wait) {
      this.lastNudge = now; this._emit('nudge', this.suggest(f));
    }
  };

  TabySense.prototype.setMood = function (m) {
    this.mood = m; this.moodSince = Date.now(); this._emit('mood', m);
  };

  TabySense.prototype.suggest = function (f) {
    if (f.hr !== null && f.hr > 0.6 && (f.typing === null || f.typing < 0.5)) {
      return { practice: 'squeeze-and-release', reason: 'Your pulse is up.' };
    }
    if (f.typing !== null && f.typing > 0.6) {
      return { practice: 'cyclic-sighing', reason: 'Your typing sped up.' };
    }
    return { practice: 'cyclic-sighing', reason: 'It has been a busy stretch.' };
  };

  TabySense.prototype.start = function () {
    var self = this;
    if (this._timer) { return; }
    this._timer = setInterval(function () { self.tick(1); }, 1000);
  };
  TabySense.prototype.stop = function () { clearInterval(this._timer); this._timer = null; };

  /* ---------------------------------------------------------------------------
     TabyHeart: Bluetooth LE sensor integration
  --------------------------------------------------------------------------- */
  var TabyHeart = {
    supported: function () { return !!(global.navigator && global.navigator.bluetooth); },
    connect: function (onBpm, onStatus) {
      var status = onStatus || function () {};
      if (!TabyHeart.supported()) {
        status('unsupported');
        return Promise.reject(new Error('Web Bluetooth is not available in this browser'));
      }
      var device, char;
      function handle(e) {
        var v = e.target.value, flags = v.getUint8(0);
        onBpm((flags & 1) ? v.getUint16(1, true) : v.getUint8(1));
      }
      return global.navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] })
        .then(function (d) {
          device = d; status('connecting');
          device.addEventListener('gattserverdisconnected', function () { status('disconnected'); });
          return device.gatt.connect();
        })
        .then(function (server) { return server.getPrimaryService('heart_rate'); })
        .then(function (svc) { return svc.getCharacteristic('heart_rate_measurement'); })
        .then(function (c) { char = c; return char.startNotifications(); })
        .then(function () {
          char.addEventListener('characteristicvaluechanged', handle);
          status('connected');
          return {
            name: device.name,
            disconnect: function () { try { device.gatt.disconnect(); } catch (e) {} }
          };
        });
    }
  };

  /* ---------------------------------------------------------------------------
     TabyDirector: Safe action script validator, animator & intent engine
  --------------------------------------------------------------------------- */
  var EASES = {
    linear: function (u) { return u; },
    ease: function (u) { return u * u * (3 - 2 * u); },
    out: function (u) { return 1 - Math.pow(1 - u, 3); },
    spring: function (u) { return 1 - Math.exp(-6 * u) * Math.cos(10 * u); }
  };
  var LIMITS = { maxBeats: 60, maxDuration: 30, maxProps: 14, maxText: 60, maxLabel: 40, maxErrors: 3 };
  var COLOR_NAMES = ['teal', 'amber', 'sage', 'indigo', 'orchid', 'lime', 'grey', 'white', 'pink'];
  var PROP_TYPES = ['stone', 'feather', 'ring', 'orbs', 'bubble', 'waves', 'meter', 'compass', 'shell', 'plant', 'anchor'];
  var BACK = { waves: 1, ring: 1, compass: 1, plant: 1, anchor: 1, meter: 1 };
  var TWEENABLE = ['x', 'y', 'size', 'alpha', 'rot', 'value'];
  var FX = ['sparkles', 'confetti', 'ripple', 'flash', 'drops'];

  var N = function (min, max, def) { return { t: 'num', min: min, max: max, def: def }; };
  var I = function (min, max, def) { return { t: 'int', min: min, max: max, def: def }; };
  var STR = function (max, def) { return { t: 'str', max: max, def: def === undefined ? '' : def }; };
  var ENUM = function (list, def) { return { t: 'enum', list: list, def: def }; };
  var ID = { t: 'id' };

  var MOOD_LIST = Object.keys(MOODS);
  var VERBS = {
    'mood': { args: { mood: ENUM(MOOD_LIST) }, req: ['mood'] },
    'say': { args: { text: STR(LIMITS.maxText), dur: N(0.5, 6, 2.5) }, req: ['text'] },
    'gesture': { args: { name: ENUM(['hop', 'poke', 'shake', 'nod', 'tilt']), dur: N(0.2, 3, 1) }, req: ['name'] },
    'breathe': { args: { inhale: N(0.5, 8, 2), hold: N(0, 6, 1), exhale: N(0.5, 10, 3), cycles: I(1, 8, 1) }, req: [] },
    'move': { args: { dx: N(-1, 1, 0), dy: N(-1, 1, 0), scale: N(0.4, 1.8, 1), dur: N(0.1, 6, 1), ease: ENUM(Object.keys(EASES), 'ease') }, req: [] },
    'look': { args: { x: N(-1, 1, 0), y: N(-1, 1, 0), dur: N(0.2, 6, 2) }, req: [] },
    'prop.add': { args: { id: ID, type: ENUM(PROP_TYPES), x: N(-2.5, 2.5, 0), y: N(-3, 3, 0), size: N(0.05, 4, 1), alpha: N(0, 1, 1), rot: N(-360, 360, 0), value: N(0, 1, 0), count: I(1, 12, 5), label: STR(LIMITS.maxLabel), text: STR(LIMITS.maxText), color: ENUM(COLOR_NAMES, 'teal') }, req: ['id', 'type'] },
    'prop.set': { args: { id: ID, x: N(-2.5, 2.5), y: N(-3, 3), size: N(0.05, 4), alpha: N(0, 1), rot: N(-360, 360), value: N(0, 1), label: STR(LIMITS.maxLabel, null), text: STR(LIMITS.maxText, null), color: ENUM(COLOR_NAMES) }, req: ['id'] },
    'prop.tween': { args: { id: ID, to: { t: 'tweens' }, dur: N(0.1, 10, 1), ease: ENUM(Object.keys(EASES), 'ease') }, req: ['id', 'to'] },
    'prop.remove': { args: { id: ID, dur: N(0, 3, 0.4) }, req: ['id'] },
    'fx': { args: { name: ENUM(FX), dur: N(0.3, 6, 2) }, req: ['name'] },
    'end': { args: { mood: ENUM(MOOD_LIST, 'calm') }, req: [] }
  };

  function cleanStr(v, max) { return String(v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
  function coerce(spec, v, path, errs) {
    switch (spec.t) {
      case 'num': { var n = typeof v === 'number' ? v : parseFloat(v); if (!isFinite(n)) { errs.push(path + ' must be a number'); return spec.def; } return clamp(n, spec.min, spec.max); }
      case 'int': { var k = Math.round(typeof v === 'number' ? v : parseFloat(v)); if (!isFinite(k)) { errs.push(path + ' must be a whole number'); return spec.def; } return clamp(k, spec.min, spec.max); }
      case 'str': { if (typeof v !== 'string') { errs.push(path + ' must be text'); return spec.def; } return cleanStr(v, spec.max); }
      case 'enum': { if (spec.list.indexOf(v) < 0) { errs.push(path + ' must be one of: ' + spec.list.join(', ')); return spec.def; } return v; }
      case 'id': { if (typeof v !== 'string' || !/^[a-z0-9_-]{1,24}$/i.test(v)) { errs.push(path + ' must be 1 to 24 letters, digits, - or _'); return null; } return v; }
      case 'tweens': {
        if (!v || typeof v !== 'object' || Array.isArray(v)) { errs.push(path + ' must be an object like {"y": 0.5}'); return null; }
        var out = {}, any = false;
        Object.keys(v).forEach(function (key) {
          if (TWEENABLE.indexOf(key) < 0) { errs.push(path + '.' + key + ' cannot be animated'); return; }
          var lim = VERBS['prop.add'].args[key]; var n2 = parseFloat(v[key]);
          if (!isFinite(n2)) { errs.push(path + '.' + key + ' must be a number'); return; }
          out[key] = clamp(n2, lim.min, lim.max); any = true;
        });
        if (!any) { errs.push(path + ' needs at least one value'); return null; }
        return out;
      }
    }
    return spec.def;
  }

  function validate(raw, opts) {
    opts = opts || {}; var errors = [], warnings = [];
    try {
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { return { ok: false, errors: ['The script is not valid JSON'], warnings: [], script: null }; } }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { return { ok: false, errors: ['The script must be an object'], warnings: [], script: null }; }
      if (raw.v !== 1) { errors.push('"v" must be 1'); }
      if (!Array.isArray(raw.beats) || raw.beats.length < 1) { return { ok: false, errors: errors.concat(['"beats" must be a list with at least one beat']), warnings: [], script: null }; }
      if (raw.beats.length > LIMITS.maxBeats) { errors.push('Too many beats (maximum ' + LIMITS.maxBeats + ')'); }
      var beats = [];
      raw.beats.slice(0, LIMITS.maxBeats).forEach(function (b, i) {
        var path = 'beats[' + i + ']', be = [];
        if (!b || typeof b !== 'object') { be.push(path + ' must be an object'); errors.push.apply(errors, be); return; }
        var verb = VERBS[b['do']];
        if (!verb) { be.push(path + '.do "' + b['do'] + '" is not a known verb'); errors.push.apply(errors, be); return; }
        var at = parseFloat(b.at);
        if (!isFinite(at) || at < 0 || at > LIMITS.maxDuration) { be.push(path + '.at must be a number from 0 to ' + LIMITS.maxDuration); }
        var out = { at: clamp(isFinite(at) ? at : 0, 0, LIMITS.maxDuration), 'do': b['do'] };
        verb.req.forEach(function (r) { if (b[r] === undefined) { be.push(path + '.' + r + ' is required'); } });
        Object.keys(verb.args).forEach(function (key) {
          var spec = verb.args[key];
          if (b[key] === undefined) { if (spec.def !== undefined && spec.def !== null) { out[key] = spec.def; } return; }
          var v = coerce(spec, b[key], path + '.' + key, be); if (v !== null && v !== undefined) { out[key] = v; }
        });
        if (be.length) { if (opts.repair) { warnings.push.apply(warnings, be.map(function (m) { return 'dropped: ' + m; })); } else { errors.push.apply(errors, be); } } else { beats.push(out); }
      });
      beats.sort(function (a, b) { return a.at - b.at; });
      var alive = {}, count = 0, maxAlive = 0, endAt = 0, kept = [];
      beats.forEach(function (b) {
        var bad = null;
        if (b['do'] === 'prop.add') { if (!alive[b.id]) { count++; } alive[b.id] = true; maxAlive = Math.max(maxAlive, count); }
        else if (b['do'] === 'prop.tween' || b['do'] === 'prop.set') { if (!alive[b.id]) { bad = b['do'] + ' uses "' + b.id + '" before added'; } }
        else if (b['do'] === 'prop.remove') { if (!alive[b.id]) { bad = 'prop.remove uses "' + b.id + '" before added'; } else { delete alive[b.id]; count--; } }
        if (bad) { if (opts.repair) { warnings.push('dropped: ' + bad); return; } errors.push(bad); }
        endAt = Math.max(endAt, b.at + (b.dur || (b['do'] === 'breathe' ? (b.inhale + b.hold + b.exhale) * b.cycles : 0)));
        kept.push(b);
      });
      if (maxAlive > LIMITS.maxProps) { errors.push('Too many props at once (maximum ' + LIMITS.maxProps + ')'); }
      if (endAt > LIMITS.maxDuration) { errors.push('The script runs longer than ' + LIMITS.maxDuration + ' seconds'); }
      if (!kept.length) { errors.push('No valid beats'); }
      return { ok: errors.length === 0, errors: errors, warnings: warnings, script: { v: 1, name: cleanStr(raw.name || 'custom', 40), beats: kept }, duration: endAt };
    } catch (e) { return { ok: false, errors: ['Error checking script: ' + e.message], warnings: warnings, script: null }; }
  }

  function fitText(ctx, text, x, y, maxW, px, color, weight) {
    var size = clamp(px, 11, 30); ctx.font = (weight || '600') + ' ' + size + 'px Inter, Arial, sans-serif';
    while (ctx.measureText(text).width > maxW && size > 9) { size -= 1; ctx.font = (weight || '600') + ' ' + size + 'px Inter, Arial, sans-serif'; }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
  }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); } else { ctx.rect(x, y, w, h); } }

  var DRAW = {
    stone: function (ctx, p, f) {
      var u = f.R, x = f.cx + p.x * u, y = f.cy + p.y * u, r = p.size * u * 0.9, i, a, rr;
      ctx.fillStyle = rgba([112, 124, 136], 1); ctx.beginPath();
      for (i = 0; i < 16; i++) { a = TAU * i / 16; rr = r * (1 + 0.08 * Math.sin(3 * a + 1) + 0.06 * Math.sin(5 * a)); ctx.lineTo(x + Math.cos(a) * rr * 1.15, y + Math.sin(a) * rr * 0.85); }
      ctx.closePath(); ctx.fill();
      if (p.label) { rrect(ctx, x - r * 0.95, y - r * 0.28, r * 1.9, r * 0.56, 8); ctx.fillStyle = 'rgba(40,46,54,0.88)'; ctx.fill(); fitText(ctx, p.label, x, y, r * 1.75, r * 0.3, '#EAF0F5'); }
    },
    feather: function (ctx, p, f) {
      var u = f.R, x = f.cx + p.x * u, y = f.cy + p.y * u, L = p.size * u * 0.8;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot * Math.PI / 180 - 0.6); ctx.fillStyle = 'rgba(232,244,248,1)'; ctx.strokeStyle = rgba(COLORS.teal, 1); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, L, L * 0.26, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    },
    ring: function (ctx, p, f) { var col = COLORS[p.color] || COLORS.teal; ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.cx + p.x * f.R, f.cy + p.y * f.R, p.size * f.R * 1.5 * (1 + 0.04 * Math.sin(f.t * 3)), 0, TAU); ctx.stroke(); },
    orbs: function (ctx, p, f) {
      var col = COLORS[p.color] || COLORS.teal, n = p.count, i, a, rad = p.size * f.R * 1.6;
      ctx.fillStyle = rgba(col, 1);
      for (i = 0; i < n; i++) { a = TAU * i / n + f.t * (0.4 + p.value); ctx.beginPath(); ctx.arc(f.cx + p.x * f.R + Math.cos(a) * rad, f.cy + p.y * f.R + Math.sin(a) * rad * 0.9, f.R * 0.1, 0, TAU); ctx.fill(); }
    },
    bubble: function (ctx, p, f) {
      var u = f.R, x = f.cx + p.x * u, y = f.cy + p.y * u, text = p.text || p.label || ''; if (!text) { return; }
      var px = clamp(u * 0.2 * p.size, 12, 22); ctx.font = '600 ' + px + 'px Inter, Arial, sans-serif'; var w = Math.min(f.W * 0.9, ctx.measureText(text).width + px * 1.6), h = px * 2.3;
      var style = p.color === 'grey' ? ['rgba(58,69,80,1)', '#EAF0F5'] : ['rgba(234,240,245,1)', '#0B0F14'];
      rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = style[0]; ctx.fill(); fitText(ctx, text, x, y, w - px, px, style[1]);
    },
    waves: function (ctx, p, f) {
      var col = COLORS[p.color] || COLORS.indigo, y0 = f.cy + p.y * f.R, k, x;
      for (k = 0; k < 4; k++) { ctx.strokeStyle = rgba(col, 0.75 - k * 0.15); ctx.lineWidth = 3; ctx.beginPath(); for (x = 0; x <= f.W; x += 6) { var y = y0 + k * f.R * 0.28 + Math.sin(x / (f.R * 0.7) + f.t * 1.6 + k) * f.R * (0.05 + 0.2 * p.value); if (x === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } } ctx.stroke(); }
    },
    meter: function (ctx, p, f) {
      var u = f.R, w = 3 * u * p.size, h = u * 0.22, x = f.cx + p.x * u - w / 2, y = f.cy + p.y * u, col = COLORS[p.color] || COLORS.amber;
      rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(26,34,43,1)'; ctx.fill(); rrect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * p.value), h - 4, (h - 4) / 2); ctx.fillStyle = rgba(col, 1); ctx.fill();
    },
    compass: function (ctx, p, f) {
      var u = f.R, x = f.cx + p.x * u, y = f.cy + p.y * u, r = p.size * u * 1.3, col = COLORS.amber, a = p.rot * Math.PI / 180;
      ctx.fillStyle = 'rgba(20,27,34,0.9)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = 3; ctx.stroke();
    },
    shell: function (ctx, p, f) {
      var u = f.R, x = f.cx + p.x * u, y = f.cy + p.y * u, r = p.size * u, col = COLORS[p.color] || COLORS.amber;
      ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (p.label) { fitText(ctx, p.label, x, y, r * 1.5, r * 0.25, '#0B0F14', '700'); }
    },
    plant: function (ctx, p, f) {
      var u = f.R, x = f.cx + p.x * u, y = f.cy + p.y * u, s = p.size * u;
      ctx.fillStyle = 'rgba(127,217,168,1)'; ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 0.3, 0, TAU); ctx.fill();
    },
    anchor: function (ctx, p, f) {
      var u = f.R, x = f.cx + p.x * u, y = f.cy + p.y * u, s = p.size * u * 0.5;
      ctx.strokeStyle = rgba(COLORS.lime, 1); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, s * 0.8, 0, TAU); ctx.stroke();
    }
  };

  function TabyDirector(taby, opts) {
    this.taby = taby; this.opts = opts || {};
    this.state = 'idle'; this.clock = 0; this.beats = []; this.idx = 0; this.endAt = 0; this.name = '';
    this.props = {}; this.fx = []; this.ovTw = []; this.errors = 0; this.endClock = 0;
    this.listeners = { start: [], end: [], error: [], log: [] };
    var self = this;
    taby.hooks.update = function (dt) { self.update(dt); };
    taby.hooks.before = function (ctx, f) { self.draw(ctx, f, true); };
    taby.hooks.after = function (ctx, f) { self.draw(ctx, f, false); };
  }
  TabyDirector.prototype.on = function (ev, fn) { if (this.listeners[ev]) { this.listeners[ev].push(fn); } return this; };
  TabyDirector.prototype._emit = function (ev, v) { var a = this.listeners[ev] || []; for (var i = 0; i < a.length; i++) { try { a[i](v); } catch (e) {} } };
  TabyDirector.prototype.isPlaying = function () { return this.state !== 'idle'; };

  TabyDirector.prototype.play = function (raw, opts) {
    var res = validate(raw, opts);
    if (!res.ok) { this._emit('error', res); return res; }
    if (this.state !== 'idle') { this._reset(); }
    this.beats = res.script.beats; this.idx = 0; this.clock = 0; this.errors = 0; this.name = res.script.name;
    this.endAt = res.duration + 1.2; this.state = 'playing';
    this._emit('start', { name: this.name });
    return res;
  };
  TabyDirector.prototype.playIntent = function (name, params) {
    var tpl = TEMPLATES[name];
    if (!tpl) { var r = { ok: false, errors: ['Unknown intent: ' + name] }; this._emit('error', r); return r; }
    var script; try { script = tpl(params || {}); } catch (e) { var r2 = { ok: false, errors: ['Template failed: ' + e.message] }; this._emit('error', r2); return r2; }
    return this.play(script);
  };
  TabyDirector.prototype.stop = function () {
    if (this.state === 'idle') { return; }
    this._reset();
    this._emit('end', { name: this.name, stopped: true });
  };
  TabyDirector.prototype._reset = function () {
    this.props = {}; this.fx = []; this.ovTw = []; this.state = 'idle';
    this.taby.ov.dx = 0; this.taby.ov.dy = 0; this.taby.ov.scale = 1;
  };
  TabyDirector.prototype._beginEnd = function (mood) {
    if (this.state !== 'playing') { return; }
    this.state = 'ending'; this.endClock = this.clock;
    try { this.taby.setMood(mood || 'calm'); } catch (e) {}
    var ov = this.taby.ov, self = this;
    this.ovTw = ['dx', 'dy', 'scale'].map(function (k) { return { key: k, from: ov[k], to: k === 'scale' ? 1 : 0, t0: self.clock, dur: 0.6, ease: 'ease' }; });
  };
  TabyDirector.prototype._run = function (b) {
    var t = this.taby, self = this, p;
    switch (b['do']) {
      case 'mood': t.setMood(b.mood); break;
      case 'say': t.say(b.text, b.dur); break;
      case 'gesture':
        if (b.name === 'hop') { t.hop(); }
        else if (b.name === 'poke') { t.poke(); }
        else if (b.name === 'shake') { t.shake(b.dur); }
        else if (b.name === 'nod') { t.nod(); }
        else { t.tiltBy(0.12); }
        break;
      case 'breathe': t.breathe({ inhale: b.inhale, hold: b.hold, exhale: b.exhale, cycles: b.cycles }); break;
      case 'look': t.lookAt(b.x, b.y, b.dur); break;
      case 'move':
        ['dx', 'dy', 'scale'].forEach(function (k) {
          self.ovTw = self.ovTw.filter(function (w) { return w.key !== k; });
          self.ovTw.push({ key: k, from: t.ov[k], to: b[k], t0: self.clock, dur: b.dur, ease: b.ease });
        });
        break;
      case 'prop.add':
        this.props[b.id] = { id: b.id, type: b.type, x: b.x, y: b.y, size: b.size, alpha: b.alpha, rot: b.rot, value: b.value, count: b.count, label: b.label, text: b.text, color: b.color, layer: BACK[b.type] ? 'back' : 'front', tw: [] };
        break;
      case 'prop.set':
        p = this.props[b.id];
        if (p) { ['x', 'y', 'size', 'alpha', 'rot', 'value', 'label', 'text', 'color'].forEach(function (k) { if (b[k] !== undefined && b[k] !== null) { p[k] = b[k]; } }); }
        break;
      case 'prop.tween':
        p = this.props[b.id];
        if (p) {
          Object.keys(b.to).forEach(function (k) {
            p.tw = p.tw.filter(function (w) { return w.key !== k; });
            p.tw.push({ key: k, from: p[k], to: b.to[k], t0: self.clock, dur: b.dur, ease: b.ease });
          });
        }
        break;
      case 'prop.remove':
        delete this.props[b.id];
        break;
      case 'fx':
        this.fx.push({ name: b.name, t0: this.clock, dur: b.dur, seed: Math.random() * 100 });
        break;
      case 'end':
        this._beginEnd(b.mood);
        break;
    }
  };
  TabyDirector.prototype.update = function (dt) {
    if (this.state === 'idle') { return; }
    dt = Math.min(dt, 0.05); this.clock += dt;
    var self = this;
    if (this.state === 'playing') {
      while (this.idx < this.beats.length && this.beats[this.idx].at <= this.clock) {
        var b = this.beats[this.idx++];
        try { this._run(b); } catch (e) { this.errors++; }
        if (this.state !== 'playing') { break; }
      }
      if (this.clock >= this.endAt) { this._beginEnd('calm'); }
    }
    var ov = this.taby.ov;
    this.ovTw = this.ovTw.filter(function (w) {
      var u = clamp((self.clock - w.t0) / w.dur, 0, 1);
      ov[w.key] = lerp(w.from, w.to, EASES[w.ease](u));
      return u < 1;
    });
    Object.keys(this.props).forEach(function (id) {
      var p = self.props[id];
      p.tw = p.tw.filter(function (w) {
        var u = clamp((self.clock - w.t0) / w.dur, 0, 1);
        p[w.key] = lerp(w.from, w.to, EASES[w.ease](u));
        return u < 1;
      });
    });
    this.fx = this.fx.filter(function (x) { return self.clock - x.t0 < x.dur; });
    if (this.state === 'ending' && this.clock - this.endClock > 0.7) {
      this._reset(); this._emit('end', { name: this.name });
    }
  };
  TabyDirector.prototype.draw = function (ctx, f, back) {
    if (this.state === 'idle') { return; }
    var self = this;
    try {
      Object.keys(this.props).forEach(function (id) {
        var p = self.props[id]; if ((p.layer === 'back') !== back) { return; }
        ctx.save(); ctx.globalAlpha = clamp(p.alpha, 0, 1); DRAW[p.type](ctx, p, f); ctx.restore();
      });
    } catch (e) {}
  };

  function trim(s, n, d) { return String(s === undefined || s === null || s === '' ? d : s).slice(0, n); }
  var TEMPLATES = {
    celebrate: function (p) {
      return { v: 1, name: 'celebrate', beats: [{ at: 0, do: 'mood', mood: 'proud' }, { at: 0.1, do: 'fx', name: 'sparkles', dur: 3 }, { at: 0.2, do: 'gesture', name: 'hop' }, { at: 0.6, do: 'say', text: trim(p.text, 60, 'Well done!'), dur: 3 }, { at: 4.5, do: 'end', mood: 'calm' }] };
    },
    comfort: function (p) {
      return { v: 1, name: 'comfort', beats: [{ at: 0, do: 'mood', mood: 'calm' }, { at: 0, do: 'prop.add', id: 'glow', type: 'ring', color: 'amber', size: 1.1 }, { at: 0.3, do: 'say', text: trim(p.line1, 60, 'This is a hard moment.'), dur: 3 }, { at: 3.6, do: 'say', text: trim(p.line2, 60, 'Take a gentle breath.'), dur: 3 }, { at: 0.5, do: 'breathe', inhale: 3, hold: 1, exhale: 4, cycles: 2 }, { at: 9, do: 'end', mood: 'relieved' }] };
    },
    cyclicSigh: function () {
      var b = [{ at: 0, do: 'mood', mood: 'calm' }, { at: 0, do: 'prop.add', id: 'r', type: 'ring', size: 1 }];
      var t = 0.5;
      for (var c = 0; c < 2; c++) {
        b.push({ at: t, do: 'say', text: 'Sip in', dur: 1 }, { at: t, do: 'move', scale: 1.22, dur: 1, ease: 'ease' },
               { at: t + 1.2, do: 'say', text: 'Sip again', dur: 1 }, { at: t + 1.2, do: 'move', scale: 1.45, dur: 0.8, ease: 'ease' },
               { at: t + 2.4, do: 'say', text: 'Long sigh out', dur: 3.5 }, { at: t + 2.4, do: 'move', scale: 0.85, dur: 4, ease: 'ease' });
        t += 6.8;
      }
      b.push({ at: t, do: 'end', mood: 'relieved' });
      return { v: 1, name: 'cyclicSigh', beats: b };
    },
    squeezeRelease: function () {
      var b = [{ at: 0, do: 'say', text: 'Squeeze muscles.', dur: 2 }], t = 1.5;
      for (var c = 0; c < 2; c++) {
        b.push({ at: t, do: 'mood', mood: 'tense' }, { at: t, do: 'move', scale: 0.7, dur: 0.6 }, { at: t, do: 'say', text: 'Hold tight!', dur: 3 },
               { at: t + 3.5, do: 'mood', mood: 'relieved' }, { at: t + 3.5, do: 'move', scale: 1.12, dur: 0.9 }, { at: t + 3.5, do: 'say', text: 'Release completely...', dur: 3 });
        t += 7;
      }
      b.push({ at: t, do: 'end', mood: 'calm' });
      return { v: 1, name: 'squeezeRelease', beats: b };
    },
    shakeOff: function () {
      return { v: 1, name: 'shakeOff', beats: [{ at: 0, do: 'say', text: 'Shake it off!', dur: 2 }, { at: 1, do: 'mood', mood: 'tense' }, { at: 1, do: 'gesture', name: 'shake', dur: 3.5 }, { at: 4.8, do: 'mood', mood: 'happy' }, { at: 5.2, do: 'say', text: 'Notice the release.', dur: 3 }, { at: 8.5, do: 'end', mood: 'calm' }] };
    },
    fiveSenses: function () {
      var names = ['see', 'hear', 'feel', 'smell', 'taste'], b = [{ at: 0, do: 'mood', mood: 'wobbly' }];
      for (var i = 0; i < 5; i++) {
        b.push({ at: 1 + i * 2.8, do: 'say', text: (5 - i) + ' things you ' + names[i], dur: 2.5 });
      }
      b.push({ at: 15, do: 'end', mood: 'calm' });
      return { v: 1, name: 'fiveSenses', beats: b };
    },
    releaseBelief: function (p) {
      var belief = trim(p.belief, 40, 'I must always do everything'), nt = trim(p.newThought, 40, 'Steady effort matters');
      return { v: 1, name: 'releaseBelief', beats: [{ at: 0, do: 'mood', mood: 'tense' }, { at: 0, do: 'prop.add', id: 'stone', type: 'stone', label: belief, y: -1.5, size: 1.15 },
        { at: 2, do: 'say', text: 'Where does it come from?', dur: 2.5 },
        { at: 5, do: 'say', text: 'A kinder, realistic version?', dur: 2.5 }, { at: 5.5, do: 'prop.set', id: 'stone', label: nt },
        { at: 8.5, do: 'prop.remove', id: 'stone', dur: 0.3 }, { at: 8.6, do: 'prop.add', id: 'f', type: 'feather', y: -1.8, size: 0.8 }, { at: 8.6, do: 'mood', mood: 'happy' }, { at: 9, do: 'say', text: 'Feel the lift.', dur: 3 }, { at: 12.5, do: 'end', mood: 'calm' }] };
    },
    gracefulNo: function (p) {
      return { v: 1, name: 'gracefulNo', beats: [{ at: 0, do: 'mood', mood: 'calm' }, { at: 0.5, do: 'say', text: 'Let us build a graceful no.', dur: 2.5 }, { at: 3.5, do: 'say', text: 'Gratitude, Value, Priority, Connection', dur: 3 }, { at: 7, do: 'mood', mood: 'happy' }, { at: 7.2, do: 'say', text: 'Declined kindly. Still connected.', dur: 3 }, { at: 11, do: 'end', mood: 'calm' }] };
    },
    zoomOut: function (p) {
      var worry = trim(p.worry, 30, 'Deadline');
      return { v: 1, name: 'zoomOut', beats: [{ at: 0, do: 'mood', mood: 'tense' }, { at: 0, do: 'prop.add', id: 'wy', type: 'shell', label: worry, color: 'amber', size: 2.2, value: 1, y: -1.2 },
        { at: 2.5, do: 'say', text: 'Will it matter in a week?', dur: 2.5 },
        { at: 5.5, do: 'say', text: 'In a month? In a year?', dur: 2.5 },
        { at: 8.5, do: 'mood', mood: 'happy' }, { at: 8.8, do: 'say', text: 'You have got this.', dur: 3 }, { at: 12, do: 'end', mood: 'calm' }] };
    },
    brainDump: function (p) {
      return { v: 1, name: 'brainDump', beats: [{ at: 0, do: 'mood', mood: 'wobbly' }, { at: 0.5, do: 'say', text: 'Get it out of your head.', dur: 2.5 }, { at: 3.5, do: 'mood', mood: 'relieved' }, { at: 4, do: 'say', text: 'Space created.', dur: 2.5 }, { at: 7, do: 'end', mood: 'calm' }] };
    }
  };

  var EXERCISE_INTENTS = {
    'identity': 'releaseBelief',
    'values': 'driftReturn',
    'clarity': 'anchorDrop',
    'needs': 'needsGarden',
    'emotions': 'peelLayers',
    'boundaries': 'gracefulNo',
    'cyclic-sighing': 'cyclicSigh',
    'squeeze-and-release': 'squeezeRelease',
    'shake-it-off': 'shakeOff',
    'five-senses': 'fiveSenses',
    'zoom-out': 'zoomOut',
    'brain-dump': 'brainDump'
  };

  TabyDirector.route = function (ctx) {
    ctx = ctx || {};
    if (ctx.flags && (ctx.flags.support || ctx.flags.distress)) { return null; }
    if (ctx.event === 'saved_card' || ctx.event === 'pillar_done') { return { intent: 'celebrate', params: {} }; }
    if (ctx.exercise && EXERCISE_INTENTS[ctx.exercise]) { return { intent: EXERCISE_INTENTS[ctx.exercise], params: ctx.params || {} }; }
    return null;
  };

  TabyDirector.validate = validate;
  TabyDirector.TEMPLATES = TEMPLATES;
  TabyDirector.EXERCISE_INTENTS = EXERCISE_INTENTS;

  global.TabyBlob = TabyBlob;
  global.TabySense = TabySense;
  global.TabyHeart = TabyHeart;
  global.TabyDirector = TabyDirector;
  global.TABY_MOODS = MOODS;

})(typeof window !== 'undefined' ? window : globalThis);
