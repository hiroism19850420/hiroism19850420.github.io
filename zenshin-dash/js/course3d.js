// コースを まとめて 作る・こわす（付録AP AP.1）
import * as THREE from 'three';
import { CFG } from './config.js';
import { COURSES } from './courses.js';
import { makeHeight } from './height.js';
import { World } from './world.js';
import { buildTerrain } from './terrain.js';
import { buildRoad, buildEdges, buildGates, buildGoal } from './road.js';
import { buildScenery } from './scenery.js';
import { ObstacleMeshes } from './obsmesh.js';
import { GlowPoints } from './build.js';
import { detailTexture } from './tex.js';

export const COURSES_BY = Object.fromEntries(COURSES.map(c => [c.id, c]));

export class Course3D {
  constructor(fx) { this.fx = fx; this.built = null; this.detail = null; }

  build(courseId, dist, quality) {
    const t0 = performance.now();
    const c = COURSES_BY[courseId], L = typeof dist === 'number' ? dist : CFG.course.DIST[dist];
    const key = c.id + ':' + L + ':' + quality;
    if (this.built === key) return this;
    this.dispose();
    const scene = World.scene;
    this.c = c; this.L = L; this.quality = quality;
    this.H = makeHeight(c, L);
    World.setLook(c);
    if (!this.detail) this.detail = detailTexture();
    this.detail.repeat.set(1, 1);
    const tm = {};
    let t = performance.now();
    this.terrain = buildTerrain(c, L, this.H, quality, this.detail);
    scene.add(this.terrain.mesh, this.terrain.disc); tm.terrain = performance.now() - t; t = performance.now();
    this.glow = new GlowPoints();
    this.road = buildRoad(c, L, this.H, quality); scene.add(this.road.root);
    this.edges = buildEdges(c, L, this.H, this.terrain, quality, this.glow); scene.add(this.edges.root);
    this.gates = buildGates(c, this.H); scene.add(this.gates.root);
    this.goal = buildGoal(c, L, this.H); scene.add(this.goal.root); tm.road = performance.now() - t; t = performance.now();
    World.buildSea(c, L);
    World.buildFar(c, L);
    World.buildClouds(c.clouds, 5 + c.no, L);
    this.scenery = buildScenery(c, L, this.H, this.terrain, quality, this.glow); scene.add(this.scenery.root); tm.scenery = performance.now() - t;
    this.glowRoot = new THREE.Group(); this.glowRoot.name = 'glow'; scene.add(this.glowRoot);
    this.glow.build(this.glowRoot);
    this.obs = new ObstacleMeshes(c, this.H, scene, this.fx);
    this.built = key;
    this.times = { all: performance.now() - t0, ...tm };
    return this;
  }
  heightAt(s) { return this.H(s); }
  groundAt(x, s) { return this.terrain.heightAtS(x, s); }

  // ctx：{ camS, camS2?, cam, nearRunner, playerS, final }
  update(dt, t, race, ctx) {
    const a = ctx.camS, b = ctx.camS2 ?? ctx.camS;
    this.edges.chunks.cull(a, b);
    this.scenery.chunks.cull(a, b);
    this.scenery.update(dt, t, ctx);
    this.gates.update(dt);
    this.goal.update(dt);
    if (race) this.obs.update(dt, t, race, a, b, ctx.hide);
    if (ctx.cam) this.glow.scale(ctx.cam, ctx.viewH || innerHeight);
  }

  dispose() {
    if (!this.built) return;
    const scene = World.scene;
    for (const k of ['road', 'edges', 'gates', 'goal', 'scenery']) if (this[k]) { scene.remove(this[k].root); this[k].dispose(); this[k] = null; }
    if (this.terrain) { scene.remove(this.terrain.mesh, this.terrain.disc); this.terrain.dispose(); this.terrain = null; }
    if (this.obs) { this.obs.dispose(); this.obs = null; }
    if (this.glowRoot) { scene.remove(this.glowRoot); this.glow.dispose(); this.glowRoot = null; }
    World.disposeWater();
    this.built = null;
  }
}
