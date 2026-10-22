// 障害物の 見た目と 動き（第23部 23.4、付録J J.1、付録AP AP.2〜AP.3、付録W）
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CFG } from './config.js';
import { clamp, lerp, rng, noise2 } from './util.js';
import { colored, merge, V3, windMat } from './build.js';
import { paperTexture, stripeTexture, lineGlowTexture, chevronGlowTexture, canvas, texture } from './tex.js';

const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, ...o });

// 「！」の 札
function bangTexture() {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke();
  g.fillStyle = '#ffffff'; g.font = '900 92px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 70);
  return texture(c);
}

// ばね（縦と 横の 大きさ を ぷるんと）
class Jiggle {
  constructor(k = 120, c = 6) { this.k = k; this.c = c; this.x = 0; this.v = 0; }
  kick(v) { this.v += v; }
  step(dt) { const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; for (let i = 0; i < n; i++) { this.v += (-this.k * this.x - this.c * this.v) * h; this.x += this.v * h; } return this.x; }
}

// ---------- 紙の門の 紙（2枚の 布） ----------
class Paper {
  constructor(tex, w, y0, y1) {
    this.halves = []; this.state = 'hang'; this.t = 0; this.bulge = 0;
    const W = w / 2, Hh = y1 - y0;
    this.mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 });
    for (const side of [-1, 1]) {
      const g = new THREE.PlaneGeometry(W, Hh, 12, 8);
      // u：外の はし 0 → 内の はし 1、v：上 0 → 下 1
      const p = g.attributes.position, uv = g.attributes.uv, base = [];
      for (let i = 0; i < p.count; i++) {
        const lx = p.getX(i) + W / 2;                         // 0〜W（左から）
        const u = clamp(side < 0 ? lx / W : 1 - lx / W, 0, 1);   // 外（柱がわ）が 0
        const v = clamp(1 - (p.getY(i) + Hh / 2) / Hh, 0, 1);
        base.push({ u, v, x: side < 0 ? -W + lx : lx, y: y1 - v * Hh });
        uv.setXY(i, side < 0 ? lx / w : 0.5 + lx / w, 1 - v);
      }
      uv.needsUpdate = true;
      const m = new THREE.Mesh(g, this.mat); m.castShadow = true; m.frustumCulled = false;
      this.halves.push({ m, g, base, side, ang: 0, v: 0 });
    }
    this.W = W; this.write(0);
  }
  tear(kind) { if (this.state !== 'hang') return; this.state = kind === 'bulge' ? 'bulge' : 'torn'; this.t = 0; if (this.state === 'torn') for (const h of this.halves) h.v = 5.5 + Math.random(); }
  reset() { this.state = 'hang'; this.t = 0; this.bulge = 0; for (const h of this.halves) { h.ang = 0; h.v = 0; } this.write(0); }
  step(dt, t) {
    this.t += dt;
    if (this.state === 'bulge') { this.bulge = Math.min(1, this.t / 0.18); if (this.t > 0.22) { this.state = 'torn'; for (const h of this.halves) h.v = 4.5; } }
    else if (this.state === 'torn') this.bulge = Math.max(0, this.bulge - dt * 4);
    for (const h of this.halves) {
      const target = this.state === 'torn' ? 1.35 : 0;
      const n = Math.max(1, Math.ceil(dt / 0.008)), hh = dt / n;
      for (let i = 0; i < n; i++) { h.v += (-(h.ang - target) * 40 - h.v * 3.2) * hh; h.ang += h.v * hh; }
    }
    this.write(t);
  }
  write(t) {
    for (const h of this.halves) {
      const p = h.g.attributes.position, sideX = h.side * this.W;     // 柱の 位置
      h.base.forEach((b, i) => {
        const bend = h.ang * Math.pow(b.u, 1.3);
        const r = b.u * this.W;
        // 柱から 内へ のびる 布を、前（−z）へ 回す
        let x = sideX - h.side * r * Math.cos(bend), z = -r * Math.sin(bend);
        let y = b.y - (this.state === 'torn' ? h.ang * 0.18 * b.u * b.v : 0);
        z -= this.bulge * Math.sin(Math.PI * b.u) * Math.sin(Math.PI * Math.min(1, b.v + 0.1)) * 0.55;
        z += Math.sin(t * 6 + b.u * 5 + b.v * 3) * 0.02 * (0.3 + b.u) + (this.state === 'torn' ? Math.sin(t * 13 + b.v * 6 + b.u * 4) * 0.08 * b.u * Math.min(1, h.ang) : 0);
        p.setXYZ(i, x, y, z);
      });
      p.needsUpdate = true; h.g.computeVertexNormals();
    }
  }
  dispose() { for (const h of this.halves) h.g.dispose(); this.mat.dispose(); }
}

