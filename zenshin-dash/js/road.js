// 道・縁石・横線・道ぞい（さく・ロープ・ガードレール・旗・万国旗）・距離の看板・ゲート・ゴール
// （第10部、第23部 23.2・23.5、付録J・S・AL・AP）
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CFG } from './config.js';
import { clamp, lerp, noise2, rng, damp } from './util.js';
import { colored, merge, M, V3, Chunks, flutterMat, withAttr, sweep, GlowPoints } from './build.js';
import { runRoadTexture, curbTexture, checkerTexture, distSignTexture, textBannerTexture, gateNumTexture, crackTexture, canvas, texture } from './tex.js';

const K = () => CFG.course;
const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, ...o });

// ================= 道の 面 =================
export function buildRoad(course, L, H, quality) {
  const C = K(), half = C.ROAD_W / 2, R = course.road;
  const root = new THREE.Group(); root.name = 'road';
  const keep = [];
  const s0 = -C.PRE, s1 = L + C.POST, ds = 2, NC = 9;
  const rows = Math.round((s1 - s0) / ds) + 1;
  const pos = new Float32Array(rows * NC * 3), uv = new Float32Array(rows * NC * 2), col = new Float32Array(rows * NC * 3), idx = [];
  for (let j = 0; j < rows; j++) {
    const s = s0 + j * ds, y = H(s) + 0.02;
    for (let i = 0; i < NC; i++) {
      const u = i / (NC - 1), x = -half + u * C.ROAD_W, o = j * NC + i;
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = -s;
      uv[o * 2] = u; uv[o * 2 + 1] = s / 4;
      // 大きな まだら（くり返しを 目立たせない）
      const m = clamp(1 + 0.07 * noise2(x / 6, s / 26, 3) + 0.05 * noise2(x / 2.2, s / 7, 4) + 0.03 * noise2(x / 0.9, s / 2.5, 5), 0.82, 1.12);
      col[o * 3] = col[o * 3 + 1] = col[o * 3 + 2] = m;
    }
  }
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < NC - 1; i++) { const a = j * NC + i, b = a + 1, c = a + NC, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const tex = runRoadTexture(R, course.no); keep.push(tex);
  const look = {
    track: { roughness: 0.92, envMapIntensity: 0.25 }, sand: { roughness: 1, envMapIntensity: 0.2 },
    snow: { roughness: 0.5, envMapIntensity: 0.7 }, asphalt: { roughness: R.wet ? 0.3 : 0.8, metalness: R.wet ? 0.18 : 0, envMapIntensity: R.wet ? 1.3 : 0.4 }
  }[R.kind];
  const roadMat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, ...look });
  const road = new THREE.Mesh(g, roadMat); road.receiveShadow = true; road.name = 'roadSurface';
  root.add(road); keep.push(g, roadMat);

  // ---- 縁石（±4.0〜±4.6） ----
  const curbC = R.kind === 'sand' ? [R.dark, R.dark] : R.curb;
  const ctex = curbTexture(curbC[0], curbC[1]); keep.push(ctex);
  const ch = R.kind === 'sand' ? 0.03 : 0.08;
  for (const side of [-1, 1]) {
    const x0 = side * half, x1 = side * (half + C.CURB);
    const prof = [[x0, 0.0], [x0 + side * 0.06, ch], [x1 - side * 0.08, ch], [x1, -0.32]];
    const n = prof.length, cp = [], cu = [], ci = [];
    for (let j = 0; j < rows; j++) {
      const s = s0 + j * ds, y = H(s) + 0.02;
      prof.forEach(([x, dy], k) => { cp.push(x, y + dy, -s); cu.push(k / (n - 1), s / 2); });
    }
    for (let j = 0; j < rows - 1; j++) for (let k = 0; k < n - 1; k++) {
      const a = j * n + k, b = a + 1, c = a + n, d = c + 1;
      if (side > 0) ci.push(a, b, c, b, d, c); else ci.push(a, c, b, b, c, d);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2)); cg.setIndex(ci);
    cg.computeVertexNormals(); cg.computeBoundingSphere();
    const cm = new THREE.MeshStandardMaterial({ map: ctex, roughness: 0.7, side: THREE.DoubleSide });
    const curb = new THREE.Mesh(cg, cm); curb.receiveShadow = true; curb.castShadow = false;
    root.add(curb); keep.push(cg, cm);
  }

  // ---- 横線（50m ごと）・スタートの 白線・ゴールの チェッカー ----
  const lines = [];
  const lineCol = R.kind === 'sand' ? '#a07a4a' : R.cross;
  for (let s = C.LINE_EVERY; s < L - 5; s += C.LINE_EVERY) {
    const y = H(s) + 0.022;
    if (R.kind === 'sand') lines.push(colored(new THREE.BoxGeometry(C.ROAD_W, 0.04, 0.32).translate(0, y + 0.005, -s), lineCol));
    else lines.push(colored(new THREE.PlaneGeometry(C.ROAD_W, R.kind === 'snow' ? 0.16 : 0.12).rotateX(-Math.PI / 2).translate(0, y + 0.004, -s), lineCol));
  }
  lines.push(colored(new THREE.PlaneGeometry(C.ROAD_W, 0.22).rotateX(-Math.PI / 2).translate(0, H(0) + 0.028, 0.0), '#ffffff'));
  const lm = vmat({ roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, transparent: R.kind !== 'sand', opacity: R.kind === 'sand' ? 1 : 0.85 });
  const lmesh = new THREE.Mesh(merge(lines), lm); lmesh.receiveShadow = true; root.add(lmesh); keep.push(lmesh.geometry, lm);
  const chk = checkerTexture(8); chk.repeat.set(16, 3); keep.push(chk);
  const chkG = new THREE.PlaneGeometry(C.ROAD_W, 1.5).rotateX(-Math.PI / 2).translate(0, H(L) + 0.028, -L - 0.75);
  const chkM = new THREE.MeshStandardMaterial({ map: chk, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const chkMesh = new THREE.Mesh(chkG, chkM); chkMesh.receiveShadow = true; root.add(chkMesh); keep.push(chkG, chkM);

  // ---- 氷（ゆきみち） ----
  for (const z of (course.special && course.special.ice) || []) {
    const a = z.f * L, b = a + z.len, ip = [], iu = [], ic = [], ii = [], n = 5;
    const rws = Math.ceil((b - a) / 2) + 1;
    for (let j = 0; j < rws; j++) {
      const s = lerp(a, b, j / (rws - 1)), y = H(s) + 0.03, ea = Math.min(1, Math.min(s - a, b - s) / 3);
      for (let i = 0; i < n; i++) { const u = i / (n - 1), x = lerp(-3.7, 3.7, u); ip.push(x, y, -s); iu.push(u * 2, s / 6); const e = ea * Math.min(1, Math.min(u, 1 - u) * 6); ic.push(1, 1, 1, 0.92 * e); }
    }
    for (let j = 0; j < rws - 1; j++) for (let i = 0; i < n - 1; i++) { const p = j * n + i, q = p + 1, r = p + n, t = r + 1; ii.push(p, q, r, q, t, r); }
    const ig = new THREE.BufferGeometry();
    ig.setAttribute('position', new THREE.Float32BufferAttribute(ip, 3)); ig.setAttribute('uv', new THREE.Float32BufferAttribute(iu, 2)); ig.setAttribute('color', new THREE.Float32BufferAttribute(ic, 4)); ig.setIndex(ii);
    ig.computeVertexNormals();
    const it = crackTexture(); keep.push(it);
    const im = new THREE.MeshStandardMaterial({ map: it, color: '#e6f6ff', vertexColors: true, transparent: true, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false });
    const ice = new THREE.Mesh(ig, im); ice.receiveShadow = true; ice.renderOrder = 1; root.add(ice); keep.push(ig, im);
  }
  return { root, road, dispose() { keep.forEach(k => k.dispose && k.dispose()); } };
}

// ================= 道ぞい（区画に まとめる） =================
export function buildEdges(course, L, H, ground, quality, glow) {
  const C = K(), root = new THREE.Group(); root.name = 'edges';
  const ch = new Chunks(root), keep = [];
  const sA = -C.PRE + 4, sB = L + C.POST - 4;
  const gy = (x, s) => ground.heightAtS(x, s);
  const E = course.edge, S = course.scenery;
  const em = vmat({ roughness: 0.7 }); keep.push(em);
  const steps = (a, b, step, f) => { for (let s = a; s <= b; s += step) f(s); };
  // 区画ごとに 長い 形を 作る
  const perChunk = (f) => { for (let c0 = Math.floor(sA / C.CHUNK) * C.CHUNK; c0 < sB; c0 += C.CHUNK) { const a = Math.max(sA, c0), b = Math.min(sB, c0 + C.CHUNK); if (b - a > 1) f(a, b); } };

  switch (E.kind) {
    case 'fence': {        // 白い 木の さく（柱 2.5m ごと、横の 板 2本）
      const post = colored(new THREE.BoxGeometry(0.09, 1.05, 0.09).translate(0, 0.5, 0), E.post);
      for (const x of [-5.8, 5.8]) {
        steps(sA, sB, 2.5, s => ch.addInst(s, 'fpost', post, em, M(x, gy(x, s), -s)));
        perChunk((a, b) => { for (const h of [0.45, 0.86]) ch.addGeo(a, 'rail', em, sweep([[x + 0.03, h - 0.05], [x + 0.03, h + 0.05], [x - 0.03, h + 0.05], [x - 0.03, h - 0.05]], a, b + 0.05, null, { ds: 2.5, closed: true, color: E.color, yAt: s => gy(x, s) })); });
      }
      break;
    }
    case 'rope': {         // 左は ロープと 杭、右（海がわ）は 低い 杭だけ
      const pole = colored(new THREE.CylinderGeometry(0.045, 0.055, 0.85, 7).translate(0, 0.42, 0), E.post);
      const stake = colored(new THREE.CylinderGeometry(0.05, 0.06, 0.42, 7).translate(0, 0.2, 0), E.post);
      steps(sA, sB, 4, s => { ch.addInst(s, 'rpole', pole, em, M(-5.8, gy(-5.8, s), -s)); ch.addInst(s, 'rstake', stake, em, M(5.9, gy(5.9, s) - 0.02, -s)); });
      perChunk((a, b) => {
        const pts = [];
        for (let s = Math.ceil(a / 4) * 4; s <= b; s += 0.5) { const t = (s % 4) / 4, sag = Math.sin(Math.PI * t) * 0.09; pts.push(new V3(-5.8, gy(-5.8, s) + 0.78 - sag, -s)); }
        if (pts.length > 2) { const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.018, 5, false); ch.addGeo(a, 'rope', em, colored(tg, E.color), { cast: false }); }
      });
      break;
    }
    case 'guard': {        // ガードレール（歩道の 上）
      const gm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.55 }); keep.push(gm);
      const post = colored(new THREE.BoxGeometry(0.1, 0.8, 0.1).translate(0, 0.4, 0), '#8a93a3');
      for (const side of [-1, 1]) {
        const x = side * 5.9;
        steps(sA, sB, 4, s => ch.addInst(s, 'gpost', post, gm, M(x, gy(x, s), -s)));
        const xi = x - side * 0.06, xo = x - side * 0.12;
        const prof = side < 0
          ? [[xo, 0.52], [xi, 0.6], [xo, 0.68], [xi, 0.77], [xo, 0.86], [xo + 0.02, 0.86], [xi + 0.02, 0.77], [xo + 0.02, 0.68], [xi + 0.02, 0.6], [xo + 0.02, 0.52]]
          : [[xo, 0.52], [xo - 0.02, 0.52], [xi - 0.02, 0.6], [xo - 0.02, 0.68], [xi - 0.02, 0.77], [xo - 0.02, 0.86], [xo, 0.86], [xi, 0.77], [xo, 0.68], [xi, 0.6]];
        perChunk((a, b) => ch.addGeo(a, 'guard', gm, sweep(prof, a, b + 0.05, null, { ds: 4, closed: true, color: E.color, yAt: s => gy(x, s) })));
      }
      // 反射板（光る 点）
      if (glow) steps(sA + 2, sB, 8, s => { for (const side of [-1, 1]) glow.add(new V3(side * 5.84, gy(side * 5.9, s) + 0.7, -s), side < 0 ? '#ff9a3a' : '#ffffff', 0.18); });
      break;
    }
    case 'snowbank': break;   // 雪の 土手は 地形で 作る
  }

  // ---- 旗（両わき）／赤白の 棒（雪） ----
  const F = S.flags;
  if (F && F.kind === 'pole') {
    const stick = new THREE.CylinderGeometry(0.035, 0.035, 1.7, 7, 6).translate(0, 0.85, 0);
    const sg = colored(stick, '#ffffff'); { const p = sg.attributes.position, c = sg.attributes.color, red = new THREE.Color(F.colors[0]); for (let i = 0; i < p.count; i++) if (Math.floor(p.getY(i) / 0.283 + 0.001) % 2 === 0) c.setXYZ(i, red.r, red.g, red.b); }
    let i = 0;
    steps(8, L + C.POST - 10, F.every, s => { for (const side of [-1, 1]) ch.addInst(s, 'stick', sg, em, M(side * F.x, gy(side * F.x, s) + 0.3, -s, 0, 1, 1, (i++ % 3 - 1) * 0.04)); });
  } else if (F) {
    const poleG = colored(new THREE.CylinderGeometry(0.035, 0.04, 3.0, 6).translate(0, 1.5, 0), '#f4f6fa');
    const ballG = colored(new THREE.SphereGeometry(0.06, 8, 6).translate(0, 3.03, 0), '#ffd54a');
    const fm = flutterMat({ vertexColors: true, roughness: 0.8 }, 0.14, 7); keep.push(fm);
    const sides = F.x < 0 ? [-1] : [-1, 1], ax = Math.abs(F.x);
    let i = 0;
    for (let s = 6; s < L + C.POST - 6; s += F.every) for (const side of sides) {
      const x = side * ax, y = gy(x, s), col = F.colors[i++ % F.colors.length];
      ch.addInst(s, 'fpole', poleG, em, M(x, y, -s)); ch.addInst(s, 'fball', ballG, em, M(x, y, -s));
      const cg = colored(new THREE.PlaneGeometry(0.85, 0.52, 8, 2).translate(0.43, 2.68, 0), col);
      withAttr(cg, 'aWave', px => clamp(px / 0.86, 0, 1));
      cg.translate(x, y, -s);
      ch.addGeo(s, 'flag', fm, cg, { cast: true });
    }
  }

  // ---- 万国旗・電球の ひも（道の上を 横切る） ----
  const GA = S.garland;
  if (GA) {
    const pm = em, lights = GA.kind === 'lights';
    const fm = flutterMat({ vertexColors: true, roughness: 0.8 }, 0.07, 6); keep.push(fm);
    const bulbM = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.0, roughness: 0.4 }); keep.push(bulbM);
    const cols = ['#ff5a4a', '#ffd54a', '#3fa9f5', '#56d364', '#ff6fa8', '#ffffff'];
    const bulbCols = ['#ffd27a', '#ff7a9a', '#7ad8ff', '#a8ff7a', '#ffe9a8'];
    for (let s = GA.every * 0.5 + 10; s < L - 20; s += GA.every) {
      const h = GA.h, xL = -7.2, xR = 7.2, yL = gy(xL, s), yR = gy(xR, s);
      for (const [x, y] of [[xL, yL], [xR, yR]]) ch.addGeo(s, 'gpole', pm, colored(new THREE.CylinderGeometry(0.07, 0.09, h + 0.4, 7).translate(x, y + (h + 0.4) / 2, -s), '#e8e2d4'));
      const at = t => { const x = lerp(xL, xR, t); return new V3(x, lerp(yL, yR, t) + h - Math.sin(Math.PI * t) * 0.55, -s); };
      const pts = []; for (let k = 0; k <= 24; k++) pts.push(at(k / 24));
      ch.addGeo(s, 'gline', pm, colored(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.014, 4, false), '#2b2f3a'), { cast: false });
      const N = 20;
      for (let k = 0; k < N; k++) {
        const ta = (k + 0.15) / N, tb = (k + 0.85) / N, A = at(ta), B = at(tb), mid = at((ta + tb) / 2);
        if (lights) {
          const bc = bulbCols[k % bulbCols.length];
          ch.addGeo(s, 'bulb', bulbM, colored(new THREE.SphereGeometry(0.07, 8, 6).translate(mid.x, mid.y - 0.09, mid.z), bc), { cast: false });
          if (glow) glow.add(new V3(mid.x, mid.y - 0.09, mid.z), bc, 0.55);
        } else {
          const tri = new THREE.BufferGeometry();
          tri.setAttribute('position', new THREE.Float32BufferAttribute([A.x, A.y, A.z, mid.x, mid.y - 0.4, mid.z, B.x, B.y, B.z], 3));
          tri.setAttribute('aWave', new THREE.Float32BufferAttribute([0.15, 1, 0.15], 1));
          tri.computeVertexNormals();
          const cg = colored(tri, cols[(k + Math.round(s)) % cols.length]); cg.setAttribute('aWave', tri.attributes.aWave);
          ch.addGeo(s, 'pennant', fm, cg, { cast: false });
        }
      }
    }
    if (lights) bulbM.emissiveIntensity = course.sky.night ? 1.4 : 0.6;
  }

  // ---- 距離の 看板（100m ごと、左がわ） ----
  const signs = [];
  for (let m = C.SIGN_EVERY; L - m >= 30; m += C.SIGN_EVERY) {
    const s = L - m, last = m === 100, x = -6.9, y = gy(x, s), w = last ? 2.2 : 1.6, h = last ? 0.96 : 0.7;
    const tex = distSignTexture(m, last); keep.push(tex);
    const g = new THREE.Group(); g.position.set(x, y, -s); g.rotation.y = 0.28;
    const posts = colored(merge([new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6).translate(-w * 0.38, 1.15, -0.04), new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6).translate(w * 0.38, 1.15, -0.04)]), '#8a93a3');
    const board = new THREE.Mesh(new RoundedBoxGeometry(w + 0.08, h + 0.08, 0.06, 2, 0.02), new THREE.MeshStandardMaterial({ color: last ? '#e8483b' : '#1d2b53', roughness: 0.6 }));
    board.position.y = 2.3 - h / 2; board.castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: course.sky.night ? 0.35 : 0.0 }));
    face.position.set(0, board.position.y, 0.035);
    const pm = new THREE.Mesh(posts, em); pm.castShadow = true;
    g.add(pm, board, face); ch.addObj(s, g); signs.push(g);
    keep.push(board.geometry, board.material, face.geometry, face.material, posts);
  }

  ch.build();
  return { root, chunks: ch, dispose() { ch.dispose(); keep.forEach(k => k.dispose && k.dispose()); } };
}

