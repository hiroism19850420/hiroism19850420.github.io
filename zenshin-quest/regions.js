// ぜんしんクエスト：ちほうの てき・ボス・はいけい（すべて オリジナルの SVG）
// RegionArt.draw(id) → 400x400 の SVG、RegionArt.bg(id) → 400x300 の SVG
(function () {
  'use strict';
  const OL = '#1b1230';
  const S = `stroke="${OL}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`;
  const S5 = `stroke="${OL}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
  const S3 = `stroke="${OL}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
  let U = 0;
  const lg = (a, b, x2 = 0, y2 = 1) => { const id = 'rg' + (++U); return [id, `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`]; };
  const rg = (a, b, cx = .35, cy = .3, r = .9) => { const id = 'rg' + (++U); return [id, `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`]; };
  const shadow = (rx = 120, y = 372) => `<ellipse cx="200" cy="${y}" rx="${rx}" ry="${rx * 0.12}" fill="#000" opacity=".3"/>`;
  const wrap = (defs, inner) => `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" overflow="visible"><defs>${defs}</defs>${inner}</svg>`;
  const wrapBg = (defs, inner) => `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${inner}</svg>`;
  // かお：cx,cy まん中、s 大きさ、mood 'angry' | 'smug' | 'cute'
  function face(cx, cy, s, mood = 'angry') {
    const ex = s * 0.42, ey = cy - s * 0.05, er = s * 0.2;
    let o = '';
    for (const d of [-1, 1]) {
      o += `<ellipse cx="${cx + d * ex}" cy="${ey}" rx="${er}" ry="${er * 1.15}" fill="#fff" ${S3}/>`;
      o += `<circle cx="${cx + d * ex + d * -er * 0.15}" cy="${ey + er * 0.15}" r="${er * 0.55}" fill="${OL}"/>`;
      o += `<circle cx="${cx + d * ex - er * 0.25}" cy="${ey - er * 0.15}" r="${er * 0.2}" fill="#fff"/>`;
      if (mood === 'angry') o += `<path d="M${cx + d * ex * 1.6} ${ey - er * 1.5} L${cx + d * ex * 0.35} ${ey - er * 0.95}" ${S5} fill="none"/>`;
    }
    if (mood === 'angry') o += `<path d="M${cx - s * 0.28} ${cy + s * 0.42} Q${cx} ${cy + s * 0.25} ${cx + s * 0.28} ${cy + s * 0.42}" ${S5} fill="none"/>`;
    else if (mood === 'smug') o += `<path d="M${cx - s * 0.25} ${cy + s * 0.3} Q${cx} ${cy + s * 0.5} ${cx + s * 0.3} ${cy + s * 0.25}" ${S5} fill="none"/>`;
    else o += `<path d="M${cx - s * 0.2} ${cy + s * 0.3} Q${cx} ${cy + s * 0.48} ${cx + s * 0.2} ${cy + s * 0.3}" ${S5} fill="#e05a6a"/>`;
    return o;
  }
  const cheeks = (cx, cy, s) => `<ellipse cx="${cx - s * 0.7}" cy="${cy + s * 0.25}" rx="${s * 0.16}" ry="${s * 0.09}" fill="#ff8aa0" opacity=".6"/><ellipse cx="${cx + s * 0.7}" cy="${cy + s * 0.25}" rx="${s * 0.16}" ry="${s * 0.09}" fill="#ff8aa0" opacity=".6"/>`;

  const ART = {
    // ---------------- ぐんま ----------------
    tsuru() { // つる（ぐんまけんの かたちは つるが まう すがた）
      const [g, gd] = lg('#ffffff', '#d8e4f2');
      return wrap(gd, shadow(110) +
        `<path d="M160 215 C110 140 60 110 20 120 C60 150 70 190 110 225 Z" fill="url(#${g})" ${S}/>` +
        `<path d="M20 120 C40 135 50 150 58 168 L35 160 Z" fill="${OL}"/>` +
        `<path d="M230 205 C280 120 330 90 385 95 C345 135 320 180 270 225 Z" fill="url(#${g})" ${S}/>` +
        `<path d="M385 95 C360 115 345 135 335 155 L365 140 Z" fill="${OL}"/>` +
        `<path d="M150 250 L80 300 M165 255 L105 315" ${S} fill="none"/>` +
        `<ellipse cx="200" cy="235" rx="95" ry="52" fill="url(#${g})" ${S}/>` +
        `<path d="M110 240 L60 262 L118 262 Z" fill="${OL}"/>` +
        `<path d="M265 215 C295 180 300 140 290 105" stroke="${OL}" stroke-width="30" fill="none" stroke-linecap="round"/>` +
        `<path d="M265 215 C295 180 300 140 290 105" stroke="#fff" stroke-width="17" fill="none" stroke-linecap="round"/>` +
        `<circle cx="292" cy="92" r="30" fill="#fff" ${S}/>` +
        `<circle cx="290" cy="68" r="12" fill="#e2263a" ${S3}/>` +
        `<path d="M318 90 L372 100 L318 106 Z" fill="#3a3a3a" ${S3}/>` +
        `<circle cx="300" cy="88" r="6" fill="${OL}"/><path d="M284 76 L306 82" ${S5}/>`);
    },
    akagi() { // あかぎやま（なだらかな やまが いくつも ならぶ）
      const [g, gd] = lg('#9be07a', '#3f8f4a'), [r, rd] = lg('#d9714f', '#9be07a');
      return wrap(gd + rd, shadow(170) +
        `<path d="M20 360 C60 250 100 190 140 170 C165 160 180 175 200 150 C220 125 240 140 260 160 C300 185 340 250 380 360 Z" fill="url(#${g})" ${S}/>` +
        `<path d="M118 190 C140 165 165 160 200 150 C230 130 250 150 275 170 C250 172 230 160 200 175 C170 185 150 180 118 190 Z" fill="url(#${r})" opacity=".85"/>` +
        `<path d="M60 330 l14 -30 l14 30 Z M300 320 l14 -32 l14 32 Z M330 345 l12 -26 l12 26 Z" fill="#2e6b38"/>` +
        `<ellipse cx="290" cy="110" rx="40" ry="16" fill="#fff" opacity=".85"/>` +
        face(200, 255, 70, 'smug'));
    },
    myogi() { // みょうぎさん（ギザギザの いわやま）
      const [g, gd] = lg('#a9a2b8', '#5e566e');
      return wrap(gd, shadow(160) +
        `<path d="M30 360 L80 220 L105 260 L140 110 L170 200 L200 70 L235 190 L262 120 L290 240 L320 180 L370 360 Z" fill="url(#${g})" ${S}/>` +
        `<path d="M140 110 L150 160 L130 170 Z M200 70 L212 130 L190 135 Z M262 120 L270 165 L252 168 Z" fill="#fff" opacity=".7"/>` +
        `<path d="M70 345 l12 -28 l12 28 Z M300 340 l12 -30 l12 30 Z" fill="#2e6b38"/>` +
        face(200, 275, 72, 'angry'));
    },
    daruma1() { return daruma(false); },
    daruma2() { return daruma(true); },
    // ---------------- よこはま ----------------
    shumai() {
      const [g, gd] = lg('#fff4d0', '#e8c27a'), [w, wd] = lg('#fffbe8', '#f2dca0');
      return wrap(gd + wd, shadow(110) +
        `<path d="M200 70 q10 -20 0 -40 M160 80 q10 -20 0 -40 M240 80 q10 -20 0 -40" stroke="#fff" stroke-width="7" fill="none" opacity=".7" stroke-linecap="round"/>` +
        `<path d="M95 175 C95 340 305 340 305 175 Z" fill="url(#${g})" ${S}/>` +
        `<path d="M85 180 C100 120 130 135 150 110 C165 135 185 100 200 105 C215 100 235 135 250 110 C270 135 300 120 315 180 C270 160 130 160 85 180 Z" fill="url(#${w})" ${S}/>` +
        `<ellipse cx="200" cy="150" rx="70" ry="22" fill="#f6c97a" ${S5}/>` +
        `<circle cx="200" cy="138" r="18" fill="#6fcf4b" ${S5}/><circle cx="194" cy="132" r="5" fill="#c8f5a8"/>` +
        face(200, 245, 66, 'angry'));
    },
    nami() { // なみ
      const [g, gd] = lg('#7fd8ff', '#1f6fc4');
      return wrap(gd, shadow(150) +
        `<path d="M40 360 C40 220 120 110 240 100 C320 95 370 150 350 205 C335 245 285 245 280 205 C276 175 300 170 310 185 C305 150 260 140 225 165 C170 205 175 300 220 360 Z" fill="url(#${g})" ${S}/>` +
        `<path d="M240 100 C320 95 370 150 350 205 C362 160 330 120 280 118 C300 112 320 118 330 126 C300 100 270 98 240 100 Z" fill="#fff"/>` +
        `<circle cx="360" cy="170" r="10" fill="#fff" ${S3}/><circle cx="378" cy="196" r="7" fill="#fff" ${S3}/><circle cx="336" cy="140" r="8" fill="#fff" ${S3}/>` +
        face(140, 260, 66, 'angry'));
    },
    kamome() { // カモメ
      return wrap('', shadow(100) +
        `<path d="M190 200 C140 120 70 100 25 130 C75 140 110 175 150 225 Z" fill="#cfd8e3" ${S}/>` +
        `<path d="M25 130 C45 133 60 140 70 148 L48 150 Z" fill="${OL}"/>` +
        `<path d="M210 200 C260 120 330 100 375 130 C325 140 290 175 250 225 Z" fill="#cfd8e3" ${S}/>` +
        `<path d="M375 130 C355 133 340 140 330 148 L352 150 Z" fill="${OL}"/>` +
        `<ellipse cx="200" cy="235" rx="80" ry="58" fill="#fff" ${S}/>` +
        `<path d="M175 260 L200 300 L225 260 Z" fill="#ffc531" ${S5}/>` +
        face(200, 225, 56, 'angry'));
    },
    wheel() { // だいかんらんしゃ（ボス）
      const cols = ['#ff5a6a', '#ffd23f', '#5ad1ff', '#7be07a', '#c38aff', '#ff9a3c', '#ff7ac0', '#5affc0'];
      let sp = '', go = '';
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, x = 200 + Math.cos(a) * 150, y = 190 + Math.sin(a) * 150;
        sp += `<line x1="200" y1="190" x2="${x}" y2="${y}" stroke="#e8eef8" stroke-width="7"/>`;
        go += `<rect x="${x - 22}" y="${y - 6}" width="44" height="40" rx="12" fill="${cols[i]}" ${S5}/><rect x="${x - 14}" y="${y + 2}" width="28" height="14" rx="4" fill="#fff" opacity=".8"/>`;
      }
      return wrap('', shadow(150, 380) +
        `<path d="M200 190 L110 375 M200 190 L290 375" stroke="${OL}" stroke-width="22" stroke-linecap="round"/>` +
        `<path d="M200 190 L110 375 M200 190 L290 375" stroke="#b8c4d8" stroke-width="12" stroke-linecap="round"/>` +
        `<circle cx="200" cy="190" r="150" fill="none" stroke="${OL}" stroke-width="18"/><circle cx="200" cy="190" r="150" fill="none" stroke="#f2f6ff" stroke-width="9"/>` +
        sp + go +
        `<circle cx="200" cy="190" r="62" fill="#ffe7a8" ${S}/>` + face(200, 192, 52, 'angry'));
    },
    // ---------------- ちば ----------------
    rakkasei() { // らっかせい
      const [g, gd] = lg('#f2d29a', '#c99a55');
      let net = '';
      for (let i = 0; i < 7; i++) net += `<path d="M${120 + i * 26} 90 L${100 + i * 30} 350" stroke="#a87a3c" stroke-width="3" opacity=".5"/>`;
      return wrap(gd + `<clipPath id="pnc"><path d="M200 70 C290 70 300 150 270 200 C300 250 290 350 200 350 C110 350 100 250 130 200 C100 150 110 70 200 70 Z"/></clipPath>`, shadow(100) +
        `<path d="M200 70 C290 70 300 150 270 200 C300 250 290 350 200 350 C110 350 100 250 130 200 C100 150 110 70 200 70 Z" fill="url(#${g})" ${S}/>` +
        `<g clip-path="url(#pnc)">${net}</g>` +
        face(200, 255, 62, 'smug') + cheeks(200, 255, 62));
    },
    nanohana() { // なのはな
      let fl = '';
      const pts = [[200, 120], [150, 150], [250, 150], [170, 95], [232, 95], [130, 200], [270, 200], [200, 170]];
      for (const [x, y] of pts) {
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; fl += `<ellipse cx="${x + Math.cos(a) * 14}" cy="${y + Math.sin(a) * 14}" rx="13" ry="10" fill="#ffe02a" ${S3} transform="rotate(${a * 57} ${x + Math.cos(a) * 14} ${y + Math.sin(a) * 14})"/>`; }
        fl += `<circle cx="${x}" cy="${y}" r="7" fill="#ff9d1a"/>`;
      }
      return wrap('', shadow(90) +
        `<path d="M200 360 L200 220" stroke="${OL}" stroke-width="22" stroke-linecap="round"/><path d="M200 360 L200 220" stroke="#5bb84a" stroke-width="12" stroke-linecap="round"/>` +
        `<path d="M200 300 C150 300 120 270 110 250 C150 250 185 265 200 290 Z M200 320 C250 320 285 290 292 270 C250 270 215 290 200 312 Z" fill="#6fcf4b" ${S5}/>` +
        fl + `<circle cx="200" cy="240" r="58" fill="#ffe86a" ${S}/>` + face(200, 240, 46, 'angry'));
    },
    hikouki() { // ひこうき
      const [g, gd] = lg('#ffffff', '#cfdcec');
      return wrap(gd, shadow(150) +
        `<path d="M170 210 L90 330 L135 330 L240 215 Z" fill="#dfe8f4" ${S}/>` +
        `<path d="M300 160 L340 90 L370 90 L350 175 Z" fill="#3a8be0" ${S}/>` +
        `<path d="M40 215 C40 175 90 160 160 160 L330 160 C370 160 375 210 350 225 L120 250 C70 252 40 240 40 215 Z" fill="url(#${g})" ${S}/>` +
        `<path d="M70 225 L350 205" stroke="#3a8be0" stroke-width="10"/>` +
        `<path d="M170 205 L110 120 L150 120 L235 200 Z" fill="#dfe8f4" ${S}/>` +
        `<path d="M48 200 C55 185 75 178 92 180 L90 205 Z" fill="#7cc8ff" ${S3}/>` +
        face(130, 205, 34, 'angry'));
    },
    nashi() { // なしの おうさま（ボス）
      const [g, gd] = rg('#fff4b8', '#d9b04a', .4, .35, .8);
      let sp = '';
      for (let i = 0; i < 40; i++) { const a = i * 2.4, r = 40 + (i * 37 % 100); sp += `<circle cx="${200 + Math.cos(a) * r}" cy="${225 + Math.sin(a) * r * 0.9}" r="2.6" fill="#b08a3a" opacity=".55"/>`; }
      return wrap(gd, shadow(140) +
        `<circle cx="200" cy="225" r="140" fill="url(#${g})" ${S}/>` + sp +
        `<path d="M200 88 C195 70 200 55 210 45" stroke="${OL}" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M200 88 C195 70 200 55 210 45" stroke="#7a5230" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<path d="M212 60 C240 40 270 50 280 66 C255 76 230 74 212 60 Z" fill="#6fcf4b" ${S5}/>` +
        `<path d="M130 100 L140 60 L170 85 L200 50 L230 85 L260 60 L270 100 Z" fill="#ffd23f" ${S}/>` +
        `<circle cx="200" cy="72" r="9" fill="#ff5a6a"/>` +
        face(200, 235, 82, 'angry'));
    },
    // ---------------- とうきょう ----------------
    densha() { // でんしゃ（まえから）
      const [g, gd] = lg('#f4f6fa', '#c3cbd8');
      return wrap(gd, shadow(120) +
        `<rect x="95" y="70" width="210" height="270" rx="40" fill="url(#${g})" ${S}/>` +
        `<rect x="95" y="230" width="210" height="26" fill="#3fbf6a"/>` +
        `<rect x="115" y="95" width="170" height="95" rx="20" fill="#7cc8ff" ${S5}/>` +
        `<circle cx="140" cy="290" r="16" fill="#fff6a0" ${S5}/><circle cx="260" cy="290" r="16" fill="#fff6a0" ${S5}/>` +
        `<rect x="160" y="40" width="80" height="30" rx="8" fill="#5a6478" ${S5}/>` +
        `<path d="M180 40 L200 15 L220 40" ${S5} fill="none"/>` +
        face(200, 145, 52, 'angry') + `<rect x="120" y="345" width="160" height="16" rx="6" fill="#444"/>`);
    },
    biru() { // ビル
      let win = '';
      for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { if (r === 1 && (c === 1 || c === 2)) continue; win += `<rect x="${133 + c * 36}" y="${85 + r * 42}" width="22" height="26" rx="3" fill="${(r + c) % 3 ? '#ffe7a0' : '#7cc8ff'}" opacity=".9"/>`; }
      const [g, gd] = lg('#8fa0c0', '#4c5878');
      return wrap(gd, shadow(110) +
        `<rect x="115" y="60" width="170" height="300" rx="10" fill="url(#${g})" ${S}/>` + win +
        `<rect x="185" y="30" width="30" height="30" fill="#c3cbd8" ${S5}/><line x1="200" y1="30" x2="200" y2="5" ${S5}/><circle cx="200" cy="5" r="6" fill="#ff5a6a"/>` +
        face(200, 140, 44, 'angry'));
    },
    hato() { // ハト
      const [g, gd] = lg('#c2c8d6', '#8a92a6');
      return wrap(gd, shadow(100) +
        `<path d="M110 250 C110 180 160 160 210 165 C280 170 320 220 330 290 C300 270 270 270 250 280 C220 300 150 310 110 250 Z" fill="url(#${g})" ${S}/>` +
        `<path d="M230 200 C270 200 300 240 310 280 C280 260 250 250 230 240 Z" fill="#7a8296" ${S5}/>` +
        `<path d="M150 175 C150 120 180 95 205 95 C240 95 255 125 250 160 C240 175 200 185 150 175 Z" fill="#a9b0c2" ${S}/>` +
        `<path d="M150 175 C175 190 225 190 250 165 C245 185 220 200 160 195 Z" fill="#5fae8f" opacity=".9"/>` +
        `<path d="M150 175 C175 185 225 185 248 172" stroke="#9a6ad0" stroke-width="6" fill="none" opacity=".7"/>` +
        `<path d="M115 128 L90 140 L118 145 Z" fill="#e8b0a0" ${S3}/>` +
        `<circle cx="160" cy="128" r="11" fill="#ff8a3c" ${S3}/><circle cx="160" cy="128" r="5" fill="${OL}"/>` +
        `<path d="M148 112 L176 120" ${S5}/>` +
        `<path d="M180 300 L170 340 M215 300 L220 340" stroke="#e86a6a" stroke-width="7" stroke-linecap="round"/>`);
    },
    tower() { // タワーきょじん（ボス）
      let lat = '';
      for (let i = 0; i < 8; i++) { const y = 130 + i * 30, w = 20 + i * 14; lat += `<path d="M${200 - w} ${y} L${200 + w + 14} ${y + 30} M${200 + w} ${y} L${200 - w - 14} ${y + 30}" stroke="${i % 2 ? '#fff' : '#e8463a'}" stroke-width="5"/>`; }
      return wrap('', shadow(150, 380) +
        `<path d="M190 20 L210 20 L215 130 L320 375 L270 375 L200 230 L130 375 L80 375 L185 130 Z" fill="#e8463a" ${S}/>` + lat +
        `<path d="M196 20 L204 20 L204 -10 L196 -10 Z" fill="#fff" ${S3}/>` +
        `<rect x="140" y="110" width="120" height="70" rx="18" fill="#fff" ${S}/>` +
        face(200, 145, 44, 'angry') +
        `<rect x="150" y="250" width="100" height="26" rx="6" fill="#fff" ${S5}/>`);
    },
    // ---------------- ほっかいどう ----------------
    yukidaruma() { // ゆきだるま
      const [g, gd] = rg('#ffffff', '#cfe4f6');
      return wrap(gd, shadow(110) +
        `<circle cx="200" cy="270" r="95" fill="url(#${g})" ${S}/>` +
        `<circle cx="200" cy="140" r="70" fill="url(#${g})" ${S}/>` +
        `<path d="M140 190 C170 205 230 205 262 190 L268 214 C230 228 170 228 134 214 Z" fill="#e2263a" ${S5}/>` +
        `<path d="M240 205 L262 262 L232 262 Z" fill="#e2263a" ${S5}/>` +
        `<path d="M150 85 L250 85 L240 40 L160 40 Z" fill="#5a6478" ${S}/>` +
        `<path d="M100 240 L50 200 M300 240 L350 200" stroke="#7a5230" stroke-width="9" stroke-linecap="round"/>` +
        `<circle cx="200" cy="255" r="8" fill="${OL}"/><circle cx="200" cy="290" r="8" fill="${OL}"/>` +
        face(200, 140, 52, 'angry') + `<path d="M200 150 L238 160 L200 166 Z" fill="#ff8a3c" ${S3}/>`);
    },
    kuma() { // クマ
      const [g, gd] = rg('#b07a4a', '#6e4526');
      return wrap(gd, shadow(130) +
        `<ellipse cx="200" cy="290" rx="110" ry="80" fill="url(#${g})" ${S}/>` +
        `<circle cx="120" cy="105" r="36" fill="#8a5a34" ${S}/><circle cx="280" cy="105" r="36" fill="#8a5a34" ${S}/>` +
        `<circle cx="120" cy="105" r="18" fill="#d9a878"/><circle cx="280" cy="105" r="18" fill="#d9a878"/>` +
        `<circle cx="200" cy="175" r="100" fill="url(#${g})" ${S}/>` +
        `<ellipse cx="200" cy="215" rx="48" ry="36" fill="#e8c49a" ${S5}/>` +
        `<ellipse cx="200" cy="198" rx="16" ry="11" fill="${OL}"/>` +
        face(200, 170, 62, 'angry') +
        `<path d="M110 300 l-20 30 M290 300 l20 30" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>`);
    },
    kani() { // カニ
      const [g, gd] = rg('#ff8a6a', '#c8301e');
      return wrap(gd, shadow(140) +
        `<path d="M100 270 L40 320 M110 290 L60 345 M300 270 L360 320 M290 290 L340 345" stroke="${OL}" stroke-width="14" stroke-linecap="round"/>` +
        `<path d="M100 270 L40 320 M110 290 L60 345 M300 270 L360 320 M290 290 L340 345" stroke="#e8463a" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="M120 200 L70 130 M280 200 L330 130" stroke="${OL}" stroke-width="16" stroke-linecap="round"/><path d="M120 200 L70 130 M280 200 L330 130" stroke="#e8463a" stroke-width="8" stroke-linecap="round"/>` +
        `<path d="M70 130 C30 120 25 70 55 55 L75 95 L95 60 C115 80 105 120 70 130 Z" fill="url(#${g})" ${S}/>` +
        `<path d="M330 130 C370 120 375 70 345 55 L325 95 L305 60 C285 80 295 120 330 130 Z" fill="url(#${g})" ${S}/>` +
        `<ellipse cx="200" cy="255" rx="120" ry="75" fill="url(#${g})" ${S}/>` +
        `<path d="M170 185 L165 150 M230 185 L235 150" ${S5}/>` +
        `<circle cx="165" cy="145" r="16" fill="#fff" ${S3}/><circle cx="235" cy="145" r="16" fill="#fff" ${S3}/><circle cx="167" cy="148" r="8" fill="${OL}"/><circle cx="233" cy="148" r="8" fill="${OL}"/>` +
        `<path d="M170 280 Q200 262 230 280" ${S5} fill="none"/><path d="M150 130 L180 140 M250 130 L220 140" ${S5}/>`);
    },
    shirokuma1() { return shirokuma(false); },
    shirokuma2() { return shirokuma(true); }
  };
  function daruma(both) { // だるま だいおう（ボス）。りょうめが はいると おこる
    const [g, gd] = rg('#ff5a4a', '#b81e1e', .4, .3, .85);
    const eye = (x, filled) => `<circle cx="${x}" cy="175" r="30" fill="#fff" ${S5}/>` + (filled ? `<circle cx="${x}" cy="178" r="20" fill="${OL}"/><circle cx="${x - 6}" cy="170" r="6" fill="#fff"/>` : '');
    return wrap(gd, shadow(150) +
      `<path d="M200 40 C310 40 345 150 340 230 C335 330 290 365 200 365 C110 365 65 330 60 230 C55 150 90 40 200 40 Z" fill="url(#${g})" ${S}/>` +
      `<path d="M200 95 C275 95 300 150 295 200 C290 265 255 285 200 285 C145 285 110 265 105 200 C100 150 125 95 200 95 Z" fill="#fff4e6" ${S}/>` +
      `<path d="M120 140 C140 115 170 118 182 138 M218 138 C230 118 260 115 280 140" stroke="${OL}" stroke-width="13" fill="none" stroke-linecap="round"/>` +
      eye(160, true) + eye(240, both) +
      `<path d="M140 238 C165 222 185 236 200 228 C215 236 235 222 260 238 C240 255 220 245 200 252 C180 245 160 255 140 238 Z" fill="${OL}"/>` +
      `<path d="M182 262 Q200 ${both ? 252 : 272} 218 262" ${S5} fill="none"/>` +
      `<path d="M120 320 C150 300 250 300 280 320" stroke="#ffd23f" stroke-width="10" fill="none" stroke-linecap="round"/>` +
      `<path d="M90 230 C80 260 85 290 100 310 M310 230 C320 260 315 290 300 310" stroke="#ffd23f" stroke-width="8" fill="none" stroke-linecap="round"/>`);
  }
  function shirokuma(angry) { // しろクマ だいおう（ボス）
    const [g, gd] = rg('#ffffff', '#c8dcef');
    return wrap(gd, shadow(160, 380) +
      `<ellipse cx="200" cy="300" rx="140" ry="85" fill="url(#${g})" ${S}/>` +
      `<circle cx="110" cy="95" r="34" fill="#f2f8ff" ${S}/><circle cx="290" cy="95" r="34" fill="#f2f8ff" ${S}/>` +
      `<circle cx="110" cy="95" r="16" fill="#c8dcef"/><circle cx="290" cy="95" r="16" fill="#c8dcef"/>` +
      `<circle cx="200" cy="175" r="110" fill="url(#${g})" ${S}/>` +
      `<path d="M120 70 L130 30 L160 55 L200 15 L240 55 L270 30 L280 70 Z" fill="#7cd8ff" ${S}/>` +
      `<path d="M95 255 C150 285 250 285 305 255 L310 280 C250 312 150 312 90 280 Z" fill="#2e7de0" ${S5}/>` +
      `<ellipse cx="200" cy="215" rx="48" ry="34" fill="#eef5ff" ${S5}/><ellipse cx="200" cy="200" rx="17" ry="12" fill="${OL}"/>` +
      face(200, 170, 66, angry ? 'angry' : 'smug') +
      (angry ? `<path d="M60 120 l-25 -10 M60 150 l-30 0 M340 120 l25 -10 M340 150 l30 0" stroke="#9fe6ff" stroke-width="6" stroke-linecap="round"/>` : ''));
  }

  // ---------------- はいけい（400x300） ----------------
  const BG = {
    gunma() {
      const [sk, skd] = lg('#7fc8ff', '#d8f0ff'), [f, fd] = lg('#7fcf5a', '#3f8f3a');
      return wrapBg(skd + fd,
        `<rect width="400" height="300" fill="url(#${sk})"/>` +
        `<path d="M0 190 L60 120 L90 150 L140 90 L190 160 L240 110 L300 170 L350 120 L400 160 L400 300 L0 300 Z" fill="#8a9ab8"/>` +
        `<path d="M0 210 C80 170 150 180 220 200 C290 220 340 190 400 200 L400 300 L0 300 Z" fill="url(#${f})"/>` +
        `<path d="M50 260 q10 -25 0 -45 M70 262 q10 -25 0 -45" stroke="#fff" stroke-width="6" fill="none" opacity=".6" stroke-linecap="round"/>` +
        `<ellipse cx="60" cy="270" rx="40" ry="12" fill="#9fdcff"/>` +
        `<ellipse cx="300" cy="60" rx="50" ry="14" fill="#fff" opacity=".9"/><ellipse cx="120" cy="45" rx="36" ry="11" fill="#fff" opacity=".8"/>`);
    },
    yokohama() {
      const [sk, skd] = lg('#ff9a6a', '#ffd6a0'), [sea, sead] = lg('#2a6fc4', '#0f3a7a');
      let b = '';
      for (let i = 0; i < 12; i++) b += `<rect x="${10 + i * 33}" y="${150 - (i * 37 % 60)}" width="26" height="${40 + (i * 37 % 60)}" fill="#3a3a6a"/>`;
      return wrapBg(skd + sead,
        `<rect width="400" height="300" fill="url(#${sk})"/><circle cx="320" cy="110" r="34" fill="#fff2b0"/>` + b +
        `<circle cx="90" cy="120" r="55" fill="none" stroke="#3a3a6a" stroke-width="6"/><line x1="90" y1="120" x2="70" y2="190" stroke="#3a3a6a" stroke-width="6"/><line x1="90" y1="120" x2="110" y2="190" stroke="#3a3a6a" stroke-width="6"/>` +
        `<rect y="190" width="400" height="110" fill="url(#${sea})"/>` +
        `<path d="M0 220 q20 -10 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#fff" stroke-width="4" fill="none" opacity=".5"/>` +
        `<path d="M260 205 L360 205 L350 222 L270 222 Z" fill="#fff"/><rect x="290" y="190" width="40" height="15" fill="#fff"/>`);
    },
    chiba() {
      const [sk, skd] = lg('#8fd4ff', '#e6f6ff');
      let fl = '';
      for (let i = 0; i < 70; i++) fl += `<circle cx="${(i * 61) % 400}" cy="${210 + (i * 23) % 90}" r="${4 + i % 4}" fill="#ffe02a"/>`;
      return wrapBg(skd,
        `<rect width="400" height="300" fill="url(#${sk})"/>` +
        `<path d="M250 60 L330 50 L345 40 L350 55 L330 62 L300 70 L310 90 L295 90 L280 68 L255 70 Z" fill="#fff" stroke="#5a6478" stroke-width="2"/>` +
        `<path d="M0 200 C100 185 300 185 400 200 L400 300 L0 300 Z" fill="#6fcf4b"/>` + fl +
        `<ellipse cx="90" cy="70" rx="40" ry="12" fill="#fff" opacity=".9"/>`);
    },
    tokyo() {
      const [sk, skd] = lg('#1a1f4a', '#4a3a7a');
      let b = '', w = '';
      for (let i = 0; i < 14; i++) { const h = 70 + (i * 53 % 120), x = i * 29; b += `<rect x="${x}" y="${300 - h - 40}" width="26" height="${h}" fill="#2a2f5a"/>`; for (let k = 0; k < h / 14 - 1; k++) if ((i + k) % 3) w += `<rect x="${x + 6}" y="${300 - h - 30 + k * 14}" width="5" height="6" fill="#ffe7a0"/><rect x="${x + 15}" y="${300 - h - 30 + k * 14}" width="5" height="6" fill="#ffe7a0" opacity=".7"/>`; }
      let st = '';
      for (let i = 0; i < 30; i++) st += `<circle cx="${(i * 97) % 400}" cy="${(i * 41) % 110}" r="1.5" fill="#fff"/>`;
      return wrapBg(skd,
        `<rect width="400" height="300" fill="url(#${sk})"/>` + st +
        `<path d="M300 40 L306 40 L330 260 L276 260 Z" fill="#e8463a"/>` + b + w +
        `<rect y="260" width="400" height="40" fill="#1a1f3a"/>`);
    },
    hokkaido() {
      const [sk, skd] = lg('#0f2a5a', '#5a8ac4');
      let sn = '';
      for (let i = 0; i < 60; i++) sn += `<circle cx="${(i * 67) % 400}" cy="${(i * 29) % 300}" r="${1.5 + i % 3}" fill="#fff" opacity=".85"/>`;
      return wrapBg(skd,
        `<rect width="400" height="300" fill="url(#${sk})"/>` +
        `<path d="M0 80 C80 40 160 110 240 60 C300 25 360 70 400 50" stroke="#7affc0" stroke-width="18" fill="none" opacity=".35"/>` +
        `<path d="M0 100 C90 60 170 130 250 80 C310 45 370 90 400 70" stroke="#c38aff" stroke-width="10" fill="none" opacity=".3"/>` +
        `<path d="M0 200 L70 140 L130 190 L200 120 L270 185 L340 135 L400 175 L400 300 L0 300 Z" fill="#dfeaf6"/>` +
        `<path d="M0 230 C100 210 300 215 400 230 L400 300 L0 300 Z" fill="#fff"/>` + sn);
    }
  };

  window.RegionArt = {
    draw: (id) => ART[id] ? ART[id]() : null,
    bg: (id) => BG[id] ? BG[id]() : null,
    ids: Object.keys(ART), bgs: Object.keys(BG)
  };
})();