// ================= 種類ごとの 形 =================
// 返す：{ group, spring?, lamps?, paper?, frameMat?, thrower? }
function makeMesh(course, ob, keep) {
  const spec = course.obstacles[ob.base], cl = spec.colors, kind = spec.kind;
  const g = new THREE.Group(); const u = { kind };
  const add = (geo, m, cast = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; g.add(o); keep.push(geo); return o; };
  const vm = vmat(); keep.push(vm);
  const R = rng(ob.id * 17 + 3);
  switch (kind) {
    // ----- ハードル -----
    case 'log': {
      const bark = new THREE.CylinderGeometry(0.18, 0.18, 8.4, 16, 12).rotateZ(Math.PI / 2).toNonIndexed();
      const p = bark.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(cl.wood), b = new THREE.Color(cl.stand);
      for (let i = 0; i < p.count; i++) { const k = 0.5 + 0.5 * noise2(p.getX(i) * 3, Math.atan2(p.getZ(i), p.getY(i)) * 2, 9); const c = a.clone().lerp(b, k * 0.6); col.set([c.r, c.g, c.b], i * 3); }
      bark.setAttribute('color', new THREE.BufferAttribute(col, 3)); bark.deleteAttribute('uv');
      const ends = [-4.2, 4.2].flatMap(x => [colored(new THREE.CircleGeometry(0.17, 16).rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2).translate(x + Math.sign(x) * 0.001, 0, 0), cl.end), colored(new THREE.TorusGeometry(0.1, 0.012, 4, 16).rotateY(Math.PI / 2).translate(x + Math.sign(x) * 0.004, 0, 0), cl.stand)]);
      const body = merge([bark, ...ends]); body.translate(0, 0.52, 0);
      const stands = merge([-3.6, 3.6].flatMap(x => [colored(new THREE.BoxGeometry(0.3, 0.42, 0.3).translate(x, 0.21, 0), cl.stand), colored(new THREE.BoxGeometry(0.5, 0.06, 0.4).translate(x, 0.03, 0), cl.stand)]));
      add(stands, vm);
      const piv = new THREE.Group(); g.add(piv); const lm = new THREE.Mesh(body, vm); lm.castShadow = true; piv.add(lm); keep.push(body);
      u.spring = new Jiggle(160, 8); u.springObj = piv; u.springMode = 'roll';
      break;
    }
    case 'wave': {
      const len = 13, r = 0.68;
      const wg = new THREE.CylinderGeometry(r, r, len, 28, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).toNonIndexed();
      wg.scale(1, 1.05, 1.3);
      const wm = new THREE.MeshStandardMaterial({ color: cl.water, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.86, emissive: cl.deep, emissiveIntensity: 0.12, envMapIntensity: 1.4 });
      keep.push(wm);
      const w = add(wg, wm); w.castShadow = false;
      const fg = new THREE.CylinderGeometry(r * 0.32, r * 0.32, len * 1.02, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).translate(0, r * 0.92, 0.05);
      const fm = new THREE.MeshStandardMaterial({ color: cl.foam, roughness: 0.9, transparent: true, opacity: 0.92 }); keep.push(fm);
      add(fg, fm, false);
      u.wave = { k: 0, kSee: 0 }; g.position.x = 16;
      break;
    }
    case 'snowbank': {
      const sg = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = sg.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 1 + noise2(p.getX(i) * 4, p.getZ(i) * 4, 5) * 0.08; p.setXYZ(i, p.getX(i) * 4.6, p.getY(i) * 0.72 * k, p.getZ(i) * 0.65); }
      sg.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({ color: cl.snow, roughness: 0.55, envMapIntensity: 0.9 }); keep.push(m);
      const piv = new THREE.Group(); g.add(piv); const sm = new THREE.Mesh(sg, m); sm.castShadow = true; sm.receiveShadow = true; piv.add(sm); keep.push(sg);
      const sp = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(4.7, 0.2, 0.8).translate(0, -0.05, 0), new THREE.MeshStandardMaterial({ color: cl.shade, roughness: 0.9 })); piv.add(sp); keep.push(sp.geometry, sp.material);
      u.spring = new Jiggle(140, 7); u.springObj = piv; u.springMode = 'squash'; u.sparkle = true;
      break;
    }
    case 'barrier': {
      const st = stripeTexture(cl.a, cl.b); st.repeat.set(10, 1); keep.push(st);
      const bm = new THREE.MeshStandardMaterial({ map: st, roughness: 0.5 }); keep.push(bm);
      for (const y of [0.6, 0.3]) { const b = add(new RoundedBoxGeometry(8.2, 0.24, 0.08, 2, 0.02), bm); b.position.y = y; }
      add(merge([-3.8, -1.3, 1.3, 3.8].flatMap(x => [colored(new THREE.BoxGeometry(0.08, 0.72, 0.08).translate(x, 0.36, 0), '#8a93a3'), colored(new THREE.BoxGeometry(0.1, 0.06, 0.7).translate(x, 0.03, 0), '#5a6072')])), vm);
      const lampM = new THREE.MeshStandardMaterial({ color: cl.lamp, emissive: cl.lamp, emissiveIntensity: 1, roughness: 0.3 }); keep.push(lampM);
      for (const x of [-3, 0, 3]) { const l = add(new THREE.SphereGeometry(0.09, 12, 8), lampM, false); l.position.set(x, 0.8, 0); }
      u.lampMat = lampM; u.blink = true;
      u.spring = new Jiggle(150, 7); u.springObj = g.children[0].parent; u.springMode = 'roll';
      break;
    }
    // ----- くぐり棒 -----
    case 'branch': {
      const trunkG = merge([-4.9, 4.9].map(x => colored(new THREE.CylinderGeometry(0.22, 0.32, 3.2, 9).translate(x, 1.6, 0), cl.trunk)));
      add(trunkG, vm);
      const pts = [new V3(-4.8, 2.4, 0), new V3(-2.5, 1.45, 0), new V3(0, 1.32, 0), new V3(2.5, 1.45, 0), new V3(4.8, 2.4, 0)];
      const bg = colored(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.12, 8), cl.trunk);
      const piv = new THREE.Group(); g.add(piv);
      const bm = new THREE.Mesh(bg, vm); bm.castShadow = true; piv.add(bm); keep.push(bg);
      const leaves = [];
      for (let i = 0; i < 14; i++) {
        const t = i / 13, x = lerp(-4.6, 4.6, t), base = 1.32 + Math.pow(Math.abs(x) / 4.8, 2) * 1.0, r0 = 0.55 + R() * 0.35;
        const ig = new THREE.IcosahedronGeometry(r0, 1); const p = ig.attributes.position;
        for (let k = 0; k < p.count; k++) { const n = 1 + noise2(p.getX(k) * 3 + i, p.getZ(k) * 3, 4) * 0.12; p.setXYZ(k, p.getX(k) * n, p.getY(k) * n * 0.8, p.getZ(k) * n); }
        leaves.push(colored(ig.translate(x, base + r0 * 0.72 + 0.1, (R() - 0.5) * 0.5), i % 2 ? cl.leaf : cl.leaf2));
      }
      const lg = merge(leaves), lm = windMat({ vertexColors: true, roughness: 0.75 }, 0.02); keep.push(lg, lm);
      const lmesh = new THREE.Mesh(lg, lm); lmesh.castShadow = true; piv.add(lmesh);
      u.spring = new Jiggle(70, 3.5); u.springObj = piv; u.springMode = 'sway'; u.drop = cl.leaf2;
      break;
    }
    case 'palmArch': {
      const parts = [];
      for (const side of [-1, 1]) {
        const curve = new THREE.CubicBezierCurve3(new V3(side * 5.6, 0, 0), new V3(side * 5.4, 2.4, 0), new V3(side * 3.6, 3.8, 0), new V3(side * 0.6, 2.2, 0));
        parts.push(colored(new THREE.TubeGeometry(curve, 18, 0.22, 7, false), cl.trunk));
      }
      add(merge(parts), vm);
      const piv = new THREE.Group(); g.add(piv);
      const fronds = [];
      for (let i = 0; i < 16; i++) {
        const x = lerp(-4.2, 4.2, i / 15), y = 1.42 + Math.pow(Math.abs(x) / 4.2, 2) * 1.0 + R() * 0.08;
        const pos = [], n = 8, Ln = 1.6 + R() * 0.5, a = R() * 6.28;
        for (let k = 0; k <= n; k++) { const t = k / n, w = 0.3 * Math.sin(Math.PI * t) + 0.02; const ax = Math.cos(a) * t * Ln, az = Math.sin(a) * t * Ln * 0.6, ay = -0.35 * t * t; pos.push(x + ax - Math.sin(a) * w, y + 0.12 + ay, az + Math.cos(a) * w, x + ax + Math.sin(a) * w, y + 0.12 + ay, az - Math.cos(a) * w); }
        const idx = []; for (let k = 0; k < n; k++) { const b = k * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
        const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx); fg.computeVertexNormals();
        fronds.push(colored(fg.toNonIndexed(), i % 2 ? cl.leaf : cl.leaf2));
      }
      const fg = merge(fronds), fm = windMat({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }, 0.02); keep.push(fg, fm);
      const fmesh = new THREE.Mesh(fg, fm); fmesh.castShadow = true; piv.add(fmesh);
      u.spring = new Jiggle(70, 3.5); u.springObj = piv; u.springMode = 'sway'; u.drop = cl.leaf2;
      break;
    }
    case 'icicle': {
      add(merge([-4.4, 4.4].map(x => colored(new THREE.BoxGeometry(0.25, 2.4, 0.25).translate(x, 1.2, 0), cl.wood))), vm);
      const piv = new THREE.Group(); g.add(piv);
      const beam = merge([colored(new THREE.BoxGeometry(9.0, 0.3, 0.3).translate(0, 1.6, 0), cl.wood), colored(new THREE.CapsuleGeometry(0.2, 8.6, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.7, 1.2).translate(0, 1.82, 0), cl.snow)]);
      const bm = new THREE.Mesh(beam, vm); bm.castShadow = true; piv.add(bm); keep.push(beam);
      const ice = [];
      for (let i = 0; i < 30; i++) { const x = lerp(-4.2, 4.2, (i + R() * 0.6) / 30), h = 0.16 + R() * 0.26; ice.push(colored(new THREE.ConeGeometry(0.05, h, 6).rotateX(Math.PI).translate(x, 1.45 - h / 2, (R() - 0.5) * 0.18), cl.ice)); }
      const ig = merge(ice), im = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8, envMapIntensity: 1.6 }); keep.push(ig, im);
      piv.add(new THREE.Mesh(ig, im));
      u.spring = new Jiggle(110, 5); u.springObj = piv; u.springMode = 'sway'; u.drop = '#ffffff';
      break;
    }
    case 'beam': {
      add(merge([-4.4, 4.4].flatMap(x => [colored(new THREE.BoxGeometry(0.22, 2.3, 0.22).translate(x, 1.15, 0), cl.post), colored(new THREE.BoxGeometry(0.6, 0.1, 0.6).translate(x, 0.05, 0), '#5a6072')])), vm);
      const st = stripeTexture(cl.a, cl.b); st.repeat.set(12, 1); keep.push(st);
      const piv = new THREE.Group(); g.add(piv);
      const bmesh = new THREE.Mesh(new RoundedBoxGeometry(9.0, 0.3, 0.26, 2, 0.04), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45 })); bmesh.position.y = 1.3; bmesh.castShadow = true; piv.add(bmesh); keep.push(bmesh.geometry, bmesh.material);
      const lampM = new THREE.MeshStandardMaterial({ color: cl.lamp, emissive: cl.lamp, emissiveIntensity: 1.4, roughness: 0.3 }); keep.push(lampM);
      u.spin = [];
      for (const x of [-4.4, 4.4]) {
        const l = add(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 12), lampM, false); l.position.set(x, 2.42, 0);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 12, 1, true).translate(0, -1.6, 0).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: cl.lamp, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        const pv = new THREE.Group(); pv.position.set(x, 2.42, 0); pv.add(cone); g.add(pv); keep.push(cone.geometry, cone.material); u.spin.push(pv);
      }
      u.spring = new Jiggle(150, 7); u.springObj = piv; u.springMode = 'sway';
      break;
    }
    // ----- どっしり（ふさぐ がわ。g の 中心が ふさぐ はばの まん中） -----
    case 'hay': {
      const rolls = [[-1.25, 1.2], [1.25, 1.2], [0, 3.28]];
      for (const [x, y] of rolls) {
        const cg = new THREE.CylinderGeometry(1.2, 1.2, 1.4, 28, 3).rotateX(Math.PI / 2).toNonIndexed();
        const p = cg.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(cl.hay), b = new THREE.Color(cl.dark), band = new THREE.Color(cl.band);
        for (let i = 0; i < p.count; i++) {
          const r = Math.hypot(p.getX(i), p.getY(i)), face = Math.abs(p.getZ(i)) > 0.69;
          let c = face ? a.clone().lerp(b, (Math.sin(r * 22) * 0.5 + 0.5) * 0.5) : a.clone().lerp(b, noise2(Math.atan2(p.getY(i), p.getX(i)) * 6, p.getZ(i) * 4, 3) * 0.3 + 0.2);
          if (!face && Math.abs(Math.abs(p.getZ(i)) - 0.35) < 0.08) c = band;
          col.set([c.r, c.g, c.b], i * 3);
        }
        cg.setAttribute('color', new THREE.BufferAttribute(col, 3)); cg.deleteAttribute('uv'); cg.computeVertexNormals();
        cg.translate(x, y, 0);
        add(cg, vm);
      }
      u.spring = new Jiggle(120, 5); u.springObj = g; u.springMode = 'squash';
      break;
    }
    case 'castle': {
      const parts = [];
      const sand = cl.sand, dark = cl.dark;
      for (const [x, h] of [[-1.8, 2.2], [0, 2.6], [1.8, 1.9]]) {
        parts.push(colored(new THREE.CylinderGeometry(0.62, 0.72, h, 12).translate(x, h / 2, 0), sand));
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; parts.push(colored(new THREE.BoxGeometry(0.22, 0.24, 0.22).translate(x + Math.cos(a) * 0.55, h + 0.1, Math.sin(a) * 0.55), sand)); }
        parts.push(colored(new THREE.BoxGeometry(0.3, 0.42, 0.05).translate(x, h * 0.55, 0.7), dark));
        parts.push(colored(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4).translate(x, h + 0.55, 0), '#ffffff'));
        parts.push(colored(new THREE.PlaneGeometry(0.42, 0.26).translate(x + 0.22, h + 0.86, 0), cl.flag));
      }
      parts.push(colored(new THREE.BoxGeometry(4.6, 1.2, 0.9).translate(0, 0.6, 0), sand));
      for (let k = 0; k < 9; k++) parts.push(colored(new THREE.BoxGeometry(0.28, 0.22, 0.9).translate(-2.1 + k * 0.52, 1.3, 0), sand));
      parts.push(colored(new THREE.BoxGeometry(5.0, 0.3, 1.4).translate(0, 0.15, 0), dark));
      const cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }); keep.push(cm);
      add(merge(parts), cm);
      u.spring = new Jiggle(150, 6); u.springObj = g; u.springMode = 'squash';
      break;
    }
    case 'snowman': {
      for (const x of [-1.3, 1.3]) {
        const parts = [colored(new THREE.SphereGeometry(0.95, 18, 12).translate(0, 0.85, 0), cl.snow), colored(new THREE.SphereGeometry(0.68, 18, 12).translate(0, 2.05, 0), cl.snow), colored(new THREE.SphereGeometry(0.46, 16, 12).translate(0, 2.88, 0), cl.snow),
          colored(new THREE.TorusGeometry(0.5, 0.11, 8, 18).rotateX(Math.PI / 2).translate(0, 2.52, 0), cl.scarf), colored(new THREE.BoxGeometry(0.22, 0.6, 0.06).translate(0.3, 2.3, 0.45), cl.scarf),
          colored(new THREE.CylinderGeometry(0.32, 0.4, 0.45, 14).translate(0, 3.42, 0).rotateZ(x * 0.08), cl.bucket),
          colored(new THREE.ConeGeometry(0.08, 0.42, 8).rotateX(Math.PI / 2).translate(0, 2.88, 0.6), cl.nose),
          colored(new THREE.SphereGeometry(0.05, 6, 5).translate(0.15, 3.0, 0.4), '#1d2433'), colored(new THREE.SphereGeometry(0.05, 6, 5).translate(-0.15, 3.0, 0.4), '#1d2433'),
          ...[2.2, 1.95, 1.7].map(y => colored(new THREE.SphereGeometry(0.06, 6, 5).translate(0, y, 0.66), '#1d2433')),
          colored(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 4).rotateZ(1.1).translate(0.9, 2.3, 0), '#6b4a33'), colored(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 4).rotateZ(-1.1).translate(-0.9, 2.3, 0), '#6b4a33')];
        const sm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }); keep.push(sm);
        const o = add(merge(parts), sm); o.position.x = x; o.rotation.y = -x * 0.15;
      }
      u.spring = new Jiggle(110, 5); u.springObj = g; u.springMode = 'squash'; u.drop = '#ffffff';
      break;
    }
    case 'crates': {
      const list = cl.list;
      const spots = [[-1.65, 0.8, 0], [0, 0.8, 0.05], [1.65, 0.8, -0.04], [-0.82, 2.42, 0], [0.86, 2.42, 0.06]];
      spots.forEach(([x, y, z], i) => {
        const c = list[(i + ob.id) % list.length];
        const b = merge([colored(new RoundedBoxGeometry(1.6, 1.6, 1.6, 3, 0.1), c), colored(new THREE.BoxGeometry(1.62, 0.18, 1.62).translate(0, 0.35, 0), cl.band), colored(new THREE.BoxGeometry(1.62, 0.18, 1.62).translate(0, -0.35, 0), cl.band)]);
        const o = add(b, vmat({ roughness: 0.5 })); o.position.set(x, y, z); o.rotation.y = (R() - 0.5) * 0.25; keep.push(o.material);
      });
      u.spring = new Jiggle(130, 6); u.springObj = g; u.springMode = 'squash';
      break;
    }
    // ----- 紙の門 -----
    case 'paper': {
      const fm = new THREE.MeshStandardMaterial({ color: cl.frame, roughness: 0.5, emissive: cl.frame, emissiveIntensity: cl.neon ? 0.9 : 0 }); keep.push(fm);
      for (const x of [-4.4, 4.4]) { const p = add(new RoundedBoxGeometry(0.24, 2.95, 0.24, 2, 0.05), fm); p.position.set(x, 1.47, 0); }
      const top = add(new RoundedBoxGeometry(9.1, 0.3, 0.3, 2, 0.06), fm); top.position.y = 2.82;
      for (const x of [-4.4, 4.4]) { const ft = add(new THREE.BoxGeometry(0.5, 0.08, 0.6), vm); ft.position.set(x, 0.04, 0); }
      const tex = paperTexture(cl); keep.push(tex);
      const paper = new Paper(tex, 8.56, 0.9, 2.66);
      for (const h of paper.halves) g.add(h.m);
      u.paper = paper; u.frameMat = fm; keep.push(paper);
      break;
    }
    // ----- ボールがかり（道の わき） -----
    case 'cannon': {
      const piv = new THREE.Group(); g.add(piv); piv.position.y = 0.55;
      const barrel = merge([colored(new THREE.CylinderGeometry(0.25, 0.3, 1.1, 14).translate(0, 0.45, 0), cl.body), colored(new THREE.TorusGeometry(0.26, 0.04, 6, 16).rotateX(Math.PI / 2).translate(0, 1.0, 0), cl.ring), colored(new THREE.TorusGeometry(0.3, 0.04, 6, 16).rotateX(Math.PI / 2).translate(0, 0.0, 0), cl.ring)]);
      const bm = new THREE.Mesh(barrel, vm); bm.castShadow = true; piv.add(bm); keep.push(barrel);
      piv.rotation.z = -ob.side * 0.95;
      add(merge([-0.32, 0.32].flatMap(z => [colored(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 14).rotateX(Math.PI / 2).translate(0, 0.34, z), '#6b4a33'), colored(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8).rotateX(Math.PI / 2).translate(0, 0.34, z + Math.sign(z) * 0.04), cl.ring)])), vm);
      add(colored(new THREE.BoxGeometry(0.5, 0.25, 0.55).translate(0, 0.4, 0), cl.body), vm);
      u.thrower = { piv, hand: new V3(-ob.side * 0.9, 1.4, 0), recoil: 0, kind };
      break;
    }
    case 'crab': {
      const sc = 2.5, body = merge([colored(new THREE.SphereGeometry(0.25, 14, 8).scale(1, 0.55, 0.8), cl.body), colored(new THREE.SphereGeometry(0.05, 6, 5).translate(0.09, 0.2, 0.17), '#1d2433'), colored(new THREE.SphereGeometry(0.05, 6, 5).translate(-0.09, 0.2, 0.17), '#1d2433'),
        colored(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 4).translate(0.09, 0.13, 0.16), cl.body), colored(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 4).translate(-0.09, 0.13, 0.16), cl.body),
        ...[-1, 1].flatMap(sx => [0, 1, 2].map(k => colored(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 4).rotateZ(sx * 1.1).translate(sx * 0.28, -0.02, -0.1 + k * 0.1), cl.body)))]);
      body.scale(sc, sc, sc);
      const bo = add(body, vm); bo.position.y = 0.45;
      const claws = [];
      for (const sx of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(sx * 0.62, 0.62, 0.3); g.add(arm);
        const cg = merge([colored(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6).translate(0, 0.25, 0), cl.body), colored(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 1.3, 0.7).translate(0, 0.6, 0), cl.claw), colored(new THREE.ConeGeometry(0.08, 0.3, 6).translate(0.1, 0.85, 0).rotateZ(-0.3), cl.claw)]);
        const cm = new THREE.Mesh(cg, vm); cm.castShadow = true; arm.add(cm); keep.push(cg); arm.rotation.z = sx * 0.5; claws.push(arm);
      }
      g.rotation.y = -ob.side * 0.9;
      u.thrower = { claws, hand: new V3(-ob.side * 0.4, 1.6, 0.2), recoil: 0, kind, body: bo };
      break;
    }
    case 'snowmanSmall': {
      const b = merge([colored(new THREE.SphereGeometry(0.5, 16, 12).translate(0, 0.45, 0), cl.snow), colored(new THREE.SphereGeometry(0.35, 16, 12).translate(0, 1.15, 0), cl.snow),
        colored(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 14).translate(0, 1.44, 0), cl.hat), colored(new THREE.CylinderGeometry(0.18, 0.2, 0.32, 14).translate(0, 1.62, 0), cl.hat),
        colored(new THREE.ConeGeometry(0.05, 0.25, 6).rotateX(Math.PI / 2).translate(0, 1.15, 0.45), '#ff9f1c'), colored(new THREE.SphereGeometry(0.04, 6, 5).translate(0.11, 1.25, 0.3), '#1d2433'), colored(new THREE.SphereGeometry(0.04, 6, 5).translate(-0.11, 1.25, 0.3), '#1d2433')]);
      const sm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }); keep.push(sm);
      add(b, sm);
      const arm = new THREE.Group(); arm.position.set(-ob.side * 0.3, 1.0, 0); g.add(arm);
      const ag = colored(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4).translate(0, 0.35, 0), '#6b4a33'); const am = new THREE.Mesh(ag, vm); arm.add(am); keep.push(ag);
      arm.rotation.z = ob.side * 0.6;
      g.rotation.y = -ob.side * 0.9;
      u.thrower = { arm, hand: new V3(-ob.side * 0.5, 1.6, 0), recoil: 0, kind };
      break;
    }
    case 'robot': {
      const rm = vmat({ roughness: 0.35, metalness: 0.4 }); keep.push(rm);
      const body = merge([colored(new RoundedBoxGeometry(0.8, 1.0, 0.6, 3, 0.12).translate(0, 0.95, 0), cl.body), colored(new RoundedBoxGeometry(0.5, 0.42, 0.42, 3, 0.1).translate(0, 1.72, 0), cl.body),
        colored(new THREE.BoxGeometry(0.5, 0.14, 0.02).translate(0, 1.04, 0.31), '#1d2433'), colored(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4).translate(0, 2.05, 0), cl.arm), colored(new THREE.CylinderGeometry(0.16, 0.2, 0.45, 10).translate(0, 0.22, 0), cl.arm)]);
      add(body, rm);
      const eyeM = new THREE.MeshStandardMaterial({ color: cl.eye, emissive: cl.eye, emissiveIntensity: 2.2 }); keep.push(eyeM);
      for (const sx of [-1, 1]) { const e = add(new THREE.SphereGeometry(0.06, 10, 8), eyeM, false); e.position.set(sx * 0.12, 1.75, 0.21); }
      const ant = add(new THREE.SphereGeometry(0.06, 8, 6), eyeM, false); ant.position.set(0, 2.22, 0);
      const arms = [];
      for (const sx of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(sx * 0.48, 1.3, 0); g.add(arm);
        const ag = merge([colored(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8).translate(0, -0.3, 0), cl.arm), colored(new THREE.SphereGeometry(0.11, 8, 6).translate(0, -0.62, 0), cl.body)]);
        const am = new THREE.Mesh(ag, rm); am.castShadow = true; arm.add(am); keep.push(ag); arms.push(arm);
      }
      g.rotation.y = -ob.side * 0.9;
      u.thrower = { arms, hand: new V3(-ob.side * 0.6, 1.9, 0), recoil: 0, kind, eyeM };
      break;
    }
  }
  return { group: g, u };
}

