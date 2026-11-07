import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { blobTexture, grassTexture, speckleTexture } from './textures.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * WebGL stage for one building: a floating grass island lit like the game (sun from the top left),
 * drag to rotate, scroll or pinch to zoom, and a slow turntable that pauses while you look around.
 * `radius` is the part of the scene that must fit on screen, `target` the point the camera orbits.
 */
export function createViewer(container, { radius = 2.6, target = [0, 0.45, 0] } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#dbe9ff', '#6a5034', 1.6));
  const sun = new THREE.DirectionalLight('#fff1d9', 3);
  sun.position.set(-5, 8, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 1, far: 25 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(island());

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.45;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 1;
  let idle;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    clearTimeout(idle);
  });
  controls.addEventListener('end', () => {
    if (!reducedMotion) idle = setTimeout(() => (controls.autoRotate = true), 5000);
  });

  // First view matches the game's camera: on the tile diagonal, looking down at about 35°.
  const gameView = new THREE.Vector3(1, 1, 1).normalize();
  const fit = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const distance = radius / Math.sin(Math.min(vHalf, hHalf));
    controls.minDistance = distance * 0.45;
    controls.maxDistance = distance * 1.8;
    const dir = camera.position.lengthSq() > 0 ? camera.position.clone().sub(controls.target).normalize() : gameView;
    camera.position.copy(controls.target).addScaledVector(dir, distance);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(container);
  fit();

  const frameHandlers = [];
  let last = 0;
  renderer.setAnimationLoop((ms) => {
    const t = ms / 1000;
    const dt = last ? Math.min(t - last, 0.1) : 1 / 60;
    last = t;
    // With reduced motion the clock stands still: no twinkling, no flicker.
    for (const handler of frameHandlers) handler(reducedMotion ? 0 : t);
    controls.update(dt);
    renderer.render(scene, camera);
  });

  return { scene, camera, renderer, controls, onFrame: (handler) => frameHandlers.push(handler) };
}

/** Grass island with dirt sides, floating over a soft shadow. Its top is at y = 0. */
function island() {
  const group = new THREE.Group();
  const grass = grassTexture();
  grass.repeat.set(3, 3);
  const soil = speckleTexture(31, 1600);
  soil.repeat.set(16, 0.6);
  const top = new THREE.MeshStandardMaterial({ map: grass, roughness: 1 });
  const side = new THREE.MeshStandardMaterial({ map: soil, color: '#6e4b2e', roughness: 1 });
  // CylinderGeometry groups: 0 = side, 1 = top cap, 2 = bottom cap.
  const land = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.1, 0.55, 72, 1), [side, top, side]);
  land.position.y = -0.275;
  land.receiveShadow = true;
  group.add(land);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 48),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.8;
  group.add(shadow);
  return group;
}
