// ふたりで はしる（左右に 分けた 画面）の 表示。左が 1P、右が 2P
import { CFG } from './config.js';
import { fmtTime, clamp, $ } from './util.js';
import { picSVG } from './pics.js';
import { CHARS } from './models.js';
import { ITEM_SVG, ITEMS } from './plus.js';

const cueText = { jump: 'ジャンプ！', squat: 'しゃがめ！', run: 'あしぶみ！' };
export const Two = {
  init() { this.P = [$('h2a'), $('h2b')]; },
  setup(race) {
    this.race = race;
    this.e = race.humans.map((k, i) => {
      const el = this.P[i], c = CHARS[k.id];
      el.innerHTML = `<div class="h2tag" style="background:${c.kart}">${i + 1}P　${c.name}</div>`
        + `<div class="h2rank"><b>1</b><span>い</span></div><div class="h2lap"></div><div class="h2time"></div>`
        + `<div class="h2spd"><b>0</b><small>km/h</small></div><div class="h2star">★<b>0</b></div><div class="h2coin">●<b>0</b></div><div class="h2item"></div>`
        + `<div class="h2cue"><span class="pic"></span><span class="tx"></span><i></i></div><div class="h2msg"></div><div class="h2big"></div>`;
      const q = s => el.querySelector(s);
      return { rank: q('.h2rank b'), rankBox: q('.h2rank'), lap: q('.h2lap'), time: q('.h2time'), spd: q('.h2spd b'), star: q('.h2star b'), cue: q('.h2cue'), cuePic: q('.cue .pic') || q('.h2cue .pic'), cueTx: q('.h2cue .tx'), cueBar: q('.h2cue i'), msg: q('.h2msg'), big: q('.h2big'), coin: q('.h2coin b'), item: q('.h2item'), v: {} };
    });
  },
  set(e, key, el, text) { if (e.v[key] !== text) { e.v[key] = text; el.textContent = text; } },
  update(race) {
    race.humans.forEach((k, i) => {
      const e = this.e && this.e[i]; if (!e) return;
      const pos = i ? race.player2Pos : race.playerPos;
      this.set(e, 'rank', e.rank, pos);
      e.rankBox.className = 'h2rank' + (pos <= 3 ? ' r' + pos : '');
      const lapNow = clamp(k.lap + 1, 1, race.laps);
      this.set(e, 'lap', e.lap, k.finished ? 'ゴール' : lapNow >= race.laps && race.finalLap ? 'ファイナル' : `${lapNow} / ${race.laps} しゅう`);
      this.set(e, 'time', e.time, fmtTime(k.finished ? k.finishTime : race.time));
      this.set(e, 'spd', e.spd, Math.round(k.v * 3.6));
      this.set(e, 'star', e.star, k.stars);
      this.set(e, 'coin', e.coin, k.coins);
      const it = k.rollT > 0 ? ITEMS[Math.floor(performance.now() / 83) % ITEMS.length] : (k.item || '');
      if (e.v.item !== it) { e.v.item = it; e.item.innerHTML = it ? ITEM_SVG[it] : ''; e.item.classList.toggle('has', !!k.item); }
      const c = race.cs[i].cue;
      if (c && race.phase === 'run' && !k.finished) {
        if (e.v.cueKind !== c.kind) { e.v.cueKind = c.kind; e.cueTx.textContent = cueText[c.kind]; e.cue.querySelector('.pic').innerHTML = picSVG(c.kind === 'jump' ? 'jump' : c.kind === 'squat' ? 'squat' : 'run'); }
        e.cue.classList.add('on'); e.cue.classList.toggle('now', !!c.now); e.cueBar.style.width = (clamp(c.p, 0, 1) * 100) + '%';
      } else { e.cue.classList.remove('on', 'now'); e.v.cueKind = null; }
    });
  },
  say(i, text, ms = 1400) {
    const e = this.e && this.e[i]; if (!e) return;
    e.msg.textContent = text; e.msg.classList.remove('on'); void e.msg.offsetWidth; e.msg.classList.add('on');
    clearTimeout(e.mt); e.mt = setTimeout(() => e.msg.classList.remove('on'), ms);
  },
  goal(i, pos) {
    const e = this.e && this.e[i]; if (!e) return;
    e.big.innerHTML = `<div class="g">ゴール！</div><div class="n r${pos}">${pos}い</div>`; e.big.classList.add('on');
  },
  clear() { (this.e || []).forEach(e => { e.big.classList.remove('on'); e.msg.classList.remove('on'); }); }
};
