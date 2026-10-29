"""skill.json -> webxr/index.html + anchors.json + manifest.json (P2 stub).

Static page: importmap pinned to three@0.160.0, VRButton from the same
version's addons, anchor spheres from skill.json positions, voice-prompt
panel. No headset tracking code. Test in Chrome + WebXR emulator.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

HTML_TEMPLATE = """<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>handLens VR - {title}</title>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.160.0/examples/jsm/"}}</script>
<style>body{margin:0;font-family:system-ui}#panel{position:fixed;left:8px;bottom:8px;background:#111;color:#fff;padding:8px 12px;border-radius:8px}</style>
</head><body>
<div id="panel">{prompt}</div>
<script type="module">
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
const anchors = ANCHORS_JSON;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e12);
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.01, 100);
camera.position.set(0.6, 0.6, 0.9);
camera.lookAt(0, 0.25, 0);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));
const note = document.createElement('div');
note.style.cssText = 'position:fixed;left:8px;top:8px;background:#111;color:#fff;padding:8px 12px;border-radius:8px;font-size:13px';
note.textContent = 'handLens VR overlay — no headset? Open in Chrome with the WebXR emulator extension, or use Cardboard stereo view on S23.';
document.body.appendChild(note);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const subject = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.5, 0.5)),
  new THREE.LineBasicMaterial({color: 0x334455}));
subject.position.set(0, 0.25, 0);
scene.add(subject);
const speakTargets = [];
function makeGhostHand() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:0x00ff88, emissive:0x00ff88, emissiveIntensity:0.4, transparent:true, opacity:0.55});
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.06), mat);
  g.add(palm);
  for (let f = 0; f < 4; f++) {
    const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.05, 8), mat);
    finger.position.set(-0.018 + f * 0.012, -0.035, 0);
    g.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.04, 8), mat);
  thumb.position.set(0.032, -0.02, 0);
  thumb.rotation.z = -0.9;
  g.add(thumb);
  return g;
}
for (const a of anchors) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 16),
    new THREE.MeshStandardMaterial({color:0x00ff00, emissive:0x00ff00}));
  m.position.set(a.position_m[0], a.position_m[1], a.position_m[2]);
  m.userData.voice_prompt = a.voice_prompt;
  m.userData.step_id = a.step_id;
  scene.add(m);
  speakTargets.push(m);
  const hand = makeGhostHand();
  hand.position.set(a.position_m[0], a.position_m[1] + 0.07, a.position_m[2]);
  hand.userData.voice_prompt = a.voice_prompt;
  hand.userData.step_id = a.step_id;
  scene.add(hand);
  speakTargets.push(hand);
}
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(speakTargets, true);
  if (hits.length > 0) {
    let o = hits[0].object;
    while (o && !o.userData.voice_prompt) o = o.parent;
    if (o && o.userData.voice_prompt) {
      document.getElementById('panel').textContent = o.userData.voice_prompt;
      const clip = 'voice/step' + String(o.userData.step_id).padStart(2, '0') + '.mp3';
      const audio = new Audio(clip);
      audio.onerror = () => {
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel();
          speechSynthesis.speak(new SpeechSynthesisUtterance(o.userData.voice_prompt));
        }
      };
      audio.play().catch(() => audio.onerror());
    }
  }
});
let previewAngle = 0.8;
renderer.setAnimationLoop(() => {
  if (!renderer.xr.isPresenting) {
    previewAngle += 0.003;
    camera.position.set(
      1.35 * Math.sin(previewAngle), -1.35 * Math.cos(previewAngle), 0.85);
    camera.lookAt(0, 0.25, 0);
  }
  renderer.render(scene, camera);
});
</script>
</body></html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skill', default='gen_ladipo_001')
    args = ap.parse_args()
    sdir = config.skill_dir(args.skill)
    with open(os.path.join(sdir, 'skill.json')) as f:
        skill = json.load(f)
    wdir = os.path.join(sdir, 'webxr')
    os.makedirs(wdir, exist_ok=True)
    anchors = [{'step_id': s['step_id'], 'xr_anchor': s['vr']['xr_anchor'],
                'position_m': s['spatial_3d']['position_m'],
                'voice_prompt': s['vr']['voice_prompt']} for s in skill['steps']]
    with open(os.path.join(wdir, 'anchors.json'), 'w') as f:
        json.dump(anchors, f, indent=1)
    html = HTML_TEMPLATE.replace('ANCHORS_JSON', json.dumps(anchors))
    html = html.replace('{title}', skill.get('skill_title', args.skill))
    html = html.replace('{prompt}', skill['steps'][0]['vr']['voice_prompt'])
    with open(os.path.join(wdir, 'index.html'), 'w') as f:
        f.write(html)
    with open(os.path.join(wdir, 'manifest.json'), 'w') as f:
        json.dump({'name': 'handLens VR - ' + args.skill, 'display': 'standalone'}, f, indent=1)
    assert 'three@0.160.0' in html and 'VRButton' in html
    print(f'webxr -> {wdir}: index.html + anchors.json + manifest.json')


if __name__ == '__main__':
    main()
