// レース中の 表示（第21部、付録Q・AZ・CB）。横・縦・2人
import { CFG } from './config.js';
import { fmtTime, clamp, $ } from './util.js';
import { picSVG } from './pics.js';
import { CHARS } from './models.js';

const PIC_OF = { jump: 'jump', crouch: 'squat', dodgeR: 'dodgeR', dodgeL: 'dodgeL', banzai: 'banzai', handR: 'handR', handL: 'handL' };
const LEAD_TEXT = { jump: 'ジャンプまで', crouch: 'しゃがむよ！', dodgeR: 'みぎに よけて！', dodgeL: 'ひだりに よけて！', banzai: 'りょうてを あげるよ！', handR: 'みぎてを あげるよ！', handL: 'ひだりてを あげるよ！' };
const GO_TEXT = { jump: 'ジャンプ！', crouch: 'しゃがんで！', dodgeR: 'よけて！', dodgeL: 'よけて！', banzai: 'バンザイ！', handR: 'みぎて！', handL: 'ひだりて！' };
const CROWN = '<svg class="hCrown" viewBox="0 0 64 48"><path d="M6 40 L10 12 L24 26 L32 6 L40 26 L54 12 L58 40 Z" fill="#ffd54a" stroke="#1d2b53" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="6" r="4" fill="#ff6fae"/><circle cx="10" cy="12" r="3.5" fill="#3fa9f5"/><circle cx="54" cy="12" r="3.5" fill="#3fa9f5"/></svg>';
const pop = (el, cls = 'pop') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

