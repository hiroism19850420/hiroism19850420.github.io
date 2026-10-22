// 道の 高さ（第10部 10.2・付録S S.1）
import { CFG } from './config.js';
import { lerp, smoothstep, clamp } from './util.js';

export function makeHeight(course, L) {
  const K = CFG.course, [p1, p2] = course.hPhase || [0, 0];
  const raw = s => K.H_A1 * Math.sin(2 * Math.PI * s / K.H_W1 + p1) + K.H_A2 * Math.sin(2 * Math.PI * s / K.H_W2 + p2);
  const amp = course.hAmp ?? 1, r0 = raw(0), rL = raw(L);
  return s => {
    if (s <= 0 || s >= L) return 0;
    const a = smoothstep(K.FLAT_START * 0.3, K.FLAT_START, s);
    const b = 1 - smoothstep(L - K.FLAT_END, L - K.FLAT_END * 0.3, s);
    return (raw(s) - lerp(r0, rL, clamp(s / L, 0, 1))) * a * b * amp;
  };
}
