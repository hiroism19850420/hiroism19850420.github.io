// 地形（第10部 10.6、付録S S.3）：まっすぐの道に そった 細長い 格子
// 世界の座標：x = 横（右が正）、z = −s
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, lerp, smoothstep, noise2, hex3, s2l } from './util.js';

// 山を ひとつ（a〜b の間で 1、外へ なだらかに 0）
const hump = (x, a, b, w) => smoothstep(a - w, a, x) * (1 - smoothstep(b, b + w, x));

// ビーチの 波打ちぎわ：x = shoreX(s)
export function shoreX(T, s) { const [a1, w1, a2, w2] = T.shoreWig; return T.shoreX + a1 * Math.sin(s / w1) + a2 * Math.sin(s / w2); }

// 景色ごとの 高さ。H は 道の 高さ h(s)
export function makeGround(course, L, H) {
  const K = CFG.course, T = course.terrain;
  const half = K.ROAD_W / 2, curbOut = half + K.CURB, near = curbOut + K.SHOULDER;   // 4.0、4.6、7.6
  const H0 = s => H(clamp(s, -K.PRE, L + K.POST));
  const water = course.water ? course.water.level : -99;
  // 道を 気にしない 自然の 高さ
  const natural = (x, s, hs) => {
    const ax = Math.abs(x);
    const follow = hs * (1 - smoothstep(30, 160, ax));               // 道の 上り下りが 外へ ひろがる
    switch (T.kind) {
      case 'meadow': {
        let n = 0; for (let i = 0; i < 3; i++) n += T.amp[i] * noise2(x / T.scale[i], s / T.scale[i], 11 + i);
        return follow + n * smoothstep(10, 70, ax) + Math.max(0, ax - 55) * 0.055;
      }
      case 'beach': {
        if (x < 0) {
          const Ld = T.land;
          const n = Ld.a1 * noise2(x / Ld.s1, s / Ld.s1, 21) + Ld.a2 * noise2(x / Ld.s2, s / Ld.s2, 22);
          return follow + (Ld.base + n) * smoothstep(12, 40, ax) + Math.max(0, ax - 60) * 0.06;
        }
        const sx = shoreX(T, s);
        if (x < sx) return lerp(hs - 0.05, water + 0.06, smoothstep(near, sx, x));
        return Math.max(T.seaMin, water + 0.06 - (x - sx) * T.seaSlope);
      }
      case 'snow': {
        let n = 0; for (let i = 0; i < 3; i++) n += T.amp[i] * noise2(x / T.scale[i], s / T.scale[i], 31 + i);
        return follow + n * smoothstep(10, 80, ax) + Math.max(0, ax - 60) * 0.09;
      }
      case 'city': return hs;
    }
    return hs;
  };
  // 道の 近くを 道の 高さに 合わせた 高さ
  const heightAtS = (x, s) => {
    const hs = H0(s), ax = Math.abs(x);
    if (T.kind === 'beach' && x > 0) {                               // 海がわは 道の はしから そのまま 浜へ
      if (ax < curbOut) return hs - 0.35;
      if (ax < near) return hs - 0.05 - (ax - curbOut) * 0.02;
      return natural(x, s, hs);
    }
    let y;
    if (ax < curbOut) y = hs - 0.35;                                  // 道の 下は 少し さげる
    else {
      const k = smoothstep(near, near + K.TERRAIN_BLEND, ax);
      y = lerp(hs - 0.05, natural(x, s, hs), k);
    }
    if (T.kind === 'snow') y += 0.9 * hump(ax, 5.9, 6.6, 0.75);       // 雪の 土手
    if (T.kind === 'city' && ax >= curbOut) y = hs + 0.14;            // 歩道
    return y;
  };
  return { heightAtS, heightAt: (x, z) => heightAtS(x, -z), natural, near, curbOut, H };
}

