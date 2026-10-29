import { parseRange } from './skillLoader.js';

// Seconds into the source video where this step's clip starts. Clips are named
// clip_<start>.mp4 by tools/cut_clips.sh; fall back to the step's start time.
export function clipOffset(step) {
  const m = /clip_(\d+)/.exec((step.human && step.human.video_clip) || '');
  return m ? Number(m[1]) : parseRange(step.timestamp)[0];
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, u) => a + (b - a) * u;

// SAM runs on sampled frames (one per couple of seconds), so boxes between
// samples are interpolated per object id and fade in/out at the ends.
export function boxesAt(frames, T, targetId) {
  if (!frames || frames.length === 0) return [];
  let prev = null;
  let next = null;
  for (const fr of frames) {
    if (fr.timestamp <= T) prev = fr;
    else { next = fr; break; }
  }
  const out = [];
  const size = (fr) => fr.image_size || [1920, 1080];
  const norm = (fr, bbox) => {
    const [iw, ih] = size(fr);
    return { x: bbox[0] / iw, y: bbox[1] / ih, w: bbox[2] / iw, h: bbox[3] / ih };
  };
  const push = (o, box, opacity) => {
    if (opacity <= 0.02) return;
    out.push({ id: o.id, label: o.label, score: o.score, ...box, opacity, isTarget: o.id === targetId });
  };
  const gap = prev && next ? next.timestamp - prev.timestamp : Infinity;

  if (prev) {
    prev.objects.forEach((o) => {
      const mate = next && gap <= 3.5 ? next.objects.find((n) => n.id === o.id && n.label === o.label) : null;
      const a = norm(prev, o.bbox);
      if (mate) {
        const u = clamp01((T - prev.timestamp) / gap);
        const b = norm(next, mate.bbox);
        push(o, { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) }, 1);
      } else {
        push(o, a, clamp01(1.2 - (T - prev.timestamp)));
      }
    });
  }
  if (next) {
    next.objects.forEach((o) => {
      const seen = prev && gap <= 3.5 && prev.objects.some((p) => p.id === o.id && p.label === o.label);
      if (!seen) push(o, norm(next, o.bbox), clamp01(1.2 - (next.timestamp - T)));
    });
  }
  // target on top, higher confidence first
  return out.sort((p, q) => Number(p.isTarget) - Number(q.isTarget) || p.score - q.score);
}