// ================= スタートの ゲート（10.4.1、J.2、AP.4） =================
export function buildGates(course, H) {
  const C = K(), root = new THREE.Group(); root.name = 'gates';
  const keep = [], y0 = H(0);
  const front = 0.6, back = -1.4, depth = front - back, zc = -(front + back) / 2;
  const frame = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }); keep.push(frame);
  const parts = [];
  for (let k = 0; k <= 6; k++) {
    const x = -3.75 + k * 1.25;
    parts.push(colored(new THREE.BoxGeometry(0.08, 1.8, depth).translate(x, y0 + 0.9 + 0.05, zc), k % 2 ? '#e8ecf5' : '#d8dde8'));
    parts.push(colored(new THREE.BoxGeometry(0.14, 2.1, 0.14).translate(x, y0 + 1.05, -front), '#c8ced8'));
    parts.push(colored(new THREE.BoxGeometry(0.14, 2.1, 0.14).translate(x, y0 + 1.05, -back), '#c8ced8'));
  }
  parts.push(colored(new THREE.BoxGeometry(8.4, 0.28, depth + 0.3).translate(0, y0 + 2.2, zc), course.color));
  parts.push(colored(new THREE.BoxGeometry(8.5, 0.08, depth + 0.4).translate(0, y0 + 2.36, zc), '#ffffff'));
  parts.push(colored(new THREE.BoxGeometry(8.4, 0.12, 0.14).translate(0, y0 + 0.06, -back), '#8a93a3'));
  // 横断幕の 柱
  for (const x of [-4.55, 4.55]) parts.push(colored(new THREE.CylinderGeometry(0.09, 0.1, 3.7, 8).translate(x, y0 + 1.85, zc), '#8a93a3'));
  const fm = new THREE.Mesh(merge(parts), frame); fm.castShadow = true; fm.receiveShadow = true; root.add(fm); keep.push(fm.geometry);
  // 横断幕（両面）
  const btex = textBannerTexture('はしれ！ とべ！ ぜんしんダッシュ！', course.color, 1536, 200); keep.push(btex);
  const bm = new THREE.MeshStandardMaterial({ map: btex, roughness: 0.7, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: btex, emissiveIntensity: course.sky.night ? 0.45 : 0.06 }); keep.push(bm);
  for (const [z, ry] of [[zc + 0.02, 0], [zc - 0.02, Math.PI]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(8.9, 1.16), bm); b.position.set(0, y0 + 3.05, z); b.rotation.y = ry; root.add(b); keep.push(b.geometry); }
  // とびら（12枚）と 番号
  const doors = [];
  const doorM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.1 }); keep.push(doorM);
  const doorG = new RoundedBoxGeometry(0.6, 1.3, 0.05, 2, 0.02); keep.push(doorG);
  const grill = colored(merge([0, 1, 2, 3].map(i => new THREE.BoxGeometry(0.5, 0.04, 0.06).translate(0, 0.25 + i * 0.25, 0))), '#c8ced8');
  const grillM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4 }); keep.push(grill, grillM);
  for (let k = 0; k < 6; k++) {
    const d = C.GATE_D[k];
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(d + side * 0.6, y0 + 0.2, -front - 0.04);
      const door = new THREE.Mesh(doorG, doorM); door.position.set(-side * 0.3, 0.65, 0); door.castShadow = true;
      const gr = new THREE.Mesh(grill, grillM); gr.position.set(-side * 0.3, 0, 0);
      hinge.add(door, gr); root.add(hinge);
      hinge.userData = { side, ang: 0, v: 0, target: 0 };
      doors.push(hinge);
    }
    const nt = gateNumTexture(k + 1, course.color); keep.push(nt);
    const nm = new THREE.MeshStandardMaterial({ map: nt, roughness: 0.6 }); keep.push(nm);
    for (const [z, ry] of [[-front - 0.17, Math.PI], [-back + 0.17, 0]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), nm); p.position.set(d, y0 + 2.2, z); p.rotation.y = ry; root.add(p); keep.push(p.geometry); }
  }
  return {
    root, doors,
    open() { for (const d of doors) { d.userData.target = -d.userData.side * 1.75; d.userData.v = -d.userData.side * 16; } },
    close() { for (const d of doors) { d.userData.target = 0; d.userData.ang = 0; d.userData.v = 0; d.rotation.y = 0; } },
    update(dt) {
      for (const d of doors) {
        const u = d.userData; if (u.target === 0 && u.ang === 0) continue;
        const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
        for (let i = 0; i < n; i++) { u.v += (-(u.ang - u.target) * 160 - u.v * 9) * h; u.ang += u.v * h; }
        if (Math.abs(u.ang) > 1.95) { u.ang = Math.sign(u.ang) * 1.95; u.v *= -0.35; }
        d.rotation.y = u.ang;
      }
    },
    dispose() { keep.forEach(k => k.dispose && k.dispose()); }
  };
}

