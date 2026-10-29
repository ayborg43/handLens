import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Builds one hotspot for a skill step: a small anchor dot at
// step.spatial_3d.position_m (meters) carrying a numbered DOM pin.
// `position` may be a display override when several steps share one anchor.
export function createHotspot(step, index, position, onSelect) {
  const color = (step.vr && step.vr.highlight_color) || '#2fe38b';
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.006, 12, 12),
    new THREE.MeshBasicMaterial({ color })
  );
  const pos = position || step.spatial_3d.position_m;
  mesh.position.set(pos[0], pos[1], pos[2]);

  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'pin';
  pin.setAttribute('aria-label', `Go to step ${step.step_id}: ${step.action}`);
  pin.innerHTML = `<span class="pin-num">${step.step_id}</span><span class="pin-label"></span>`;
  pin.querySelector('.pin-label').textContent = step.action;
  pin.addEventListener('click', () => onSelect(index));
  mesh.add(new CSS2DObject(pin));

  mesh.userData.pin = pin;
  return mesh;
}

// Steps often share one anchor before real calibration. Fan coincident anchors
// out on a small ring (display only; skill.json is untouched).
export function spreadPositions(steps) {
  const groups = new Map();
  steps.forEach((s, i) => {
    const p = s.spatial_3d.position_m;
    const key = p.map((v) => v.toFixed(3)).join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  const out = steps.map((s) => s.spatial_3d.position_m.slice());
  groups.forEach((idxs) => {
    if (idxs.length < 2) return;
    idxs.forEach((stepIdx, n) => {
      const a = (n / idxs.length) * Math.PI * 2 - Math.PI / 2;
      out[stepIdx][0] += Math.cos(a) * 0.14;
      out[stepIdx][2] += Math.sin(a) * 0.11;
    });
  });
  return out;
}
