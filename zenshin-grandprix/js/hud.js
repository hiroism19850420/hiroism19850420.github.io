// レース中の 表示（第19部・付録Q）
import { CFG } from './config.js';
import { fmtTime, clamp, $ } from './util.js';
import { picSVG } from './pics.js';
import { CHARS } from './models.js';
import { ZONE } from './track.js';

const H = CFG.hud;
export const HUD = {
  init() {
    this.el = { hud: $('hud'), rank: $('hudRankNum'), crown: $('hudCrown'), list: $('hudList'), lap: $('hudLap'), lapLabel: $('hudLapLabel'), lapNum: $('hudLapNum'), lapOf: $('hudLapOf'), time: $('hudTime'),
      map: $('hudMap'), stars: $('hudStarNum'), cells: [...document.querySelectorAll('.hudCell')], speedArc: $('hudSpeedArc'), speedNum: $('hudSpeedNum'),
      toast: $('hudToast'), cue: $('hudCue'), cuePic: $('hudCuePic'), cueText: $('hudCueText'), cueRing: $('hudCueRingFg'), lights: $('hudLights'), lightEls: [...document.querySelectorAll('#hudLightBox .light')], ready: $('hudReady'),
      big: $('hudBig'), banner: $('hudBanner'), almost: $('hudAlmost'), tip: $('hudTurboTip'), run: $('hudRun'), count: $('hudCount') };
    this.el.ready.innerHTML = picSVG('run') + '<span>あしぶみ じゅんび！</span>';
    this.el.tip.innerHTML = picSVG('banzai') + '<span>バンザイで ターボ！</span>';
    this.el.run.innerHTML = picSVG('run') + '<span>あしぶみ！</span>';
    this.sl = $('speedLines'); this.slc = this.sl.getContext('2d'); this.lines = [];
    this.toastQ = []; this.toastBusy = 0;
  },
  show(on) { this.el.hud.classList.toggle('on', on); if (!on) { this.cue(null); this.slc.clearRect(0, 0, this.sl.width, this.sl.height); } },
  // レースの はじめに
  setRace(race, portraits, quality) {
    this.race = race; this.quality = quality;
    const L = this.el.list; L.innerHTML = '';
    this.faces = {};
    race.karts.forEach(k => {
      const d = document.createElement('div'); d.className = 'hudFace' + (k.isPlayer ? ' you' : '');
      d.style.backgroundImage = `url(${portraits[k.id] ? portraits[k.id].normal : ''})`; d.style.borderColor = k.isPlayer ? '' : CHARS[k.id].kart;
      d.innerHTML = '<svg class="flag" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="12" fill="#fff" stroke="#1d2b53" stroke-width="2"/><rect x="2" y="2" width="4" height="4" fill="#1d2b53"/><rect x="10" y="2" width="4" height="4" fill="#1d2b53"/><rect x="6" y="6" width="4" height="4" fill="#1d2b53"/><rect x="14" y="6" width="4" height="4" fill="#1d2b53"/><rect x="2" y="10" width="4" height="4" fill="#1d2b53"/><rect x="10" y="10" width="4" height="4" fill="#1d2b53"/></svg>';
      L.appendChild(d); this.faces[k.id] = d; d._i = -1;
    });
    this.el.lapOf.textContent = '/' + race.laps;
    this.pos = 0; this.lapShown = 0; this.tt = -1; this.kmh = -1; this.starsShown = -1;
    this.buildMap(race.track);
    this.el.lights.classList.remove('on', 'away');
    this.el.almost.classList.remove('on'); this.el.banner.classList.remove('on'); this.el.big.innerHTML = ''; this.el.toast.innerHTML = '';
    this.el.lap.classList.remove('final'); this.el.lapLabel.textContent = 'しゅう';
  },
  buildMap(tr) {
    const c = document.createElement('canvas'); c.width = c.height = 420; const g = c.getContext('2d');
    const B = tr.box, span = Math.max(B.x1 - B.x0, B.z1 - B.z0), sc = 300 / span;
    this.mapT = (x, z) => [210 + (x - B.cx) * sc, 210 + (z - B.cz) * sc];
    g.fillStyle = 'rgba(11,22,48,0.45)'; g.beginPath(); g.arc(210, 210, 208, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 3; g.stroke();
    const path = (pred) => { g.beginPath(); let on = false; for (let i = 0; i <= tr.N; i += 2) { const j = i % tr.N; if (!pred(j)) { on = false; continue; } const [x, y] = this.mapT(tr.px[j], tr.pz[j]); on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } };
    g.lineCap = 'round'; g.lineJoin = 'round';
    path(() => true); g.strokeStyle = 'rgba(29,43,83,0.6)'; g.lineWidth = 26; g.stroke();
    path(() => true); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 18; g.stroke();
    path(j => tr.zone[j] === ZONE.bridge || tr.zone[j] === ZONE.viaduct); g.strokeStyle = 'rgba(29,43,83,0.9)'; g.lineWidth = 28; g.stroke();
    path(j => tr.zone[j] === ZONE.bridge || tr.zone[j] === ZONE.viaduct); g.strokeStyle = '#ffffff'; g.lineWidth = 18; g.stroke();
    // スタートの線
    const f = tr.frame(0, {}), [sx, sy] = this.mapT(f.x, f.z);
    g.save(); g.translate(sx, sy); g.rotate(Math.atan2(f.lfz, f.lfx)); g.fillStyle = '#1d2433'; g.fillRect(-14, -4, 28, 8); g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) g.fillRect(-14 + i * 7, i % 2 ? 0 : -4, 7, 4); g.restore();
    this.mapBase = c;
  },
  drawMap(race) {
    const c = this.el.map, g = c.getContext('2d');
    g.clearRect(0, 0, 420, 420); g.drawImage(this.mapBase, 0, 0);
    const pl = race.player;
    for (const k of race.karts) {
      if (k === pl) continue;
      const [x, y] = this.mapT(k.wpos.x, k.wpos.z);
      g.fillStyle = CHARS[k.id].kart; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    const [x, y] = this.mapT(pl.wpos.x, pl.wpos.z), a = pl.yawW;
    g.save(); g.translate(x, y); g.rotate(-a + Math.PI);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -24); g.lineTo(10, -8); g.lineTo(-10, -8); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = CHARS[pl.id].kart; g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  drawSpeed(kmh, boost, t) {
    const c = this.el.speedArc, g = c.getContext('2d');
    g.clearRect(0, 0, 420, 280);
    const cx = 210, cy = 230, r = 180;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(11,22,48,0.55)'; g.lineWidth = 36; g.beginPath(); g.arc(cx, cy, r, Math.PI, Math.PI * 2); g.stroke();
    const k = clamp(kmh / 100, 0, 1);
    if (k > 0.005) {
      let col = kmh < 40 ? '#56d364' : kmh < 65 ? '#ffd54a' : '#ff7a2f';
      if (boost) { const grd = g.createLinearGradient(cx - r, 0, cx + r, 0); for (let i = 0; i <= 6; i++) grd.addColorStop(i / 6, ((i + Math.floor(t * 12)) % 2) ? '#3fd0ff' : '#ffffff'); col = grd; }
      g.strokeStyle = col; g.lineWidth = 26; g.beginPath(); g.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * k); g.stroke();
    }
  },
  // 毎コマ
  update(dt, race, t) {
    const E = this.el, p = race.player;
    const pos = race.playerPos;
    if (pos !== this.pos) {
      E.rank.textContent = pos; E.rank.className = pos <= 3 ? 'r' + pos : '';
      if (this.pos) { E.rank.classList.add(pos < this.pos ? 'up' : 'down'); setTimeout(() => E.rank.classList.remove('up', 'down'), 400); }
      E.crown.style.display = pos === 1 ? 'block' : 'none';
      this.pos = pos;
    }
    race.order.forEach((k, i) => { const f = this.faces[k.id]; if (f && f._i !== i) { f.style.transform = `translateY(${i * 52}px)`; f._i = i; } f && f.classList.toggle('fin', k.finished); });
    const lapNow = clamp(p.lap + 1, 1, race.laps);
    if (lapNow !== this.lapShown) { E.lapNum.textContent = lapNow; this.lapShown = lapNow; }
    if (race.finalLap && !E.lap.classList.contains('final')) { E.lap.classList.add('final'); E.lapLabel.textContent = 'ファイナル'; E.lapOf.textContent = ''; E.lapNum.textContent = ''; }
    const shownT = p.finished ? p.finishTime : race.time;
    const tt = Math.floor(shownT * 10);
    if (tt !== this.tt) { E.time.textContent = fmtTime(shownT); this.tt = tt; }
    const kmh = Math.round(p.v * 3.6), boost = p.boostT > 0;
    if (kmh !== this.kmh || boost) { E.speedNum.textContent = kmh; this.drawSpeed(kmh, boost, t); this.kmh = kmh; }
    if (p.stars !== this.starsShown) {
      if (this.starsShown >= 0 && p.stars > this.starsShown) { E.stars.classList.remove('pop'); void E.stars.offsetWidth; E.stars.classList.add('pop'); }
      if (this.starsShown >= 0 && Math.floor(p.stars / 5) < Math.floor(this.starsShown / 5)) { const i = Math.floor(this.starsShown / 5) - 1; const cell = E.cells[clamp(i, 0, 2)]; cell.classList.add('burst'); setTimeout(() => cell.classList.remove('burst'), 320); }
      E.stars.textContent = p.stars; this.starsShown = p.stars;
      const full = Math.floor(p.stars / 5), part = (p.stars % 5) / 5;
      E.cells.forEach((c, i) => { c.classList.toggle('full', i < full); c.firstChild.style.width = i < full ? '100%' : i === full ? (part * 100) + '%' : '0%'; });
    }
    this.drawMap(race);
    this.speedLines(dt, p);
    this.updateCue(race);
    if (this.toastBusy > 0) this.toastBusy -= dt;
    else if (this.toastQ.length) { const q = this.toastQ.shift(); this.showToast(q.text, q.cls); }
  },
  // ---------- 合図 ----------
  updateCue(race) {
    const c = race.cue, E = this.el;
    if (!c || race.phase !== 'run') { this.cue(null); E.run.classList.remove('on'); return; }
    if (c.kind === 'run') { this.cue(null); E.run.classList.add('on'); return; }
    E.run.classList.remove('on');
    if (this.cueKind !== c.kind) {
      this.cueKind = c.kind;
      E.cuePic.innerHTML = picSVG(c.kind === 'jump' ? 'jump' : 'squat');
      E.cueText.textContent = c.kind === 'jump' ? 'ジャンプ！' : 'しゃがめ！';
      E.cue.classList.remove('burst');
    }
    E.cue.classList.add('on'); E.cue.classList.toggle('now', !!c.now);
    E.cueRing.style.strokeDashoffset = String(276.5 * (1 - clamp(c.p, 0, 1)));
  },
  cue(c) { if (!c) { this.el.cue.classList.remove('on', 'now'); this.cueKind = null; } },
  cueBurst() { const E = this.el; if (!E.cue.classList.contains('on')) return; E.cue.classList.add('burst'); setTimeout(() => { E.cue.classList.remove('on', 'burst', 'now'); }, 350); this.cueKind = null; },
  // ---------- ほめ言葉 ----------
  toast(text, cls = '') { this.toastQ.push({ text, cls }); if (this.toastQ.length > 3) this.toastQ.shift(); },
  showToast(text, cls) {
    const el = this.el.toast;
    el.innerHTML = `<span class="t in ${cls}">${text}</span>`;
    this.toastBusy = H.TOAST_GAP + H.TOAST_IN;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => { const s = el.firstChild; if (s) { s.classList.remove('in'); s.classList.add('out'); } setTimeout(() => { if (el.firstChild && el.firstChild.classList.contains('out')) el.innerHTML = ''; }, 260); }, (H.TOAST_IN + H.TOAST_HOLD) * 1000);
  },
  big(text, cls = '', up = false) {
    const el = this.el.big;
    if (up && el.firstChild) { el.firstChild.classList.add('up'); setTimeout(() => this.big(text, cls), 300); return; }
    el.innerHTML = text ? `<span class="t in" style="${cls}">${text}</span>` : '';
  },
  banner() { const b = this.el.banner; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 2300); },
  almost(on) { this.el.almost.classList.toggle('on', on); },
  turboTip() { const t = this.el.tip; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(this._tip); this._tip = setTimeout(() => t.classList.remove('on'), 3000); },
  lights(n, show = true) {
    const E = this.el;
    E.lights.classList.toggle('on', show); E.lights.classList.remove('away');
    E.lightEls.forEach((l, i) => { l.className = 'light' + (n >= 4 ? ' green' : i < n ? ' red' : ''); });
  },
  lightsAway() { this.el.lights.classList.add('away'); setTimeout(() => this.el.lights.classList.remove('on'), 400); },
  count(n) { const c = this.el.count; c.textContent = n || ''; c.classList.toggle('on', !!n); },
  // ---------- 速さの線 ----------
  speedLines(dt, p) {
    const c = this.sl, W = innerWidth, Hh = innerHeight;
    if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
    const g = this.slc;
    g.clearRect(0, 0, W, Hh);
    const boost = p.boostT > 0, turbo = p.turbo;
    let want = clamp((p.v - H.SPEED_LINES_V0) / (CFG.phys.VMAX - H.SPEED_LINES_V0), 0, 1) * H.SPEED_LINES_MAX + (boost ? H.SPEED_LINES_BOOST : 0) + (turbo ? H.SPEED_LINES_TURBO : 0);
    if (this.quality === 'low' && !boost) want = 0;
    let n = this.lines.length;
    for (let i = 0; i < want * dt / H.SPEED_LINES_LIFE * 1.0 && n < 80; i++) {
      const a = Math.random() * Math.PI * 2, r0 = H.SPEED_LINES_INNER + Math.random() * 0.25;
      this.lines.push({ a, r: r0, t: 0, len: 0.05 + Math.random() * 0.12 }); n++;
    }
    const cx = W / 2, cy = Hh * 0.52, R = Math.hypot(W, Hh) / 2;
    g.lineCap = 'round';
    g.strokeStyle = turbo ? 'rgba(190,240,255,0.5)' : 'rgba(255,255,255,0.35)';
    g.lineWidth = Math.max(1.5, W / 700);
    this.lines = this.lines.filter(l => {
      l.t += dt; if (l.t > H.SPEED_LINES_LIFE) return false;
      l.r += dt * 1.6;
      const r1 = l.r * R, r2 = (l.r + l.len) * R;
      g.beginPath(); g.moveTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1); g.lineTo(cx + Math.cos(l.a) * r2, cy + Math.sin(l.a) * r2); g.stroke();
      return true;
    });
  },
  clearLines() { this.lines = []; this.slc.clearRect(0, 0, this.sl.width, this.sl.height); }
};
