// ThreeView：机・ノート・怪獣の3D描画と演出。ゲーム判定は持たない（見た目専用）。
import * as THREE from 'three';
import { GAME, QUALITY } from './config.js';

const TAU = Math.PI * 2;
const NO_SHAKE = true;   // ぜんしん版：画面ゆれを止める
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (t) => t * t * (3 - 2 * t);

// 位置から決まる揺らぎ（面ごとの頂点がずれないように同じ座標は同じ量だけ動かす）
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function jitter(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const kx = Math.round(x * 1000) / 1000, ky = Math.round(y * 1000) / 1000, kz = Math.round(z * 1000) / 1000;
    p.setXYZ(i,
      x + (hash3(kx, ky, kz) - 0.5) * amt,
      y + (hash3(ky, kz, kx) - 0.5) * amt,
      z + (hash3(kz, kx, ky) - 0.5) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  t.userData.canvas = c;
  return t;
}

// 手描き風の線（2回なぞる）
function sketchLine(g, pts, w, col, jit = 1.5, closed = false) {
  g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.lineWidth = w * (pass ? 0.6 : 1);
    g.globalAlpha = pass ? 0.55 : 0.95;
    g.beginPath();
    pts.forEach((p, i) => {
      const x = p[0] + (Math.random() - 0.5) * jit * (pass + 1), y = p[1] + (Math.random() - 0.5) * jit * (pass + 1);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    if (closed) g.closePath();
    g.stroke();
  }
  g.globalAlpha = 1;
}
function ellipsePts(cx, cy, rx, ry, n = 28, a0 = 0, a1 = TAU) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}

// 平面の落書き（タイトル・封印後）
export function drawDoodle(g, w, h, eyesOpen = true, glow = 0) {
  g.clearRect(0, 0, w, h);
  const s = w / 512;
  g.save(); g.scale(s, s);
  const ink = '#24365e';
  // しっぽ
  sketchLine(g, [[330, 350], [400, 330], [455, 360], [470, 330]], 7, ink, 2);
  // 背中のトゲ
  sketchLine(g, [[170, 150], [190, 105], [215, 140], [240, 92], [265, 135], [292, 98], [312, 145], [338, 118], [345, 170]], 6, ink, 2);
  // 胴
  sketchLine(g, ellipsePts(256, 300, 118, 112), 8, ink, 2.2, true);
  // おなか
  sketchLine(g, ellipsePts(256, 320, 70, 70, 20), 4, '#5a6c90', 2, true);
  // 頭
  sketchLine(g, [[160, 230], [150, 130], [205, 92], [310, 92], [362, 135], [352, 232]], 8, ink, 2.2);
  // 口
  sketchLine(g, [[190, 205], [256, 222], [322, 205]], 6, ink, 2);
  for (let i = 0; i < 5; i++) sketchLine(g, [[205 + i * 25, 210 + (i === 2 ? 4 : 0)], [215 + i * 25, 224], [225 + i * 25, 212]], 3, ink, 1);
  // 目
  if (eyesOpen) {
    for (const ex of [212, 300]) {
      g.fillStyle = glow > 0 ? `rgba(255,${200 - glow * 120},${60 - glow * 60},${0.4 + glow * 0.6})` : '#ffffff';
      g.beginPath(); g.ellipse(ex, 160, 22, 26, 0, 0, TAU); g.fill();
      sketchLine(g, ellipsePts(ex, 160, 22, 26, 18), 5, ink, 1.5, true);
      g.fillStyle = glow > 0.5 ? '#3a0a0a' : ink;
      g.beginPath(); g.arc(ex + 5, 165, 9, 0, TAU); g.fill();
    }
  } else {
    for (const ex of [212, 300]) sketchLine(g, [[ex - 20, 162], [ex, 170], [ex + 20, 162]], 5, ink, 1.5);
  }
  // 腕
  sketchLine(g, [[150, 270], [110, 300], [96, 290]], 7, ink, 2);
  sketchLine(g, [[362, 270], [402, 300], [416, 290]], 7, ink, 2);
  // 足
  sketchLine(g, [[200, 395], [195, 445], [160, 450]], 8, ink, 2);
  sketchLine(g, [[312, 395], [317, 445], [352, 450]], 8, ink, 2);
  // 胸の赤い消し残し
  g.fillStyle = 'rgba(216,52,59,0.75)';
  g.beginPath(); g.ellipse(256, 300, 26, 22, 0.2, 0, TAU); g.fill();
  g.strokeStyle = '#b8222a'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < 40; i++) { const a = i * 0.55; const r = 6 + (i % 7) * 3; g.lineTo(256 + Math.cos(a) * r * 1.1 + i * 0.2 - 4, 300 + Math.sin(a) * r * 0.85); }
  g.stroke();
  g.restore();
}

export class ThreeView {
  constructor(container) {
    this.container = container;
    this.ok = false;
    this.quality = 'high';
    this.reduceFx = false;
    this.time = 0;
    this.mode = 'title';
    this.modeT = 0;
    this.motionName = 'idle'; this.motionT = 0; this.motionDur = 0;
    this.hurtAmt = 0; this.hurtBig = 0; this.flash = 0;
    this.phase = 1;
    this.shakeAmp = 0; this.shakeT = 0;
    this.parallaxTarget = { x: 0, y: 0 }; this.parallax = { x: 0, y: 0 };
    this.pose = { lean: 0, head: 0, jaw: 0, armL: 0, armR: 0, hop: 0, squash: 1, tail: 0, twist: 0 };
    this.damageRatio = 0;
    this.blinkT = 2;
    this.eyeGlow = 0;
    this._v = new THREE.Vector3();
  }

