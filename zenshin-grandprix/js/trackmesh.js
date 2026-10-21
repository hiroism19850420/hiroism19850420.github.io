// 道まわりの 見た目（10.9〜10.13、21.11、付録J）
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ZONE } from './track.js';
import { clamp, lerp, rng, hexLin, noise2 } from './util.js';
import { U } from './world.js';
import * as TX from './tex.js';

const V3 = THREE.Vector3;
const tmpP = { x: 0, y: 0, z: 0 }, tmpF = {};

// 道にそった 向きの 行列（位置 p、前 T、左 Lb、上 U）
function frameMatrix(tr, s, d, h, m4, yawOff = 0) {
  const f = tr.frame(s, tmpF);
  tr.pos(s, d, h, tmpP);
  const fwd = new V3(f.tx, f.ty, f.tz).normalize(), up = new V3(f.ux, f.uy, f.uz).normalize();
  const left = new V3().crossVectors(up, fwd).normalize();
  const fw2 = new V3().crossVectors(left, up).normalize();
  m4.makeBasis(left, up, fw2);
  if (yawOff) m4.multiply(new THREE.Matrix4().makeRotationY(yawOff));
  m4.setPosition(tmpP.x, tmpP.y, tmpP.z);
  return m4;
}
// 水平だけの 向き
function flatMatrix(x, y, z, yaw, sx = 1, sy = 1, sz = 1, m4 = new THREE.Matrix4()) {
  return m4.compose(new V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), yaw), new V3(sx, sy, sz));
}

