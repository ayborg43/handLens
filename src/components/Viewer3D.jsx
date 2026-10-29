import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHotspot, spreadPositions } from './Hotspot.jsx';
import { Fallback2D } from './Fallback2D.jsx';

const ACCENT = 0x2fe38b;
const EDGE = 0x2fe38b;
const EMPTY = [];
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Soft pool of light under the subject.
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// The generated placeholder box gets a deliberate blueprint look. Real
// captures keep their own materials.
function styleAsBlueprint(root) {
  const edges = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    // the generated GLB ships positions only; give it flat-shaded faces
    if (!o.geometry.attributes.normal) {
      o.geometry = o.geometry.toNonIndexed();
      o.geometry.computeVertexNormals();
    }
    o.material = new THREE.MeshStandardMaterial({ color: 0x27353a, roughness: 0.45, metalness: 0.3 });
    o.castShadow = true;
    edges.push(o);
  });
  edges.forEach((o) => {
    o.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(o.geometry),
      new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: 0.9 })
    ));
  });
}

export function Viewer3D({ modelUrl, steps, activeStep, onSelect, done = EMPTY }) {
  const mountRef = useRef(null);
  const groupRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fly = useRef({ center: new THREE.Vector3(0, 0.12, 0), goal: new THREE.Vector3(0, 0.12, 0), until: 0 });
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 480;
    setStatus('loading');

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xdde7e3, 2.2, 5.5);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.01, 100);
    camera.position.set(0.75, 0.55, 0.95);

    let renderer;
    try {
      // ?nowebgl forces the fallback for testing
      if (new URLSearchParams(window.location.search).has('nowebgl')) throw new Error('forced');
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus('nowebgl');
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.setSize(width, height);
    labels.domElement.className = 'pin-layer';
    mount.appendChild(labels.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.6;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 3;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = !reduceMotion();
    controls.autoRotateSpeed = 0.7;
    controls.target.copy(fly.current.center);
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c9c3, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(0.5, 2.6, 0.7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -0.8;
    key.shadow.camera.right = key.shadow.camera.top = 0.8;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 6;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfeedb, 0.8);
    rim.position.set(-1.5, 0.8, -1.2);
    scene.add(rim);

    // floor: faint grid, shadow catcher, pool of light
    const grid = new THREE.GridHelper(4, 40, 0x7fa597, 0xb8c9c2);
    grid.material.transparent = true;
    grid.material.opacity = 0.6;
    scene.add(grid);
    const shadowFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.ShadowMaterial({ opacity: 0.22, color: 0x1d3a30 })
    );
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = 0.0005;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.001;
    scene.add(glow);

    const hotspots = new THREE.Group();
    scene.add(hotspots);
    groupRef.current = hotspots;

    let disposed = false;
    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        let placeholder = false;
        gltf.scene.traverse((o) => { if (o.name === 'subject-placeholder') placeholder = true; });
        if (placeholder) styleAsBlueprint(gltf.scene);
        else gltf.scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        scene.add(gltf.scene);

        // frame the subject
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        fly.current.center.copy(center);
        fly.current.goal.copy(center);
        controls.target.copy(center);
        const radius = Math.max(size.x, size.y, size.z, 0.2);
        const fit = Math.min(1, camera.aspect);
        const dist = (radius / Math.tan((camera.fov * Math.PI) / 360) / fit) * 1.05;
        camera.position.copy(center).add(new THREE.Vector3(0.7, 0.5, 0.9).normalize().multiplyScalar(dist));
        setStatus('ready');
      },
      undefined,
      () => { if (!disposed) setStatus('error'); }
    );

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (performance.now() < fly.current.until) controls.target.lerp(fly.current.goal, 0.07);
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labels.setSize(w, h);
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      mount.removeChild(renderer.domElement);
      mount.removeChild(labels.domElement);
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      groupRef.current = null;
    };
  }, [modelUrl]);

  // pins
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      const mesh = group.children.pop();
      mesh.remove(...mesh.children);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    const positions = spreadPositions(steps);
    steps.forEach((s, i) => {
      group.add(createHotspot(s, i, positions[i], (n) => onSelectRef.current(n)));
    });
  }, [steps, modelUrl]);

  // active pin + camera glide
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.children.forEach((mesh, i) => {
      const active = i === activeStep;
      mesh.userData.pin.classList.toggle('is-active', active);
      mesh.userData.pin.classList.toggle('is-done', done.includes(steps[i].step_id));
      mesh.userData.pin.setAttribute('aria-current', active ? 'step' : 'false');
      mesh.scale.setScalar(active ? 1.6 : 1);
    });
    const target = group.children[activeStep];
    if (target) {
      fly.current.goal.copy(fly.current.center).lerp(target.position, 0.45);
      fly.current.until = performance.now() + 1400;
    }
  }, [activeStep, steps, modelUrl, done]);

  return (
    <>
      <div ref={mountRef} className="viewer-mount" />
      {status === 'loading' && (
        <div className="viewer-status" role="status">
          <div className="skeleton skeleton-stage" aria-hidden="true" />
          <span className="viewer-status-text">Loading 3D model…</span>
        </div>
      )}
      {status === 'nowebgl' && (
        <Fallback2D steps={steps} activeStep={activeStep} onSelect={onSelect} />
      )}
      {status === 'error' && (
        <div className="viewer-status" role="alert">
          The 3D model couldn’t be loaded. Steps and clips are still available.
        </div>
      )}
    </>
  );
}
