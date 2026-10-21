// 地面（第10部 10.14、第12〜15部、付録S）
import * as THREE from 'three';
import { clamp, lerp, smoothstep, noise2, hex3, s2l } from './util.js';
import { ZONE } from './track.js';

const bump = (x, z, b) => { const r = Math.hypot(x - b.c[0], z - b.c[1]); return r >= b.r ? 0 : b.h * (0.5 + 0.5 * Math.cos(Math.PI * r / b.r)); };

// コースごとの 自然の高さ N(x, z)
export function naturalHeight(T, tr, x, z) {
  switch (T.kind) {
    case 'meadow': {
      let n = 0;
      for (let i = 0; i < 3; i++) n += T.amp[i] * noise2(x / T.scale[i], z / T.scale[i], 11 + i);
      const d = tr.distAll(x, z);
      return n + Math.max(0, d - T.rimFrom) * T.rimK;
    }
    case 'beach': {
      const S = T.shore, L = T.land;
      const zs = S.base + S.a1 * Math.sin(x / S.f1) + S.a2 * Math.sin(x / S.f2);
      const q = zs - z;     // 陸がわが 正
      let land = L.base + L.a1 * noise2(x / L.s1, z / L.s1, 21) + L.a2 * noise2(x / L.s2, z / L.s2, 22);
      for (const h of T.hills || []) land += bump(x, z, h);
      if (q >= T.toShore) return land;
      if (q >= 0) return lerp(T.beachY, land, smoothstep(0, 1, q / T.toShore));
      return Math.max(T.seaMin, T.beachY + q * T.seaSlope);
    }
    case 'snow': {
      let n = 0;
      for (let i = 0; i < 3; i++) n += T.amp[i] * noise2(x / T.scale[i], z / T.scale[i], 31 + i);
      for (const b of T.bumps || []) n += bump(x, z, b);
      if (T.lake) {
        const r = Math.hypot(x - T.lake.c[0], z - T.lake.c[1]);
        n = lerp(T.lake.y - 0.6, n, smoothstep(T.lake.r - 2, T.lake.r + 14, r));
      }
      return n;
    }
    case 'city': {
      const R = T.river;
      if (!R) return 0;
      const a = Math.abs(z - R.z);
      return R.depth * (1 - smoothstep(R.half, R.half + R.bank, a));
    }
  }
  return 0;
}

export function buildTerrain(tr, course, q, detailTex) {
  const T = course.terrain;
  const step = q === 'low' ? 5 : 2.5;
  const F = tr.field;
  const x0 = F.x0 + 20, z0 = F.z0 + 20;
  const W = (F.nx - 1) * F.cell - 40, H = (F.nz - 1) * F.cell - 40;
  const nx = Math.floor(W / step) + 1, nz = Math.floor(H / step) + 1;
  const half = course.width / 2;
  const e0 = half + course.shoulder + 2, blend = T.blend || (T.kind === 'city' ? 6 : 28), e1 = e0 + blend;
  // トンネルの区間の 道の点
  const tun = [];
  for (const t of course.tunnels || []) {
    const list = [];
    for (let i = 0; i < tr.N; i++) if (tr.zone[i] === ZONE.tunnel && tr.inRangeS(i * tr.ds, t.s0, t.s1)) list.push(i);
    tun.push(list);
  }
  const tubeR = half + 2.5;

  const heightAt = (x, z) => {
    const N = naturalHeight(T, tr, x, z);
    const dG = tr.distGround(x, z);
    let h;
    if (dG > e1) h = N;
    else {
      const hard = tr.roadHardY(x, z), soft = tr.roadSoftY(x, z);
      const R = lerp(hard, soft, smoothstep(e0 - 4, e0 + 10, dG));
      const drop = lerp(0.35, 0.07, smoothstep(half - 2, half + 0.5, dG));
      h = lerp(R - drop, N, smoothstep(e0, e1, dG));
    }
    return h;
  };

  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
  const hs = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * step, z = z0 + j * step, o = j * nx + i;
    const h = heightAt(x, z);
    hs[o] = h;
    pos[o * 3] = x; pos[o * 3 + 1] = h; pos[o * 3 + 2] = z;
    uv[o * 2] = x / 8; uv[o * 2 + 1] = z / 8;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let p = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  // 色
  const nrm = geo.attributes.normal.array;
  const C = T.colors, cc = {};
  for (const k in C) cc[k] = hex3(C[k]);
  const offC = hex3(course.offroadColor || offroadColorOf(course));
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const o = j * nx + i, x = pos[o * 3], z = pos[o * 3 + 2], h = hs[o], ny = nrm[o * 3 + 1];
    const dG = tr.distAll(x, z);
    let c = colorAt(T, cc, x, z, h, ny);
    // 道の近く（路肩）
    const near = 1 - smoothstep(half + course.shoulder + 0.5, half + course.shoulder + 4, dG);
    if (near > 0) c = c.map((v, k) => lerp(v, offC[k], near * 0.85));
    const nv = 1 + noise2(x / 9, z / 9, 77) * 0.05;
    for (let k = 0; k < 3; k++) col[o * 3 + k] = s2l(clamp(c[k] * nv, 0, 1));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: detailTex || null, envMapIntensity: 0.2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  // 外がわの 大きな地面
  let ec = [0, 0, 0], en = 0;
  for (let i = 0; i < nx; i++) for (const j of [0, nz - 1]) { const o = j * nx + i; ec[0] += col[o * 3]; ec[1] += col[o * 3 + 1]; ec[2] += col[o * 3 + 2]; en++; }
  const edgeCol = new THREE.Color(ec[0] / en, ec[1] / en, ec[2] / en);
  let eh = 0; for (let i = 0; i < nx; i++) eh += hs[i] + hs[(nz - 1) * nx + i]; eh /= nx * 2;
  // 地形の ふちから 遠くへ のびる すそ（すき間を 作らない）
  const tcx = x0 + (nx - 1) * step / 2, tcz = z0 + (nz - 1) * step / 2;
  const loop = [];
  const k = 4;
  for (let i = 0; i < nx - 1; i += k) loop.push(i);                                   // 上の 辺
  for (let j = 0; j < nz - 1; j += k) loop.push(j * nx + nx - 1);                     // 右
  for (let i = nx - 1; i > 0; i -= k) loop.push((nz - 1) * nx + i);                    // 下
  for (let j = nz - 1; j > 0; j -= k) loop.push(j * nx);                               // 左
  const outerY = T.kind === 'beach' ? -8 : eh - 2;
  const sp = [], sc = [], si = [];
  for (const o of loop) {
    const x = pos[o * 3], y = pos[o * 3 + 1], z = pos[o * 3 + 2];
    const a = Math.atan2(z - tcz, x - tcx);
    sp.push(x, y - 0.02, z, tcx + Math.cos(a) * 2600, outerY, tcz + Math.sin(a) * 2600);
    sc.push(col[o * 3], col[o * 3 + 1], col[o * 3 + 2], edgeCol.r, edgeCol.g, edgeCol.b);
  }
  const L = loop.length;
  for (let i = 0; i < L; i++) { const a = i * 2, b = ((i + 1) % L) * 2; si.push(a, b, a + 1, b, b + 1, a + 1); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); sg.setIndex(si);
  sg.computeVertexNormals();
  { const n = sg.attributes.normal; for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); }
  const disc = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  disc.receiveShadow = false;
  disc.name = 'terrainDisc';
  return { mesh, disc, heightAt, grid: { x0, z0, nx, nz, step, hs } };
}