// ================= ゴール（門・テープ・紙ふぶきの 大砲） =================
class Tape {
  constructor(L, H) {
    this.n = 16; this.p = []; this.v = []; this.y0 = H(L) + 1.12; this.z0 = -L;
    for (let i = 0; i < this.n; i++) { this.p.push(new V3(lerp(-4.4, 4.4, i / (this.n - 1)), this.y0, this.z0)); this.v.push(new V3()); }
    this.rest = 8.8 / (this.n - 1); this.cut = -1; this.t = 0;
    const segs = this.n - 1;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(segs * 4 * 3);
    const uv = new Float32Array(segs * 4 * 2), idx = [];
    for (let i = 0; i < segs; i++) { uv.set([i / 2, 0, i / 2, 1, (i + 1) / 2, 0, (i + 1) / 2, 1], i * 8); const a = i * 4; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); this.geo.setIndex(idx);
    const c = canvas(64, 32), g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#e8483b'; g.fillRect(0, 12, 64, 8);
    this.tex = texture(c, { repeat: true });
    this.mat = new THREE.MeshStandardMaterial({ map: this.tex, side: THREE.DoubleSide, roughness: 0.6 });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    this.write();
  }
  reset() { for (let i = 0; i < this.n; i++) { this.p[i].set(lerp(-4.4, 4.4, i / (this.n - 1)), this.y0, this.z0); this.v[i].set(0, 0, 0); } this.cut = -1; this.write(); }
  breakAt(d, v = 18) {
    if (this.cut >= 0) return;
    this.cut = clamp(Math.round((d + 4.4) / 8.8 * (this.n - 1)), 2, this.n - 3);
    for (let i = 1; i < this.n - 1; i++) { const k = Math.exp(-Math.abs(i - this.cut) * 0.45); this.v[i].set((i < this.cut ? -1 : 1) * 1.5 * k, 1.2 * k, -v * 0.45 * k); }
  }
  step(dt) {
    if (this.cut < 0) { this.t += dt; for (let i = 1; i < this.n - 1; i++) this.p[i].y = this.y0 + Math.sin(this.t * 3 + i * 0.7) * 0.015 * Math.sin(Math.PI * i / (this.n - 1)); this.write(); return; }
    const sub = 3, h = dt / sub;
    for (let k = 0; k < sub; k++) {
      for (let i = 1; i < this.n - 1; i++) {
        const v = this.v[i];
        v.y -= 9.8 * 0.35 * h; v.multiplyScalar(Math.exp(-1.6 * h));
        v.z += 1.2 * h; v.x += Math.sin(this.t * 7 + i) * 0.6 * h;
        this.p[i].addScaledVector(v, h);
        if (this.p[i].y < this.y0 - 1.08) { this.p[i].y = this.y0 - 1.08; v.y = 0; v.multiplyScalar(0.8); }
      }
      for (let it = 0; it < 4; it++) for (let i = 0; i < this.n - 1; i++) {
        if (i + 1 === this.cut) continue;                 // 切れた ところは つながない
        const a = this.p[i], b = this.p[i + 1], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz) || 1e-4, diff = (len - this.rest) / len * 0.5;
        if (i > 0) { a.x += dx * diff; a.y += dy * diff; a.z += dz * diff; }
        if (i + 1 < this.n - 1) { b.x -= dx * diff; b.y -= dy * diff; b.z -= dz * diff; }
      }
      this.t += h;
    }
    this.write();
  }
  write() {
    const P = this.pos, w = 0.045;
    for (let i = 0; i < this.n - 1; i++) {
      const a = this.p[i], b = this.p[i + 1], o = i * 12;
      if (i + 1 === this.cut) { P.fill(a.x, o, o + 12); for (let k = 0; k < 4; k++) { P[o + k * 3] = a.x; P[o + k * 3 + 1] = a.y; P[o + k * 3 + 2] = a.z; } continue; }
      P.set([a.x, a.y - w, a.z, a.x, a.y + w, a.z, b.x, b.y - w, b.z, b.x, b.y + w, b.z], o);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); this.tex.dispose(); }
}

