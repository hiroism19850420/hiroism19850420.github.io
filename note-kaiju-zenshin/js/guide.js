// ぜんしん版：操作の案内（手書き風の文字と、左手・右手の小さな絵）。
// #stage の中に置き、ゲームの座標（960×540）に合わせた --u で大きさを決める。中身は 状態が変わったときだけ 作りなおす。

const INK = '#1d2a44', BLUE = '#2f5bd8', RED = '#d8343b', GRAY = '#9aa3b5';

// 人の絵（鏡うつし：プレイヤーの左手が 画面の左）。left：up/down/lost、right：pen/write/swipe/lost、clap
export function figure(o = {}) {
  const s = (d, c = INK, w = 3.6, extra = '') => `<path d="${d}" stroke="${c}" stroke-width="${w}" ${extra}/>`;
  let g = `<circle cx="60" cy="20" r="10" stroke="${INK}" stroke-width="3.4"/>` + s('M60 31 L60 72 M47 39 Q60 36 73 39');
  if (o.clap) {
    g += s('M47 39 L44 58 L56 50') + s('M73 39 L76 58 L64 50');
    g += `<circle cx="56.5" cy="49.5" r="4.2" fill="${INK}"/><circle cx="63.5" cy="49.5" r="4.2" fill="${INK}"/>`;
    g += s('M60 41 L60 34 M51 43 L45 37 M69 43 L75 37 M49 52 L42 53 M71 52 L78 53', BLUE, 3);
    g += `<text x="60" y="95" font-size="15" fill="${BLUE}" stroke="none" text-anchor="middle">パン！</text>`;
  } else {
    if (o.left === 'up') g += s('M47 39 L40 23 L37 8') + `<circle cx="37" cy="7" r="3.4" fill="${INK}"/>` + s('M22 36 L22 12 M15 19 L22 11 L29 19', BLUE, 3.4);
    else if (o.left === 'lost') g += s('M47 39 L41 56 L39 72', GRAY, 3.4, 'stroke-dasharray="4 5"') + `<text x="22" y="44" font-size="26" fill="${RED}" stroke="none" text-anchor="middle">?</text>`;
    else g += s('M47 39 L41 56 L39 72') + `<circle cx="39" cy="73" r="3.4" fill="${INK}"/>` + s('M22 14 L22 36 M15 29 L22 37 L29 29', GRAY, 3.2);
    if (o.right === 'lost') g += s('M73 39 L86 50 L98 44', GRAY, 3.4, 'stroke-dasharray="4 5"') + `<text x="104" y="74" font-size="26" fill="${RED}" stroke="none" text-anchor="middle">?</text>`;
    else {
      g += s('M73 39 L86 50 L98 44') + s('M98 44 L109 30', INK, 4.6) + s('M98 44 L96 47', INK, 2.4);
      if (o.right === 'write') g += s('M66 74 Q76 54 85 66 T96 47', BLUE, 3.4);
      else if (o.right === 'swipe') g += s('M114 64 L74 64 M82 57 L74 64 L82 71', RED, 3.2);
      else g += s('M70 70 Q80 58 88 66 T100 56', GRAY, 2.4, 'stroke-dasharray="3 5"');
    }
    g += `<text x="22" y="95" font-size="12.5" fill="${INK}" stroke="none" text-anchor="middle" opacity=".8">左手</text>`;
    g += `<text x="100" y="95" font-size="12.5" fill="${INK}" stroke="none" text-anchor="middle" opacity=".8">右手</text>`;
  }
  return `<svg viewBox="0 0 120 100" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}</svg>`;
}