function offroadColorOf(course) {
  return { grass: '#8ad46a', sand: '#ead6a4', snow: '#f4f8fc', walk: '#6b7186' }[course.offroad] || '#8ad46a';
}

function colorAt(T, c, x, z, h, ny) {
  const steep = 1 - smoothstep(0.75, 0.95, ny);
  switch (T.kind) {
    case 'meadow': {
      let a = lerpC(c.low, c.high, smoothstep(-2, 10, h));
      a = lerpC(a, c.steep, steep);
      const f = smoothstep(0.35, 0.7, noise2(x / 40, z / 40, 5));
      return lerpC(a, c.flower, f * 0.5);
    }
    case 'beach': {
      if (h < -0.2) return lerpC(c.sea, c.seaDeep, smoothstep(-0.2, -6, h));
      if (h < 0.6) return c.wet;
      if (h < 2.2) return lerpC(c.wet, c.beach, smoothstep(0.6, 1.0, h));
      return lerpC(c.landLow, c.landHigh, smoothstep(2.2, 12, h));
    }
    case 'snow': {
      let a = lerpC(c.low || c.snow, c.snow, smoothstep(-4, 14, h));
      a = lerpC(a, c.shade, Math.min(1, steep * 1.2));
      a = lerpC(a, c.rock, 1 - smoothstep(0.42, 0.6, ny));
      return lerpC(a, c.shade, (noise2(x / 70, z / 70, 8) * 0.5 + 0.5) * 0.3);
    }
    case 'city': {
      const P = T.park;
      if (T.river && Math.abs(z - T.river.z) < T.river.half + 1) return c.riverbed;
      if (P && x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) return c.park;
      return c.ground;
    }
  }
  return [0.5, 0.6, 0.4];
}
const lerpC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// 水の 深さを読むための 地形の高さの絵（21.9.1）
export function heightTexture(heightAt, cx, cz, size, res = 256, range = [-14, 6]) {
  const data = new Uint8Array(res * res * 4);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = cx - size / 2 + (i + 0.5) / res * size, z = cz - size / 2 + (j + 0.5) / res * size;
    const h = heightAt(x, z);
    const v = Math.round(clamp((h - range[0]) / (range[1] - range[0]), 0, 1) * 255);
    const o = (j * res + i) * 4; data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  tex.colorSpace = THREE.NoColorSpace;
  return { tex, box: new THREE.Vector4(cx - size / 2, cz - size / 2, size, size), range: new THREE.Vector2(range[0], range[1]) };
}