export function buildGoal(course, L, H) {
  const root = new THREE.Group(); root.name = 'goal';
  const keep = [], y0 = H(L), z = -L;
  const chk = checkerTexture(4); chk.repeat.set(1, 10); keep.push(chk);
  const pm = new THREE.MeshStandardMaterial({ map: chk, roughness: 0.5 }); keep.push(pm);
  const pillars = [];
  for (const x of [-5.3, 5.3]) {
    const p = new THREE.Mesh(new RoundedBoxGeometry(0.55, 6.0, 0.55, 2, 0.06), pm); p.position.set(x, y0 + 3.0, z - 0.75); p.castShadow = true; root.add(p); keep.push(p.geometry); pillars.push(p);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffd54a', roughness: 0.3, metalness: 0.6 })); cap.position.set(x, y0 + 6.3, z - 0.75); cap.castShadow = true; root.add(cap); keep.push(cap.geometry, cap.material);
  }
  const beam = new THREE.Mesh(new RoundedBoxGeometry(11.2, 1.4, 0.5, 2, 0.08), new THREE.MeshStandardMaterial({ color: '#1d2b53', roughness: 0.5 })); beam.position.set(0, y0 + 5.2, z - 0.75); beam.castShadow = true; root.add(beam); keep.push(beam.geometry, beam.material);
  const btex = textBannerTexture('ゴール', course.color, 1024, 128); keep.push(btex);
  const bm = new THREE.MeshStandardMaterial({ map: btex, roughness: 0.6, emissive: '#ffffff', emissiveMap: btex, emissiveIntensity: course.sky.night ? 0.55 : 0.1 }); keep.push(bm);
  for (const [dz, ry] of [[0.26, 0], [-0.26, Math.PI]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 1.25), bm); b.position.set(0, y0 + 5.2, z - 0.75 + dz); b.rotation.y = ry; root.add(b); keep.push(b.geometry); }
  // テープの 柱
  const tp = colored(merge([new THREE.CylinderGeometry(0.05, 0.06, 1.25, 8).translate(-4.4, y0 + 0.62, z), new THREE.CylinderGeometry(0.05, 0.06, 1.25, 8).translate(4.4, y0 + 0.62, z)]), '#ffffff');
  const tpm = new THREE.Mesh(tp, vmat({ roughness: 0.4 })); root.add(tpm); keep.push(tp, tpm.material);
  const tape = new Tape(L, H); root.add(tape.mesh);
  // 紙ふぶきの 大砲 4つ
  const cannons = [];
  const cg = merge([colored(new THREE.CylinderGeometry(0.26, 0.3, 1.0, 14).translate(0, 0.5, 0), '#2b2f3a'), colored(new THREE.TorusGeometry(0.28, 0.06, 8, 18).rotateX(Math.PI / 2).translate(0, 1.0, 0), '#ffd54a'), colored(new THREE.CylinderGeometry(0.42, 0.48, 0.3, 14).translate(0, 0.15, 0), '#ffd54a')]);
  const cm = vmat({ roughness: 0.35, metalness: 0.5 }); keep.push(cg, cm);
  for (const x of [-7.6, -6.6, 6.6, 7.6]) { const c = new THREE.Mesh(cg, cm); c.position.set(x, y0, z + 2 + (Math.abs(x) > 7 ? 2 : 0)); c.rotation.z = -Math.sign(x) * 0.25; c.castShadow = true; root.add(c); cannons.push(c); }
  return {
    root, tape, cannons,
    update(dt) { tape.step(dt); },
    dispose() { tape.dispose(); keep.forEach(k => k.dispose && k.dispose()); }
  };
}
