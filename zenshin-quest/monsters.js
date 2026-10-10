// ドナルゴクエスト モンスター画(すべてオリジナルデザインの SVG)
// assets/img/<id>.png を置くと、その画像が優先して使われる(game.js 側で差し替え)
(function () {
  'use strict';
  const OL = '#1b1230';
  let U = 0;
  const S = `stroke="${OL}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`;
  const S5 = `stroke="${OL}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
  const S3 = `stroke="${OL}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
  const lg = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const rg = (id, a, b, cx = .35, cy = .3, r = .9) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  const mirror = (s) => `<g transform="translate(400,0) scale(-1,1)">${s}</g>`;
  const both = (s) => s + mirror(s);
  const shadow = (rx = 130, y = 372) => `<ellipse cx="200" cy="${y}" rx="${rx}" ry="${rx * 0.12}" fill="#000" opacity=".32"/>`;
  const wrap = (inner, cls = '') => `<svg class="mon-svg ${cls}" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" overflow="visible">${inner}</svg>`;

  // ---------------------------------------------------------------- カワチー(さいしょの相手。ちいさくて まるい)
  function kawachi() {
    const p = 'kw' + (U++);
    const body = 'M84 286 C84 196 136 150 200 150 C264 150 316 196 316 286 C316 342 268 366 200 366 C132 366 84 342 84 286 Z';
    const spark = (x, y, s) => `<path class="flicker" d="M${x} ${y - 13 * s} Q${x + 2 * s} ${y - 2 * s} ${x + 13 * s} ${y} Q${x + 2 * s} ${y + 2 * s} ${x} ${y + 13 * s} Q${x - 2 * s} ${y + 2 * s} ${x - 13 * s} ${y} Q${x - 2 * s} ${y - 2 * s} ${x} ${y - 13 * s} Z" fill="#fff6b0" ${S3}/>`;
    return wrap(`<defs>${rg(p + 'b', '#ffffff', '#ffe3cf', .4, .3, .9)}${rg(p + 'e', '#ffd9e2', '#ff9db5', .4, .35, .8)}${lg(p + 'r', '#ff8fb1', '#e8436e')}</defs>
      ${shadow(104, 368)}
      <g class="part-body">
      ${both(`<circle cx="132" cy="170" r="34" fill="url(#${p}b)" ${S}/><circle cx="134" cy="174" r="17" fill="url(#${p}e)"/>`)}
      <path d="M200 362 C232 372 258 366 262 352" fill="none" ${S}/>
      ${both(`<ellipse cx="164" cy="362" rx="27" ry="13" fill="url(#${p}b)" ${S}/>`)}
      <path d="${body}" fill="url(#${p}b)" ${S}/>
      <path d="M100 300 C120 344 280 344 300 300 C296 340 258 358 200 358 C142 358 104 340 100 300 Z" fill="#ffc9ad" opacity=".5"/>
      <ellipse cx="150" cy="190" rx="34" ry="15" transform="rotate(-28 150 190)" fill="#fff" opacity=".9"/>
      ${both(`<ellipse cx="96" cy="292" rx="17" ry="24" transform="rotate(24 96 292)" fill="url(#${p}b)" ${S}/>`)}
      ${both(`<ellipse cx="160" cy="258" rx="12" ry="15" fill="${OL}"/><circle cx="155" cy="251" r="5.5" fill="#fff"/><circle cx="164" cy="264" r="2.5" fill="#fff" opacity=".9"/>`)}
      ${both(`<ellipse cx="128" cy="286" rx="19" ry="11" fill="#ff9db5" opacity=".75"/>`)}
      <path d="M186 276 Q193 288 200 277 Q207 288 214 276" fill="none" ${S5}/>
      <g transform="rotate(-18 262 150)">
        <path d="M262 150 C238 128 226 136 228 152 C226 168 240 174 262 152 Z" fill="url(#${p}r)" ${S5}/>
        <path d="M262 150 C286 128 298 136 296 152 C298 168 284 174 262 152 Z" fill="url(#${p}r)" ${S5}/>
        <circle cx="262" cy="151" r="9" fill="#ffd0dc" ${S3}/>
      </g>
      ${spark(72, 196, 1)}${spark(334, 232, .8)}${spark(318, 120, .6)}
      </g>`);
  }

  // ---------------------------------------------------------------- プルリン
  function pururin() {
    const p = 'pu' + (U++);
    const body = 'M70 298 C70 180 128 108 200 108 C272 108 330 180 330 298 Q332 334 302 322 Q282 348 256 326 Q230 352 200 328 Q170 352 144 326 Q118 348 98 322 Q68 334 70 298 Z';
    return wrap(`<defs>${rg(p + 'b', '#b9fff2', '#1fa9c4', .38, .28, .85)}${rg(p + 'c', '#ffb3c4', '#e8436e', .4, .35, .8)}<clipPath id="${p}cp"><path d="${body}"/></clipPath></defs>
      ${shadow(140, 350)}
      <g class="part-body">
      <path d="M200 112 C196 92 204 78 196 62" fill="none" ${S5} stroke="#2b7a3a"/>
      <path d="M196 64 C170 40 140 52 138 70 C160 82 184 78 196 64 Z" fill="#7be07a" ${S5}/>
      <path d="M197 62 C214 30 248 34 256 52 C240 70 214 72 197 62 Z" fill="#a4f08a" ${S5}/>
      <path d="${body}" fill="url(#${p}b)" ${S}/>
      <g clip-path="url(#${p}cp)">
        <path d="M60 270 C120 320 280 320 340 262 L340 360 L60 360 Z" fill="#0f7fa3" opacity=".42"/>
        <path d="M200 312 C176 296 168 276 182 268 C192 263 199 270 200 276 C201 270 208 263 218 268 C232 276 224 296 200 312 Z" fill="url(#${p}c)" opacity=".75"/>
        <ellipse cx="189" cy="275" rx="6" ry="4" fill="#fff" opacity=".6"/>
        <circle cx="282" cy="220" r="9" fill="#fff" opacity=".35"/><circle cx="296" cy="252" r="5" fill="#fff" opacity=".35"/>
        <circle cx="112" cy="262" r="6" fill="#fff" opacity=".3"/><circle cx="266" cy="286" r="4" fill="#fff" opacity=".3"/>
      </g>
      <ellipse cx="136" cy="168" rx="30" ry="15" transform="rotate(-38 136 168)" fill="#fff" opacity=".8"/>
      <circle cx="112" cy="204" r="7" fill="#fff" opacity=".75"/>
      <ellipse cx="160" cy="210" rx="13" ry="19" fill="${OL}"/><ellipse cx="240" cy="210" rx="13" ry="19" fill="${OL}"/>
      <circle cx="155" cy="202" r="5.5" fill="#fff"/><circle cx="235" cy="202" r="5.5" fill="#fff"/>
      <ellipse cx="134" cy="238" rx="15" ry="8" fill="#ff8fb1" opacity=".7"/><ellipse cx="266" cy="238" rx="15" ry="8" fill="#ff8fb1" opacity=".7"/>
      <path d="M183 236 Q191 250 200 237 Q209 250 217 236" fill="none" ${S5}/>
      </g>`);
  }

  // ---------------------------------------------------------------- ドロハンズ
  function dorohands() {
    const p = 'dh' + (U++);
    const finger = (cx, top, rot, w = 40) => `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${215 - top}" rx="${w / 2}" transform="rotate(${rot} ${cx} 210)" fill="url(#${p}m)" ${S}/>
      <path d="M${cx - w / 2 + 9} ${top + 20} q${w / 2 - 9} -12 ${w - 18} 0" transform="rotate(${rot} ${cx} 210)" fill="none" stroke="#e2b684" stroke-width="5" stroke-linecap="round" opacity=".8"/>`;
    return wrap(`<defs>${lg(p + 'm', '#c28a52', '#6a4124')}${rg(p + 'e', '#fff6a8', '#f2b62a', .4, .35, .8)}</defs>
      <ellipse cx="200" cy="352" rx="165" ry="30" fill="#3d2616" ${S}/>
      <ellipse cx="200" cy="346" rx="140" ry="20" fill="#5a3a22"/>
      <ellipse cx="92" cy="330" rx="18" ry="9" fill="#5a3a22" ${S5}/><ellipse cx="318" cy="336" rx="14" ry="7" fill="#5a3a22" ${S5}/>
      <g class="part-body">
      <path d="M130 228 C106 220 92 200 86 178 C80 156 44 160 46 188 C50 232 86 274 132 290 Z" fill="url(#${p}m)" ${S}/>
      <path d="M58 184 q6 -12 16 -6" fill="none" stroke="#e2b684" stroke-width="5" stroke-linecap="round" opacity=".8"/>
      ${finger(138, 78, -11)}${finger(182, 46, -4, 42)}${finger(226, 54, 4, 42)}${finger(268, 92, 12, 38)}
      <path d="M112 196 Q112 150 200 150 Q288 150 288 196 L278 270 Q272 310 242 328 L246 356 L154 356 L158 328 Q128 310 122 270 Z" fill="url(#${p}m)" ${S}/>
      <path d="M150 300 Q200 330 250 300 L244 352 L156 352 Z" fill="#4e2f1a" opacity=".45"/>
      <path d="M150 196 L250 196" stroke="#4e2f1a" stroke-width="6" stroke-linecap="round" opacity=".35"/>
      <path d="M140 212 Q200 176 260 212" fill="none" ${S} />
      <ellipse cx="200" cy="246" rx="44" ry="30" fill="url(#${p}e)" ${S}/>
      <ellipse cx="200" cy="246" rx="10" ry="26" fill="${OL}"/>
      <circle cx="186" cy="234" r="7" fill="#fff" opacity=".9"/>
      <path d="M128 176 q-4 20 4 26 q8 -8 -4 -26Z" fill="#6a4124" ${S3}/>
      <path d="M270 268 q-5 24 4 30 q9 -9 -4 -30Z" fill="#6a4124" ${S3}/>
      <path d="M184 60 q-5 -18 2 -24 q8 8 -2 24Z" fill="#6a4124" ${S3} transform="translate(46 24)"/>
      </g>`);
  }

  // ---------------------------------------------------------------- まおうムーザ
  function muza() {
    const p = 'mz' + (U++);
    const flame = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" class="flicker">
        <path d="M0 40 C-34 20 -16 -14 -4 -44 C4 -18 28 -10 22 14 C34 6 32 30 0 40 Z" fill="url(#${p}f)" ${S5}/>
        <path d="M0 34 C-16 22 -8 4 -2 -14 C4 2 14 8 10 20 C14 20 12 30 0 34 Z" fill="#fff3a0"/></g>`;
    const arm = `<path d="M108 214 C62 210 28 238 22 284 L72 292 C80 268 100 258 122 258 Z" fill="url(#${p}r2)" ${S}/>
        <path d="M22 284 L72 292 L70 302 L20 296 Z" fill="url(#${p}g)" ${S5}/>
        <path d="M18 300 C6 290 2 268 14 258 M38 300 C30 280 34 262 46 254 M60 304 C62 286 70 272 82 268" fill="none" stroke="${OL}" stroke-width="0"/>
        <path d="M14 296 C2 276 8 258 20 250 C22 264 30 270 36 270 C34 256 42 246 52 242 C52 258 60 266 68 268 C70 258 78 252 86 252 C88 272 82 292 72 302 Z" fill="url(#${p}s)" ${S}/>
        ${flame(46, 200, 1.05)}`;
    return wrap(`<defs>${lg(p + 's', '#57c8a6', '#1d6f66')}${lg(p + 'r', '#a23bbd', '#4a136b')}${lg(p + 'r2', '#7c2a96', '#3a0f55')}${lg(p + 'g', '#ffe27a', '#c98318')}
        ${lg(p + 'h', '#fff4d8', '#b3915c')}${rg(p + 'f', '#ffd24a', '#f0541e', .5, .7, .7)}${rg(p + 'j', '#ff9aa8', '#b3122e', .35, .3, .8)}</defs>
      ${shadow(165)}
      <g class="part-body">
      <path d="M70 372 C20 300 40 190 120 150 L280 150 C360 190 380 300 330 372 Z" fill="#2a0c3f" ${S}/>
      ${both(`<path d="M132 128 C76 124 34 78 62 18 C80 62 112 84 158 96 Z" fill="url(#${p}h)" ${S}/><path d="M72 46 C84 70 104 84 128 94" fill="none" stroke="#8d6c3d" stroke-width="4" stroke-linecap="round" opacity=".7"/>`)}
      ${both(arm)}
      <path d="M84 372 C52 300 62 226 122 200 C162 236 238 236 278 200 C338 226 348 300 316 372 Z" fill="url(#${p}r)" ${S}/>
      <path d="M158 372 C148 306 168 252 200 244 C232 252 252 306 242 372 Z" fill="#2a0c3f" ${S5}/>
      <path d="M200 286 l16 22 l-16 22 l-16 -22 Z M200 336 l10 14 l-10 14 l-10 -14 Z" fill="url(#${p}g)" ${S3}/>
      <path d="M104 190 Q200 276 296 190 L290 220 Q200 302 110 220 Z" fill="url(#${p}g)" ${S}/>
      <circle cx="200" cy="268" r="17" fill="url(#${p}j)" ${S5}/><circle cx="194" cy="262" r="5" fill="#fff" opacity=".85"/>
      ${both(`<path d="M114 150 L62 132 L108 192 Z" fill="url(#${p}s)" ${S}/>`)}
      <path d="M106 168 C96 98 148 62 200 62 C252 62 304 98 294 168 C292 216 252 244 200 244 C148 244 108 216 106 168 Z" fill="url(#${p}s)" ${S}/>
      <path d="M118 190 C140 226 176 238 200 238 C224 238 260 226 282 190 C270 232 236 246 200 246 C164 246 130 232 118 190 Z" fill="#12524e" opacity=".5"/>
      <ellipse cx="160" cy="92" rx="26" ry="10" transform="rotate(-18 160 92)" fill="#fff" opacity=".35"/>
      ${both(`<path d="M126 128 L192 152 L190 136 Z" fill="${OL}"/>
        <path d="M136 152 Q164 142 190 164 Q160 182 136 152 Z" fill="#ffe14d" ${S5}/><ellipse cx="168" cy="162" rx="5" ry="8" fill="${OL}"/>
        <path d="M188 182 q4 8 0 12" fill="none" ${S3}/>`)}
      <path d="M134 198 Q200 214 266 198 Q256 236 200 236 Q144 236 134 198 Z" fill="#3a0d1c" ${S}/>
      <path d="M152 204 L160 172 L174 207 Z M248 204 L240 172 L226 207 Z" fill="#fffdf2" ${S5}/>
      <path d="M180 207 l7 12 l7 -11 M206 208 l7 11 l7 -12" fill="#fffdf2" ${S3}/>
      <path d="M176 230 Q200 220 224 230 Q200 240 176 230Z" fill="#e2566f"/>
      </g>`);
  }

  // ---------------------------------------------------------------- デスピエール(3形態)
  const DP = [
    { main: '#3d8bff', lite: '#9fd0ff', dark: '#16306e', glow: '#7fd4ff', orb: 'water' },
    { main: '#bfefff', lite: '#ffffff', dark: '#3a7d9c', glow: '#e6fbff', orb: 'ice' },
    { main: '#ff4a2b', lite: '#ffb347', dark: '#7a0f12', glow: '#ffd24a', orb: 'fire' },
  ];
  function despierre(form) {
    const p = 'dp' + (U++), c = DP[form], big = form === 2;
    const orb = (x, y) => {
      if (c.orb === 'water') return `<g class="flicker"><path d="M${x} ${y - 34} C${x - 30} ${y - 4} ${x - 26} ${y + 24} ${x} ${y + 24} C${x + 26} ${y + 24} ${x + 30} ${y - 4} ${x} ${y - 34} Z" fill="url(#${p}o)" ${S5}/><ellipse cx="${x - 9}" cy="${y + 2}" rx="6" ry="10" fill="#fff" opacity=".7"/></g>`;
      if (c.orb === 'ice') return `<g class="flicker"><path d="M${x} ${y - 36} L${x + 20} ${y - 8} L${x + 12} ${y + 26} L${x - 12} ${y + 26} L${x - 20} ${y - 8} Z" fill="url(#${p}o)" ${S5}/><path d="M${x} ${y - 36} L${x} ${y + 26} M${x - 20} ${y - 8} L${x + 20} ${y - 8}" stroke="#fff" stroke-width="3" opacity=".8"/></g>`;
      return `<g class="flicker"><path d="M${x} ${y + 26} C${x - 34} ${y + 6} ${x - 16} ${y - 22} ${x - 4} ${y - 44} C${x + 4} ${y - 20} ${x + 28} ${y - 12} ${x + 22} ${y + 8} C${x + 34} ${y + 2} ${x + 30} ${y + 20} ${x} ${y + 26} Z" fill="url(#${p}o)" ${S5}/><path d="M${x} ${y + 20} C${x - 14} ${y + 10} ${x - 6} ${y - 4} ${x} ${y - 16} C${x + 6} ${y - 2} ${x + 14} ${y + 6} ${x} ${y + 20}Z" fill="#fff3a0"/></g>`;
    };
    const armUp = `<path d="M158 188 C120 176 92 150 76 118 L98 104 C114 132 138 152 172 164 Z" fill="url(#${p}a)" ${S}/>
      <path d="M70 122 C56 112 54 92 66 82 C70 90 76 94 82 94 C80 82 88 74 98 74 C98 86 104 92 110 96 C112 104 106 112 98 116 Z" fill="#fff" ${S5}/>`;
    const armLow = `<path d="M160 214 C120 226 96 250 84 282 L108 292 C118 266 138 248 170 240 Z" fill="url(#${p}a)" ${S}/>
      <path d="M80 280 C66 286 60 302 68 314 C74 308 80 306 86 308 C82 318 88 328 98 330 C100 320 106 314 112 312 C116 304 114 294 108 290 Z" fill="#fff" ${S5}/>`;
    const eyes = form === 0
      ? both(`<path d="M168 112 Q180 98 192 112 Q180 106 168 112 Z" fill="${OL}" ${S5}/>`)
      : form === 1
        ? `<path d="M168 112 Q180 98 192 112 Q180 106 168 112 Z" fill="${OL}" ${S5}/>
           <path d="M204 96 L226 86 L236 104 L224 122 L206 118 Z" fill="#160a22" ${S5}/><circle cx="220" cy="106" r="8" fill="#ff3b3b"/><circle cx="220" cy="106" r="3" fill="#fff"/>
           <path d="M226 86 L236 66 M236 104 L252 100 M224 122 L232 140" fill="none" ${S3}/>`
        : both(`<path d="M164 96 L194 110 L190 122 L166 114 Z" fill="#160a22" ${S5}/><circle cx="180" cy="112" r="6" fill="${c.glow}"/>`);
    const mouth = form === 2
      ? `<path d="M170 138 L180 146 L190 138 L200 146 L210 138 L220 146 L230 138 Q200 172 170 138 Z" fill="#160a22" ${S5}/>`
      : `<path d="M174 136 Q200 158 226 136 Q200 148 174 136 Z" fill="#b3122e" ${S5}/>`;
    const hat = (side) => {
      const s = `<path d="M166 84 C140 40 96 26 58 52 C92 56 118 76 144 112 Z" fill="${form === 2 ? 'url(#' + p + 'h)' : 'url(#' + p + 'm)'}" ${S}/>` +
        (form === 2 ? '' : `<circle cx="56" cy="54" r="13" fill="url(#${p}g)" ${S5}/><path d="M50 58 h12" stroke="${OL}" stroke-width="3"/>`);
      return side ? mirror(s) : s;
    };
    const aura = big ? `<path class="flicker" d="M200 10 C220 60 260 40 262 86 C300 60 330 90 316 130 C356 126 372 170 344 196 C378 214 372 262 338 270 C354 304 330 340 300 334 L100 334 C70 340 46 304 62 270 C28 262 22 214 56 196 C28 170 44 126 84 130 C70 90 100 60 138 86 C140 40 180 60 200 10 Z" fill="url(#${p}u)" opacity=".6"/>` : '';
    return wrap(`<defs>${lg(p + 'm', c.main, c.dark)}${lg(p + 'a', c.lite, c.main)}${lg(p + 'g', '#ffe27a', '#c98318')}${lg(p + 'h', '#fff4d8', '#b3915c')}
        ${rg(p + 'o', '#ffffff', c.orb === 'fire' ? '#ff5a1f' : c.main, .4, .35, .9)}${lg(p + 'k', '#ffffff', '#cfd6e6')}${rg(p + 'u', '#ffd24a', '#e8281a', .5, .7, .75)}
        <clipPath id="${p}cp"><path d="M160 172 L240 172 L256 300 L218 366 L182 366 L144 300 Z"/></clipPath></defs>
      ${shadow(big ? 150 : 110)}
      <g class="part-body" ${big ? 'transform="translate(200 372) scale(1.1) translate(-200 -372)"' : ''}>
      ${aura}
      <path d="M200 120 C116 142 72 264 86 366 L314 366 C328 264 284 142 200 120 Z" fill="#15142e" ${S}/>
      <path d="M200 150 C140 170 112 270 118 366 L282 366 C288 270 260 170 200 150 Z" fill="${c.dark}" opacity=".9"/>
      ${both(armUp)}${form > 0 ? both(armLow) : ''}
      <path d="M160 172 L240 172 L256 300 L218 366 L182 366 L144 300 Z" fill="#17142c" ${S}/>
      <g clip-path="url(#${p}cp)">
        <path d="M200 160 L260 160 L260 370 L200 370 Z" fill="url(#${p}m)"/>
        <path d="M200 196 l22 30 l-22 30 l-22 -30 Z M200 262 l22 30 l-22 30 l-22 -30 Z M156 232 l20 28 l-20 28 l-20 -28 Z M244 232 l20 28 l-20 28 l-20 -28 Z" fill="url(#${p}g)" opacity=".92"/>
        ${big ? `<g><path d="M162 210 Q200 196 238 210 L232 262 Q200 286 168 262 Z" fill="#fff" ${S5}/><path d="M174 226 l14 8 l-14 6 Z M226 226 l-14 8 l14 6 Z" fill="${OL}"/><path d="M178 254 l8 6 l8 -6 l6 6 l6 -6 l8 6 l8 -6" fill="none" ${S3}/></g>` : ''}
      </g>
      <path d="M160 172 L240 172 L256 300 L218 366 L182 366 L144 300 Z" fill="none" ${S}/>
      ${[-44, -26, -8, 10, 28, 46].map((dx, i) => `<circle cx="${200 + dx + 0}" cy="${172 + Math.abs(dx) * 0.12}" r="15" fill="url(#${p}k)" ${S5}/>`).join('')}
      ${hat(0)}${hat(1)}
      <path d="M156 110 C156 74 176 56 200 56 C224 56 244 74 244 110 C244 146 224 168 200 168 C176 168 156 146 156 110 Z" fill="url(#${p}k)" ${S}/>
      <path d="M160 92 C170 66 190 60 204 60" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
      ${eyes}
      <path d="M176 120 q-6 12 0 18 q6 -6 0 -18 Z" fill="${c.main}" ${S3}/>
      <path d="M222 124 l8 10 l-8 10 l-8 -10 Z" fill="${c.main}" ${S3}/>
      ${mouth}
      ${form === 1 ? `<path d="M200 56 L206 78 L198 92 L210 108" fill="none" ${S3}/>` : ''}
      ${orb(88, form === 2 ? 50 : 54)}${form === 2 ? mirror(orb(88, 50)) : ''}
      </g>`);
  }

  // ---------------------------------------------------------------- だいまおうミルガドス 第1形態
  function milgados1() {
    const p = 'm1' + (U++);
    return wrap(`<defs>${lg(p + 'r', '#3a3f9e', '#12143f')}${lg(p + 'r2', '#2a2d78', '#0c0e2c')}${lg(p + 'g', '#ffe27a', '#c98318')}${lg(p + 's', '#cdb8e6', '#7c62a8')}
        ${rg(p + 'o', '#fffbe0', '#ff4fd0', .4, .35, .9)}${rg(p + 'j', '#ff9aa8', '#b3122e', .35, .3, .8)}${lg(p + 'b', '#ffffff', '#b9c2d6')}</defs>
      ${shadow(130)}
      <g class="part-body">
      <path d="M200 40 C110 60 86 140 104 196 L296 196 C314 140 290 60 200 40 Z" fill="#7a0f1e" ${S}/>
      <path d="M200 62 C132 78 116 140 126 190 L274 190 C284 140 268 78 200 62 Z" fill="#b3122e"/>
      <path d="M118 372 C108 290 136 206 168 168 L232 168 C264 206 292 290 282 372 Z" fill="url(#${p}r)" ${S}/>
      <path d="M118 372 C116 358 116 346 118 334 L282 334 C284 346 284 358 282 372 Z" fill="url(#${p}g)" ${S5}/>
      <path d="M186 180 L214 180 L226 334 L174 334 Z" fill="url(#${p}r2)" ${S5}/>
      <path d="M200 216 l10 14 l-10 14 l-10 -14 Z M200 262 l10 14 l-10 14 l-10 -14 Z" fill="url(#${p}g)" ${S3}/>
      <path d="M160 190 C116 196 84 232 78 300 C92 316 112 318 128 306 C128 268 142 240 168 226 Z" fill="url(#${p}r)" ${S}/>
      <path d="M78 300 C92 316 112 318 128 306 L126 290 C112 300 96 298 82 284 Z" fill="url(#${p}g)" ${S5}/>
      <path d="M240 190 C286 176 318 148 330 110 L352 124 C340 168 308 206 250 226 Z" fill="url(#${p}r)" ${S}/>
      <path d="M326 108 L354 126 L362 112 L334 94 Z" fill="url(#${p}g)" ${S5}/>
      <path d="M332 100 C324 82 330 64 346 60 C346 72 352 78 358 80 C364 72 374 72 380 80 C376 96 368 110 356 116 Z" fill="url(#${p}s)" ${S5}/>
      <g class="flicker"><circle cx="352" cy="34" r="26" fill="url(#${p}o)" ${S5}/><ellipse cx="352" cy="34" rx="6" ry="15" fill="${OL}"/><circle cx="343" cy="25" r="5" fill="#fff"/></g>
      <path d="M156 70 L160 22 L180 50 L200 8 L220 50 L240 22 L244 70 Z" fill="url(#${p}g)" ${S}/>
      <circle cx="200" cy="48" r="9" fill="url(#${p}j)" ${S3}/>
      ${both(`<path d="M160 110 L122 96 L158 138 Z" fill="url(#${p}s)" ${S5}/>`)}
      <path d="M156 100 C156 76 176 66 200 66 C224 66 244 76 244 100 C244 132 226 158 200 162 C174 158 156 132 156 100 Z" fill="url(#${p}s)" ${S}/>
      ${both(`<path d="M162 96 L192 106 L190 98 Z" fill="${OL}"/><path d="M166 108 Q180 102 192 114 Q178 120 166 108 Z" fill="#ff3b3b" ${S3}/><circle cx="181" cy="111" r="2.5" fill="#fff"/>`)}
      <path d="M200 108 L192 134 L208 134 Z" fill="#9a80c2" ${S3}/>
      <path d="M170 136 C150 180 164 230 200 262 C236 230 250 180 230 136 C218 150 182 150 170 136 Z" fill="url(#${p}b)" ${S}/>
      <path d="M184 160 Q200 200 196 244 M216 160 Q204 200 206 244" fill="none" stroke="#9aa3ba" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M186 146 Q200 154 214 146" fill="none" ${S3}/>
      </g>`);
  }

  // ---------------------------------------------------------------- だいまおうミルガドス 第2形態
  function milgados2() {
    const p = 'm2' + (U++);
    const wing = `<path d="M150 150 C100 80 50 40 4 30 C22 70 20 100 34 126 C16 124 6 132 0 146 C24 158 30 182 44 200 C28 204 22 214 20 228 C60 226 110 230 150 216 Z" fill="url(#${p}w)" ${S}/>
      <path d="M150 150 C110 110 60 70 4 30 M150 176 C100 156 50 146 0 146 M150 200 C100 206 60 216 20 228" fill="none" stroke="${OL}" stroke-width="4" stroke-linecap="round" opacity=".7"/>`;
    const armUp = `<path d="M132 176 C92 160 62 132 50 96 L82 82 C94 116 116 136 150 148 Z" fill="url(#${p}s)" ${S}/>
      <path d="M42 100 C22 90 14 64 28 46 C34 58 42 64 50 64 C46 46 56 32 70 28 C72 46 80 56 88 60 C92 50 100 44 108 44 C112 66 104 86 88 96 Z" fill="url(#${p}s)" ${S}/>
      <path d="M18 50 L20 22 L38 44 Z M60 30 L68 4 L80 30 Z M100 44 L116 22 L114 50 Z" fill="#fff4d8" ${S3}/>`;
    const armLow = `<path d="M126 232 C86 238 58 260 46 296 L78 306 C88 280 108 266 140 262 Z" fill="url(#${p}s)" ${S}/>
      <path d="M40 292 C22 300 16 322 28 338 C34 328 42 324 50 326 C46 340 54 352 68 354 C70 340 78 332 86 330 C92 320 88 308 80 302 Z" fill="url(#${p}s)" ${S}/>`;
    return wrap(`<defs>${lg(p + 's', '#f0564a', '#7d1220')}${lg(p + 'w', '#6a2a8c', '#200a38')}${lg(p + 'p', '#fff1c9', '#d9a657')}${lg(p + 'h', '#fff4d8', '#b3915c')}${lg(p + 'g', '#ffe27a', '#c98318')}</defs>
      ${shadow(175)}
      <g class="part-body">
      <g class="wing">${both(wing)}</g>
      <path d="M270 330 C330 340 372 316 384 276 C360 296 330 300 296 288 Z" fill="url(#${p}s)" ${S}/>
      ${both(armUp)}${both(armLow)}
      <path d="M96 372 C60 300 76 200 140 156 L260 156 C324 200 340 300 304 372 Z" fill="url(#${p}s)" ${S}/>
      <path d="M140 372 C120 310 136 230 200 206 C264 230 280 310 260 372 Z" fill="url(#${p}p)" ${S}/>
      <path d="M138 262 Q200 286 262 262 M130 302 Q200 328 270 302 M134 340 Q200 366 266 340" fill="none" stroke="#a8742c" stroke-width="5" stroke-linecap="round"/>
      ${both(`<path d="M150 90 C120 70 96 40 104 6 C122 34 146 50 176 60 Z" fill="url(#${p}h)" ${S}/>`)}
      ${both(`<path d="M168 60 C160 40 164 22 176 10 C182 28 190 40 200 48 Z" fill="url(#${p}h)" ${S}/>`)}
      <path d="M124 130 C116 78 156 48 200 48 C244 48 284 78 276 130 C290 150 280 186 256 196 L200 214 L144 196 C120 186 110 150 124 130 Z" fill="url(#${p}s)" ${S}/>
      <ellipse cx="164" cy="74" rx="24" ry="9" transform="rotate(-20 164 74)" fill="#fff" opacity=".3"/>
      ${both(`<path d="M134 96 L192 116 L190 102 Z" fill="${OL}"/><path d="M142 114 Q166 104 190 124 Q164 138 142 114 Z" fill="#ffe14d" ${S5}/><ellipse cx="170" cy="121" rx="4.5" ry="8" fill="${OL}"/>`)}
      <path d="M140 150 Q200 170 260 150 L250 196 Q200 222 150 196 Z" fill="#2a0612" ${S}/>
      <path d="M146 154 L158 180 L170 158 L182 184 L194 162 L200 186 L206 162 L218 184 L230 158 L242 180 L254 154" fill="#fffdf2" ${S5}/>
      <path d="M160 200 L170 180 L182 204 L194 184 L200 206 L206 184 L218 204 L230 180 L240 200" fill="#fffdf2" ${S3}/>
      <path d="M186 132 q-4 8 2 12 M214 132 q4 8 -2 12" fill="none" ${S3}/>
      </g>`);
  }

  // ---------------------------------------------------------------- ていおうエスタロス
  function estalos(awake) {
    const p = 'es' + (U++);
    const blade = `<path d="M96 250 C60 280 30 330 26 388 C60 372 96 336 124 288 Z" fill="url(#${p}b)" ${S}/>
      <path d="M40 372 C62 340 86 308 112 276" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
      <path d="M84 236 L138 280 L126 296 L72 252 Z" fill="url(#${p}g)" ${S5}/>`;
    const arm = `<path d="M110 168 C66 176 46 214 60 254 L116 268 C108 242 116 222 140 212 Z" fill="url(#${p}s)" ${S}/>
      <path d="M62 250 C56 266 62 284 78 292 L118 298 C128 286 126 270 116 262 Z" fill="url(#${p}s)" ${S}/>${blade}`;
    const pauldron = `<path d="M150 150 C110 120 62 130 44 172 C80 170 108 180 132 204 Z" fill="url(#${p}a)" ${S}/>
      <path d="M60 150 L34 112 L84 136 Z M96 132 L86 88 L122 128 Z" fill="url(#${p}h)" ${S5}/>`;
    const eye = awake
      ? both(`<path d="M150 108 L190 122 L186 136 L154 128 Z" fill="#fff36b" ${S5}/><circle cx="172" cy="124" r="5" fill="#ff2a2a"/>`)
      : both(`<path d="M152 124 Q170 134 188 126" fill="none" ${S5}/>`);
    const third = awake
      ? `<path d="M186 82 Q200 62 214 82 Q200 100 186 82 Z" fill="#ffe14d" ${S5}/><ellipse cx="200" cy="82" rx="4" ry="9" fill="#ff2a2a"/>`
      : `<path d="M186 82 Q200 92 214 82" fill="none" ${S5}/>`;
    const aura = awake ? `<path class="flicker" d="M200 -20 C226 40 274 14 280 70 C330 44 372 84 352 136 C398 140 408 204 368 232 C404 268 384 330 334 330 L66 330 C16 330 -4 268 32 232 C-8 204 2 140 48 136 C28 84 70 44 120 70 C126 14 174 40 200 -20 Z" fill="url(#${p}au)" opacity=".7"/>` : '';
    const zzz = awake ? '' : `<g class="zzz" fill="#dfe8ff" stroke="${OL}" stroke-width="3" font-family="sans-serif" font-weight="900"><text x="318" y="108" font-size="36">Z</text><text x="350" y="74" font-size="28">z</text><text x="374" y="48" font-size="20">z</text></g>`;
    return wrap(`<defs>${lg(p + 's', awake ? '#7f95d6' : '#6a7aa6', awake ? '#27306a' : '#2a3350')}${lg(p + 'a', '#e9e3d0', '#8d8468')}${lg(p + 'h', '#fff4d8', '#b3915c')}
        ${lg(p + 'g', '#ffe27a', '#c98318')}${lg(p + 'b', awake ? '#ffd0d0' : '#e6ecf7', awake ? '#d43b3b' : '#7e8aa6')}${rg(p + 'au', '#ff3b3b', '#5a0010', .5, .6, .7)}
        ${rg(p + 'j', '#ff9aa8', '#b3122e', .35, .3, .8)}</defs>
      ${shadow(180)}
      <g class="part-body">
      ${aura}
      ${both(arm)}
      <path d="M112 380 C92 310 104 220 150 176 L250 176 C296 220 308 310 288 380 Z" fill="url(#${p}s)" ${S}/>
      <path d="M150 200 L250 200 L262 262 L200 300 L138 262 Z" fill="url(#${p}a)" ${S}/>
      <path d="M200 216 l20 26 l-20 26 l-20 -26 Z" fill="url(#${p}j)" ${S5}/>
      <path d="M142 300 Q200 330 258 300 L262 332 Q200 362 138 332 Z" fill="url(#${p}g)" ${S}/>
      <path d="M176 334 L224 334 L214 380 L186 380 Z" fill="#3a1030" ${S5}/>
      ${both(pauldron)}
      <g class="head" ${awake ? '' : 'transform="translate(0 10)"'}>
      ${both(`<path d="M150 96 C96 92 58 44 80 -14 C98 30 130 56 176 68 Z" fill="url(#${p}h)" ${S}/><path d="M92 16 C104 40 124 56 150 66" fill="none" stroke="#8d6c3d" stroke-width="4" stroke-linecap="round" opacity=".7"/>`)}
      <path d="M134 120 C130 76 164 52 200 52 C236 52 270 76 266 120 C266 156 240 184 200 190 C160 184 134 156 134 120 Z" fill="url(#${p}s)" ${S}/>
      <path d="M150 62 L200 40 L250 62 L236 86 L200 72 L164 86 Z" fill="url(#${p}a)" ${S}/>
      ${third}
      ${both(`<path d="M146 100 L192 116 L190 104 Z" fill="${OL}"/>`)}
      ${eye}
      <path d="M194 128 L190 150 L210 150 L206 128" fill="none" ${S3}/>
      <path d="M162 160 Q200 172 238 160 L230 176 Q200 186 170 176 Z" fill="#160a22" ${S5}/>
      <path d="M170 162 L176 176 L184 164 M230 162 L224 176 L216 164" fill="#fffdf2" ${S3}/>
      ${zzz}
      </g>
      </g>`);
  }

  const MAP = {
    kawachi: kawachi, pururin: pururin, dorohands: dorohands, muza: muza,
    despierre1: () => despierre(0), despierre2: () => despierre(1), despierre3: () => despierre(2),
    milgados1: milgados1, milgados2: milgados2,
    estalos_sleep: () => estalos(false), estalos: () => estalos(true),
  };

  // ---------------------------------------------------------------- 背景
  function bg(kind) {
    const p = 'bg' + (U++);
    const W = (inner) => `<svg class="bg-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
    if (kind === 'field') return W(`<defs>${lg(p + 'a', '#4aa3ff', '#d6f3ff')}${lg(p + 'b', '#8be36b', '#2f9a48')}</defs>
      <rect width="400" height="300" fill="url(#${p}a)"/>
      <g fill="#fff" opacity=".9"><ellipse cx="80" cy="60" rx="46" ry="14"/><ellipse cx="110" cy="50" rx="30" ry="14"/><ellipse cx="300" cy="90" rx="52" ry="13"/><ellipse cx="330" cy="80" rx="28" ry="13"/></g>
      <path d="M0 200 L60 130 L110 180 L170 110 L240 185 L300 140 L400 200 L400 300 L0 300 Z" fill="#8fb4d9"/>
      <path d="M170 110 L188 130 L176 132 L164 148 L156 128 Z M60 130 L72 144 L62 148 L50 144 Z" fill="#fff" opacity=".85"/>
      <path d="M0 215 Q100 180 200 212 Q300 184 400 214 L400 300 L0 300 Z" fill="#59c06a"/>
      <path d="M0 240 Q120 214 220 240 Q320 222 400 240 L400 300 L0 300 Z" fill="url(#${p}b)"/>
      <g stroke="#1f7a3a" stroke-width="3" stroke-linecap="round" fill="none"><path d="M40 270 l4 -12 M48 270 l0 -14 M56 270 l-4 -12 M330 262 l4 -12 M338 262 l0 -14 M346 262 l-4 -12 M190 284 l4 -12 M198 284 l0 -14"/></g>`);
    if (kind === 'castle') return W(`<defs>${lg(p + 'a', '#1b0f33', '#3a1a55')}${rg(p + 'f', '#ffd24a', '#ff6a1f00', .5, .5, .5)}</defs>
      <rect width="400" height="300" fill="url(#${p}a)"/>
      <g fill="#120a24">${[30, 130, 270, 370].map(x => `<rect x="${x - 22}" y="0" width="44" height="240"/><rect x="${x - 30}" y="226" width="60" height="16"/><rect x="${x - 30}" y="20" width="60" height="12"/>`).join('')}</g>
      <path d="M160 70 Q200 20 240 70 L240 190 L160 190 Z" fill="#0a0616"/><path d="M168 76 Q200 36 232 76 L232 184 L168 184 Z" fill="#8a5be0" opacity=".8"/>
      <path d="M200 40 L200 184 M168 110 L232 110 M168 150 L232 150" stroke="#0a0616" stroke-width="4"/>
      ${[80, 320].map(x => `<circle cx="${x}" cy="120" r="46" fill="url(#${p}f)"/><path d="M${x} 132 c-14 -8 -8 -22 -2 -34 c4 10 14 14 12 24 c6 -2 4 8 -10 10 Z" fill="#ffd24a"/><rect x="${x - 4}" y="132" width="8" height="26" fill="#6a4a2a"/>`).join('')}
      <path d="M0 240 L400 240 L400 300 L0 300 Z" fill="#241238"/>
      <path d="M150 240 L250 240 L300 300 L100 300 Z" fill="#8c1f2e"/><path d="M162 240 L238 240 L282 300 L118 300 Z" fill="#b3283a"/>`);
    if (kind === 'circus') return W(`<defs>${lg(p + 'a', '#12061f', '#2b0f3f')}${rg(p + 's', '#fff7c400', '#fff7c4', .5, 1, 1)}</defs>
      <rect width="400" height="300" fill="url(#${p}a)"/>
      <g>${Array.from({ length: 10 }, (_, i) => `<path d="M${i * 40} 0 L${i * 40 + 40} 0 L${200 + (i - 4) * 12} 110 L${200 + (i - 5) * 12} 110 Z" fill="${i % 2 ? '#7a1626' : '#d9c9a8'}" opacity=".85"/>`).join('')}</g>
      <path d="M0 0 Q30 120 0 260 L0 0 Z M400 0 Q370 120 400 260 Z" fill="#5a0f1c"/>
      <path d="M0 0 C60 60 60 180 20 262 L0 262 Z M400 0 C340 60 340 180 380 262 L400 262 Z" fill="#8c1f2e"/>
      <path d="M200 0 L290 262 L110 262 Z" fill="#fff7c4" opacity=".16"/>
      <ellipse cx="200" cy="268" rx="190" ry="34" fill="#3a2440"/><ellipse cx="200" cy="266" rx="150" ry="24" fill="#58365c"/>
      <g fill="#ffd24a">${[40, 100, 160, 240, 300, 360].map((x, i) => `<circle cx="${x}" cy="${118 + (i % 2) * 6}" r="4"/>`).join('')}</g>
      <rect x="0" y="262" width="400" height="38" fill="#1a0b26" opacity=".6"/>`);
    if (kind === 'makai') return W(`<defs>${lg(p + 'a', '#070312', '#3a0f4a')}${rg(p + 'n', '#ff4fd0', '#ff4fd000', .5, .5, .5)}</defs>
      <rect width="400" height="300" fill="url(#${p}a)"/>
      <ellipse cx="200" cy="130" rx="190" ry="90" fill="url(#${p}n)" opacity=".5"/>
      <g fill="#fff">${Array.from({ length: 28 }, (_, i) => `<circle cx="${(i * 97) % 400}" cy="${(i * 53) % 190}" r="${1 + (i % 3) * .6}" opacity="${.3 + (i % 4) * .15}"/>`).join('')}</g>
      <path d="M30 150 l40 -16 l30 14 l-12 18 l-44 4 Z M300 110 l36 -10 l28 16 l-20 14 l-36 -4 Z M330 190 l24 -8 l18 10 l-14 10 l-22 -2 Z" fill="#1a0b2c" stroke="#5b2a8c" stroke-width="2"/>
      <path d="M120 0 L132 60 L118 66 L140 130" fill="none" stroke="#c9a6ff" stroke-width="2.5" opacity=".7"/>
      <path d="M0 250 L50 222 L100 244 L160 216 L220 246 L290 220 L350 244 L400 226 L400 300 L0 300 Z" fill="#12061f"/>
      <path d="M0 270 Q200 246 400 270 L400 300 L0 300 Z" fill="#241038"/>`);
    // abyss(エスタロス)
    return W(`<defs>${lg(p + 'a', '#050208', '#2a0508')}${rg(p + 'l', '#ff5a1f', '#ff5a1f00', .5, 1, .9)}</defs>
      <rect width="400" height="300" fill="url(#${p}a)"/>
      <rect width="400" height="300" fill="url(#${p}l)" opacity=".75"/>
      <g fill="#0a0408">${[20, 90, 310, 380].map((x, i) => `<path d="M${x - 26} 0 L${x + 26} 0 L${x + 16} ${150 + i * 10} L${x - 16} ${150 + i * 10} Z"/>`).join('')}
        <path d="M0 0 L400 0 L400 40 Q360 70 330 44 Q300 80 260 46 Q220 76 190 44 Q150 78 110 46 Q70 72 40 44 Q14 60 0 40 Z"/></g>
      <path d="M0 250 Q100 228 200 246 Q300 226 400 250 L400 300 L0 300 Z" fill="#14060a"/>
      <g stroke="#ff8a3a" stroke-width="3" fill="none" opacity=".8"><path d="M60 300 L80 268 L70 256 M300 300 L318 272 L340 262 M190 300 L200 280"/></g>`);
  }

  window.Monsters = { draw: (id) => MAP[id](), ids: Object.keys(MAP), bg };
})();
