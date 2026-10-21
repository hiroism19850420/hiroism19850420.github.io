// 3D の 特別な 場面（7.5、7.6、7.15、21.15）
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { World } from './world.js';
import { KartModel, CHARS, CHAR_IDS } from './models.js';
import { Cam } from './camera.js';
import { CFG } from './config.js';
import { damp, lerp, clamp } from './util.js';
import { canvas, texture } from './tex.js';

const V3 = THREE.Vector3;
const FONT = `'M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Yu Gothic',sans-serif`;

export const Stages = {
  root: null, karts: [], mode: null, t: 0,
  clear() {
    if (this.root) { World.scene.remove(this.root); this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    this.root = null; this.karts = []; this.mode = null; this.light && World.scene.remove(this.light); this.light = null;
  },
  ensure() { if (!this.root) { this.root = new THREE.Group(); this.root.name = 'stage'; World.scene.add(this.root); } },
  addKart(id, night) { const m = new KartModel(id, { night }); this.root.add(m.group); const k = { m, id, t: Math.random() * 5, look: 0, wave: false, banzai: false, face: 'normal' }; this.karts.push(k); return k; },
  poseIdle(k, dt, t, o = {}) {
    k.t += dt;
    const look = Math.sin(k.t * 0.7) * 0.5 + (Math.sin(k.t * 0.23) > 0.8 ? 0.6 : 0);
    k.m.pose({ v: 0, steer: o.steer ?? Math.sin(k.t * 0.5) * 0.15, throttle: o.throttle ?? 0.1, pedalA: (o.pedal ?? k.t * 1.5), lookYaw: o.look ?? look * 0.6, face: o.face || k.face, wave: o.wave ?? k.wave, banzai: o.banzai ?? k.banzai, crouch: o.crouch, clap: o.clap, accelY: o.accelY || 0, accelX: 0, boost: o.boost }, dt, t);
  },

  // ---------- タイトル：スタートの列 ----------
  titleGrid(course3d, playerChar) {
    this.clear(); this.ensure(); this.mode = 'title';
    const tr = course3d.track, night = !!course3d.course.night;
    const ids = [...CHAR_IDS.filter(c => c !== playerChar), playerChar];
    ids.forEach((id, i) => {
      const k = this.addKart(id, night);
      const [s, d] = CFG.race.GRID[i];
      place(k.m.group, tr, tr.wrapS(s), d);
      k.wave = i % 2 === 0 && Math.random() < 0.5;
    });
    const c = tr.pos(tr.wrapS(-17), 0, 0, new V3());
    Cam.setOrbit(c, CFG.cam.TITLE_R, CFG.cam.TITLE_H, Math.PI * 2 / CFG.cam.TITLE_T, 1);
    Cam.orbit.a = Math.PI * 0.8;
  },

  // ---------- キャラえらび ----------
  charSelect(course3d, index) {
    this.clear(); this.ensure(); this.mode = 'char';
    const tr = course3d.track;
    // スタートから 少し はなれた 草地
    const base = tr.pos(tr.wrapS(70), -(course3d.course.width / 2 + course3d.course.shoulder + 46), 0, new V3());
    base.y = course3d.terrain.heightAt(base.x, base.z) + 0.05;
    this.center = base;
    const ring = new THREE.Group(); ring.position.copy(base); this.root.add(ring); this.ring = ring;
    const R = 7;
    CHAR_IDS.forEach((id, i) => {
      const a = i / 6 * Math.PI * 2;
      const ped = new THREE.Group(); ped.position.set(Math.sin(a) * R, 0, Math.cos(a) * R); ring.add(ped);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.3, 32), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
      top.position.y = 0.15; top.receiveShadow = true; top.castShadow = true; ped.add(top);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 40), new THREE.MeshStandardMaterial({ color: CHARS[id].kart, roughness: 0.4, emissive: CHARS[id].kart, emissiveIntensity: 0.2 }));
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; ped.add(rim);
      const k = this.addKart(id, false); ped.add(k.m.group); k.m.group.position.y = 0.3; k.m.group.rotation.y = a;
      k.ped = ped; k.a = a;
    });
    this.sel = index; this.ringA = Math.PI - index / 6 * Math.PI * 2; ring.rotation.y = this.ringA;
    // 手前（-z がわ）を 照らす。カメラは コースに 背を向け、草原と 遠くの山を 背景にする
    const sl = new THREE.SpotLight('#ffffff', 60, 30, 0.45, 0.6); this.light = sl;
    const front = new V3(0, 0, -R).add(base);
    sl.position.set(front.x, base.y + 9, front.z - 6); sl.target.position.copy(front); World.scene.add(sl, sl.target);
    const camP = new V3(base.x, base.y + 2.3, base.z - R - 7.4), look = new V3(base.x, base.y + 0.15, base.z - R);
    Cam.setFixed(camP, look, 42);
    this.picked = -1;
  },
  charSelectSet(i) { this.sel = i; },
  charPicked(i) { this.picked = i; this.pickT = 0; },

  // ---------- じゅんびの 回転台 ----------
  prep(course3d, id) {
    this.clear(); this.ensure(); this.mode = 'prep';
    const tr = course3d.track;
    const base = tr.pos(tr.wrapS(-10), -(course3d.course.width / 2 + course3d.course.shoulder + 40), 0, new V3());
    base.y = course3d.terrain.heightAt(base.x, base.z) + 0.05;
    const ped = new THREE.Group(); ped.position.copy(base); this.root.add(ped); this.ped = ped;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.3, 0.3, 40), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 })); top.position.y = 0.15; top.receiveShadow = true; ped.add(top);
    const k = this.addKart(id, false); ped.add(k.m.group); k.m.group.position.y = 0.3;
    this.prepKart = k; this.spin = 0; this.hold = false;
    // 左に 鏡が 出るので、回転台は 画面の 右がわに 見せる
    const camP = new V3(base.x + 3.0, base.y + 2.3, base.z + 4.2);
    const right = new V3(4.2, 0, -3.0).normalize();
    const look = new V3(base.x, base.y + 0.9, base.z).addScaledVector(right, -1.5);
    Cam.setFixed(camP, look, 45);
  },

  // ---------- 表彰台（夜の 公園） ----------
  podium(course3d, ranking, playerId) {
    this.clear(); this.ensure(); this.mode = 'podium';
    const c = course3d.course;
    let base;
    const fer = (c.scenery.props || []).find(p => p.kind === 'ferris');
    if (fer) base = new V3(fer.at[0], 0, fer.at[1] + 26);
    else base = course3d.track.pos(course3d.track.wrapS(-10), -(c.width / 2 + c.shoulder + 40), 0, new V3());
    base.y = course3d.terrain.heightAt(base.x, base.z) + 0.05;
    this.center = base;
    const grp = new THREE.Group(); grp.position.copy(base); this.root.add(grp);
    // 台
    const H = [1.6, 1.1, 0.8], X = [0, -2.6, 2.6], rimC = ['#ffd54a', '#e6edf5', '#ffb37a'];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new RoundedBoxGeometry(2.4, H[i], 2.4, 3, 0.12), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
      b.position.set(X[i], H[i] / 2, 0); b.castShadow = b.receiveShadow = true; grp.add(b);
      // 色の 帯と 天板（台の 上面と 同じ 高さに 置くと ちらつくので ずらす）
      const rimM = new THREE.MeshStandardMaterial({ color: rimC[i], roughness: 0.3, metalness: 0.5 });
      const r = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.16, 2.46), rimM); r.position.set(X[i], H[i] - 0.24, 0); grp.add(r);
      const cap = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.06, 2.2, 2, 0.02), rimM); cap.position.set(X[i], H[i] + 0.02, 0); cap.receiveShadow = true; grp.add(cap);
      const nt = numTex(i + 1, rimC[i]);
      const n = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshStandardMaterial({ map: nt, transparent: true, roughness: 0.5 })); n.position.set(X[i], H[i] * 0.5, 1.21); grp.add(n);
    }
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c0283a', roughness: 0.9 })); carpet.position.set(0, 0.02, 7); carpet.receiveShadow = true; grp.add(carpet);
    // 幕
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(14, 6, 40, 1), new THREE.MeshStandardMaterial({ color: '#8a1a2e', roughness: 0.8, side: THREE.DoubleSide }));
    { const p = curtain.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.2) * 0.25); curtain.geometry.computeVertexNormals(); }
    curtain.position.set(0, 3, -3); grp.add(curtain);
    for (const x of [-6.5, -3.5, 3.5, 6.5]) { const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe9a0', emissiveIntensity: 1.2 })); lp.position.set(x, 3.5, -2.6); grp.add(lp); }
    // トロフィー
    const prof = [[0, 0], [0.3, 0], [0.3, 0.06], [0.1, 0.1], [0.08, 0.35], [0.12, 0.42], [0.34, 0.6], [0.4, 0.95], [0.42, 1.0], [0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd54a', metalness: 1.0, roughness: 0.25, envMapIntensity: 1.4 });
    const trophy = new THREE.Group();
    trophy.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 32), gold));
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 16, Math.PI), gold); h.position.set(s * 0.42, 0.72, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; trophy.add(h); }
    const tb = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.3, 0.8, 2, 0.05), new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: 0.6 })); tb.position.y = -0.15; trophy.add(tb);
    trophy.scale.setScalar(0.9); trophy.position.set(0, 9, 0.2); grp.add(trophy);
    this.trophy = trophy; this.trophyY = H[0] + 2.75;
    // キャラ
    this.ranked = ranking.map((r, i) => {
      const k = this.addKart(r.id, true);
      // 1〜3いは 台の 前で 待つ。4いから下は 台の 両わきで 拍手する（重ならないように）
      const SIDE = [[-5.2, -0.2, 0.5], [5.3, 1.2, -0.5], [-5.6, 2.9, 0.35]];
      const start = i < 3 ? new V3(X[i], 0, 3.4) : new V3(SIDE[i - 3][0], 0, SIDE[i - 3][1]);
      const end = i < 3 ? new V3(X[i], H[i] + 0.05, 0) : start.clone();
      k.m.group.position.copy(start); k.m.group.rotation.y = i < 3 ? 0 : SIDE[i - 3][2]; grp.add(k.m.group);
      k.start = start; k.end = end; k.climbT = -1; k.rank = i + 1; k.isPlayer = r.id === playerId;
      return k;
    });
    this.grp = grp; this.t = 0;
    const sl = new THREE.SpotLight('#fff6e0', 120, 40, 0.5, 0.5); sl.position.set(base.x, base.y + 14, base.z + 10); sl.target.position.set(base.x, base.y + 1, base.z); World.scene.add(sl, sl.target); this.light = sl;
    this.camShot(0);
  },
  climb(rank) { const k = this.ranked[rank - 1]; if (k) { k.climbT = 0; k.face = 'happy'; } },
  trophyDown() { this.trophyT = 0; },
  camShot(n) {
    const b = this.center;
    if (n === 0) Cam.setFixed(new V3(b.x, b.y + 4, b.z + 14), new V3(b.x, b.y + 1.5, b.z), 48);
    else if (n === 1) Cam.setFixed(new V3(b.x, b.y + 3, b.z + 10), new V3(b.x, b.y + 2.0, b.z), 48);
    else Cam.setPath((dt, C) => { this.camA = (this.camA || 0) + dt * 0.25; const a = Math.sin(this.camA) * 0.17; C.pos.set(b.x + Math.sin(a) * 5.5, b.y + 3.6, b.z + Math.cos(a) * 5.5); C.look.set(b.x, b.y + 2.4, b.z); C.fov = 46; });
  },

  update(dt, t) {
    if (!this.root) return;
    this.t += dt;
    if (this.mode === 'title') for (const k of this.karts) this.poseIdle(k, dt, t, { wave: k.wave && Math.sin(k.t * 0.8) > 0.3 });
    if (this.mode === 'char') {
      const want = Math.PI - this.sel / 6 * Math.PI * 2;
      let d = want - this.ringA; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.ringA += d * (1 - Math.exp(-dt / 0.12));
      this.ring.rotation.y = this.ringA;
      this.karts.forEach((k, i) => {
        const front = i === this.sel;
        // みんな 外がわを 向く（手前の キャラは カメラを 向く）
        k.m.group.rotation.y = k.a;
        const picked = this.picked === i;
        this.poseIdle(k, dt, t, { wave: front && !picked && Math.sin(k.t * 1.2) > 0, banzai: picked, face: picked || front ? 'happy' : 'normal', look: front ? 0 : undefined });
      });
    }
    if (this.mode === 'prep') {
      const k = this.prepKart, B = this.body || {};
      if (!this.hold) this.spin += dt * Math.PI * 2 / 12;
      else this.spin = damp(this.spin, Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2 + 0.6, 0.4, dt);
      this.ped.rotation.y = this.spin;
      k.m.group.position.z = (B.throttle || 0) * 0.3;
      if (B.air) this.airT = 0.3;
      this.airT = Math.max(0, (this.airT || 0) - dt);
      k.m.group.position.y = 0.3 + (this.airT > 0 ? Math.sin((0.3 - this.airT) / 0.3 * Math.PI) * 0.45 : 0);
      if (this.landPending && this.airT <= 0) { this.landPending = false; k.m.land(5); }
      if (B.air) this.landPending = true;
      k.pedal = (k.pedal || 0) + (B.throttle || 0) * 2.2 * Math.PI * 2 * dt;
      this.poseIdle(k, dt, t, { steer: B.steer || 0, throttle: B.throttle || 0, pedal: B.legs && B.throttle > 0.05 ? Math.asin(clamp(B.legPhase || 0, -1, 1)) : k.pedal, crouch: B.crouch, banzai: B.banzaiT > 0.05, boost: B.banzaiT > 0.05, face: B.throttle > 0.6 ? 'effort' : 'normal', look: 0 });
    }
    if (this.mode === 'podium') {
      for (const k of this.ranked) {
        if (k.climbT >= 0 && k.climbT < 1) {
          k.climbT = Math.min(1, k.climbT + dt / 0.5);
          const p = k.m.group.position; p.lerpVectors(k.start, k.end, k.climbT); p.y += Math.sin(k.climbT * Math.PI) * 1.2;
          if (k.climbT >= 1) k.m.land(6);
        }
        const top = k.rank === 1 && this.t > 5;
        this.poseIdle(k, dt, t, { banzai: top || (k.rank <= 3 && k.climbT >= 1 && Math.sin(t * 2 + k.rank) > 0.6), clap: k.rank > 3, wave: k.rank <= 3 && k.climbT >= 1 && !top, face: k.rank <= 3 && k.climbT >= 1 ? 'happy' : 'normal', look: 0 });
      }
      if (this.trophyT != null && this.trophyT < 1) { this.trophyT = Math.min(1, this.trophyT + dt / 1.2); this.trophy.position.y = lerp(9, this.trophyY, 1 - Math.pow(1 - this.trophyT, 3)); }
      this.trophy.rotation.y += dt * 0.8;
    }
  }
};
function place(g, tr, s, d) {
  const p = tr.pos(s, d, 0, {}), f = tr.frame(s, {});
  g.position.set(p.x, p.y, p.z);
  const fwd = new V3(f.tx, f.ty, f.tz).normalize(), up = new V3(f.ux, f.uy, f.uz);
  const left = new V3().crossVectors(up, fwd).normalize(), fw2 = new V3().crossVectors(left, up);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, fw2));
}
function numTex(n, color) {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.font = `800 110px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#1d2b53'; g.lineJoin = 'round'; g.strokeText(String(n), 64, 70);
  g.fillStyle = color; g.fillText(String(n), 64, 70);
  return texture(c);
}
