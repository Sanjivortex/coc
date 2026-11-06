import * as THREE from 'three';
import { seeded, sparkleTexture, speckleTexture, woodTexture } from './textures.js';

/** Height of the dirt pad the building stands on (1 unit = 1 tile, the mine covers 3 × 3). */
const TOP = 0.14;

/**
 * Level 1 Gold Mine, built from code: a timber A-frame dug into a rocky hill, a dark tunnel, rails
 * running out of it and a cart heaped with gold. An original model after the game's look; no game
 * files are used. `update(t)` animates the sparkles on the gold and the lantern.
 */
export function buildGoldMine() {
  const rnd = seeded(1);
  const jitter = (amount) => (rnd() - 0.5) * 2 * amount;
  const root = new THREE.Group();
  root.name = 'Gold Mine (level 1)';

  const grain = woodTexture();
  const woodMats = ['#c48a52', '#ad7440', '#d29d63', '#9c6535', '#ba8049', '#c9925a'].map(
    (color) => new THREE.MeshStandardMaterial({ map: grain, color, roughness: 0.9 }),
  );
  const wood = () => woodMats[Math.floor(rnd() * woodMats.length)];
  const darkWood = new THREE.MeshStandardMaterial({ map: grain, color: '#74461f', roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: '#5d636e', metalness: 0.75, roughness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({
    color: '#ffd04a',
    metalness: 0.85,
    roughness: 0.3,
    emissive: '#9a6400',
    emissiveIntensity: 0.5,
    envMapIntensity: 1.6,
    flatShading: true,
  });
  const padTex = speckleTexture(11, 1800);
  const hillTex = speckleTexture(17, 1400);
  hillTex.repeat.set(6, 4);
  const dirt = new THREE.MeshStandardMaterial({ map: padTex, color: '#9a7449', roughness: 1 });
  const earth = new THREE.MeshStandardMaterial({ map: hillTex, color: '#7f6448', roughness: 1, flatShading: true });
  const rock = new THREE.MeshStandardMaterial({ map: speckleTexture(5, 600), color: '#a59d91', roughness: 0.95, flatShading: true });
  const darkness = new THREE.MeshBasicMaterial({ color: '#120b06' });

  const add = (parent, geometry, material, { at = [0, 0, 0], rot = [0, 0, 0], scale, cast = true, receive = true } = {}) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...at);
    mesh.rotation.set(...rot);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  };

  // Dirt pad under the whole footprint.
  const pad = new THREE.ExtrudeGeometry(roundedRect(2.8, 2.8, 0.4), {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.06,
    bevelSegments: 3,
    curveSegments: 8,
  });
  pad.rotateX(-Math.PI / 2);
  pad.translate(0, 0.04, 0);
  add(root, pad, dirt, { cast: false });

  // Rocky hill the tunnel is dug into.
  add(root, lumpy(new THREE.IcosahedronGeometry(1, 3), 0.1, 1.7), earth, { at: [-0.78, 0, 0], scale: [0.85, 0.74, 1.12] });

  // Timber A-frame over the tunnel: entrance at +x, the back end buried in the hill.
  const front = 0.78;
  const back = -0.72;
  const halfW = 0.72;
  const ridge = 0.9;
  const rise = ridge - TOP;
  const slope = Math.hypot(halfW, rise);
  const pitch = Math.atan2(rise, halfW);
  /** Point on a roof slope: `f` = 0 at the ridge, 1 at the eave, lifted `lift` off the boards. */
  const onSlope = (side, x, f, lift) =>
    new THREE.Vector3(x, ridge - f * rise, side * f * halfW).addScaledVector(new THREE.Vector3(0, Math.cos(pitch), side * Math.sin(pitch)), lift);

  // Darkness inside, set back from the front so the opening has depth.
  const inside = new THREE.Shape();
  inside.moveTo(-halfW + 0.06, 0);
  inside.lineTo(halfW - 0.06, 0);
  inside.lineTo(0, rise - 0.07);
  inside.closePath();
  const tunnel = new THREE.ExtrudeGeometry(inside, { depth: front - 0.14 - back, bevelEnabled: false });
  tunnel.rotateY(Math.PI / 2);
  tunnel.translate(back, TOP, 0);
  add(root, tunnel, darkness, { cast: false, receive: false });

  const boards = 8;
  const step = (front - back) / boards;
  for (const side of [1, -1]) {
    // Roof boards side by side down the slope, a little crooked and with gaps, like hand-cut planks.
    for (let i = 0; i < boards; i++) {
      const length = slope * (1 + jitter(0.06)) + 0.12;
      const board = add(root, new THREE.BoxGeometry(step * (0.93 + jitter(0.04)), 0.05, length), wood(), {
        rot: [side * pitch, jitter(0.07), jitter(0.03)],
      });
      board.position.copy(onSlope(side, back + step * (i + 0.5) + jitter(0.012), 0.5 + jitter(0.03), 0.03 + rnd() * 0.012));
    }
    // Two battens nailed across the boards.
    for (const f of [0.28, 0.8]) {
      const batten = add(root, new THREE.BoxGeometry(front - back + 0.06, 0.045, 0.085), darkWood, {
        rot: [side * pitch, jitter(0.02), jitter(0.02)],
      });
      batten.position.copy(onSlope(side, (front + back) / 2 + 0.02, f, 0.075));
    }
    // Heavier rafter along the front edge of each slope.
    const rafter = add(root, new THREE.BoxGeometry(0.12, 0.12, slope + 0.2), darkWood, { rot: [side * pitch, 0, 0] });
    rafter.position.copy(onSlope(side, front + 0.03, 0.5, 0.05));
    // Door post up to the rafter, framing the whole triangular opening.
    add(root, new THREE.BoxGeometry(0.11, 0.3, 0.11), darkWood, { at: [front - 0.02, TOP + 0.15, side * 0.42], rot: [jitter(0.03), 0, jitter(0.03)] });
  }
  const ridgeLog = new THREE.CylinderGeometry(0.065, 0.065, front - back + 0.32, 8);
  ridgeLog.rotateZ(Math.PI / 2);
  add(root, ridgeLog, darkWood, { at: [(front + back) / 2 + 0.12, ridge + 0.07, 0] });

  // Rails out of the tunnel toward the front right, on wooden sleepers.
  const track = new THREE.Group();
  track.position.set(0.6, TOP, -0.06);
  track.rotation.y = 0.95;
  root.add(track);
  const trackLength = 0.95;
  for (let d = 0.08; d < trackLength; d += 0.15) {
    add(track, new THREE.BoxGeometry(0.075, 0.03, 0.36), darkWood, { at: [d, 0.015, 0], rot: [0, jitter(0.08), 0] });
  }
  for (const side of [1, -1]) add(track, new THREE.BoxGeometry(trackLength, 0.03, 0.03), iron, { at: [trackLength / 2, 0.045, side * 0.12] });

  // Mine cart heaped with gold.
  const cart = new THREE.Group();
  cart.position.set(0.6, 0.055, 0);
  cart.scale.setScalar(0.9);
  track.add(cart);
  const flare = 1.14;
  const body = new THREE.BoxGeometry(0.56, 0.3, 0.42);
  taper(body, flare);
  body.translate(0, 0.22, 0);
  add(cart, body, darkWood);
  const topY = 0.37;
  const topW = 0.56 * flare;
  const topD = 0.42 * flare;
  for (const side of [1, -1]) {
    add(cart, new THREE.BoxGeometry(topW + 0.04, 0.04, 0.04), iron, { at: [0, topY, (side * topD) / 2] });
    add(cart, new THREE.BoxGeometry(0.04, 0.04, topD + 0.04), iron, { at: [(side * topW) / 2, topY, 0] });
  }
  const wheel = new THREE.CylinderGeometry(0.075, 0.075, 0.045, 14);
  wheel.rotateX(Math.PI / 2);
  for (const sx of [1, -1]) for (const sz of [1, -1]) add(cart, wheel, iron, { at: [sx * 0.18, 0.075, sz * 0.13] });
  add(cart, new THREE.BoxGeometry(topW - 0.02, 0.02, topD - 0.02), gold, { at: [0, topY - 0.02, 0], cast: false });
  const nuggets = [new THREE.IcosahedronGeometry(1, 0), new THREE.DodecahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0)];
  for (let i = 0; i < 30; i++) {
    const u = jitter(1);
    const v = jitter(1);
    const heap = Math.max(0, 1 - (u * u + v * v) * 0.55);
    const size = 0.05 + rnd() * 0.04;
    add(cart, nuggets[i % 3], gold, {
      at: [u * 0.25, topY - 0.02 + heap * 0.15 * (0.6 + rnd() * 0.4), v * 0.18],
      rot: [rnd() * 3, rnd() * 3, rnd() * 3],
      scale: [size, size * (0.8 + rnd() * 0.4), size],
    });
  }
  // A few nuggets that fell off.
  for (const [x, z] of [[0.3, 0.28], [0.4, 0.34], [0.95, -0.3]]) {
    const size = 0.04 + rnd() * 0.02;
    add(track, nuggets[Math.floor(rnd() * 3)], gold, { at: [x, size * 0.7, z], rot: [rnd() * 3, rnd() * 3, rnd() * 3], scale: [size, size, size] });
  }

  // Sparkles that blink on the gold.
  const sparkleMat = new THREE.SpriteMaterial({ map: sparkleTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const sparkles = [];
  for (let i = 0; i < 6; i++) {
    const sparkle = new THREE.Sprite(sparkleMat);
    sparkle.position.set(jitter(0.22), topY + 0.1 + rnd() * 0.12, jitter(0.16));
    sparkle.userData = { phase: rnd() * Math.PI * 2, speed: 1.1 + rnd() * 1.3 };
    cart.add(sparkle);
    sparkles.push(sparkle);
  }

  // Lantern on a bracket on the left door post, beside the opening rather than in front of it.
  const lantern = new THREE.Group();
  lantern.position.set(front + 0.13, 0.4, 0.42);
  root.add(lantern);
  add(lantern, new THREE.BoxGeometry(0.17, 0.035, 0.035), darkWood, { at: [-0.075, 0, 0] });
  add(lantern, new THREE.BoxGeometry(0.012, 0.06, 0.012), iron, { at: [0, -0.03, 0], cast: false });
  add(lantern, new THREE.ConeGeometry(0.075, 0.05, 4), iron, { at: [0, -0.075, 0], rot: [0, Math.PI / 4, 0] });
  add(lantern, new THREE.BoxGeometry(0.095, 0.12, 0.095), iron, { at: [0, -0.16, 0] });
  const glass = new THREE.MeshStandardMaterial({ color: '#ffcf85', emissive: '#ff9d2e', emissiveIntensity: 1.5 });
  add(lantern, new THREE.BoxGeometry(0.07, 0.09, 0.107), glass, { at: [0, -0.16, 0], cast: false });
  add(lantern, new THREE.BoxGeometry(0.107, 0.09, 0.07), glass, { at: [0, -0.16, 0], cast: false });
  const lamp = new THREE.PointLight('#ffb54d', 1.1, 2.2, 2);
  lamp.position.set(0.04, -0.16, -0.04);
  lantern.add(lamp);

  // Pickaxe dropped beside the entrance: handle along +x, picks flat on the ground.
  const pick = new THREE.Group();
  add(pick, new THREE.CylinderGeometry(0.02, 0.024, 0.6, 6), woodMats[2], { at: [0, 0.3, 0] });
  add(pick, new THREE.BoxGeometry(0.06, 0.06, 0.06), iron, { at: [0, 0.58, 0] });
  for (const side of [1, -1]) {
    add(pick, new THREE.ConeGeometry(0.028, 0.2, 5), iron, { at: [side * 0.1, 0.57, 0], rot: [0, 0, -side * (Math.PI / 2 + 0.22)] });
  }
  pick.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
  pick.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0.5);
  pick.position.set(0.55, TOP + 0.03, 1.08);
  root.add(pick);

  // Loose rocks: a pile at the foot of the hill and a few around the pad.
  const stone = new THREE.DodecahedronGeometry(1, 0);
  const rocks = [
    [-0.5, 1.02, 0.15],
    [-0.82, 1.1, 0.12],
    [-1.12, 0.92, 0.14],
    [-0.28, 1.18, 0.08],
    [-1.2, -0.98, 0.13],
    [1.15, 1.12, 0.08],
    [-0.35, -1.15, 0.1],
    [1.2, -1.15, 0.07],
  ];
  for (const [x, z, s] of rocks) {
    add(root, stone, rock, { at: [x, TOP + s * 0.3, z], rot: [rnd() * 3, rnd() * 3, rnd() * 3], scale: [s * (1 + rnd() * 0.4), s * 0.75, s] });
  }

  return {
    object: root,
    update(t) {
      for (const s of sparkles) {
        const size = 0.17 * Math.max(0, Math.sin(t * s.userData.speed + s.userData.phase)) ** 6;
        s.scale.set(size, size, 1);
      }
      const flicker = 0.88 + 0.07 * Math.sin(t * 11.3) + 0.05 * Math.sin(t * 6.7 + 1.3);
      lamp.intensity = 1.1 * flicker;
      glass.emissiveIntensity = 1.5 * flicker;
    },
  };
}

function roundedRect(w, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r);
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** Makes the top of a box wider than its bottom, like a mine cart. */
function taper(geometry, factor) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) pos.setXYZ(i, pos.getX(i) * factor, pos.getY(i), pos.getZ(i) * factor);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Bumps on a sphere from smooth waves of the position, so shared corners move together. */
function lumpy(geometry, amount, seed) {
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 1.3) * Math.sin(v.z * 3.3 + seed * 0.7) +
      0.5 * Math.sin(v.x * 6.1 + v.z * 4.3 + seed * 2.1);
    v.multiplyScalar(1 + n * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}
