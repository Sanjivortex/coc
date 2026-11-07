import * as THREE from 'three';

/** Deterministic random numbers (mulberry32), so a model looks the same on every load. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTexture(canvas, repeat = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Square texture that tiles: `wrap` draws a mark nine times, shifted by one canvas size. */
function tileTexture(size, background, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = background;
  g.fillRect(0, 0, size, size);
  const wrap = (mark) => {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        g.save();
        g.translate(dx, dy);
        mark(g);
        g.restore();
      }
    }
  };
  draw(size, wrap);
  return toTexture(canvas);
}

/** Wood grain along the texture's v axis, nearly white so the material color sets the wood tone. */
export function woodTexture() {
  const rnd = seeded(7);
  return tileTexture(256, '#ffffff', (s, wrap) => {
    for (let i = 0; i < 90; i++) {
      const x = rnd() * s;
      const w = 1 + rnd() * 3.5;
      const a = 0.06 + rnd() * 0.2;
      wrap((g) => {
        g.fillStyle = `rgba(60, 35, 15, ${a})`;
        g.fillRect(x, 0, w, s);
      });
    }
    for (let i = 0; i < 5; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const rx = 3 + rnd() * 4;
      const ry = 7 + rnd() * 9;
      wrap((g) => {
        g.fillStyle = 'rgba(55, 30, 12, 0.35)';
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
      });
    }
  });
}

/** Darker and lighter grains for dirt and rock, nearly white so the material color sets the tone. */
export function speckleTexture(seed = 11, count = 1400) {
  const rnd = seeded(seed);
  return tileTexture(256, '#ffffff', (s, wrap) => {
    for (let i = 0; i < count; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 0.6 + rnd() * 2.4;
      const fill = rnd() < 0.6 ? `rgba(40, 25, 10, ${0.12 + rnd() * 0.28})` : `rgba(255, 245, 220, ${0.1 + rnd() * 0.25})`;
      wrap((g) => {
        g.fillStyle = fill;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      });
    }
  });
}

/** Short grass blades in darker and lighter greens. */
export function grassTexture() {
  const rnd = seeded(23);
  return tileTexture(256, '#5c9a36', (s, wrap) => {
    for (let i = 0; i < 2200; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const w = 1 + rnd() * 1.6;
      const h = 3 + rnd() * 5;
      const fill = rnd() < 0.55 ? `rgba(28, 74, 18, ${0.18 + rnd() * 0.25})` : `rgba(150, 200, 90, ${0.1 + rnd() * 0.18})`;
      wrap((g) => {
        g.fillStyle = fill;
        g.fillRect(x, y, w, h);
      });
    }
  });
}

/** Four-point star with a soft glow, for sparkles on gold. */
export function sparkleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255, 250, 220, 1)');
  glow.addColorStop(0.25, 'rgba(255, 220, 120, 0.55)');
  glow.addColorStop(1, 'rgba(255, 200, 80, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255, 255, 240, 0.95)';
  g.beginPath();
  g.moveTo(32, 2);
  g.lineTo(35, 29);
  g.lineTo(62, 32);
  g.lineTo(35, 35);
  g.lineTo(32, 62);
  g.lineTo(29, 35);
  g.lineTo(2, 32);
  g.lineTo(29, 29);
  g.closePath();
  g.fill();
  return toTexture(canvas, false);
}

/** Soft round shadow: dark in the middle, transparent at the edge. */
export function blobTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  const shade = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  shade.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 128);
  return toTexture(canvas, false);
}