  init() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      return false;
    }
    if (!this.renderer.getContext()) return false;
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.className = 'three-canvas';
    this.container.appendChild(r.domElement);
    r.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.onContextLost && this.onContextLost(); });
    r.domElement.addEventListener('webglcontextrestored', () => { this.lost = false; this.onContextRestored && this.onContextRestored(); });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6b4a33);
    this.scene.fog = new THREE.Fog(0x6b4a33, 26, 46);
    this.camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 100);
    this.camBase = new THREE.Vector3(0, 8.6, 9.4);
    this.camLook = new THREE.Vector3(0, 0.78, -0.9);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camLook);

    const hemi = new THREE.HemisphereLight(0xfff4e2, 0x5a4636, 1.25);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0dc, 1.7);
    sun.position.set(-5, 13, 7);
    sun.castShadow = true;
    sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.sun = sun;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xb8d0ff, 0.35);
    rim.position.set(6, 4, -8);
    this.scene.add(rim);

    this.buildDesk();
    this.buildNotebook();
    this.buildStationery();
    this.buildMonster();
    this.buildDoodle();
    this.buildParticles();
    this.ok = true;
    return true;
  }

  // ---------- 机とノート ----------
  buildDesk() {
    const wood = canvasTex(1024, 1024, (g, w, h) => {
      g.fillStyle = '#8a5f3e'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        const y = Math.random() * h;
        g.strokeStyle = `rgba(${60 + Math.random() * 40},${35 + Math.random() * 25},${20},${0.08 + Math.random() * 0.18})`;
        g.lineWidth = 1 + Math.random() * 4;
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + Math.sin(x * 0.003 + i * 2) * 14);
        g.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        g.strokeStyle = 'rgba(60,35,20,0.25)'; g.lineWidth = 2;
        for (let k = 1; k < 6; k++) { g.beginPath(); g.ellipse(x, y, k * 9, k * 4, 0, 0, TAU); g.stroke(); }
      }
    }, { repeat: [3, 3] });
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshLambertMaterial({ map: wood }));
    desk.rotation.x = -Math.PI / 2;
    desk.receiveShadow = true;
    this.scene.add(desk);
  }

  buildNotebook() {
    const W = 13.6, D = 9.4;
    this.pageW = W; this.pageD = D;
    const paper = canvasTex(2048, 1416, (g, w, h) => {
      g.fillStyle = '#fbf7ec'; g.fillRect(0, 0, w, h);
      // 紙の質感
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(120,100,70,${Math.random() * 0.035})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      // 罫線
      g.strokeStyle = 'rgba(95,150,215,0.55)'; g.lineWidth = 2.5;
      for (let y = 150; y < h - 20; y += 58) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      // 余白線
      g.strokeStyle = 'rgba(220,90,100,0.6)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(170, 0); g.lineTo(170, h); g.stroke();
      // リング穴
      g.fillStyle = '#d9cdb4';
      for (let i = 0; i < 17; i++) { g.beginPath(); g.ellipse(100 + i * queueX(w), 46, 16, 12, 0, 0, TAU); g.fill(); }
      function queueX(w) { return (w - 200) / 16; }
      // 端の小さな落書き
      g.strokeStyle = 'rgba(40,60,110,0.35)'; g.lineWidth = 3;
      g.beginPath(); g.arc(1880, 1300, 34, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(1850, 1290); g.lineTo(1870, 1270); g.moveTo(1890, 1270); g.lineTo(1910, 1290); g.stroke();
      g.font = '42px "Yomogi", cursive'; g.fillStyle = 'rgba(40,60,110,0.35)';
      g.fillText('6/14  ほうかご', 220, 120);
    });
    const pageMat = new THREE.MeshLambertMaterial({ map: paper });
    const page = new THREE.Mesh(new THREE.PlaneGeometry(W, D), pageMat);
    page.rotation.x = -Math.PI / 2;
    page.position.set(0, 0.16, -0.3);
    page.receiveShadow = true;
    this.scene.add(page);
    this.page = page;
    // 紙の束
    const stack = new THREE.Mesh(new THREE.BoxGeometry(W, 0.15, D), [
      new THREE.MeshLambertMaterial({ color: 0xece4d2 }), new THREE.MeshLambertMaterial({ color: 0xece4d2 }),
      new THREE.MeshLambertMaterial({ color: 0xf3ecdc }), new THREE.MeshLambertMaterial({ color: 0xece4d2 }),
      new THREE.MeshLambertMaterial({ color: 0xe6dcc6 }), new THREE.MeshLambertMaterial({ color: 0xe6dcc6 }),
    ]);
    stack.position.set(0, 0.08, -0.3);
    stack.castShadow = true; stack.receiveShadow = true;
    this.scene.add(stack);
    // 表紙（下にはみ出す）
    const cover = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.05, D + 0.3), new THREE.MeshLambertMaterial({ color: 0x3e6aa8 }));
    cover.position.set(0, 0.025, -0.3);
    cover.receiveShadow = true;
    this.scene.add(cover);
    // リング
    const ringMat = new THREE.MeshLambertMaterial({ color: 0xb8bcc4 });
    const ringGeo = new THREE.TorusGeometry(0.22, 0.04, 6, 14, Math.PI * 1.3);
    for (let i = 0; i < 17; i++) {
      const rg = new THREE.Mesh(ringGeo, ringMat);
      rg.position.set(-W / 2 + 0.65 + i * ((W - 1.3) / 16), 0.2, -0.3 - D / 2 + 0.3);
      rg.rotation.y = Math.PI / 2;
      rg.rotation.z = -0.3;
      rg.castShadow = true;
      this.scene.add(rg);
    }
    this.paperTex = paper;
  }

  buildStationery() {
    const g = new THREE.Group();
    // えんぴつ
    const pencil = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.4, 6), new THREE.MeshLambertMaterial({ color: 0xf2c230, flatShading: true }));
    body.rotation.z = Math.PI / 2;
    pencil.add(body);
    const wood = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), new THREE.MeshLambertMaterial({ color: 0xe8c79a, flatShading: true }));
    wood.rotation.z = -Math.PI / 2; wood.position.x = 2.45; pencil.add(wood);
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    lead.rotation.z = -Math.PI / 2; lead.position.x = 2.75; pencil.add(lead);
    const ferr = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 10), new THREE.MeshLambertMaterial({ color: 0xc8c8cc }));
    ferr.rotation.z = Math.PI / 2; ferr.position.x = -2.35; pencil.add(ferr);
    const er = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.35, 10), new THREE.MeshLambertMaterial({ color: 0xf08aa0 }));
    er.rotation.z = Math.PI / 2; er.position.x = -2.65; pencil.add(er);
    pencil.position.set(7.4, 0.17, -6.0);
    pencil.rotation.y = 0.55;
    pencil.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    g.add(pencil);
    // 消しゴム
    const eraser = new THREE.Group();
    const eb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.85), new THREE.MeshLambertMaterial({ color: 0xf6f6f2 }));
    eraser.add(eb);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.58, 0.88), new THREE.MeshLambertMaterial({ color: 0x3a7bd5 }));
    sleeve.position.x = 0.25; eraser.add(sleeve);
    eraser.position.set(-8.0, 0.28, -5.6);
    eraser.rotation.y = 0.5;
    eraser.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(eraser);
    this.eraserPos = eraser.position.clone();
    // クリップ
    const clipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.2, 0, 0), new THREE.Vector3(1.35, 0, 0.18), new THREE.Vector3(1.2, 0, 0.36),
      new THREE.Vector3(-0.15, 0, 0.36), new THREE.Vector3(-0.3, 0, 0.2), new THREE.Vector3(-0.15, 0, 0.07), new THREE.Vector3(0.95, 0, 0.07),
    ]);
    const clip = new THREE.Mesh(new THREE.TubeGeometry(clipCurve, 60, 0.035, 6), new THREE.MeshLambertMaterial({ color: 0xd0d4dc }));
    clip.position.set(-6.2, 0.2, -4.3);
    clip.rotation.y = 0.4;
    clip.castShadow = true;
    g.add(clip);
    // ペン
    const pen = new THREE.Group();
    const pb = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.6, 12), new THREE.MeshLambertMaterial({ color: 0x24365e }));
    pb.rotation.z = Math.PI / 2; pen.add(pb);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 1.2, 12), new THREE.MeshLambertMaterial({ color: 0x1b2846 }));
    cap.rotation.z = Math.PI / 2; cap.position.x = -1.4; pen.add(cap);
    const pclip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.06), new THREE.MeshLambertMaterial({ color: 0xc8ccd4 }));
    pclip.position.set(-1.3, 0.17, 0); pen.add(pclip);
    pen.position.set(-4.6, 0.16, -7.4);
    pen.rotation.y = -0.35;
    pen.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(pen);
    // 消しカス
    this.crumbs = [];
    const cm = new THREE.MeshLambertMaterial({ color: 0xe8e2d8 });
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12 + Math.random() * 0.12, 2, 5), cm);
      c.rotation.z = Math.PI / 2; c.rotation.y = Math.random() * TAU;
      c.position.set(-7.2 + Math.random() * 1.8, 0.03, -4.9 + Math.random() * 1.2);
      c.userData.base = c.position.clone();
      c.userData.ph = Math.random() * TAU;
      c.castShadow = true;
      g.add(c);
      this.crumbs.push(c);
    }
    this.scene.add(g);
  }

  // ---------- 怪獣 ----------
  buildMonster() {
    const hatch = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) {
        const x = Math.random() * w, y = Math.random() * h, L = 10 + Math.random() * 26;
        g.strokeStyle = `rgba(60,70,95,${0.05 + Math.random() * 0.12})`;
        g.lineWidth = 1 + Math.random() * 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + L * 0.8, y - L * 0.6); g.stroke();
      }
    }, { repeat: [2, 2] });
    this.hatch = hatch;
    this.outlineMat = new THREE.MeshBasicMaterial({ color: 0x1d2a44, side: THREE.BackSide });
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0x2a3a62, transparent: true, opacity: 0.85 });
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xdcd8cf, map: hatch, flatShading: true });
    const bellyMat = new THREE.MeshLambertMaterial({ color: 0xf2eee4, map: hatch, flatShading: true });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0xb9b4aa, map: hatch, flatShading: true });
    this.bodyMats = [bodyMat, bellyMat, darkMat];
    this.outlineParts = [];

    const part = (geo, mat, parent, pos = [0, 0, 0], opt = {}) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(pos[0], pos[1], pos[2]);
      if (opt.rot) m.rotation.set(opt.rot[0], opt.rot[1], opt.rot[2]);
      if (opt.scale) m.scale.set(opt.scale[0], opt.scale[1], opt.scale[2]);
      m.castShadow = true;
      parent.add(m);
      if (opt.outline !== false) {
        const o = new THREE.Mesh(geo, this.outlineMat);
        o.scale.setScalar(opt.outline || 1.07);
        m.add(o);
        this.outlineParts.push(o);
      }
      if (opt.edges !== false) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), this.edgeMat);
        m.add(e);
      }
      return m;
    };

    const root = new THREE.Group();
    root.position.set(0, 0.17, -3.05);
    this.scene.add(root);
    this.root = root;
    const rig = new THREE.Group();
    root.add(rig);
    this.rig = rig;
    const S = 0.95;
    rig.scale.setScalar(S);
    this.rigScale = S;

    // 足
    this.legs = [];
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.55, 0.62, 0.05);
      rig.add(leg);
      part(jitter(new THREE.CylinderGeometry(0.34, 0.4, 0.75, 7), 0.06), bodyMat, leg, [0, -0.25, 0]);
      part(jitter(new THREE.BoxGeometry(0.62, 0.24, 0.82), 0.05), darkMat, leg, [0, -0.55, 0.14]);
      for (let k = -1; k <= 1; k++) part(new THREE.ConeGeometry(0.07, 0.2, 4), bellyMat, leg, [k * 0.18, -0.6, 0.6], { rot: [Math.PI / 2, 0, 0], outline: 1.15, edges: false });
      this.legs.push(leg);
    }
    // 胴
    const torso = new THREE.Group();
    torso.position.set(0, 1.45, 0);
    rig.add(torso);
    this.torso = torso;
    part(jitter(new THREE.DodecahedronGeometry(1.0, 0), 0.12), bodyMat, torso, [0, 0, 0], { scale: [1.18, 1.05, 0.88] });
    part(jitter(new THREE.IcosahedronGeometry(0.66, 0), 0.08), bellyMat, torso, [0, -0.08, 0.5], { scale: [1.0, 1.05, 0.55], outline: 1.04 });
    // 胸の弱点
    this.chestCanvas = document.createElement('canvas');
    this.chestCanvas.width = this.chestCanvas.height = 256;
    this.chestTex = new THREE.CanvasTexture(this.chestCanvas);
    this.chestTex.colorSpace = THREE.SRGBColorSpace;
    this.drawChest(0);
    this.chestMat = new THREE.MeshBasicMaterial({ map: this.chestTex, transparent: true, depthWrite: false });
    const chest = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), this.chestMat);
    chest.position.set(0, 0.05, 0.86);
    chest.rotation.x = -0.12;
    torso.add(chest);
    this.chest = chest;
    // 弱点の光
    const glowTex = canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,90,90,0.9)'); gr.addColorStop(0.4, 'rgba(255,60,60,0.35)'); gr.addColorStop(1, 'rgba(255,40,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.0 }));
    this.glow.position.set(0, 0.05, 0.95);
    this.glow.scale.setScalar(1.4);
    torso.add(this.glow);
    this.chestAnchor = new THREE.Object3D();
    this.chestAnchor.position.set(0, 0.05, 0.9);
    torso.add(this.chestAnchor);
    // 背中のトゲ（紙の三角）
    const spikeMat = new THREE.MeshLambertMaterial({ color: 0xc9c3b6, flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      part(new THREE.ConeGeometry(0.2, 0.55, 3), spikeMat, torso, [0, 0.55 + Math.cos(a) * 0.45, -0.35 - Math.sin(Math.abs(a)) * 0.1 - 0.35 * (1 - Math.abs(a))], { rot: [-0.7 + a * 0.3, 0, 0], outline: 1.12 });
    }
    // しっぽ
    const tail = new THREE.Group();
    tail.position.set(0, -0.35, -0.75);
    torso.add(tail);
    this.tail = tail;
    let tp = tail;
    this.tailSegs = [];
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, 0, i === 0 ? 0 : -0.5);
      tp.add(seg);
      part(jitter(new THREE.ConeGeometry(0.34 - i * 0.09, 0.7, 6), 0.04), i === 2 ? darkMat : bodyMat, seg, [0, 0, -0.25], { rot: [-Math.PI / 2, 0, 0] });
      this.tailSegs.push(seg);
      tp = seg;
    }
    // 腕
    this.arms = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 1.0, 0.32, 0.28);
      torso.add(arm);
      part(jitter(new THREE.CylinderGeometry(0.17, 0.2, 0.62, 6), 0.03), bodyMat, arm, [0, -0.15, 0.2], { rot: [1.1, 0, -sx * 0.25] });
      const hand = new THREE.Group();
      hand.position.set(sx * 0.05, -0.32, 0.48);
      arm.add(hand);
      for (let k = -1; k <= 1; k++) part(new THREE.ConeGeometry(0.05, 0.22, 4), bellyMat, hand, [k * 0.09, -0.02, 0.08], { rot: [1.6, 0, 0], outline: 1.2, edges: false });
      this.arms.push(arm);
    }
    // 頭
    const neck = new THREE.Group();
    neck.position.set(0, 0.85, 0.18);
    torso.add(neck);
    this.neck = neck;
    const head = new THREE.Group();
    neck.add(head);
    this.head = head;
    part(jitter(new THREE.CylinderGeometry(0.88, 1.08, 1.1, 4, 1).rotateY(Math.PI / 4).scale(1.05, 1, 0.82), 0.1), bodyMat, head, [0, 0.52, 0]);
    part(jitter(new THREE.CylinderGeometry(0.5, 0.66, 0.5, 4, 1).rotateY(Math.PI / 4).scale(1.25, 1, 0.95), 0.06), bodyMat, head, [0, 0.27, 0.78]);
    for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.1, 0.05, 0.1), darkMat, head, [sx * 0.18, 0.53, 1.06], { outline: false, edges: false });
    // 歯
    for (let k = 0; k < 5; k++) part(new THREE.ConeGeometry(0.06, 0.16, 4), bellyMat, head, [-0.36 + k * 0.18, 0.02, 1.0], { rot: [Math.PI, 0, 0], outline: 1.15, edges: false });
    // あご
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.06, 0.2);
    head.add(jaw);
    this.jaw = jaw;
    part(jitter(new THREE.BoxGeometry(1.05, 0.24, 0.85), 0.05), darkMat, jaw, [0, -0.05, 0.45]);
    // 口の中
    const mouthIn = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ color: 0x2a1018 }));
    mouthIn.position.set(0, 0.04, 0.6); mouthIn.rotation.x = -Math.PI / 2 + 0.3;
    head.add(mouthIn);
    // 目
    this.eyeMats = [];
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const em = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 });
      this.eyeMats.push(em);
      const eye = part(new THREE.SphereGeometry(0.2, 10, 8), em, head, [sx * 0.38, 0.78, 0.6], { scale: [1, 1.15, 0.6], outline: 1.18, edges: false });
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1d2a44 }));
      pupil.position.set(sx * 0.03, -0.02, 0.15);
      eye.add(pupil);
      this.eyes.push(eye);
    }
    // 眉（紙片）
    for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.4, 0.07, 0.07), darkMat, head, [sx * 0.38, 1.05, 0.62], { rot: [0, 0, sx * 0.25], outline: 1.2, edges: false });
    // 発射口
    this.mouthAnchor = new THREE.Object3D(); this.mouthAnchor.position.set(0, 0.1, 1.15); head.add(this.mouthAnchor);
    this.mouthL = new THREE.Object3D(); this.mouthL.position.set(-0.45, 0.1, 1.0); head.add(this.mouthL);
    this.mouthR = new THREE.Object3D(); this.mouthR.position.set(0.45, 0.1, 1.0); head.add(this.mouthR);
    this.headTop = new THREE.Object3D(); this.headTop.position.set(0, 1.2, 0.3); head.add(this.headTop);
    // インクの吐息
    this.puffs = [];
    const pm = new THREE.MeshBasicMaterial({ color: 0x14161c, transparent: true });
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), pm.clone());
      p.visible = false;
      this.scene.add(p);
      this.puffs.push({ m: p, v: new THREE.Vector3(), life: 0 });
    }
    // 影を受ける
    rig.traverse(o => { if (o.isMesh && o.material !== this.outlineMat) o.receiveShadow = false; });
    // 見本の怪獣の部品をひとまとめにする（描いた怪獣と入れ替えるため）
    const def = new THREE.Group();
    while (rig.children.length) def.add(rig.children[0]);
    rig.add(def);
    this.defGroup = def;
    this.defAnchors = { mouthAnchor: this.mouthAnchor, mouthL: this.mouthL, mouthR: this.mouthR, headTop: this.headTop };
    this.custom = null;
  }

  // ---------- 描いた怪獣（紙の切り抜き） ----------
  setCustom(art) {
    this.clearCustom();
    const H0 = 3.3, Wmax = 4.4;
    let ph = H0, pw = H0 * art.aspect;
    if (pw > Wmax) { pw = Wmax; ph = Wmax / art.aspect; }
    const colorTex = new THREE.CanvasTexture(art.color); colorTex.colorSpace = THREE.SRGBColorSpace; colorTex.anisotropy = 4;
    const maskTex = new THREE.CanvasTexture(art.mask);
    const seg = [18, 26];
    // 下端（絵の足もと）がページに乗るように
    const footV = Math.min(1, art.bottomV + 0.01);
    const mkGeo = () => {
      const g = new THREE.PlaneGeometry(pw, ph, seg[0], seg[1]);
      g.translate(0, ph / 2 - (1 - footV) * ph, 0);
      return g;
    };
    const group = new THREE.Group();
    group.position.set(0, 0, 0.05);
    const front = new THREE.MeshLambertMaterial({ map: colorTex, alphaTest: 0.5, emissiveMap: colorTex, emissive: 0x8c8c8c });
    const rim = new THREE.MeshBasicMaterial({ map: maskTex, alphaTest: 0.5, color: this.outlineMat.color, side: THREE.DoubleSide });
    const back = new THREE.MeshLambertMaterial({ map: maskTex, alphaTest: 0.5, color: 0xe9e2d2, side: THREE.BackSide });
    const layers = [];
    const add = (mat, z, cast) => {
      const m = new THREE.Mesh(mkGeo(), mat);
      m.position.z = z; m.castShadow = cast; m.renderOrder = 2;
      group.add(m); layers.push(m);
      return m;
    };
    add(front, 0, true);
    for (let i = 1; i <= 4; i++) add(rim, -0.012 * i, false);
    add(back, -0.06, false);
    rim.color = this.outlineMat.color; // フェーズの輪郭色と連動
    const base = layers[0].geometry.attributes.position.array.slice();
    const uvToLocal = (u, v) => ({ x: (u - 0.5) * pw, y: (1 - v) * ph - (1 - footV) * ph });
    const neckY = uvToLocal(0.5, art.neckV).y;
    const mk = (u, v, z) => { const o = new THREE.Object3D(); const p = uvToLocal(u, v); o.userData.base = new THREE.Vector3(p.x, p.y, z); o.position.copy(o.userData.base); group.add(o); return o; };
    const anchors = {
      mouthAnchor: mk(art.mouth.u, art.mouth.v, 0.15),
      mouthL: mk(art.mouth.u - art.mouthSpread, art.mouth.v, 0.15),
      mouthR: mk(art.mouth.u + art.mouthSpread, art.mouth.v, 0.15),
      headTop: mk(art.headTop.u, art.headTop.v, 0.1),
    };
    // 弱点・光・胸の基準点を切り抜きへ移す
    const wp = uvToLocal(art.weak.u, art.weak.v);
    const wr = art.weak.r * ph;
    this._chestHome = { parent: this.chest.parent, chest: this.chest.position.clone(), glow: this.glow.position.clone(), anchor: this.chestAnchor.position.clone(), chestScale: this.chest.scale.clone(), rotX: this.chest.rotation.x };
    group.add(this.chest); group.add(this.glow); group.add(this.chestAnchor);
    this.chest.rotation.x = 0;
    this.chest.scale.setScalar(wr / 0.5);
    for (const [o, z] of [[this.chest, 0.025], [this.glow, 0.08], [this.chestAnchor, 0.05]]) {
      o.userData.base = new THREE.Vector3(wp.x, wp.y, z); o.position.copy(o.userData.base);
    }
    group.rotation.x = -0.18;
    this.rig.add(group);
    this.defGroup.visible = false;
    Object.assign(this, anchors);
    this.custom = { group, layers, base, neckY, pw, ph, front, colorTex, maskTex, anchors, movers: [...Object.values(anchors), this.chest, this.glow, this.chestAnchor] };
  }

  clearCustom() {
    const C = this.custom;
    if (!C) return;
    const H = this._chestHome;
    H.parent.add(this.chest); H.parent.add(this.glow); H.parent.add(this.chestAnchor);
    this.chest.position.copy(H.chest); this.glow.position.copy(H.glow); this.chestAnchor.position.copy(H.anchor);
    this.chest.scale.copy(H.chestScale); this.chest.rotation.x = H.rotX;
    this.rig.remove(C.group);
    C.layers.forEach(m => { m.geometry.dispose(); });
    C.front.dispose(); C.colorTex.dispose(); C.maskTex.dispose();
    this.defGroup.visible = true;
    Object.assign(this, this.defAnchors);
    this.custom = null;
  }

  // 平面の落書きを差しかえる（null で見本）
  setDoodleDrawer(fn) {
    this.doodleDrawer = fn;
    const draws = [[this.doodleTexOpen, true, 0], [this.doodleTexClosed, false, 0], [this.doodleTexGlow, true, 1]];
    for (const [tex, open, glow] of draws) {
      const c = tex.userData.canvas, g = c.getContext('2d');
      if (fn) fn(g, c.width, c.height, glow); else drawDoodle(g, c.width, c.height, open, glow);
      tex.needsUpdate = true;
    }
  }

  // 切り抜きを曲げて動きを出す（首から上の前後・左右の端のはばたき）
  bendPoint(x, y, z, P, out) {
    const C = this.custom;
    let ny = y, nz = z, nx = x;
    const halfW = C.pw / 2;
    const ax = Math.abs(x) / halfW;
    if (ax > 0.45) {
      const k = (ax - 0.45) / 0.55;
      const arm = x < 0 ? P.armL : P.armR;
      ny += -arm * 0.12 * k * C.ph * 0.25;
      nz += Math.sin(-arm * 0.5) * 0.25 * k;
    }
    if (y > C.neckY) {
      const d = y - C.neckY;
      const a = P.head;
      const st = 1 + P.jaw * 0.06;
      ny = C.neckY + d * Math.cos(a) * st + (ny - y);
      nz = nz + d * Math.sin(a);
    }
    out.x = nx; out.y = ny; out.z = nz;
    return out;
  }

  applyCustom(P, t) {
    const C = this.custom;
    const G = C.group;
    G.rotation.x = -0.18 + P.lean * 0.8;
    G.rotation.y = P.twist;
    G.rotation.z = Math.sin(t * 1.1) * 0.02;
    G.scale.set(1 + (1 - P.squash) * 0.5, P.squash, 1);
    const o = { x: 0, y: 0, z: 0 };
    for (const m of C.layers) {
      const pos = m.geometry.attributes.position;
      const b = C.base;
      for (let i = 0; i < pos.count; i++) {
        this.bendPoint(b[i * 3], b[i * 3 + 1], b[i * 3 + 2], P, o);
        pos.setXYZ(i, o.x, o.y, o.z);
      }
      pos.needsUpdate = true;
    }
    C.layers[0].geometry.computeVertexNormals();
    for (const a of C.movers) {
      const b = a.userData.base;
      this.bendPoint(b.x, b.y, 0, P, o);
      a.position.set(o.x, o.y, b.z + o.z);
    }
  }

  drawChest(ratio, big = 0) {
    const g = this.chestCanvas.getContext('2d');
    const w = 256;
    g.clearRect(0, 0, w, w);
    // 消し残しの赤
    const rnd = mulberry(7);
    g.fillStyle = 'rgba(216,52,59,0.88)';
    g.beginPath(); g.arc(128, 128, 96, 0, TAU); g.fill();
    g.strokeStyle = '#9e1c22'; g.lineCap = 'round';
    for (let i = 0; i < 28; i++) {
      g.lineWidth = 3 + rnd() * 4;
      g.beginPath();
      const a = rnd() * TAU, r = 30 + rnd() * 60;
      g.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      g.lineTo(128 + Math.cos(a + 0.6) * (r - 20), 128 + Math.sin(a + 0.6) * (r - 20));
      g.stroke();
    }
    g.fillStyle = 'rgba(255,190,190,0.6)';
    g.beginPath(); g.ellipse(100, 92, 26, 14, -0.6, 0, TAU); g.fill();
    // ひび（鉛筆線）
    const cracks = Math.floor(ratio * 14) + big;
    const r2 = mulberry(31);
    g.strokeStyle = '#1d2a44';
    for (let i = 0; i < cracks; i++) {
      g.lineWidth = i < big ? 6 : 3;
      let x = 128 + (r2() - 0.5) * 40, y = 128 + (r2() - 0.5) * 40;
      let a = r2() * TAU;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { a += (r2() - 0.5) * 1.2; x += Math.cos(a) * 22; y += Math.sin(a) * 22; g.lineTo(x, y); }
      g.stroke();
    }
    this.chestTex && (this.chestTex.needsUpdate = true);
  }

  buildDoodle() {
    this.doodleTexOpen = canvasTex(512, 512, (g, w, h) => drawDoodle(g, w, h, true, 0));
    this.doodleTexClosed = canvasTex(512, 512, (g, w, h) => drawDoodle(g, w, h, false, 0));
    this.doodleTexGlow = canvasTex(512, 512, (g, w, h) => drawDoodle(g, w, h, true, 1));
    const geo = new THREE.PlaneGeometry(4.2, 4.2, 20, 20);
    this.doodleBase = geo.attributes.position.array.slice();
    this.doodleMat = new THREE.MeshLambertMaterial({ map: this.doodleTexOpen, transparent: true, depthWrite: false });
    const d = new THREE.Mesh(geo, this.doodleMat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(0, 0.17, -2.6);
    d.renderOrder = 1;
    this.scene.add(d);
    this.doodle = d;
  }

  setDoodleBulge(b) {
    const pos = this.doodle.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = this.doodleBase[i * 3], y = this.doodleBase[i * 3 + 1];
      const r = Math.hypot(x, y) / 2.1;
      pos.setZ(i, b * Math.max(0, 1 - r * r) * 1.0);
    }
    pos.needsUpdate = true;
    this.doodle.geometry.computeVertexNormals();
  }

  buildParticles() {
    this.chipMax = 250;
    const geo = new THREE.PlaneGeometry(0.22, 0.16);
    const mat = new THREE.MeshLambertMaterial({ color: 0xf4f0e6, side: THREE.DoubleSide });
    this.chips = new THREE.InstancedMesh(geo, mat, this.chipMax);
    this.chips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chips.count = 0;
    this.chips.castShadow = true;
    this.chips.frustumCulled = false;
    this.scene.add(this.chips);
    this.chipData = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3();
  }

  spawnChips(n, origin, spread = 1, up = 3) {
    const q = QUALITY[this.quality].particles * (this.reduceFx ? 0.4 : 1);
    n = Math.round(n * q);
    for (let i = 0; i < n && this.chipData.length < this.chipMax; i++) {
      this.chipData.push({
        p: new THREE.Vector3(origin.x + (Math.random() - 0.5) * spread, origin.y + (Math.random() - 0.5) * spread, origin.z + (Math.random() - 0.5) * spread * 0.6),
        v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * up, (Math.random() - 0.2) * 2.5),
        r: new THREE.Vector3(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU),
        w: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        life: 2.5 + Math.random() * 1.5, s: 0.6 + Math.random() * 0.8,
      });
    }
  }

  puff(at, n = 6, color = 0x14161c) {
    for (let i = 0; i < n; i++) {
      const p = this.puffs.find(q => q.life <= 0);
      if (!p) break;
      p.m.material.color.setHex(color);
      p.m.position.copy(at);
      p.v.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.2) * 1.2, 0.8 + Math.random() * 1.5);
      p.life = 0.45 + Math.random() * 0.2;
      p.m.visible = true;
      p.m.scale.setScalar(0.6 + Math.random() * 0.8);
    }
  }

  // ---------- 外部API ----------
  setQuality(q) {
    this.quality = q;
    const Q = QUALITY[q];
    this.renderer.shadowMap.enabled = Q.shadow > 0;
    this.sun.castShadow = Q.shadow > 0;
    if (Q.shadow > 0) {
      this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.needsUpdate = true); } });
    this.hatch.repeat.set(Q.particles >= 0.6 ? 2 : 1, Q.particles >= 0.6 ? 2 : 1);
    if (this._size) this.resize(this._size.w, this._size.h);
  }

  resize(w, h) {
    this._size = { w, h };
    const pr = Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].pr);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setMode(mode, opt = {}) {
    this.mode = mode;
    this.modeT = 0;
    this.modeOpt = opt;
    if (mode === 'title') {
      this.rig.visible = false;
      this.doodle.visible = true;
      this.doodleMat.opacity = 1;
      this.doodleMat.map = this.doodleTexOpen;
      this.setDoodleBulge(0);
      this.rig.scale.setScalar(this.rigScale);
      this.root.position.y = 0.17;
      this.setPhase(1);
      this.damageRatio = 0;
      this.drawChest(0);
      this.chipData.length = 0;
    } else if (mode === 'intro') {
      this.rig.visible = false;
      this.doodle.visible = true;
      this.doodleMat.opacity = 1;
      this.setDoodleBulge(0);
      this.setPhase(1);
      this.damageRatio = 0;
      this.drawChest(0);
    } else if (mode === 'battle') {
      this.rig.visible = true;
      this.doodle.visible = false;
      this.rig.scale.setScalar(this.rigScale);
      this.root.position.y = 0.17;
    } else if (mode === 'sealed') {
      // 撃破：紙片化してノートへ吸い込まれる
      this.motionName = 'idle';
      this.doodle.visible = true;
      this.doodleMat.opacity = 0;
      this.doodleMat.map = this.doodleTexClosed;
      this.setDoodleBulge(0);
    } else if (mode === 'won') {
      this.motionName = 'victoryPose';
    }
  }

  motion(name, dur = 0.5) { this.motionName = name; this.motionT = 0; this.motionDur = dur; }
  hurt(big = false) { this.hurtAmt = 1; this.hurtBig = big ? 1 : 0; this.flash = 1; }
  setDamage(ratio, big = 0) { this.damageRatio = ratio; this.bigCracks = (this.bigCracks || 0) + big; this.drawChest(ratio, this.bigCracks); }
  resetDamage() { this.bigCracks = 0; this.drawChest(0); }
  setPhase(n) {
    this.phase = n;
    const col = [0x1d2a44, 0x3b2c6e, 0x6c1f2c][n - 1] || 0x1d2a44;
    this.outlineMat.color.setHex(col);
    this.edgeMat.color.setHex([0x2a3a62, 0x4a3a86, 0x8a2a3a][n - 1] || 0x2a3a62);
  }
  shake(amp, dur = 0.2) {
    // ぜんしん版：画面を揺らさない（体を動かしながら見ると 酔いやすい）
    if (this.reduceFx || NO_SHAKE) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, dur);
  }
  setParallax(nx, ny) { this.parallaxTarget.x = nx; this.parallaxTarget.y = ny; }

  // 3D座標 → 仮想画面座標（960×540）
  screenOf(obj) {
    obj.updateWorldMatrix(true, false);
    const v = this._v.setFromMatrixPosition(obj.matrixWorld);
    v.project(this.camera);
    return { x: (v.x + 1) / 2 * GAME.VW, y: (1 - v.y) / 2 * GAME.VH };
  }
  anchors() {
    return {
      mouth: this.screenOf(this.mouthAnchor),
      mouthL: this.screenOf(this.mouthL),
      mouthR: this.screenOf(this.mouthR),
      chest: this.screenOf(this.chestAnchor),
      headTop: this.screenOf(this.headTop),
    };
  }
  worldOf(obj) { obj.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld); }
  // 仮想画面座標 → ページ上の3D点
  pagePoint(x, y) {
    const ndc = new THREE.Vector3(x / GAME.VW * 2 - 1, -(y / GAME.VH * 2 - 1), 0.5);
    ndc.unproject(this.camera);
    const dir = ndc.sub(this.camera.position).normalize();
    const t = (0.17 - this.camera.position.y) / dir.y;
    return this.camera.position.clone().add(dir.multiplyScalar(t));
  }

  // ---------- 更新 ----------
  update(dt) {
    if (!this.ok) return;
    this.time += dt;
    this.modeT += dt;
    const t = this.time;
    const P = this.pose;

    // カメラ（視差・振動）
    this.parallax.x = lerp(this.parallax.x, this.parallaxTarget.x, Math.min(1, dt * 3));
    this.parallax.y = lerp(this.parallax.y, this.parallaxTarget.y, Math.min(1, dt * 3));
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT) * 5;
      sx = (Math.random() - 0.5) * a; sy = (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    this.camera.position.set(this.camBase.x + this.parallax.x * 0.5 + sx, this.camBase.y + this.parallax.y * 0.25 + sy, this.camBase.z);
    this.camera.lookAt(this.camLook.x + sx * 0.5, this.camLook.y + sy * 0.5, this.camLook.z);

    // 消しカスのそよぎ
    for (const c of this.crumbs) {
      c.position.x = c.userData.base.x + Math.sin(t * 0.7 + c.userData.ph) * 0.04;
      c.rotation.y += dt * 0.1 * Math.sin(c.userData.ph);
    }

    // モード別
    if (this.mode === 'title') {
      this.blinkT -= dt;
      if (this.blinkT < 0) { this.doodleMat.map = this.doodleTexClosed; if (this.blinkT < -0.14) { this.doodleMat.map = this.doodleTexOpen; this.blinkT = 2 + Math.random() * 3; } }
    } else if (this.mode === 'intro') {
      const short = this.modeOpt && this.modeOpt.short;
      const k = short ? 0.5 : 1;
      const T = this.modeT;
      if (T < 0.8 * k) { this.doodleMat.map = this.doodleTexGlow; this.setDoodleBulge(0); }
      else if (T < 1.4 * k) {
        const b = (T - 0.8 * k) / (0.6 * k);
        this.setDoodleBulge(ease(b) * 0.9);
        this.root.position.x = (Math.random() - 0.5) * 0.04;
      } else {
        if (!this._popped) { this._popped = true; this.rig.visible = true; this.spawnChips(40, new THREE.Vector3(0, 0.6, -3.0), 2.4, 4); this.onIntroPop && this.onIntroPop(); }
        const b = clamp01((T - 1.4 * k) / (0.7 * k));
        const s = this.rigScale * (b < 0.7 ? ease(b / 0.7) * 1.08 : lerp(1.08, 1, (b - 0.7) / 0.3));
        this.rig.scale.set(this.rigScale * (0.6 + 0.4 * ease(b)), Math.max(0.02, s), this.rigScale * (0.6 + 0.4 * ease(b)));
        this.doodleMat.opacity = 1 - b;
        this.setDoodleBulge(0.9 * (1 - b));
        this.root.position.x = 0;
      }
      if (T < 1.4 * k) this._popped = false;
    } else if (this.mode === 'sealed') {
      const T = this.modeT;
      if (T < 0.6) {
        P.lean = lerp(P.lean, -0.25, dt * 4);
        this.root.position.x = (Math.random() - 0.5) * 0.06 * (1 - T / 0.6);
        if (Math.random() < 0.5) this.spawnChips(2, this.worldOf(this.chestAnchor), 1.6, 2);
      } else if (T < 1.8) {
        const b = ease((T - 0.6) / 1.2);
        this.rig.scale.set(this.rigScale * (1 + b * 0.3), this.rigScale * Math.max(0.02, 1 - b), this.rigScale * (1 - b * 0.6));
        this.root.position.x = 0;
        if (Math.random() < 0.7) this.spawnChips(3, this.worldOf(this.chestAnchor), 2.0, 1.5);
        this.doodleMat.opacity = b;
      } else {
        this.rig.visible = false;
        this.doodleMat.opacity = 1;
      }
    }

    // ポーズ計算
    this.motionT += dt;
    const m = this.motionName;
    const mt = this.motionDur > 0 ? clamp01(this.motionT / this.motionDur) : 1;
    const target = { lean: 0, head: Math.sin(t * 1.3) * 0.05, jaw: 0.04 + Math.sin(t * 2.1) * 0.03, armL: Math.sin(t * 1.7) * 0.12, armR: Math.sin(t * 1.7 + 1) * 0.12, hop: 0, squash: 1 + Math.sin(t * 2.4) * 0.02, tail: Math.sin(t * 1.5) * 0.3, twist: 0 };
    switch (m) {
      case 'chargeMouth': target.head = -0.35; target.lean = -0.1; target.jaw = 0.35; target.squash = 1.04; break;
      case 'fire': target.head = 0.25 * (1 - mt); target.lean = 0.12 * (1 - mt); target.jaw = 0.75 * (1 - mt * 0.7); if (mt >= 1) this.motionName = 'idle'; break;
      case 'chargeTwin': target.head = -0.25; target.jaw = 0.5; target.twist = Math.sin(t * 9) * 0.06; break;
      case 'chargeArm': target.armR = -2.3; target.armL = -0.4; target.lean = -0.12; target.twist = 0.25; break;
      case 'swipe': target.armR = 1.0; target.lean = 0.2; target.twist = -0.25; if (mt >= 1) this.motionName = 'idle'; break;
      case 'chargeSpray': target.head = -0.8; target.jaw = 0.8; target.lean = -0.18; target.armL = -0.7; target.armR = -0.7; break;
      case 'spray': target.head = -0.9; target.jaw = 0.9; target.lean = -0.2; target.squash = 1 + Math.sin(t * 20) * 0.03; if (mt >= 1) this.motionName = 'idle'; break;
      case 'happy': target.hop = Math.abs(Math.sin(mt * Math.PI * 2)) * 0.3; target.armL = -1.4; target.armR = -1.4; target.jaw = 0.5; if (mt >= 1) this.motionName = 'idle'; break;
      case 'roar': target.head = -0.6; target.jaw = 0.9; target.armL = -1.0; target.armR = -1.0; target.squash = 1 + Math.sin(t * 30) * 0.03; if (mt >= 1) this.motionName = 'idle'; break;
      case 'victoryPose': target.hop = Math.abs(Math.sin(t * 6)) * 0.35; target.armL = -2.4; target.armR = -2.4; target.jaw = 0.6; target.head = -0.2; break;
    }
    // ひるみ（加算）
    if (this.hurtAmt > 0) {
      const h = this.hurtAmt;
      target.lean -= (this.hurtBig ? 0.5 : 0.18) * h;
      target.head -= (this.hurtBig ? 0.4 : 0.12) * h;
      target.jaw += 0.3 * h;
      target.twist += Math.sin(t * 40) * 0.05 * h;
      if (this.hurtBig) target.squash -= 0.08 * h;
      this.hurtAmt = Math.max(0, this.hurtAmt - dt * (this.hurtBig ? 1.6 : 3.2));
    }
    const k = Math.min(1, dt * 14);
    for (const key in target) P[key] = lerp(P[key], target[key], k);

    this.torso.rotation.x = P.lean;
    this.torso.rotation.y = P.twist;
    this.torso.scale.y = P.squash;
    this.head.rotation.x = P.head;
    this.jaw.rotation.x = P.jaw;
    this.arms[0].rotation.x = P.armL;
    this.arms[1].rotation.x = P.armR;
    this.rig.position.y = P.hop;
    this.tail.rotation.y = P.tail;
    this.tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(t * 1.5 - i * 0.6) * 0.2; s.rotation.x = 0.15; });
    this.legs[0].rotation.x = P.hop * 0.6; this.legs[1].rotation.x = P.hop * 0.6;

    // 胸の点滅・発光
    this.flash = Math.max(0, this.flash - dt * 5);
    const ph = this.phase;
    const glowBase = ph === 1 ? 0.25 : ph === 2 ? 0.5 : 0.8;
    const pulse = 0.5 + 0.5 * Math.sin(t * (ph === 3 ? 7 : 4));
    this.glow.material.opacity = Math.min(1, glowBase * (0.6 + 0.4 * pulse) + this.flash * 0.8);
    this.glow.scale.setScalar(1.2 + ph * 0.25 + this.flash * 0.6);
    const f = this.flash;
    this.chestMat.color.setRGB(1, 1 - f * 0.0, 1 - f * 0.0);
    this.bodyMats[0].emissive && this.bodyMats[0].emissive.setRGB(f * 0.35, f * 0.12, f * 0.12);
    if (this.custom) {
      this.custom.front.emissive.setRGB(0.55 + f * 0.45, 0.55 - f * 0.1, 0.55 - f * 0.1);
      this.applyCustom(P, t);
    }

    // 目の光
    const eg = this.eyeGlow;
    this.eyeMats.forEach(mm => mm.emissive.setRGB(eg * 1.0, eg * 0.65, eg * 0.15));

    // 紙片
    let n = 0;
    for (let i = this.chipData.length - 1; i >= 0; i--) {
      const c = this.chipData[i];
      c.life -= dt;
      if (c.life <= 0) { this.chipData.splice(i, 1); continue; }
      c.v.y -= 6 * dt;
      c.v.multiplyScalar(1 - dt * 1.2);
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < 0.2) { c.p.y = 0.2; c.v.set(0, 0, 0); c.w.multiplyScalar(0.0); }
      c.r.addScaledVector(c.w, dt);
    }
    for (const c of this.chipData) {
      this._e.set(c.r.x, c.r.y, c.r.z);
      this._q.setFromEuler(this._e);
      const s = c.s * Math.min(1, c.life * 2);
      this._s.set(s, s, s);
      this._m.compose(c.p, this._q, this._s);
      this.chips.setMatrixAt(n++, this._m);
    }
    this.chips.count = n;
    this.chips.instanceMatrix.needsUpdate = true;

    // 吐息
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.material.opacity = Math.max(0, p.life * 2);
      p.m.scale.multiplyScalar(1 + dt * 1.5);
      if (p.life <= 0) p.m.visible = false;
    }
  }

  render() {
    if (!this.ok || this.lost) return;
    this.renderer.render(this.scene, this.camera);
  }
}

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
