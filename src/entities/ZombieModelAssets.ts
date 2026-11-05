/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

/**
 * Shared procedural texture and geometry cache for realistic humanoid zombies.
 * Eliminates GPU memory churn and ensures smooth 60 FPS rendering with 15+ concurrent undead models.
 */

// Procedural Offscreen Canvas Texture Generators
function createDecayedSkinTexture(baseColor: string, necroticColor: string, bruiseColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Base mottled decayed tone
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 128);

  // Necrotic patches & discoloration
  ctx.fillStyle = necroticColor;
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 4 + Math.random() * 18;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bruising & subcutaneous pooling
  ctx.fillStyle = bruiseColor;
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 6 + Math.random() * 22;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grime & dried splatter specks
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = '#1e080b'; // Dried coagulated dark crimson
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const s = 1 + Math.random() * 2.5;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createTornFlannelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Base plaid / lumberjack crimson
  ctx.fillStyle = '#591e23';
  ctx.fillRect(0, 0, 128, 128);

  // Plaid stripes
  ctx.fillStyle = '#261214';
  for (let i = 0; i < 128; i += 16) {
    ctx.fillRect(i, 0, 6, 128);
    ctx.fillRect(0, i, 128, 6);
  }

  // Dark grime and blood splatters
  ctx.fillStyle = '#210507';
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 3 + Math.random() * 12;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tears showing grayish necrotic flesh beneath
  ctx.fillStyle = '#6e7a6c';
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 8; i++) {
    const x = 15 + Math.random() * 95;
    const y = 15 + Math.random() * 95;
    ctx.fillRect(x, y, 6 + Math.random() * 10, 3 + Math.random() * 6);
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createTornDenimTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Faded dirty denim
  ctx.fillStyle = '#2c3947';
  ctx.fillRect(0, 0, 128, 128);

  // Fabric grain
  ctx.fillStyle = '#1e2630';
  for (let i = 0; i < 128; i += 4) {
    ctx.fillRect(i, 0, 1.5, 128);
  }

  // Dirt & street mud stains
  ctx.fillStyle = '#221a14';
  ctx.globalAlpha = 0.6;
  ctx.fillRect(0, 60, 128, 68); // bottom knees soiled

  // Torn knee rip showing gray skin
  ctx.fillStyle = '#7a8578';
  ctx.globalAlpha = 0.95;
  ctx.fillRect(40, 70, 26, 10);
  ctx.fillRect(75, 85, 20, 8);
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createRunnerShirtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Feral athletic compression gear: dark shredded burgundy
  ctx.fillStyle = '#3a161c';
  ctx.fillRect(0, 0, 128, 128);

  // Athletic panel stripe
  ctx.fillStyle = '#1c0c0e';
  ctx.fillRect(30, 0, 20, 128);
  ctx.fillRect(78, 0, 20, 128);

  // Shredded tears
  ctx.fillStyle = '#82796e'; // Gaunt pale necrotic skin
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * 110;
    const y = Math.random() * 110;
    ctx.fillRect(x, y, 12, 5);
  }

  // Fresh blood streaks
  ctx.fillStyle = '#6b0f17';
  ctx.globalAlpha = 0.75;
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    ctx.fillRect(x, y, 4, 16);
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createBruteArmorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Heavy tactical ballistic Kevlar
  ctx.fillStyle = '#1e2227';
  ctx.fillRect(0, 0, 128, 128);

  // Cross-weave pattern
  ctx.fillStyle = '#15181b';
  for (let i = 0; i < 128; i += 8) {
    ctx.fillRect(i, 0, 3, 128);
    ctx.fillRect(0, i, 128, 3);
  }

  // Ballistic impact cracks & metal scratches
  ctx.strokeStyle = '#4e5661';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 120;
    const y = Math.random() * 120;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 15, y + 10);
    ctx.lineTo(x + 22, y + 5);
    ctx.stroke();
  }

  // Dried blood spray
  ctx.fillStyle = '#36090e';
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    ctx.beginPath();
    ctx.arc(x, y, 3 + Math.random() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Global Texture Cache Instances
let walkerSkinTex: THREE.CanvasTexture | null = null;
let runnerSkinTex: THREE.CanvasTexture | null = null;
let bruteSkinTex: THREE.CanvasTexture | null = null;
let flannelTex: THREE.CanvasTexture | null = null;
let denimTex: THREE.CanvasTexture | null = null;
let runnerShirtTex: THREE.CanvasTexture | null = null;
let bruteArmorTex: THREE.CanvasTexture | null = null;

export function getSharedTextures() {
  if (!walkerSkinTex) {
    walkerSkinTex = createDecayedSkinTexture('#7e8c7c', '#5e6b5d', '#4f3b43'); // Ashen decayed olive
    runnerSkinTex = createDecayedSkinTexture('#8c8275', '#6b6156', '#4a3237'); // Gaunt pale necrotic
    bruteSkinTex = createDecayedSkinTexture('#6b7768', '#4b5449', '#38252b'); // Scarred dark necrotic
    flannelTex = createTornFlannelTexture();
    denimTex = createTornDenimTexture();
    runnerShirtTex = createRunnerShirtTexture();
    bruteArmorTex = createBruteArmorTexture();
  }

  return {
    walkerSkin: walkerSkinTex,
    runnerSkin: runnerSkinTex,
    bruteSkin: bruteSkinTex,
    flannel: flannelTex,
    denim: denimTex,
    runnerShirt: runnerShirtTex,
    bruteArmor: bruteArmorTex,
  };
}

// Reusable Geometry Cache
interface GeometryCache {
  // Head & Anatomy
  cranium: THREE.BufferGeometry;
  jaw: THREE.BufferGeometry;
  mouthCavity: THREE.BufferGeometry;
  teeth: THREE.BufferGeometry;
  eye: THREE.BufferGeometry;
  eyeSocket: THREE.BufferGeometry;
  hairPatch: THREE.BufferGeometry;
  hairStrand: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;

  // Torso & Pelvis
  chestTorso: THREE.BufferGeometry;
  waist: THREE.BufferGeometry;
  pelvis: THREE.BufferGeometry;
  belt: THREE.BufferGeometry;
  shirtCollar: THREE.BufferGeometry;

  // Arms & Articulated Hands
  upperArm: THREE.BufferGeometry;
  sleeveCuff: THREE.BufferGeometry;
  forearm: THREE.BufferGeometry;
  wrist: THREE.BufferGeometry;
  handPalm: THREE.BufferGeometry;
  finger: THREE.BufferGeometry;
  thumb: THREE.BufferGeometry;

  // Legs & Boots
  thigh: THREE.BufferGeometry;
  knee: THREE.BufferGeometry;
  calf: THREE.BufferGeometry;
  boot: THREE.BufferGeometry;
  bootSole: THREE.BufferGeometry;

  // Type Specific Extras
  bruteCranium: THREE.BufferGeometry;
  bruteHelmet: THREE.BufferGeometry;
  bruteChestPlate: THREE.BufferGeometry;
  brutePauldron: THREE.BufferGeometry;
  bruteGorget: THREE.BufferGeometry;
  bruteJawGuard: THREE.BufferGeometry;
  bruteHeavyThigh: THREE.BufferGeometry;
  bruteHeavyCalf: THREE.BufferGeometry;
  bruteHeavyBoot: THREE.BufferGeometry;
}

let sharedGeometries: GeometryCache | null = null;

export function getSharedGeometries(): GeometryCache {
  if (sharedGeometries) return sharedGeometries;

  // 1. Head & Cranium - rounded human skull with realistic cranial taper
  const cranium = new THREE.SphereGeometry(0.14, 12, 10);
  cranium.scale(0.92, 1.05, 1.06);

  const jaw = new THREE.BoxGeometry(0.13, 0.09, 0.14);
  const mouthCavity = new THREE.BoxGeometry(0.10, 0.05, 0.08);
  const teeth = new THREE.BoxGeometry(0.09, 0.02, 0.025);
  const eye = new THREE.SphereGeometry(0.03, 8, 8);
  const eyeSocket = new THREE.CylinderGeometry(0.042, 0.038, 0.02, 8);
  eyeSocket.rotateX(Math.PI / 2);

  const hairPatch = new THREE.BoxGeometry(0.15, 0.04, 0.14);
  const hairStrand = new THREE.BoxGeometry(0.04, 0.08, 0.04);
  const neck = new THREE.CylinderGeometry(0.065, 0.075, 0.12, 8);

  // 2. Torso - tapered ribcage into waist and pelvis
  const chestTorso = new THREE.BoxGeometry(0.44, 0.46, 0.24);
  const waist = new THREE.BoxGeometry(0.36, 0.20, 0.21);
  const pelvis = new THREE.BoxGeometry(0.38, 0.20, 0.23);
  const belt = new THREE.BoxGeometry(0.40, 0.05, 0.25);
  const shirtCollar = new THREE.BoxGeometry(0.24, 0.06, 0.18);

  // 3. Arms & Grasping Hands
  const upperArm = new THREE.CylinderGeometry(0.052, 0.046, 0.30, 8);
  upperArm.translate(0, -0.15, 0);

  const sleeveCuff = new THREE.CylinderGeometry(0.058, 0.054, 0.14, 8);
  sleeveCuff.translate(0, -0.07, 0);

  const forearm = new THREE.CylinderGeometry(0.046, 0.038, 0.28, 8);
  forearm.translate(0, -0.14, 0);

  const wrist = new THREE.CylinderGeometry(0.038, 0.034, 0.06, 8);
  wrist.translate(0, -0.03, 0);

  const handPalm = new THREE.BoxGeometry(0.08, 0.09, 0.035);
  handPalm.translate(0, -0.045, 0);

  // Grasping curved finger digits
  const finger = new THREE.BoxGeometry(0.016, 0.065, 0.018);
  finger.translate(0, -0.032, 0);

  const thumb = new THREE.BoxGeometry(0.018, 0.05, 0.018);
  thumb.translate(0, -0.025, 0);

  // 4. Legs & Combat Boots
  const thigh = new THREE.CylinderGeometry(0.082, 0.068, 0.42, 8);
  thigh.translate(0, -0.21, 0);

  const knee = new THREE.SphereGeometry(0.068, 8, 8);

  const calf = new THREE.CylinderGeometry(0.068, 0.052, 0.40, 8);
  calf.translate(0, -0.20, 0);

  const boot = new THREE.BoxGeometry(0.14, 0.12, 0.24);
  const bootSole = new THREE.BoxGeometry(0.15, 0.03, 0.25);

  // 5. Brute Heavy Soldier Geometries
  const bruteCranium = new THREE.SphereGeometry(0.19, 12, 10);
  bruteCranium.scale(0.95, 1.05, 1.05);

  const bruteHelmet = new THREE.CylinderGeometry(0.24, 0.23, 0.18, 10);
  const bruteChestPlate = new THREE.BoxGeometry(0.66, 0.52, 0.14);
  const brutePauldron = new THREE.BoxGeometry(0.26, 0.22, 0.32);
  const bruteGorget = new THREE.CylinderGeometry(0.18, 0.22, 0.14, 10);
  const bruteJawGuard = new THREE.BoxGeometry(0.24, 0.14, 0.18);

  const bruteHeavyThigh = new THREE.CylinderGeometry(0.12, 0.10, 0.48, 8);
  bruteHeavyThigh.translate(0, -0.24, 0);

  const bruteHeavyCalf = new THREE.CylinderGeometry(0.10, 0.08, 0.46, 8);
  bruteHeavyCalf.translate(0, -0.23, 0);

  const bruteHeavyBoot = new THREE.BoxGeometry(0.18, 0.15, 0.32);

  sharedGeometries = {
    cranium,
    jaw,
    mouthCavity,
    teeth,
    eye,
    eyeSocket,
    hairPatch,
    hairStrand,
    neck,
    chestTorso,
    waist,
    pelvis,
    belt,
    shirtCollar,
    upperArm,
    sleeveCuff,
    forearm,
    wrist,
    handPalm,
    finger,
    thumb,
    thigh,
    knee,
    calf,
    boot,
    bootSole,
    bruteCranium,
    bruteHelmet,
    bruteChestPlate,
    brutePauldron,
    bruteGorget,
    bruteJawGuard,
    bruteHeavyThigh,
    bruteHeavyCalf,
    bruteHeavyBoot,
  };

  return sharedGeometries;
}