export function buildTerrain(course, L, H, quality, detailTex) {
  const K = CFG.course, T = course.terrain, G = makeGround(course, L, H);
  const low = quality === 'low';
  // x の 点：道の 近くは こまかく、遠くは あらく
  const xsPos = [0, 2.0, 3.9];
  for (let x = 4.3; x < 12; x += low ? 0.9 : 0.55) xsPos.push(+x.toFixed(2));
  for (let x = 12; x < K.TERRAIN_NEAR; x += low ? 5 : K.TERRAIN_DX_NEAR) xsPos.push(x);
  for (let x = K.TERRAIN_NEAR; x <= K.TERRAIN_X; x += K.TERRAIN_DX_FAR) xsPos.push(x);
  const xs = [...xsPos.slice(1).map(x => -x).reverse(), ...xsPos];
  const dz = low ? K.TERRAIN_DZ * 2 : K.TERRAIN_DZ;
  const s0 = -K.PRE - 300, s1 = L + K.POST + 300;
  const nx = xs.length, nz = Math.floor((s1 - s0) / dz) + 1;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) {
    const s = s0 + j * dz;
    for (let i = 0; i < nx; i++) {
      const x = xs[i], o = j * nx + i, y = G.heightAtS(x, s);
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = -s;
      uv[o * 2] = x / 8; uv[o * 2 + 1] = s / 8;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let p = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = b; idx[p++] = d; idx[p++] = c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  // 上向きに そろえる（三角形の 回りの 向きを まちがえても 光が 正しくなるように）
  { const n = geo.attributes.normal; if (n.getY(Math.floor(n.count / 2)) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.index.needsUpdate = true; geo.computeVertexNormals(); } }
  const nrm = geo.attributes.normal.array;
  const C = {}; for (const k in T.colors) C[k] = hex3(T.colors[k]);
  for (let o = 0; o < nx * nz; o++) {
    const x = pos[o * 3], y = pos[o * 3 + 1], s = -pos[o * 3 + 2], ny = nrm[o * 3 + 1];
    const c = colorAt(course, C, G, x, s, y, ny);
    const nv = 1 + noise2(x / 9, s / 9, 77) * 0.05;
    for (let k = 0; k < 3; k++) col[o * 3 + k] = s2l(clamp(c[k] * nv, 0, 1));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: detailTex || null, envMapIntensity: 0.2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.name = 'terrain';

  // ---- すそ：格子の ふちから 遠くへ（すき間を 作らない） ----
  const loop = [];
  for (let i = 0; i < nx - 1; i++) loop.push(i);                                // s0 の 辺
  for (let j = 0; j < nz - 1; j += 4) loop.push(j * nx + nx - 1);              // 右
  for (let i = nx - 1; i > 0; i--) loop.push((nz - 1) * nx + i);               // s1 の 辺
  for (let j = nz - 1; j > 0; j -= 4) loop.push(j * nx);                       // 左
  const cx = 0, cz = -(s0 + s1) / 2;
  let ec = [0, 0, 0], eh = 0;
  for (const o of loop) { ec[0] += col[o * 3]; ec[1] += col[o * 3 + 1]; ec[2] += col[o * 3 + 2]; eh += pos[o * 3 + 1]; }
  ec = ec.map(v => v / loop.length); eh /= loop.length;
  const sp = [], sc = [], si = [];
  for (const o of loop) {
    const x = pos[o * 3], y = pos[o * 3 + 1], z = pos[o * 3 + 2];
    const a = Math.atan2(z - cz, x - cx);
    const oy = T.kind === 'beach' && x > 50 ? T.seaMin : eh + 6;
    sp.push(x, y - 0.02, z, cx + Math.cos(a) * 2600, oy, cz + Math.sin(a) * 2600);
    sc.push(col[o * 3], col[o * 3 + 1], col[o * 3 + 2], ec[0], ec[1], ec[2]);
  }
  const N = loop.length;
  for (let i = 0; i < N; i++) { const a = i * 2, b = ((i + 1) % N) * 2; si.push(a, b, a + 1, b, b + 1, a + 1); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); sg.setIndex(si);
  sg.computeVertexNormals();
  { const n = sg.attributes.normal; for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); }
  const disc = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  disc.name = 'terrainDisc';
  return { mesh, disc, ...G, dispose() { geo.dispose(); mat.dispose(); sg.dispose(); disc.material.dispose(); } };
}

const lerpC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function colorAt(course, c, G, x, s, h, ny) {
  const T = course.terrain, ax = Math.abs(x), steep = 1 - smoothstep(0.75, 0.95, ny);
  const hs = G.H(s);
  switch (T.kind) {
    case 'meadow': {
      let a = lerpC(c.low, c.high, smoothstep(-2, 12, h - hs * 0.5));
      a = lerpC(a, c.steep, steep);
      a = lerpC(a, c.flower, smoothstep(0.35, 0.7, noise2(x / 40, s / 40, 5)) * 0.5);
      // 道ぞいの 刈った 芝（4m ごとの しま）
      const mown = 1 - smoothstep(13, 17, ax);
      if (mown > 0) { const stripe = Math.floor((s + 1000) / 4) % 2 ? 1.06 : 0.95; a = lerpC(a, c.mown.map(v => v * stripe), mown); }
      return a;
    }
    case 'beach': {
      if (x > 0) {
        const sx = shoreX(T, s);
        if (x > sx + 0.5) return lerpC(c.sea, c.seaDeep, smoothstep(sx, sx + 40, x));
        return lerpC(c.beach, c.wet, smoothstep(G.near, sx, x));
      }
      const k = smoothstep(14, 34, ax);
      return lerpC(c.beach, lerpC(c.landLow, c.landHigh, smoothstep(1, 12, h - hs)), k);
    }
    case 'snow': {
      let a = lerpC(c.low || c.snow, c.snow, smoothstep(-4, 14, h - hs));
      a = lerpC(a, c.shade, Math.min(1, steep * 1.2));
      a = lerpC(a, c.rock, 1 - smoothstep(0.42, 0.6, ny));
      return lerpC(a, c.shade, (noise2(x / 70, s / 70, 8) * 0.5 + 0.5) * 0.3);
    }
    case 'city': {
      if (ax < 9.5) return c.walk || [0.36, 0.38, 0.45];
      if (x < -10 && x > -26) return c.park;
      return c.ground;
    }
  }
  return [0.5, 0.6, 0.4];
}