// 道ぞいの 帯（横の断面 cols：[{d, h}]）を作る
function ribbon(tr, rows, cols, { uvFn = null, colFn = null, normal = 'up', closed = false } = {}) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const nc = cols.length;
  let vi = 0, prevOK = false;
  for (let r = 0; r < rows.length; r++) {
    const s = rows[r];
    if (s == null) { prevOK = false; continue; }
    const f = tr.frame(s, tmpF);
    for (let c = 0; c < nc; c++) {
      const cd = cols[c], d = typeof cd.d === 'function' ? cd.d(s) : cd.d, h = typeof cd.h === 'function' ? cd.h(s, d) : (cd.h || 0);
      tr.pos(s, d, 0, tmpP);
      pos.push(tmpP.x, tmpP.y + h, tmpP.z);
      if (normal === 'up') nor.push(f.ux, f.uy, f.uz); else nor.push(...normal(f, c));
      uv.push(...(uvFn ? uvFn(s, c, d) : [c / (nc - 1), s / 8]));
      col.push(...(colFn ? colFn(s, d, c) : [1, 1, 1]));
    }
    if (prevOK) {
      const a0 = vi - nc, b0 = vi;
      for (let c = 0; c < nc - 1; c++) { const a = a0 + c, b = a + 1, cc = b0 + c, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
      if (closed) { const a = a0 + nc - 1, b = a0, cc = b0 + nc - 1, d = b0; idx.push(a, cc, b, b, cc, d); }
    }
    vi += nc; prevOK = true;
  }
  // 上を向く 帯は、三角形の 向きを 上にそろえる（裏返しだと 上から見えない）
  if (normal === 'up' && idx.length >= 3) {
    const a = idx[0] * 3, b = idx[1] * 3, c = idx[2] * 3;
    const ux1 = pos[b] - pos[a], uy1 = pos[b + 1] - pos[a + 1], uz1 = pos[b + 2] - pos[a + 2];
    const ux2 = pos[c] - pos[a], uy2 = pos[c + 1] - pos[a + 1], uz2 = pos[c + 2] - pos[a + 2];
    const ny = uz1 * ux2 - ux1 * uz2;   // 外積の y
    if (ny < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  if (normal !== 'up') g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const PAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const PAD_FS = `uniform float uTime; varying vec2 vUv;
void main(){
  float chev = abs(vUv.x-0.5)*1.2 + fract(vUv.y*3.0);
  float on = smoothstep(0.33,0.36,chev) - smoothstep(0.53,0.56,chev);
  float flow = fract(vUv.y*3.0 - uTime*1.7);
  float glow = on*(0.35+0.65*smoothstep(0.6,1.0,flow));
  vec3 base = vec3(0.10,0.11,0.30);
  vec3 c = mix(base, mix(vec3(1.0,0.36,0.05), vec3(1.0,0.75,0.12), glow), on);
  float edge = step(0.93, max(abs(vUv.x-0.5), abs(vUv.y-0.5))*2.0);
  c = mix(c, vec3(1.0), edge);
  gl_FragColor = vec4(c*(1.0+glow*1.2), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildTrackMeshes(tr, course, scene, ctx) {
  const root = new THREE.Group(); root.name = 'track';
  const disposables = [];
  const keep = o => { disposables.push(o); return o; };
  const half = course.width / 2, night = !!course.night;
  const R = rng(500 + course.no);
  const heightAt = ctx.heightAt;

  // ---------- 前後の点（直線は 2m、カーブは 1m） ----------
  const rowsFor = (s0, s1, coarse = true) => {
    const rows = [];
    let s = s0;
    while (s < s1) { rows.push(s); s += coarse && Math.abs(tr.kAt(s)) < 1 / 200 ? 2 : 1; }
    rows.push(s1);
    return rows;
  };
  const allRows = rowsFor(0, tr.L);
  // すきまの所は 切る
  const gapCut = rows => rows.map(s => (s != null && tr.inGap(s) ? null : s));

  // ---------- 道 ----------
  const roadTex = keep(TX.roadTexture(course.id, course.width));
  const plankTex = keep(TX.plankTexture());
  const lampPools = [];
  if (night) for (let s = 0; s < tr.L; s += 18) { lampPools.push(tr.pos(s, half + 2, 0, {})); lampPools.push(tr.pos(s + 9, -half - 2, 0, {})); }
  const colFn = (s, d) => {
    let b = 1 + noise2(s / 30, 0.5, 9) * 0.04;
    if (tr.zoneAt(s) === ZONE.tunnel) b *= 0.55;
    let c = [b, b, b];
    if (night) {
      tr.pos(s, d, 0, tmpP);
      let k = 0; for (const p of lampPools) { const dd = (p.x - tmpP.x) ** 2 + (p.z - tmpP.z) ** 2; if (dd < 64) k = Math.max(k, 1 - Math.sqrt(dd) / 8); }
      c = [b * (1 + k * 0.6), b * (1 + k * 0.45), b * (1 + k * 0.25)];
    }
    return c;
  };
  const roadCols = [];
  for (let i = 0; i <= 8; i++) roadCols.push({ d: s => { const h = tr.wAt(s) / 2; return lerp(h, -h, i / 8); } });
  const uvRoad = (s, c) => [c / 8, s / 8];
  const zoneRows = (pred) => gapCut(allRows.map(s => pred(tr.zoneAt(s)) ? s : null));
  const roadGeo = ribbon(tr, zoneRows(z => z !== ZONE.pier), roadCols, { uvFn: uvRoad, colFn });
  const roadMat = keep(new THREE.MeshStandardMaterial({ map: roadTex, vertexColors: true, roughness: night ? 0.62 : 0.92, metalness: 0, envMapIntensity: night ? 0.6 : 0.25 }));
  const road = new THREE.Mesh(keep(roadGeo), roadMat); road.receiveShadow = true; road.name = 'road';
  root.add(road);
  if (tr.zone.some(z => z === ZONE.pier)) {
    // 桟橋の 板（前後の行を つなげるため、区間の前後 1行を ふくめる）
    const pr = gapCut(allRows.map((s, i) => tr.zoneAt(s) === ZONE.pier || tr.zoneAt(allRows[Math.max(0, i - 1)] ?? s) === ZONE.pier ? s : null));
    const pg = ribbon(tr, pr, roadCols, { uvFn: (s, c) => [s / 2.4, c / 8 * tr.wAt(s) / 2.4], colFn: () => [1, 1, 1] });
    const pm = keep(new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85, metalness: 0 }));
    const pier = new THREE.Mesh(keep(pg), pm); pier.receiveShadow = true; pier.castShadow = false; root.add(pier);
  }

  // ---------- 縁石 ----------
  {
    const c = TX.canvas(2, 1), g = c.getContext('2d'); g.fillStyle = '#e84a4a'; g.fillRect(0, 0, 1, 1); g.fillStyle = '#f4f6fa'; g.fillRect(1, 0, 1, 1);
    const ct = keep(TX.texture(c, { repeat: true })); ct.magFilter = THREE.NearestFilter; ct.minFilter = THREE.NearestFilter; ct.generateMipmaps = false;
    const cm = keep(new THREE.MeshStandardMaterial({ map: ct, roughness: 0.7 }));
    for (const side of [1, -1]) {
      const rows = gapCut(rowsFor(0, tr.L, false).map(s => tr.curbAt(s) && tr.zoneAt(s) === ZONE.ground ? s : null));
      const cols = [
        { d: s => side * (tr.wAt(s) / 2 - 0.02), h: 0.005 },
        { d: s => side * (tr.wAt(s) / 2 + 0.35), h: 0.06 },
        { d: s => side * (tr.wAt(s) / 2 + 1.0), h: 0.0 }
      ];
      if (side < 0) cols.reverse();
      const g2 = ribbon(tr, rows, cols, { uvFn: s => [s / 2.4, 0.5] });
      const m = new THREE.Mesh(keep(g2), cm); m.receiveShadow = true; root.add(m);
    }
  }

  // ---------- 歩道（街） ----------
  if (course.offroad === 'walk') {
    const wm = keep(new THREE.MeshStandardMaterial({ color: '#6b7186', roughness: 0.95, map: ctx.detailTex }));
    for (const side of [1, -1]) {
      const rows = allRows.map(s => tr.zoneAt(s) === ZONE.ground ? s : null);
      const cols = [
        { d: s => side * (tr.wAt(s) / 2), h: 0.0 },
        { d: s => side * (tr.wAt(s) / 2 + 0.02), h: 0.14 },
        { d: s => side * (tr.wAt(s) / 2 + tr.shoulderAt(s) + 1.2), h: 0.14 }
      ];
      if (side < 0) cols.reverse();
      const m = new THREE.Mesh(keep(ribbon(tr, rows, cols, { uvFn: (s, c, d) => [s / 4, d / 4] })), wm);
      m.receiveShadow = true; root.add(m);
    }
  }

  // ---------- かべ ----------
  const wallD = s => tr.wAt(s) / 2 + tr.shoulderAt(s);
  const instBatches = [];   // [geo, mat, matrices[]]
  const batch = (geo, mat, castShadow = true) => { const b = { geo, mat, list: [], cast: castShadow }; instBatches.push(b); return b; };
  const addInst = (b, m4) => b.list.push(m4.clone());
  const m4 = new THREE.Matrix4();
  const groundWall = course.wall, curbWall = course.curbWall;
  const W = {};
  W.post = batch(keep(new RoundedBoxGeometry(0.14, 0.95, 0.14, 2, 0.04).translate(0, 0.47, 0)), keep(new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.8 })));
  W.rail = batch(keep(new THREE.BoxGeometry(0.06, 0.1, 1).translate(0, 0, 0)), W.post.mat);
  W.hay = batch(keep(new THREE.CylinderGeometry(0.5, 0.5, 1.15, 14).rotateX(Math.PI / 2).translate(0, 0.5, 0)), keep(new THREE.MeshStandardMaterial({ color: '#e8c66a', roughness: 1 })));
  W.ropePost = batch(keep(new THREE.CylinderGeometry(0.08, 0.09, 0.9, 8).translate(0, 0.45, 0)), keep(new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.6, emissive: '#000' })));
  W.ropeTop = batch(keep(new THREE.CylinderGeometry(0.085, 0.085, 0.18, 8).translate(0, 0.82, 0)), keep(new THREE.MeshStandardMaterial({ color: '#e84a4a', roughness: 0.6 })));
  W.rope = batch(keep(new THREE.CylinderGeometry(0.025, 0.025, 1, 5).rotateX(Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ color: '#d9c8a0', roughness: 1 })), false);
  W.wood = batch(keep(new THREE.BoxGeometry(0.14, 1.0, 0.14).translate(0, 0.5, 0)), keep(new THREE.MeshStandardMaterial({ color: '#a7774a', roughness: 0.9 })));
  W.woodRail = batch(keep(new THREE.BoxGeometry(0.1, 0.1, 1)), W.wood.mat);
  W.gpost = batch(keep(new THREE.BoxGeometry(0.12, 0.85, 0.12).translate(0, 0.42, 0)), keep(new THREE.MeshStandardMaterial({ color: '#8a90a2', roughness: 0.5, metalness: 0.5 })));
  W.refl = batch(keep(new THREE.BoxGeometry(0.05, 0.08, 0.14)), keep(new THREE.MeshStandardMaterial({ color: '#ffb340', emissive: '#ff9f1c', emissiveIntensity: night ? 1.6 : 0.2 })), false);
  W.net = batch(keep(new THREE.PlaneGeometry(1, 0.7).translate(0, 0.55, 0)), keep(new THREE.MeshStandardMaterial({ color: '#ff7a2f', roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })), false);
  W.lightPost = batch(keep(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 8).translate(0, 1.6, 0)), keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 })));
  W.lightBulb = batch(keep(new THREE.SphereGeometry(0.2, 10, 8).translate(0, 3.25, 0)), keep(new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#fff1c0', emissiveIntensity: 1.2 })), false);

  const segWall = (kind, sA, sB, side) => {
    const dA = side * wallD(sA), dB = side * wallD(sB);
    const pa = tr.pos(sA, dA, 0, {}), pb = tr.pos(sB, dB, 0, {});
    return { pa, pb, len: Math.hypot(pb.x - pa.x, pb.z - pa.z), yaw: Math.atan2(pb.x - pa.x, pb.z - pa.z) };
  };
  const railBetween = (b, pa, pb, y, sag = 0) => {
    const len = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z), yaw = Math.atan2(pb.x - pa.x, pb.z - pa.z), pitch = -Math.atan2(pb.y - pa.y, Math.hypot(pb.x - pa.x, pb.z - pa.z));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    m4.compose(new V3((pa.x + pb.x) / 2, (pa.y + pb.y) / 2 + y - sag, (pa.z + pb.z) / 2), q, new V3(1, 1, len));
    addInst(b, m4);
  };
  const groundY = (p) => p.y;
  for (const side of [1, -1]) {
    const step = { fence: 3, rope: 4, guard: 4, snowbank: 4 }[groundWall] || 3;
    for (let s = 0; s < tr.L - 0.1; s += step) {
      const z = tr.zoneAt(s), s2 = Math.min(tr.L, s + step);
      if (tr.inGap(s) || tr.inGap(s2)) continue;
      if (z === ZONE.tunnel) continue;
      if (z !== ZONE.ground) {
        // 橋・桟橋の 手すり
        const sg = segWall('', s, s2, side);
        if (z === ZONE.pier) {
          flatMatrix(sg.pa.x, sg.pa.y, sg.pa.z, sg.yaw, 1, 1, 1, m4); addInst(W.wood, m4);
          railBetween(W.woodRail, sg.pa, sg.pb, 0.92); railBetween(W.woodRail, sg.pa, sg.pb, 0.5);
          if (Math.round(s) % 15 < step && side > 0) { flatMatrix(sg.pa.x, sg.pa.y, sg.pa.z, sg.yaw, 1, 1, 1, m4); addInst(W.lightPost, m4); addInst(W.lightBulb, m4); }
        }
        continue;   // 橋と高架は らんかん（下で 帯として 作る）
      }
      const sg = segWall('', s, s2, side);
      if (curbWall === 'hay' && tr.curbAt(s) && Math.sign(tr.kAt(s)) === -side) {
        // カーブの 外がわは わらのたば
        for (let k = 0; k < step; k += 1.2) { const p = tr.pos(s + k, side * (wallD(s + k) + 0.4), 0, {}); flatMatrix(p.x, p.y, p.z, tr.yawAt(s + k), 1, 1, 1, m4); addInst(W.hay, m4); }
        continue;
      }
      if (groundWall === 'fence') {
        flatMatrix(sg.pa.x, groundY(sg.pa), sg.pa.z, sg.yaw, 1, 1, 1, m4); addInst(W.post, m4);
        railBetween(W.rail, sg.pa, sg.pb, 0.38); railBetween(W.rail, sg.pa, sg.pb, 0.78);
      } else if (groundWall === 'rope') {
        flatMatrix(sg.pa.x, sg.pa.y, sg.pa.z, sg.yaw, 1, 1, 1, m4); addInst(W.ropePost, m4); addInst(W.ropeTop, m4);
        railBetween(W.rope, sg.pa, sg.pb, 0.72, 0.08);
      } else if (groundWall === 'guard') {
        flatMatrix(sg.pa.x, sg.pa.y + 0.14, sg.pa.z, sg.yaw, 1, 1, 1, m4); addInst(W.gpost, m4);
        if (Math.round(s) % 8 < step) { const q = tr.pos(s, side * (wallD(s) - 0.08), 0.65, {}); flatMatrix(q.x, q.y + 0.14, q.z, sg.yaw, 1, 1, 1, m4); addInst(W.refl, m4); }
      } else if (groundWall === 'snowbank') {
        if (R() < 0.12) { flatMatrix(sg.pa.x, sg.pa.y + 0.3, sg.pa.z, sg.yaw + Math.PI / 2, step * 0.95, 1, 1, m4); m4.multiply(new THREE.Matrix4().makeTranslation(0.5, 0, 0)); addInst(W.net, m4); }
      }
    }
  }
  // 雪の道の はしの 赤白の くい
  if (course.biome === 'snow') {
    const c = TX.canvas(4, 32), g2 = c.getContext('2d'); for (let i = 0; i < 4; i++) { g2.fillStyle = i % 2 ? '#ffffff' : '#e84a4a'; g2.fillRect(0, i * 8, 4, 8); }
    const pt = keep(TX.texture(c));
    const pb = batch(keep(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6).translate(0, 0.6, 0)), keep(new THREE.MeshStandardMaterial({ map: pt, roughness: 0.6 })));
    for (let s = 0; s < tr.L; s += 6) {
      if (tr.zoneAt(s) !== ZONE.ground) continue;
      for (const side of [1, -1]) { const p = tr.pos(s, side * (tr.wAt(s) / 2 + 0.7), 0, {}); flatMatrix(p.x, p.y, p.z, 0, 1, 1, 1, m4); addInst(pb, m4); }
    }
  }
  // 帯の かべ（雪のかべ、ガードレールの板、らんかん）
  const bandMat = {};
  if (groundWall === 'snowbank' || groundWall === 'guard') {
    for (const side of [1, -1]) {
      const rows = allRows.map(s => tr.zoneAt(s) === ZONE.ground ? s : null);
      let cols, mat;
      if (groundWall === 'snowbank') {
        cols = [0, 0.15, 0.4, 0.7, 0.9, 1].map((t, i, arr) => ({ d: s => side * (wallD(s) - 0.4 + t * 2.6), h: s => Math.sin(t * Math.PI) * 0.85 + (t > 0.5 ? (t - 0.5) * 0.6 : 0) }));
        mat = bandMat.snow || (bandMat.snow = keep(new THREE.MeshStandardMaterial({ color: '#f7fbff', roughness: 0.9, side: THREE.DoubleSide })));
      } else {
        cols = [{ d: s => side * (wallD(s) - 0.02), h: 0.62 }, { d: s => side * (wallD(s) - 0.05), h: 0.78 }, { d: s => side * (wallD(s) - 0.02), h: 0.94 }];
        mat = bandMat.guard || (bandMat.guard = keep(new THREE.MeshStandardMaterial({ color: '#e8ecf5', roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide })));
      }
      if (side < 0) cols.reverse();
      const m = new THREE.Mesh(keep(ribbon(tr, rows, cols, { normal: () => [0, 1, 0] })), mat);
      m.castShadow = groundWall === 'snowbank'; m.receiveShadow = true; root.add(m);
    }
  }

  // ---------- 橋・高架（けた、らんかん、柱） ----------
  const deckMat = keep(new THREE.MeshStandardMaterial({ color: course.biome === 'snow' ? '#8f9aac' : '#6b7186', roughness: 0.85, side: THREE.DoubleSide }));
  const pillarB = batch(keep(new THREE.CylinderGeometry(0.9, 1.0, 1, 14).translate(0, 0.5, 0)), deckMat);
  const pileB = batch(keep(new THREE.CylinderGeometry(0.18, 0.2, 1, 8).translate(0, 0.5, 0)), keep(new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 1, side: THREE.DoubleSide })));
  const beamB = batch(keep(new THREE.BoxGeometry(1, 0.3, 0.3)), pileB.mat);
  const parMat = keep(new THREE.MeshStandardMaterial({ color: course.biome === 'snow' ? '#d6dde8' : '#c8ced8', roughness: 0.7, side: THREE.DoubleSide }));
  const parLight = night ? keep(new THREE.MeshStandardMaterial({ color: '#7fe0ff', emissive: '#7fe0ff', emissiveIntensity: 1.6, side: THREE.DoubleSide })) : null;
  for (const b of course.bridges || []) {
    const s0 = b.s0, s1 = b.s1;
    const rows = rowsFor(s0, s1, false).filter(s => !tr.inGap(s));
    const segs = [];  // すきまで 切る
    let cur = [];
    for (const s of rowsFor(s0, s1, false)) { if (tr.inGap(s)) { if (cur.length) segs.push(cur); cur = []; } else cur.push(s); }
    if (cur.length) segs.push(cur);
    for (const sr of segs) {
      if (b.kind !== 'pier') {
        // けた：道の下の 箱
        const cols = [
          { d: s => tr.wAt(s) / 2 + 0.8, h: 0.0 }, { d: s => tr.wAt(s) / 2 + 0.8, h: -0.9 },
          { d: s => -tr.wAt(s) / 2 - 0.8, h: -0.9 }, { d: s => -tr.wAt(s) / 2 - 0.8, h: 0.0 }
        ];
        const g = ribbon(tr, sr, cols, { normal: () => [0, 1, 0] });
        g.computeVertexNormals();
        const deck = new THREE.Mesh(keep(g), deckMat); deck.castShadow = true; deck.receiveShadow = true; root.add(deck);
        // らんかん
        for (const side of [1, -1]) {
          const pc = [{ d: s => side * (tr.wAt(s) / 2 + 0.8), h: 0 }, { d: s => side * (tr.wAt(s) / 2 + 0.8), h: 0.75 }, { d: s => side * (tr.wAt(s) / 2 + 0.45), h: 0.75 }, { d: s => side * (tr.wAt(s) / 2 + 0.45), h: 0 }];
          if (side < 0) pc.reverse();
          const pg = ribbon(tr, sr, pc, { normal: () => [0, 1, 0] }); pg.computeVertexNormals();
          const pm = new THREE.Mesh(keep(pg), parMat); pm.castShadow = true; root.add(pm);
          if (parLight) {
            const lc = [{ d: s => side * (tr.wAt(s) / 2 + 0.66), h: 0.78 }, { d: s => side * (tr.wAt(s) / 2 + 0.59), h: 0.78 }];
            root.add(new THREE.Mesh(keep(ribbon(tr, sr, lc, { normal: () => [0, 1, 0] })), parLight));
          }
        }
        // 柱
        for (let s = sr[0] + 6; s < sr[sr.length - 1] - 3; s += 12) {
          const p = tr.pos(s, 0, 0, {});
          const gy = heightAt(p.x, p.z);
          const hgt = p.y - 0.9 - gy;
          if (hgt < 1.2) continue;
          if (tr.distGround(p.x, p.z) < half + 4) continue;   // 下の道の上には 立てない
          flatMatrix(p.x, gy - 0.5, p.z, tr.yawAt(s), 1, hgt + 0.5, 1, m4); addInst(pillarB, m4);
        }
      } else {
        // 桟橋：はりと くい
        for (let s = sr[0]; s < sr[sr.length - 1]; s += 3) {
          const p = tr.pos(s, 0, -0.18, {});
          flatMatrix(p.x, p.y, p.z, tr.yawAt(s) + Math.PI / 2, tr.wAt(s) + 0.6, 1, 1, m4); addInst(beamB, m4);
          if (Math.round(s) % 6 < 3) for (const side of [1, -1]) {
            const q = tr.pos(s, side * (tr.wAt(s) / 2 + 0.2), 0, {});
            const gy = Math.min(heightAt(q.x, q.z), -0.5);
            flatMatrix(q.x, gy - 0.5, q.z, 0, 1, q.y - gy + 0.3, 1, m4); addInst(pileB, m4);
          }
        }
        // 板の厚み（横の面）
        for (const side of [1, -1]) {
          const cols = [{ d: s => side * tr.wAt(s) / 2, h: 0 }, { d: s => side * tr.wAt(s) / 2, h: -0.3 }];
          if (side < 0) cols.reverse();
          const g = ribbon(tr, sr, cols, { normal: () => [0, 1, 0] }); g.computeVertexNormals();
          root.add(new THREE.Mesh(keep(g), pileB.mat));
        }
      }
    }
    // アーチ橋（街）
    if (b.arch) {
      const archMat = keep(new THREE.MeshStandardMaterial({ color: '#c8ced8', roughness: 0.4, metalness: 0.6 }));
      const mid = (s0 + s1) / 2, len = s1 - s0;
      for (const side of [1, -1]) {
        const pa = tr.pos(s0 + 1, side * (half + 1.0), 0, {}), pb = tr.pos(s1 - 1, side * (half + 1.0), 0, {});
        const R = Math.hypot(pb.x - pa.x, pb.z - pa.z) / 2;
        const g = new THREE.TorusGeometry(R, 0.35, 8, 32, Math.PI);
        const m = new THREE.Mesh(keep(g), archMat);
        m.position.set((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, (pa.z + pb.z) / 2);
        m.rotation.y = Math.atan2(pb.x - pa.x, pb.z - pa.z) - Math.PI / 2;
        m.scale.set(1, 0.55, 1);
        m.castShadow = true; root.add(m);
        // つり線
        for (let i = 1; i < 10; i++) {
          const t = i / 10, x = lerp(-R, R, t), y = Math.sqrt(Math.max(0, R * R - x * x)) * 0.55;
          const c = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, y, 5).translate(0, y / 2, 0)), archMat);
          const wp = new V3(x, 0, 0).applyAxisAngle(new V3(0, 1, 0), m.rotation.y).add(m.position);
          c.position.copy(wp); root.add(c);
        }
        if (night) {
          const pts = [];
          for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; pts.push(new V3(Math.cos(a) * R, Math.sin(a) * R * 0.55 + 0.4, 0).applyAxisAngle(new V3(0, 1, 0), m.rotation.y).add(m.position)); }
          ctx.glowPoints && ctx.glowPoints(pts, '#bfe8ff', 1.1);
        }
      }
    }
  }

  // ---------- トンネル ----------
  for (const t of course.tunnels || []) {
    const rows = rowsFor(t.s0 - 1, t.s1 + 1, false);
    const tubeR = half + 2.5, seg = 16;
    const cols = [];
    // 床（道のはし〜筒の根元）は 右から左へ
    for (let i = 0; i <= seg; i++) {
      const a = Math.PI * i / seg;
      cols.push({ d: s => -Math.cos(a) * tubeR, h: s => Math.sin(a) * tubeR * 0.82 });
    }
    const g = ribbon(tr, rows, cols, { uvFn: (s, c) => [c / seg * 4, s / 6], normal: () => [0, 1, 0] });
    g.computeVertexNormals();
    // 内がわを 向かせる
    const nrm = g.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
    const tm = keep(new THREE.MeshStandardMaterial({ color: '#7d8492', roughness: 0.95, side: THREE.DoubleSide, map: ctx.detailTex }));
    const tube = new THREE.Mesh(keep(g), tm); tube.receiveShadow = false; root.add(tube);
    // 外がわの 岩と 雪の 屋根
    const oc = [];
    for (let i = 0; i <= seg; i++) { const a = Math.PI * i / seg; oc.push({ d: s => -Math.cos(a) * (tubeR + 0.9), h: s => Math.sin(a) * (tubeR + 0.9) * 0.86 - 0.2 }); }
    const og = ribbon(tr, rows, oc, { normal: () => [0, 1, 0], colFn: (s, d, c) => { const a = Math.PI * c / seg, top = Math.sin(a) > 0.62; return top ? [0.95, 0.97, 1.0] : [0.45, 0.48, 0.55]; } });
    og.computeVertexNormals();
    root.add(new THREE.Mesh(keep(og), keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, flatShading: true }))));
    // 床
    for (const side of [1, -1]) {
      const fc = [{ d: s => side * tr.wAt(s) / 2, h: 0.01 }, { d: s => side * tubeR, h: 0.01 }];
      if (side < 0) fc.reverse();
      root.add(new THREE.Mesh(keep(ribbon(tr, rows, fc)), keep(new THREE.MeshStandardMaterial({ color: '#9aa2b0', roughness: 1 }))));
    }
    // 天井の ライト
    const lb = batch(keep(new THREE.BoxGeometry(1.4, 0.12, 0.5)), keep(new THREE.MeshStandardMaterial({ color: '#fff1c9', emissive: '#fff1c9', emissiveIntensity: 1.8 })), false);
    for (let s = t.s0 + 3; s < t.s1; s += 8) { frameMatrix(tr, s, 0, tubeR * 0.82 - 0.1, m4); addInst(lb, m4); }
    ctx.tunnelRocks && ctx.tunnelRocks(t);
  }

  // ---------- しかけ ----------
  // 加速パネル
  const padMat = keep(new THREE.ShaderMaterial({ vertexShader: PAD_VS, fragmentShader: PAD_FS, uniforms: { uTime: U.time } }));
  const padGeo = keep(new THREE.PlaneGeometry(3.2, 2.6).rotateX(-Math.PI / 2));
  for (const p of tr.pads) {
    const m = new THREE.Mesh(padGeo, padMat);
    frameMatrix(tr, p.s, p.d, 0.035, m4); m.matrixAutoUpdate = false; m.matrix.copy(m4);
    // PlaneGeometry の uv：v が奥（+z）へ ふえるように
    root.add(m);
  }
  // ジャンプ台
  const stripeTex = keep(TX.stripeTexture());
  for (const r of tr.ramps) {
    const n = 12, wHalf = r.width / 2, pos = [], uv = [], idx = [], sideCol = [];
    const pt = (x, d, top) => {
      const s = r.s - r.len + x;
      const h = top ? r.h * Math.pow(x / r.len, 1.4) : 0;
      tr.pos(s, (r.d || 0) + d, 0, tmpP);
      return [tmpP.x, tmpP.y + h + 0.01, tmpP.z];
    };
    // 上の面
    for (let i = 0; i <= n; i++) {
      const x = r.len * i / n;
      pos.push(...pt(x, wHalf, true), ...pt(x, -wHalf, true));
      uv.push(0, x / 1.2, r.width / 1.2, x / 1.2);
    }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
    const top = new THREE.Mesh(keep(tg), keep(new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6, side: THREE.DoubleSide })));
    top.receiveShadow = true; top.castShadow = true; root.add(top);
    // 横と 後ろの面
    const sp = [], si = [];
    for (const side of [1, -1]) {
      const base = sp.length / 3;
      for (let i = 0; i <= n; i++) { const x = r.len * i / n; sp.push(...pt(x, side * wHalf, true), ...pt(x, side * wHalf, false)); }
      for (let i = 0; i < n; i++) { const a = base + i * 2; side > 0 ? si.push(a, a + 1, a + 2, a + 2, a + 1, a + 3) : si.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const b0 = sp.length / 3;
    sp.push(...pt(r.len, wHalf, true), ...pt(r.len, -wHalf, true), ...pt(r.len, wHalf, false), ...pt(r.len, -wHalf, false));
    si.push(b0, b0 + 2, b0 + 1, b0 + 1, b0 + 2, b0 + 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals();
    const sideCol2 = new THREE.Color(course.color).multiplyScalar(0.7);
    const sm = new THREE.Mesh(keep(sg), keep(new THREE.MeshStandardMaterial({ color: sideCol2, roughness: 0.7, side: THREE.DoubleSide })));
    sm.castShadow = true; root.add(sm);
    // 終わりの 白い線
    const lineG = keep(new THREE.PlaneGeometry(r.width, 0.35).rotateX(-Math.PI / 2));
    const lm = new THREE.Mesh(lineG, keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 })));
    frameMatrix(tr, r.s - 0.2, r.d || 0, r.h + 0.03, m4); lm.matrixAutoUpdate = false; lm.matrix.copy(m4); root.add(lm);
  }
  // くぐりゲート
  const gates = [];
  const ribbonGeo = keep(new THREE.PlaneGeometry(0.14, 0.42).translate(0, -0.21, 0));
  const gateStripe = (() => { const c = TX.canvas(64, 8), g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : course.color; g.fillRect(i * 8, 0, 8, 8); } return keep(TX.texture(c, { repeat: true })); })();
  for (const gt of tr.gates) {
    const grp = new THREE.Group();
    frameMatrix(tr, gt.s, 0, 0, m4); grp.matrixAutoUpdate = false; grp.matrix.copy(m4);
    const wHalf = tr.wAt(gt.s) / 2 + 0.4;
    const postM = keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
    for (const side of [1, -1]) {
      const p = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.2, 0.22, 3.0, 12)), postM); p.position.set(side * wHalf, 1.5, 0); p.castShadow = true; grp.add(p);
      const cap = new THREE.Mesh(keep(new THREE.SphereGeometry(0.3, 12, 8)), keep(new THREE.MeshStandardMaterial({ color: course.color, roughness: 0.4 }))); cap.position.set(side * wHalf, 3.1, 0); grp.add(cap);
    }
    const topBar = new THREE.Mesh(keep(new RoundedBoxGeometry(wHalf * 2, 0.35, 0.35, 2, 0.1)), postM); topBar.position.y = 2.85; topBar.castShadow = true; grp.add(topBar);
    // 看板（しゃがむ）
    const signT = keep(TX.signTexture('gate'));
    const sign = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.5, 1.1)), keep(new THREE.MeshStandardMaterial({ map: signT, roughness: 0.6, side: THREE.DoubleSide })));
    sign.position.set(0, 3.65, -0.05); sign.rotation.y = Math.PI; grp.add(sign);
    // くぐり棒（やわらかい）
    const barPivot = new THREE.Group(); barPivot.position.y = 1.45; grp.add(barPivot);
    gateStripe.repeat.set(wHalf * 2 / 0.9, 1);
    const bar = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.12, wHalf * 2, 12).rotateZ(Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ map: gateStripe, roughness: 0.8 })));
    bar.castShadow = true; barPivot.add(bar);
    const ribs = [];
    for (let x = -wHalf + 0.5; x < wHalf - 0.3; x += 0.6) {
      const rb = new THREE.Mesh(ribbonGeo, keep(new THREE.MeshStandardMaterial({ color: R() < 0.5 ? '#ffd54a' : course.color, side: THREE.DoubleSide, roughness: 0.8 })));
      rb.position.set(x, -0.1, 0); barPivot.add(rb); ribs.push(rb);
    }
    root.add(grp);
    gates.push({ g: gt, barPivot, ribs, wob: 0, wobV: 0 });
  }
  // 水たまり
  for (const p of tr.puddles) {
    const grp = new THREE.Group();
    frameMatrix(tr, p.s, p.d, 0.02, m4); grp.matrixAutoUpdate = false; grp.matrix.copy(m4);
    const rim = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 1 })));
    rim.scale.set(p.rx * 1.12, 1, p.rz * 1.1); grp.add(rim);
    const wat = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ color: course.biome === 'beach' ? '#4fc6d8' : '#6aa8d8', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.82, envMapIntensity: 1.2 })));
    wat.scale.set(p.rx, 1, p.rz); wat.position.y = 0.012; grp.add(wat);
    root.add(grp);
  }

  // ---------- スタートライン・グリッド・アーチ ----------
  {
    const chk = keep(TX.checkerTexture(8)); chk.repeat.set(tr.wAt(0) / 0.8 / 8, 2 / 8 * 1);
    const cg = keep(new THREE.PlaneGeometry(tr.wAt(0), 1.6).rotateX(-Math.PI / 2));
    const cm = new THREE.Mesh(cg, keep(new THREE.MeshStandardMaterial({ map: chk, roughness: 0.8 })));
    chk.repeat.set(tr.wAt(0) / 0.8 / 8, 1.6 / 0.8 / 8);
    frameMatrix(tr, 0, 0, 0.02, m4); cm.matrixAutoUpdate = false; cm.matrix.copy(m4); cm.receiveShadow = true; root.add(cm);
    // グリッドの線
    const gm = keep(new THREE.MeshStandardMaterial({ color: '#f4f6fa', roughness: 0.8 }));
    for (const [gs, gd] of ctx.grid) {
      for (const [dx, dz, w2, h2] of [[0, 0.9, 2.2, 0.15], [1.1, 0, 0.15, 1.9], [-1.1, 0, 0.15, 1.9]]) {
        const pm = new THREE.Mesh(keep(new THREE.PlaneGeometry(w2, h2).rotateX(-Math.PI / 2)), gm);
        frameMatrix(tr, tr.wrapS(gs + dz), gd + dx, 0.02, m4); pm.matrixAutoUpdate = false; pm.matrix.copy(m4); root.add(pm);
      }
    }
    // アーチ
    const arch = new THREE.Group();
    frameMatrix(tr, 0.8, 0, 0, m4); arch.matrixAutoUpdate = false; arch.matrix.copy(m4);
    const wHalf = tr.wAt(0) / 2 + 1.4;
    const pillarGeo = keep(new RoundedBoxGeometry(0.9, 6.2, 0.9, 2, 0.15));
    const pc = keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
    const band = keep(new THREE.MeshStandardMaterial({ color: course.color, roughness: 0.4 }));
    for (const side of [1, -1]) {
      const p = new THREE.Mesh(pillarGeo, pc); p.position.set(side * wHalf, 3.1, 0); p.castShadow = true; arch.add(p);
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(keep(new THREE.BoxGeometry(0.95, 0.5, 0.95)), band); b.position.set(side * wHalf, 0.9 + k * 1.8, 0); arch.add(b); }
    }
    const board = new THREE.Mesh(keep(new RoundedBoxGeometry(wHalf * 2 + 1.2, 1.7, 0.45, 2, 0.12)), keep(new THREE.MeshStandardMaterial({ color: '#1d2b53', roughness: 0.5 })));
    board.position.y = 6.4; board.castShadow = true; arch.add(board);
    const bt = keep(TX.bannerTexture(course.color));
    const face = new THREE.Mesh(keep(new THREE.PlaneGeometry(wHalf * 2 + 0.8, 1.4)), keep(new THREE.MeshStandardMaterial({ map: bt, roughness: 0.5, emissive: '#ffffff', emissiveMap: bt, emissiveIntensity: night ? 0.7 : 0.0 })));
    face.position.set(0, 6.4, -0.24); face.rotation.y = Math.PI; arch.add(face);
    const face2 = face.clone(); face2.position.z = 0.24; face2.rotation.y = 0; arch.add(face2);
    // 信号
    const lamps = [];
    for (let i = 0; i < 3; i++) {
      const lm = new THREE.Mesh(keep(new THREE.SphereGeometry(0.33, 16, 12)), new THREE.MeshStandardMaterial({ color: '#3a3f52', roughness: 0.3, emissive: '#000000' }));
      keep(lm.material);
      lm.position.set((i - 1) * 1.0, 5.15, -0.3); arch.add(lm); lamps.push(lm);
    }
    const lampBox = new THREE.Mesh(keep(new RoundedBoxGeometry(3.4, 0.95, 0.4, 2, 0.12)), keep(new THREE.MeshStandardMaterial({ color: '#141a2e', roughness: 0.5 })));
    lampBox.position.set(0, 5.15, -0.05); arch.add(lampBox);
    // 旗
    const flags = [];
    for (let i = 0; i < 5; i++) {
      const fg = keep(new THREE.PlaneGeometry(0.9, 0.6, 6, 2).translate(0.45, 0, 0));
      const fm = new THREE.Mesh(fg, keep(new THREE.MeshStandardMaterial({ color: [course.color, '#ffffff', '#ffd54a'][i % 3], side: THREE.DoubleSide, roughness: 0.8 })));
      fm.position.set((i - 2) * (wHalf * 0.45), 7.9, 0); arch.add(fm);
      const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6)), pc); pole.position.set((i - 2) * (wHalf * 0.45), 7.75, 0); arch.add(pole);
      flags.push({ mesh: fm, base: fg.attributes.position.array.slice(), ph: i * 1.3 });
    }
    root.add(arch);
    ctx.startLamps = lamps; ctx.startFlags = flags;
  }

  // ---------- 看板・カーブの矢印 ----------
  const signPost = batch(keep(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6).translate(0, 1.1, 0)), keep(new THREE.MeshStandardMaterial({ color: '#9aa3b5', metalness: 0.5, roughness: 0.4 })));
  for (const sg of course.signs || []) {
    const d = sg.side * (tr.wAt(sg.s) / 2 + tr.shoulderAt(sg.s) + 1.6);
    const p = tr.pos(sg.s, d, 0, {}), yaw = tr.yawAt(sg.s) + Math.PI;
    const tex = keep(TX.signTexture(sg.kind));
    const bm = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.8, 1.35)), keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: night ? 0.55 : 0 })));
    bm.position.set(p.x, p.y + 2.7, p.z); bm.rotation.y = yaw; bm.castShadow = true; root.add(bm);
    for (const o of [-0.7, 0.7]) { const q = new V3(o, 0, 0).applyAxisAngle(new V3(0, 1, 0), yaw); flatMatrix(p.x + q.x, p.y, p.z + q.z, yaw, 1, 1, 1, m4); addInst(signPost, m4); }
  }
  {
    const tl = keep(TX.chevronTexture(1)), tRt = keep(TX.chevronTexture(-1));
    const chevGeo = keep(new THREE.PlaneGeometry(1.0, 0.8));
    const mL = keep(new THREE.MeshStandardMaterial({ map: tl, roughness: 0.6, emissive: '#ffffff', emissiveMap: tl, emissiveIntensity: night ? 0.6 : 0 }));
    const mR = keep(new THREE.MeshStandardMaterial({ map: tRt, roughness: 0.6, emissive: '#ffffff', emissiveMap: tRt, emissiveIntensity: night ? 0.6 : 0 }));
    const cl = [], cr = [];
    for (let s = 0; s < tr.L; s += 6) {
      const k = tr.kAt(s); if (Math.abs(k) < 1 / 40 || tr.zoneAt(s) !== ZONE.ground) continue;
      const side = -Math.sign(k);   // 外がわ
      const d = side * (tr.wAt(s) / 2 + tr.shoulderAt(s) + 0.9);
      const p = tr.pos(s, d, 0, {});
      const yaw = tr.yawAt(s) + Math.PI;
      flatMatrix(p.x, p.y + 0.95, p.z, yaw, 1, 1, 1, m4);
      (k > 0 ? cl : cr).push(m4.clone());   // 左カーブ：矢印は「＜」（運転手から見て左へ）
      flatMatrix(p.x, p.y, p.z, yaw, 0.8, 0.45, 0.8, m4); addInst(signPost, m4);
    }
    for (const [list, mat] of [[cl, mR], [cr, mL]]) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(chevGeo, mat, list.length); list.forEach((x, i) => im.setMatrixAt(i, x)); im.computeBoundingSphere(); root.add(im);
    }
  }

  // ---------- 星 ----------
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.2 : 0.45; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starGeo = keep(new THREE.ExtrudeGeometry(starShape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 }).center());
  const starMat = keep(new THREE.MeshStandardMaterial({ color: '#ffd54a', emissive: '#ffb800', emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.2 }));
  const stars = new THREE.InstancedMesh(starGeo, starMat, Math.max(1, tr.stars.length));
  stars.castShadow = true; stars.frustumCulled = false;
  root.add(stars);
  // ---------- コーン ----------
  const coneGeo = (() => {
    const body = new THREE.ConeGeometry(0.22, 0.6, 14).translate(0, 0.36, 0), base = new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(0, 0.03, 0);
    const cb = new Float32Array(body.attributes.position.count * 3), cs = hexLin('#ff7a2f'), cw = hexLin('#ffffff'), cd = hexLin('#2b2f3a');
    for (let i = 0; i < body.attributes.position.count; i++) { const y = body.attributes.position.getY(i); const w = (y > 0.3 && y < 0.38) || (y > 0.46 && y < 0.53); cb.set(w ? cw : cs, i * 3); }
    body.setAttribute('color', new THREE.BufferAttribute(cb, 3));
    const cbase = new Float32Array(base.attributes.position.count * 3); for (let i = 0; i < base.attributes.position.count; i++) cbase.set(cd, i * 3);
    base.setAttribute('color', new THREE.BufferAttribute(cbase, 3));
    return mergeGeometries([body.toNonIndexed(), base.toNonIndexed()]);
  })();
  keep(coneGeo);
  const cones = new THREE.InstancedMesh(coneGeo, keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })), Math.max(1, tr.cones.length));
  cones.castShadow = true; cones.frustumCulled = false; root.add(cones);
  for (const c of tr.cones) {
    const p = tr.pos(c.s, c.d, 0, {});
    c.home = p; c.p = new V3(p.x, p.y, p.z); c.v = new V3(); c.q = new THREE.Quaternion(); c.w = new V3(); c.yaw = tr.yawAt(c.s); c.scale = 1;
  }

  // ---------- インスタンスを まとめて 置く（160m の区画ごと） ----------
  for (const b of instBatches) {
    if (!b.list.length) continue;
    const cells = new Map();
    for (const mm of b.list) { const e = mm.elements, key = Math.floor(e[12] / 260) + ',' + Math.floor(e[14] / 260); if (!cells.has(key)) cells.set(key, []); cells.get(key).push(mm); }
    for (const list of cells.values()) {
      const im = new THREE.InstancedMesh(b.geo, b.mat, list.length);
      list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.computeBoundingSphere(); im.castShadow = b.cast; im.receiveShadow = true;
      root.add(im);
    }
  }

  scene.add(root);

  // ---------- 毎コマ ----------
  const dummy = new THREE.Object3D();
  const out = {
    root, gates, stars, cones, starGeo, starMat,
    update(dt, t, karts) {
      // 星
      tr.stars.forEach((st, i) => {
        let sc;
        if (st.alive) { st.grow = Math.min(1, (st.grow ?? 1) + dt * 4); sc = st.grow; }
        else { st.shrink = Math.max(0, (st.shrink || 0) - dt); sc = st.shrink / 0.2; }
        sc *= st.sky ? 1.25 : 1;
        tr.pos(st.s, st.d, st.y + Math.sin(t * 2 + i) * 0.1, tmpP);
        dummy.position.set(tmpP.x, tmpP.y, tmpP.z);
        dummy.rotation.set(0, t * Math.PI + i, 0);
        dummy.scale.setScalar(sc || 0.0001);
        dummy.updateMatrix(); stars.setMatrixAt(i, dummy.matrix);
      });
      stars.instanceMatrix.needsUpdate = true;
      // コーン
      tr.cones.forEach((c, i) => {
        if (c.state === 'fly') {
          c.t += dt;
          c.v.y -= 24 * dt; c.p.addScaledVector(c.v, dt);
          const gy = ctx.heightAt(c.p.x, c.p.z) + 0.02, roadY = c.home.y;
          const floor = Math.max(gy, Math.abs(c.p.y - roadY) < 2 ? Math.min(roadY, gy + 3) : gy);
          if (c.p.y < floor && c.v.y < 0) { c.p.y = floor; if (!c.bounced) { c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6; c.bounced = true; } else { c.v.set(0, 0, 0); c.w.multiplyScalar(0.9); } }
          const ang = c.w.length() * dt; if (ang > 0) c.q.premultiply(new THREE.Quaternion().setFromAxisAngle(c.w.clone().normalize(), ang));
          if (c.t > 3) c.scale = Math.max(0, 1 - (c.t - 3) / 0.3);
          if (c.t > 3.3) { c.state = 'gone'; c.t = 0; }
        } else if (c.state === 'gone') {
          c.t += dt;
          if (c.t > 12) { c.state = 'stand'; c.p.set(c.home.x, c.home.y, c.home.z); c.q.identity(); c.scale = 1; c.bounced = false; }
        }
        dummy.position.copy(c.p); dummy.quaternion.copy(c.q);
        if (c.state === 'stand') dummy.quaternion.setFromAxisAngle(new V3(0, 1, 0), c.yaw);
        dummy.scale.setScalar(c.state === 'gone' ? 0.0001 : c.scale);
        dummy.updateMatrix(); cones.setMatrixAt(i, dummy.matrix);
      });
      cones.instanceMatrix.needsUpdate = true;
      // ゲートの くぐり棒・リボン
      for (const g of gates) {
        g.wobV += (-90 * g.wob - 6 * g.wobV) * dt; g.wob += g.wobV * dt;
        g.barPivot.rotation.x = g.wob * 0.5;
        g.barPivot.position.y = 1.45 + Math.max(0, g.wob) * 0.25;
        g.ribs.forEach((rb, i) => { rb.rotation.x = g.wob * (1.2 + (i % 3) * 0.3) + Math.sin(t * 3 + i) * 0.06; });
      }
      // 旗
      for (const f of ctx.startFlags || []) {
        const pa = f.mesh.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) { const x = f.base[i * 3]; pa.setZ(i, Math.sin(x * 6 - t * 7 + f.ph) * 0.08 * x); }
        pa.needsUpdate = true;
      }
    },
    wobbleGate(gt, k = 1) { const g = gates.find(x => x.g === gt); if (g) g.wobV += 6 * k; },
    setLights(n) {
      (ctx.startLamps || []).forEach((lm, i) => {
        const on = n >= 4 ? 'g' : (i < n ? 'r' : '');
        lm.material.color.set(on === 'g' ? '#3ddc84' : on === 'r' ? '#ff4d4d' : '#3a3f52');
        lm.material.emissive.set(on === 'g' ? '#3ddc84' : on === 'r' ? '#ff4d4d' : '#000000');
        lm.material.emissiveIntensity = on ? 2.2 : 0;
      });
    },
    dispose() {
      scene.remove(root);
      root.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
      for (const d of disposables) d.dispose && d.dispose();
    }
  };
  return out;
}