export const HUD = {
  views: [], acc: 0, lines: [[], []],
  init() {
    this.el = { hud: $('hud'), prog: $('hProg'), bar: $('hProgBar'), marks: $('hProgMarks'), dots: $('hProgDots'), final: $('hProgFinal'), remain: $('hRemain'), time: $('hTime'),
      toast: $('hToast'), banner: $('hBanner'), big: $('hBig'), count: $('hCount'), photo: $('hPhoto'), players: $('hPlayers') };
    this.sl = $('speedLines'); this.slc = this.sl.getContext('2d');
    this.toastQ = []; this.toastBusy = 0;
  },
  show(on) { this.el.hud.classList.toggle('on', on); if (!on) { this.clearLines(); this.views.forEach(v => this.hideCue(v)); } },

  // レースの はじめに。views：[{ runner, who }]
  setRace(race, portraits, quality, opt = {}) {
    this.race = race; this.quality = quality; this.portraits = portraits;
    const two = race.two;
    const P = this.el.players; P.innerHTML = '';
    this.views = race.players.map((r, i) => {
      const d = document.createElement('div'); d.className = 'hudP'; d.dataset.p = i;
      d.innerHTML = `<div class="hRank ol"><span class="hRankNum">${race.runners.length}</span><span class="hRankSuf">い</span><span class="hRankOf">/${race.runners.length}</span>${CROWN}</div>
        ${two ? `<div class="hTag p${i}">${i ? '2P' : '1P'}</div>` : '<div class="hList"></div>'}
        <div class="hCue"><div class="hCueRingWrap"><svg class="hCueRing" viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="44"/><circle class="fg" cx="50" cy="50" r="44" stroke-dasharray="276.5" stroke-dashoffset="0" transform="rotate(-90 50 50)"/></svg><div class="hCuePic"></div></div>
          <div class="hCueNum ol6"></div><div class="hCueArrow"></div><div class="hCueText ol6"></div></div>
        <div class="hSpeed"><canvas class="hSpeedArc" width="420" height="280"></canvas><div class="hSpeedNum ol">0</div><div class="hSpeedUnit ol">km/h</div></div>
        <div class="hSwing"><div class="hSwingIcon">${picSVG('swing')}</div><div class="hSwingBar"><i></i></div><div class="hSwingText ol">うでを ふって！</div></div>
        <div class="hJama"><div class="hJamaL">${picSVG('armL')}${picSVG('legL')}</div><div class="hJamaR">${picSVG('armR')}${picSVG('legR')}</div></div>`;
      P.appendChild(d);
      const q = s => d.querySelector(s);
      const v = { runner: r, who: i, root: d, rank: 0, kmh: -1, cueId: null, num: null, stage: null,
        el: { rankNum: q('.hRankNum'), crown: q('.hCrown'), list: q('.hList'), cue: q('.hCue'), ringWrap: q('.hCueRingWrap'), ring: q('.hCueRing .fg'), cuePic: q('.hCuePic'), cueNum: q('.hCueNum'), arrow: q('.hCueArrow'), cueText: q('.hCueText'),
          speed: q('.hSpeed'), speedArc: q('.hSpeedArc'), speedNum: q('.hSpeedNum'), swing: q('.hSwing'), swingFill: q('.hSwingBar i'), jamaL: q('.hJamaL'), jamaR: q('.hJamaR'), jama: q('.hJama') } };
      v.el.arrow.innerHTML = picSVG('arrowR');
      v.el.jama.classList.toggle('on', race.mode === 'jama');
      return v;
    });
    // 顔の ならび（横の 画面の 1人）
    this.faces = {};
    const L = this.views[0].el.list;
    if (L) race.runners.forEach(o => {
      const f = document.createElement('div'); f.className = 'hFace' + (o.isPlayer ? ' you' : '');
      f.style.backgroundImage = `url(${portraits[o.char] ? portraits[o.char].normal : ''})`; f.style.borderColor = o.isPlayer ? '' : CHARS[o.char].kart;
      L.appendChild(f); this.faces[o.id] = f; f._i = -1;
    });
    // すすみぐあい
    const L2 = race.L, fin = race.final;
    this.el.final.style.setProperty('--f0', ((L2 - fin) / L2 * 100) + '%');
    this.el.marks.innerHTML = race.obstacles.map(ob => `<i class="m" style="--p:${(ob.s / L2 * 100).toFixed(2)}%">${picSVG(PIC_OF[ob.type] || 'jump')}</i>`).join('');
    this.el.dots.innerHTML = '';
    this.dots = {};
    race.runners.forEach(o => {
      const d = document.createElement('div'); d.className = 'pd' + (o.isPlayer ? ' you p' + o.who : '');
      d.style.backgroundImage = `url(${portraits[o.char] ? portraits[o.char].normal : ''})`; d.style.borderColor = CHARS[o.char].kart;
      this.el.dots.appendChild(d); this.dots[o.id] = d;
    });
    this.el.prog.classList.remove('final');
    this.el.banner.classList.remove('on'); this.el.big.innerHTML = ''; this.el.toast.innerHTML = ''; this.el.photo.classList.remove('on');
    this.toastQ = []; this.acc = 1;
  },

  // ---------- 毎コマ（付録Q） ----------
  update(race, dt, t, viewRects) {
    const L = race.L;
    for (const v of this.views) {
      const r = v.runner, E = v.el;
      const rank = race.rankOf(r);
      if (rank !== v.rank) {
        const up = v.rank && rank < v.rank;
        E.rankNum.textContent = rank; E.rankNum.className = 'hRankNum' + (rank <= 3 ? ' r' + rank : '');
        if (v.rank) pop(E.rankNum, up ? 'up' : 'down');
        E.crown.classList.toggle('on', rank === 1);
        if (rank === 1 && v.rank) pop(E.crown, 'drop');
        v.rank = rank;
      }
      const kmh = Math.round(r.v * 3.6);
      if (kmh !== v.kmh) { v.kmh = kmh; E.speedNum.textContent = kmh; this.drawArc(E.speedArc, kmh, race.inFinal(r.s) && r.spurt > 0.3, t); }
      const cue = race.cueOf(r);
      if (cue && !r.finished && race.phase === 'run') this.showCue(v, cue, t); else if (v.cueId != null && !v.bursting) this.hideCue(v);
      const fin = race.inFinal(r.s) && !r.finished;
      E.swing.classList.toggle('on', fin);
      if (fin) E.swingFill.style.width = (clamp(r.spurt, 0, 1) * 100) + '%';
      if (race.mode === 'jama' && race.jama) {
        const [l, rr] = race.jama.sidesOf ? race.jama.sidesOf(r) : [null, null];
        E.jamaL.classList.toggle('on', !!l); E.jamaR.classList.toggle('on', !!rr);
      }
    }
    // すすみぐあい（全員）
    const portrait = document.body.classList.contains('portrait');
    for (const o of race.runners) {
      const d = this.dots[o.id]; if (!d) continue;
      const k = clamp(o.s / L, 0, 1);
      d.style.setProperty('--p', (k * 100).toFixed(2) + '%');
      d.classList.toggle('fin', o.finished);
    }
    this.el.prog.classList.toggle('final', race.players.some(p => race.inFinal(p.s) && !p.finished));
    // 顔の ならび
    if (this.faces && !portrait) race.order.forEach((o, i) => { const f = this.faces[o.id]; if (f && f._i !== i) { f.style.transform = `translateY(${i * 58}px)`; f._i = i; } if (f) f.classList.toggle('fin', o.finished); });
    // のこり と 時計
    this.acc += dt;
    if (this.acc > 0.1) {
      this.acc = 0;
      const me = this.views[0].runner, rest = Math.max(0, Math.ceil(L - me.s));
      this.el.remain.textContent = me.finished ? 'ゴール！' : `のこり ${rest}m`; this.el.remain.classList.toggle('red', rest <= 100 && !me.finished);
      this.el.time.textContent = fmtTime(me.finished ? me.finishTime : race.phase === 'gate' ? 0 : race.time - (race.runStart || 0));
    }
    // 知らせ
    if (this.toastBusy > 0) this.toastBusy -= dt;
    else if (this.toastQ.length) { const q = this.toastQ.shift(); this.showToast(q.text, q.cls); }
    // 集中線
    this.speedLines(dt, race, viewRects);
  },
  showCue(v, cue, t) {
    const E = v.el, type = cue.type;
    if (v.cueId !== cue.id) {
      v.cueId = cue.id; v.bursting = false; v.num = null; v.stage = null;
      E.cuePic.innerHTML = picSVG(PIC_OF[type] || 'jump');
      E.cue.className = 'hCue on in';
      E.arrow.className = 'hCueArrow' + (cue.base === 'dodge' ? ' on ' + cue.side : '');
    }
    E.ring.style.strokeDashoffset = String(276.5 * clamp(cue.k, 0, 1));
    const num = { lead: '', next: '', 3: '3', 2: '2', 1: '1', go: '' }[cue.stage] ?? '';
    if (v.num !== num) { v.num = num; E.cueNum.textContent = num; if (num) pop(E.cueNum); }
    if (v.stage !== cue.stage) {
      v.stage = cue.stage;
      E.cueText.textContent = cue.stage === 'go' ? GO_TEXT[type] : cue.stage === 'next' ? 'つぎ！' : LEAD_TEXT[type];
      E.cue.classList.toggle('go', cue.stage === 'go');
      if (cue.stage === 'go') pop(E.cueText, 'shake');
    }
  },
  hideCue(v) { v.cueId = null; v.el.cue.className = 'hCue'; v.el.arrow.className = 'hCueArrow'; },
  cueBurst(who = 0) { const v = this.views[who]; if (!v || v.cueId == null) return; v.bursting = true; v.el.cue.className = 'hCue on burst'; setTimeout(() => { v.bursting = false; this.hideCue(v); }, 360); },
  cueFail(who = 0) { const v = this.views[who]; if (!v || v.cueId == null) return; v.bursting = true; v.el.cue.className = 'hCue on fail'; setTimeout(() => { v.bursting = false; this.hideCue(v); }, 520); },
  cueRect(who = 0) { const v = this.views[who]; if (!v || v.cueId == null) return null; const r = v.el.ringWrap.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; },
  passFlash(who = 0) { const v = this.views[who]; if (v) pop(v.root, 'passed'); },

  drawArc(c, kmh, fire, t) {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 420, 280);
    const cx = 210, cy = 230, r = 180;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(11,22,48,0.55)'; g.lineWidth = 36; g.beginPath(); g.arc(cx, cy, r, Math.PI, Math.PI * 2); g.stroke();
    const k = clamp(kmh / 90, 0, 1);
    if (k > 0.005) {
      let col = kmh < 40 ? '#56d364' : kmh < 65 ? '#ffd54a' : kmh < 80 ? '#ff7a2f' : '#ff3b30';
      if (fire) { const grd = g.createLinearGradient(cx - r, 0, cx + r, 0); for (let i = 0; i <= 6; i++) grd.addColorStop(i / 6, ((i + Math.floor(t * 12)) % 2) ? '#ffb020' : '#ff3b00'); col = grd; }
      g.strokeStyle = col; g.lineWidth = 26; g.beginPath(); g.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * k); g.stroke();
    }
  },

  // ---------- 知らせ・帯・大きな 文字 ----------
  toast(text, cls = '') { this.toastQ.push({ text, cls }); if (this.toastQ.length > 3) this.toastQ.shift(); },
  showToast(text, cls) {
    const el = this.el.toast;
    el.innerHTML = `<span class="t in ${cls}">${text}</span>`;
    this.toastBusy = 0.9;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => { const s = el.firstChild; if (s) { s.classList.remove('in'); s.classList.add('out'); } setTimeout(() => { if (el.firstChild && el.firstChild.classList.contains('out')) el.innerHTML = ''; }, 300); }, 1300);
  },
  banner(text = 'ラストスパート！') { const b = this.el.banner; b.innerHTML = `<div class="band"><span class="ol6">${text}</span></div>`; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); clearTimeout(this._bn); this._bn = setTimeout(() => b.classList.remove('on'), 2300); },
  big(text, cls = '', hold = 0.8) {
    const el = this.el.big;
    el.innerHTML = text ? `<span class="t in ${cls}">${text}</span>` : '';
    clearTimeout(this._bg);
    if (text && hold > 0) this._bg = setTimeout(() => { if (el.firstChild) { el.firstChild.classList.remove('in'); el.firstChild.classList.add('out'); } }, hold * 1000);
  },
  count(n) { const c = this.el.count; c.textContent = n || ''; c.classList.toggle('on', !!n); if (n) pop(c); },
  photo(on) { this.el.photo.classList.toggle('on', on); },

  // ---------- 集中線（24.6） ----------
  speedLines(dt, race, rects) {
    const c = this.sl, W = innerWidth, Hh = innerHeight;
    if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
    const g = this.slc;
    g.clearRect(0, 0, W, Hh);
    const F = CFG.fx;
    this.views.forEach((v, vi) => {
      const r = v.runner, R = rects ? rects[vi] : { x: 0, y: 0, w: W, h: Hh };
      if (!R) return;
      const spd = clamp(r.v / CFG.run.V_MAX, 0, 1.2);
      let want = spd < F.LINES_FROM || r.finished ? 0 : (spd - F.LINES_FROM) / (1 - F.LINES_FROM) * 70;
      if (race.inFinal(r.s) && !r.finished) want *= 1.4;
      if (r.boostT > 0) want += 30;
      if (this.quality === 'low') want *= 0.5;
      const L = this.lines[vi];
      for (let i = 0; i < want * dt * 2.2 && L.length < 90; i++) L.push({ a: Math.random() * Math.PI * 2, r: 0.42 + Math.random() * 0.3, t: 0, len: 0.05 + Math.random() * 0.14, w: 0.6 + Math.random() * 1.4 });
      const cx = R.x + R.w / 2, cy = R.y + R.h * 0.5, Rad = Math.hypot(R.w, R.h) / 2;
      g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
      g.lineCap = 'round';
      const fin = race.inFinal(r.s) && !r.finished;
      g.strokeStyle = fin && r.spurt > 0.5 ? 'rgba(255,214,140,0.5)' : 'rgba(255,255,255,0.38)';
      this.lines[vi] = L.filter(l => {
        l.t += dt; if (l.t > 0.35) return false;
        l.r += dt * 1.8;
        const r1 = l.r * Rad, r2 = (l.r + l.len) * Rad;
        g.lineWidth = Math.max(1.5, W / 700) * l.w;
        g.beginPath(); g.moveTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1); g.lineTo(cx + Math.cos(l.a) * r2, cy + Math.sin(l.a) * r2); g.stroke();
        return true;
      });
      g.restore();
    });
  },
  clearLines() { this.lines = [[], []]; if (this.slc) this.slc.clearRect(0, 0, this.sl.width, this.sl.height); }
};
