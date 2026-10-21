// コースを 3D で 組み立てる・こわす（第6部 6.5）
import * as THREE from 'three';
import { World } from './world.js';
import { Track } from './track.js';
import { buildTerrain } from './terrain.js';
import { buildTrackMeshes } from './trackmesh.js';
import { detailTexture } from './tex.js';
import { COURSES } from './courses.js';
import { CFG } from './config.js';

let detailTex = null;
export const Course3D = {
  cur: null,
  async build(id, quality, { onStep } = {}) {
    if (this.cur && this.cur.id === id && this.cur.quality === quality) return this.cur;
    this.dispose();
    const course = COURSES.find(c => c.id === id);
    const step = async (name, fn) => { const t0 = performance.now(); const r = fn(); if (onStep) await onStep(name); this.times[name] = Math.round(performance.now() - t0); return r; };
    this.times = {};
    detailTex = detailTex || detailTexture();
    const tr = await step('track', () => new Track(course));
    await step('field', () => tr.buildField());
    const terr = await step('terrain', () => buildTerrain(tr, course, quality, detailTex));
    World.scene.add(terr.mesh, terr.disc);
    World.setLook(course);
    const ctx = { heightAt: terr.heightAt, detailTex, grid: CFG.race.GRID.map(([s, d]) => [tr.wrapS(s), d]) };
    const tm = await step('trackmesh', () => buildTrackMeshes(tr, course, World.scene, ctx));
    await step('water', () => World.buildWater(course, terr.heightAt, tr.box));
    await step('far', () => World.buildFar(course, new THREE.Vector3(tr.box.cx, 0, tr.box.cz)));
    World.buildClouds(course.scenery.clouds || 0, 5 + course.no);
    let scen = null;
    try {
      const { buildScenery } = await import('./scenery.js');
      scen = await step('scenery', () => buildScenery(World, tr, course, quality, terr, ctx));
    } catch (e) { console.warn('scenery', e); }
    this.cur = { id, course, track: tr, terrain: terr, trackMesh: tm, scenery: scen, ctx, quality };
    return this.cur;
  },
  update(dt, t, karts, cam) {
    const c = this.cur; if (!c) return;
    c.trackMesh.update(dt, t, karts);
    if (c.scenery) c.scenery.update(dt, t, karts, cam);
  },
  dispose() {
    const c = this.cur; if (!c) return;
    c.trackMesh.dispose();
    if (c.scenery) c.scenery.dispose();
    World.scene.remove(c.terrain.mesh, c.terrain.disc);
    c.terrain.mesh.geometry.dispose(); c.terrain.mesh.material.dispose();
    c.terrain.disc.geometry.dispose(); c.terrain.disc.material.dispose();
    World.disposeWater();
    this.cur = null;
  }
};