// 隅の小さなアイコン：左手が 挙がっている・下りている・見えない
function handIcon(st) {
  const c = st === 'up' ? '#fff' : st === 'lost' ? RED : INK;
  const hand = `<path d="M14 33 L14 19 Q14 16 16.5 16 Q19 16 19 19 L19 10 Q19 7.5 21.5 7.5 Q24 7.5 24 10 L24 18 Q27 16.5 28.5 19 L28.5 28 Q28.5 34 22 35 L17 35 Q14 35 14 33 Z" stroke="${c}" stroke-width="2.4" ${st === 'up' ? 'fill="#fff" fill-opacity=".25"' : ''}/>`;
  const arrow = st === 'up' ? `<path d="M7 26 L7 10 M3 14 L7 9.5 L11 14" stroke="${c}" stroke-width="2.6"/>`
    : st === 'down' ? `<path d="M7 9 L7 25 M3 21 L7 25.5 L11 21" stroke="${GRAY}" stroke-width="2.4"/>`
    : `<text x="7" y="17" font-size="15" fill="${RED}" stroke="none" text-anchor="middle">?</text>`;
  return `<svg viewBox="0 0 36 40" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${hand}${arrow}</svg><b>左</b>`;
}

const TEXT = {
  idle: { main: '左手を あげている あいだ、<br>右手で かけるよ！', pic: { left: 'down', right: 'pen' } },
  writing: { main: 'かいてる！', sub: '左手を おろすと、ペンが はなれるよ', pic: { left: 'up', right: 'write' }, cls: 'on' },
  relift: { main: '左手を いちど おろしてね', sub: 'もういちど あげると かけるよ', pic: { left: 'down', right: 'pen' } },
  noLeft: { main: '左手が うつってないよ', sub: 'カメラに 左手を みせてね', pic: { left: 'lost', right: 'pen' }, cls: 'warn' },
  noRight: { main: '右手が うつってないよ', sub: 'カメラに 右手を みせてね', pic: { left: 'down', right: 'lost' }, cls: 'warn' },
  nobody: { main: 'からだが うつってないよ', sub: 'カメラから すこし はなれてね', pic: { left: 'lost', right: 'lost' }, cls: 'warn' },
};

export class Guide {
  constructor(stage) {
    this.el = document.createElement('div');
    this.el.id = 'zenGuide';
    this.el.className = 'hand';
    this.el.hidden = true;
    this.icon = document.createElement('div');
    this.icon.id = 'zenHand';
    this.icon.hidden = true;
    stage.append(this.el, this.icon);
    this.key = ''; this.iconKey = '';
    this.mode = 'hidden'; this.status = '';
  }

  // mode：hidden / title / corner / big（はじめての練習）/ done（できたね！）。status：Zen.status() など
  update(mode, status, iconState) {
    const ik = iconState || 'none';
    if (ik !== this.iconKey) {
      this.iconKey = ik;
      this.icon.hidden = ik === 'none';
      if (ik !== 'none') { this.icon.className = ik; this.icon.innerHTML = handIcon(ik); }
    }
    const key = `${mode}|${status}`;
    if (key === this.key) return;
    this.key = key; this.mode = mode; this.status = status;
    const el = this.el;
    if (mode === 'hidden') { el.hidden = true; el.innerHTML = ''; return; }
    let T;
    if (mode === 'title') T = { main: 'はくしゅで はじめる', sub: '左手を あげている あいだ、<br>右手で かけるよ！', pic: { clap: true } };
    else if (mode === 'done') T = { main: 'できたね！', sub: 'その ちょうしで まもろう', pic: { left: 'up', right: 'write' }, cls: 'on yay' };
    else {
      T = TEXT[status] || TEXT.idle;
      if (mode === 'big' && status === 'idle') T = Object.assign({}, T, { sub: '右手を うごかして、線を かいてみよう' });
    }
    el.className = `hand ${mode} ${T.cls || ''}`;
    el.innerHTML = `<div class="zpic">${figure(T.pic)}</div><div class="ztx"><div class="zmain">${T.main}</div>${T.sub ? `<div class="zsub">${T.sub}</div>` : ''}</div>`;
    el.hidden = false;
  }
  get text() { const t = this.el.querySelector('.ztx'); return this.el.hidden || !t ? '' : t.textContent; }
}