// ================= 置いて 動かす =================
export class ObstacleMeshes {
  constructor(course, H, scene, fx) {
    this.c = course; this.H = H; this.scene = scene; this.fx = fx; this.items = []; this.balls = []; this.keep = [];
    this.root = new THREE.Group(); this.root.name = 'obstacles'; scene.add(this.root);
    this.lineTex = lineGlowTexture(); this.chevTex = chevronGlowTexture(); this.bangTex = bangTexture();
    this.markMat = new THREE.MeshBasicMaterial({ map: this.lineTex, color: '#ffd23f', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    this.chevMat = new THREE.MeshBasicMaterial({ map: this.chevTex, color: '#ffe066', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    this.ballGeo = new THREE.SphereGeometry(0.22, 18, 12);
    this.t = 0;
  }
  clear() {
    for (const ob of this.items) { if (ob.mesh) this.root.remove(ob.mesh); ob.mesh = null; ob.vis = null; }
    for (const b of this.balls) this.root.remove(b.m);
    this.items = []; this.balls = [];
    this.keep.forEach(k => k.dispose && k.dispose()); this.keep = [];
  }
  place(list) {
    this.clear();
    const C = CFG.course;
    for (const ob of list) {
      const { group, u } = makeMesh(this.c, ob, this.keep);
      const y = this.H(ob.s);
      const holder = new THREE.Group(); holder.position.set(0, y, -ob.s); holder.add(group);
      if (ob.base === 'dodge') group.position.x = ob.side > 0 ? -C.ROAD_W / 2 + 4.95 / 2 : C.ROAD_W / 2 - 4.95 / 2;
      if (ob.base === 'hand') group.position.x = ob.side * CFG.obstacles.SIZE.hand.side;
      // 予告の 光る 線（手前の 道）
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 0.55).rotateX(-Math.PI / 2), this.markMat);
      mark.position.set(0, this.H(ob.s - 2.6) - y + 0.05, 2.6); mark.visible = false; mark.renderOrder = 4; holder.add(mark); this.keep.push(mark.geometry);
      u.mark = mark;
      if (ob.base === 'dodge') {
        const arr = new THREE.Group(); arr.visible = false; holder.add(arr);
        for (const ds of [13, 7.5]) {
          const ch = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2).rotateX(-Math.PI / 2), this.chevMat);
          ch.rotation.y = ob.side > 0 ? -Math.PI / 2 : Math.PI / 2;
          ch.position.set(-ob.side * 1.2, this.H(ob.s - ds) - y + 0.06, ds); ch.renderOrder = 4; arr.add(ch); this.keep.push(ch.geometry);
        }
        u.arrows = arr;
      }
      if (u.thrower) {
        const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bangTex, depthTest: false, transparent: true }));
        bang.scale.setScalar(0.7); bang.position.set(0, 2.7, 0); bang.visible = false; bang.renderOrder = 5; group.add(bang); this.keep.push(bang.material);
        u.bang = bang;
      }
      if (u.spring && u.springMode === 'squash') u.baseScale = group.scale.clone();
      ob.mesh = holder; ob.vis = u; ob.group = group;
      this.root.add(holder); this.items.push(ob);
    }
  }
  // 予告：道の 光る線、すき間の 矢印、紙の門の 光、係の「！」
  mark(ob, on) {
    const u = ob.vis; if (!u) return;
    ob.marked = on; u.mark.visible = on;
    if (u.arrows) u.arrows.visible = on;
    if (u.bang) u.bang.visible = on;
  }
  wobble(ob, power = 1) {
    const u = ob.vis; if (!u || !u.spring) return;
    u.spring.kick((u.springMode === 'sway' ? 2.2 : 2.6) * power);
    const p = ob.mesh.position;
    if (u.drop && this.fx) for (let i = 0; i < 10; i++) this.fx.leaf(new V3(p.x + (Math.random() - 0.5) * 7, p.y + 1.6 + Math.random() * 0.6, p.z + (Math.random() - 0.5) * 0.6), u.drop);
    if (u.sparkle && this.fx) this.fx.snowPuff(new V3(p.x + (Math.random() - 0.5) * 4, p.y + 0.6, p.z));
  }
  tearPaper(ob, ok) { const u = ob.vis; if (u && u.paper) u.paper.tear(ok ? 'push' : 'bulge'); }
  // ボール：係から ランナーの 頭へ（0.9 秒）
  throwBall(ob, r, colorIndex = 0) {
    const u = ob.vis; if (!u || !u.thrower) return;
    const spec = this.c.obstacles.hand, cols = spec.balls, cs = cols[(colorIndex + ob.id) % cols.length];
    let m;
    if (cs.includes('|')) {
      const [a, b] = cs.split('|'); const g = this.ballGeo.clone().toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3), A = new THREE.Color(a), B = new THREE.Color(b);
      for (let i = 0; i < p.count; i++) { const k = Math.floor((Math.atan2(p.getZ(i), p.getX(i)) + Math.PI) / (Math.PI / 3)) % 2; const c = k ? A : B; col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); m = new THREE.Mesh(g, vmat({ roughness: 0.35 })); this.keep.push(g, m.material);
    } else {
      m = new THREE.Mesh(this.ballGeo, new THREE.MeshStandardMaterial({ color: cs, roughness: spec.glow ? 0.3 : 0.6, emissive: spec.glow ? cs : '#000000', emissiveIntensity: spec.glow ? 1.6 : 0 })); this.keep.push(m.material);
    }
    m.castShadow = true;
    const from = u.thrower.hand.clone().applyMatrix4(ob.group.matrixWorld);
    this.root.add(m);
    u.thrower.recoil = 1;
    this.balls.push({ m, ob, r, from, t: 0, T: CFG.obstacles.SIZE.hand.flight, state: 'fly', v: new V3(), spin: new V3(Math.random() * 8, Math.random() * 8, 0) });
    if (this.fx) this.fx.puff(from, spec.glow ? '#ffffff' : '#fff3d0');
  }
  // ボールの けっか：ok なら はじく、だめなら 頭で はねる
  ballResult(ob, r, ok) {
    const b = this.balls.find(q => q.ob === ob && q.r === r && q.state === 'fly'); if (!b) return;
    b.state = ok ? 'swat' : 'bonk';
    if (ok) { b.v.set(ob.side * (9 + Math.random() * 3), 5 + Math.random() * 2, -4); b.life = 0.45; }
    else { b.v.set(-ob.side * 1.5 + (Math.random() - 0.5), 4.2, 2.5); b.life = 1.6; }
  }
  // hide：[{ c: カメラの s, p: その カメラが 追う 人の s }]。通りすぎて カメラの すぐ 前に ある 障害物は かくす（画面を ふさぐため）
  update(dt, t, race, viewS0, viewS1 = viewS0, hide = null) {
    this.t += dt;
    const C = CFG.course, a = Math.min(viewS0, viewS1) - 30, bS = Math.max(viewS0, viewS1) + C.VIEW_AHEAD;
    for (const ob of this.items) {
      const m = ob.mesh, u = ob.vis; if (!m) continue;
      m.visible = ob.s > a && ob.s < bS;
      if (m.visible && hide) for (const h of hide) if (ob.s > h.c - 1 && ob.s < h.c + 2.4 && ob.s < h.p - 0.6) { m.visible = false; break; }
      if (!m.visible) continue;
      if (ob.marked) { u.mark.material.opacity = 0.45 + 0.4 * Math.sin(t * 10); if (u.arrows) for (const c of u.arrows.children) c.material.opacity = 0.55 + 0.35 * Math.sin(t * 9); if (u.frameMat) u.frameMat.emissiveIntensity = (this.c.obstacles.banzai.colors.neon ? 0.9 : 0) + 0.35 + 0.3 * Math.sin(t * 8); if (u.bang) u.bang.scale.setScalar(0.62 + Math.abs(Math.sin(t * 6)) * 0.14); }
      else if (u.frameMat) u.frameMat.emissiveIntensity = this.c.obstacles.banzai.colors.neon ? 0.9 : 0;
      if (u.wave) this.waveMotion(ob, race, dt);
      if (u.spring) {
        const x = u.spring.step(dt), o = u.springObj;
        if (u.springMode === 'roll') o.rotation.x = x * 0.25;
        else if (u.springMode === 'sway') { o.rotation.x = x * 0.12; o.position.y = -Math.abs(x) * 0.05; }
        else if (u.springMode === 'squash') { o.scale.set(1 + x * 0.06, 1 - x * 0.08, 1 + x * 0.06); }
      }
      if (u.paper) u.paper.step(dt, t);
      if (u.blink) u.lampMat.emissiveIntensity = Math.sin(t * 8) > 0 ? 2.2 : 0.2;
      if (u.spin) u.spin.forEach((p, i) => { p.rotation.y = t * 5 + i * Math.PI; });
      if (u.thrower) this.throwerMotion(ob, u.thrower, dt, t, race);
    }
    // ボール
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.state === 'fly') {
        b.t += dt; const k = Math.min(1, b.t / b.T);
        const head = new V3(b.r.d, this.H(b.r.s) + b.r.h + 1.5, -b.r.s);
        // 着く ころの 頭の 位置へ（残りの 時間ぶん 先へ）
        head.z -= b.r.v * (b.T - b.t) * 0.92;
        b.m.position.lerpVectors(b.from, head, k); b.m.position.y += Math.sin(Math.PI * k) * 1.4;
        b.m.rotation.x += dt * 8; b.m.rotation.z += dt * 5;
        if (b.t > b.T + 0.25) { b.state = 'bonk'; b.v.set(0, 3, 2); b.life = 1.2; }
      } else {
        b.life -= dt;
        b.v.y -= 16 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 12;
        const gy = this.H(-b.m.position.z) + 0.22;
        if (b.m.position.y < gy) { b.m.position.y = gy; b.v.y = Math.abs(b.v.y) * 0.45; b.v.x *= 0.7; b.v.z *= 0.7; }
        if (b.state === 'swat' && b.life < 0.2 && !b.burst) { b.burst = true; if (this.fx) this.fx.starBurst(b.m.position.clone()); b.m.visible = false; }
        if (b.life <= 0) { this.root.remove(b.m); this.balls.splice(i, 1); }
      }
    }
  }
  waveMotion(ob, race, dt) {
    const u = ob.vis;
    // まだ 通っていない いちばん 近い ランナーが 着く 1.5秒前から 海から 寄せる
    let eta = Infinity;
    for (const r of race.runners) { if (r.s > ob.s + 0.5) continue; const e = (ob.s - r.s) / Math.max(r.v, 4); if (e < eta) eta = e; }
    const want = eta < 30 ? clamp(1 - (eta - 0.25) / 1.3, 0, 1) : 0;
    u.wave.k = want >= u.wave.k ? want : Math.max(want, u.wave.k - dt * 0.35);
    const k = u.wave.k;
    ob.group.position.x = lerp(17, 0.6, k);
    ob.group.scale.set(1, 0.55 + 0.45 * Math.sin(Math.min(1, k * 1.15) * Math.PI / 2), 1);
    if (this.fx && k > 0.05 && k < 0.999 && Math.random() < 0.6) { const p = ob.mesh.position; this.fx.splash(new V3(ob.group.position.x - 6.4 + Math.random() * 1.5, p.y + 0.6, p.z + (Math.random() - 0.5)), 1); }
    if (k > 0.3 && !u.wave.sound) { u.wave.sound = true; if (this.onWave) this.onWave(ob); }
    if (k < 0.05) u.wave.sound = false;
  }
  throwerMotion(ob, T, dt, t, race) {
    T.recoil = Math.max(0, T.recoil - dt * 3);
    // ふりかぶり：近くに ランナーが いるとき
    let near = Infinity; for (const r of race.runners) { const e = (ob.s - r.s) / Math.max(r.v, 4); if (e > 0 && e < near) near = e; }
    const wind = near < 2.2 ? clamp(1 - (near - 0.9) / 1.3, 0, 1) : 0;
    const k = Math.max(wind * 0.6, T.recoil);
    if (T.kind === 'cannon') { T.piv.scale.y = 1 - T.recoil * 0.18; T.piv.position.y = 0.55 - T.recoil * 0.05; }
    if (T.kind === 'crab') { T.claws.forEach((c, i) => { c.rotation.z = (i ? -1 : 1) * (0.5 + Math.sin(t * 6 + i) * 0.15) - (i ? -1 : 1) * k * 1.2; }); T.body.position.y = 0.45 + Math.abs(Math.sin(t * 5)) * 0.04; }
    if (T.kind === 'snowmanSmall') T.arm.rotation.z = ob.side * (0.6 + Math.sin(t * 4) * 0.1) - ob.side * (wind * 1.4 - T.recoil * 2.4);
    if (T.kind === 'robot') { T.arms.forEach((a, i) => { a.rotation.x = -(wind * 2.2) + T.recoil * 1.6 + Math.sin(t * 5 + i) * 0.1; }); T.eyeM.emissiveIntensity = 1.6 + Math.sin(t * 9) * 0.8; }
  }
  dispose() {
    this.clear(); this.scene.remove(this.root);
    [this.lineTex, this.chevTex, this.bangTex, this.markMat, this.chevMat, this.ballGeo].forEach(k => k.dispose());
  }
}
