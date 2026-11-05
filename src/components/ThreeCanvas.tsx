/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GameState, WeaponId } from '../types/gameTypes';
import { PlayerController } from '../controllers/PlayerController';
import { TargetManager } from '../systems/TargetManager';
import { ZombieManager } from '../systems/ZombieManager';
import { VFXManager } from '../systems/VFXManager';
import { WeaponSystem } from '../systems/WeaponSystem';
import { ExplosiveBarrelManager } from '../systems/ExplosiveBarrelManager';
import { createWeaponArsenal } from '../entities/WeaponModels';
import { ClaymoreManager } from '../entities/ClaymoreManager';

interface ThreeCanvasProps {
  gameState: GameState;
  fireKick: number;
  damageKick: number;
  isDying?: boolean;
  fov?: number;
  cameraSway?: boolean;
  mouseSensitivity?: number;
  visualQuality?: 'standard' | 'optimized';
  onPointerLockChange?: (locked: boolean) => void;
  onPlayerDamaged?: (damage: number) => void;
  onAmmoChanged?: (ammo: number, reserve?: number) => void;
  onWeaponChanged?: (weapon: WeaponId, name: string, ammo: number, maxAmmo: number, reserve: number) => void;
  onAirburstTriggered?: () => void;
  onScoreEarned?: (points: number, coins: number) => void;
  onHitMarker?: (isKill: boolean, isHeadshot?: boolean) => void;
  onZombieKilled?: (isHeadshot: boolean) => void;
  onWaveCleared?: (wave: number, scoreBonus: number, coinsBonus: number) => void;
  onWaveStarted?: (wave: number, totalHostiles: number) => void;
  onHostilesCountChanged?: (remaining: number, total: number) => void;
  onReloadStarted?: () => void;
  onReloadProgress?: (progress: number) => void;
  onReloadCompleted?: () => void;
  onEmptyAlert?: () => void;
  onRecoilKick?: (amount: number) => void;
  onDeathCompleted?: () => void;
  fireTriggerRef?: React.MutableRefObject<(() => void) | null>;
  reloadTriggerRef?: React.MutableRefObject<(() => void) | null>;
  switchWeaponTriggerRef?: React.MutableRefObject<((weapon: WeaponId) => void) | null>;
  airburstTriggerRef?: React.MutableRefObject<(() => void) | null>;
  addAmmoTriggerRef?: React.MutableRefObject<((weapon: WeaponId, amount: number) => void) | null>;
  unlockWeaponTriggerRef?: React.MutableRefObject<((weapon: WeaponId) => void) | null>;
  spawnZombieTriggerRef?: React.MutableRefObject<(() => void) | null>;
  spawnRunnerTriggerRef?: React.MutableRefObject<(() => void) | null>;
  spawnBruteTriggerRef?: React.MutableRefObject<(() => void) | null>;
  killAllZombiesTriggerRef?: React.MutableRefObject<(() => void) | null>;
  clearWaveTriggerRef?: React.MutableRefObject<(() => void) | null>;
  skipToWaveTriggerRef?: React.MutableRefObject<((wave: number) => void) | null>;
  startNextWaveTriggerRef?: React.MutableRefObject<((wave: number) => void) | null>;
  redeployTriggerRef?: React.MutableRefObject<((startWave?: number) => void) | null>;
  knockbackZombiesTriggerRef?: React.MutableRefObject<((radius?: number) => void) | null>;
  refillAllWeaponsTriggerRef?: React.MutableRefObject<(() => void) | null>;
  touchLookSensitivity?: number;
  isMobileTouchActive?: boolean;
  touchMoveRef?: React.MutableRefObject<((forward: number, right: number, sprint?: boolean) => void) | null>;
  touchLookRef?: React.MutableRefObject<((deltaX: number, deltaY: number) => void) | null>;
  touchTriggerRef?: React.MutableRefObject<((held: boolean) => void) | null>;
  onPlantClaymoreTriggered?: () => void;
  plantClaymoreTriggerRef?: React.MutableRefObject<(() => boolean) | null>;
  quickTurnRef?: React.MutableRefObject<(() => void) | null>;
  snapTurnRef?: React.MutableRefObject<((angleInRadians: number) => void) | null>;
}

// Reusable math objects to eliminate per-frame GC allocations
const _vec3 = new THREE.Vector3();
const _camPosTarget = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _camCurrentLook = new THREE.Vector3();

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  gameState,
  fireKick,
  damageKick,
  isDying = false,
  fov = 75,
  cameraSway = true,
  mouseSensitivity = 1.0,
  visualQuality = 'standard',
  touchLookSensitivity = 1.0,
  isMobileTouchActive = false,
  onPointerLockChange,
  onPlayerDamaged,
  onAmmoChanged,
  onWeaponChanged,
  onAirburstTriggered,
  onScoreEarned,
  onHitMarker,
  onZombieKilled,
  onWaveCleared,
  onWaveStarted,
  onHostilesCountChanged,
  onReloadStarted,
  onReloadProgress,
  onReloadCompleted,
  onEmptyAlert,
  onRecoilKick,
  onDeathCompleted,
  fireTriggerRef,
  reloadTriggerRef,
  switchWeaponTriggerRef,
  airburstTriggerRef,
  addAmmoTriggerRef,
  unlockWeaponTriggerRef,
  spawnZombieTriggerRef,
  spawnRunnerTriggerRef,
  spawnBruteTriggerRef,
  killAllZombiesTriggerRef,
  clearWaveTriggerRef,
  skipToWaveTriggerRef,
  startNextWaveTriggerRef,
  redeployTriggerRef,
  knockbackZombiesTriggerRef,
  refillAllWeaponsTriggerRef,
  touchMoveRef,
  touchLookRef,
  touchTriggerRef,
  onPlantClaymoreTriggered,
  plantClaymoreTriggerRef,
  quickTurnRef,
  snapTurnRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<PlayerController | null>(null);
  const prevGameStateRef = useRef<GameState>(gameState);
  const stateRef = useRef({
    gameState,
    fireKick,
    damageKick,
    isDying,
    fov,
    cameraSway,
    mouseSensitivity,
    visualQuality,
    touchLookSensitivity,
    isMobileTouchActive,
    onPointerLockChange,
    onPlayerDamaged,
    onAmmoChanged,
    onWeaponChanged,
    onAirburstTriggered,
    onPlantClaymoreTriggered,
    onScoreEarned,
    onHitMarker,
    onZombieKilled,
    onWaveCleared,
    onWaveStarted,
    onHostilesCountChanged,
    onReloadStarted,
    onReloadProgress,
    onReloadCompleted,
    onEmptyAlert,
    onRecoilKick,
    onDeathCompleted,
  });

  // Keep stateRef fresh for render loop without re-triggering useEffect
  useEffect(() => {
    stateRef.current = {
      gameState,
      fireKick,
      damageKick,
      isDying,
      fov,
      cameraSway,
      mouseSensitivity,
      visualQuality,
      touchLookSensitivity,
      isMobileTouchActive,
      onPointerLockChange,
      onPlayerDamaged,
      onAmmoChanged,
      onWeaponChanged,
      onAirburstTriggered,
      onPlantClaymoreTriggered,
      onScoreEarned,
      onHitMarker,
      onZombieKilled,
      onWaveCleared,
      onWaveStarted,
      onHostilesCountChanged,
      onReloadStarted,
      onReloadProgress,
      onReloadCompleted,
      onEmptyAlert,
      onRecoilKick,
      onDeathCompleted,
    };

    // When deploying from MENU or restarting from GAMEOVER, reset controller position.
    // NEVER reset coordinates when resuming from PAUSED!
    if ((prevGameStateRef.current === 'MENU' || prevGameStateRef.current === 'GAMEOVER') && gameState === 'PLAYING') {
      controllerRef.current?.resetPosition(0, 4.0, 0);
    }
    prevGameStateRef.current = gameState;
  }, [
    gameState,
    fireKick,
    damageKick,
    isDying,
    fov,
    cameraSway,
    mouseSensitivity,
    visualQuality,
    touchLookSensitivity,
    isMobileTouchActive,
    onPointerLockChange,
    onPlayerDamaged,
    onAmmoChanged,
    onWeaponChanged,
    onAirburstTriggered,
    onScoreEarned,
    onHitMarker,
    onZombieKilled,
    onWaveCleared,
    onWaveStarted,
    onHostilesCountChanged,
    onReloadStarted,
    onReloadProgress,
    onReloadCompleted,
    onEmptyAlert,
    onRecoilKick,
    onDeathCompleted,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL to adapt rendering parameters safely
    const isSoftwareGl = (() => {
      try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 1. Scene & Dusk Fog
    const scene = new THREE.Scene();
    const duskSkyColor = new THREE.Color(0x16132b);
    const duskFogColor = new THREE.Color(0x231834);
    scene.background = duskSkyColor;
    scene.fog = new THREE.FogExp2(duskFogColor, 0.016);

    // 2. Camera Setup
    const width = container.clientWidth || window.innerWidth || 800;
    const height = container.clientHeight || window.innerHeight || 600;
    const camera = new THREE.PerspectiveCamera(stateRef.current.fov, width / height, 0.1, 300);
    camera.position.set(0, 1.7, 5);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 4. Procedural Studio Environment for PBR Reflections
    let roomEnvTexture: THREE.Texture | null = null;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      roomEnvTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = roomEnvTexture;
      pmremGenerator.dispose();
    } catch (e) {
      console.warn('RoomEnvironment generation warning:', e);
    }

    // 5. Procedural Texture Generators
    const createAsphaltTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#1e2229';
      ctx.fillRect(0, 0, 512, 512);

      // Noise speckles
      for (let i = 0; i < 4000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const c = Math.floor(Math.random() * 30 + 15);
        ctx.fillStyle = `rgb(${c}, ${c}, ${c})`;
        ctx.fillRect(x, y, 2, 2);
      }

      // Compound tactical grid markings
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.25)';
      ctx.lineWidth = 2;
      const step = 64;
      for (let x = 0; x <= 512; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      for (let y = 0; y <= 512; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(16, 16);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    const createHazardTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0f1115';
      ctx.fillRect(0, 0, 256, 64);

      // Yellow-black warning stripes
      ctx.fillStyle = '#eab308';
      const stripeWidth = 24;
      for (let x = -64; x < 320; x += stripeWidth * 2) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + stripeWidth, 0);
        ctx.lineTo(x + stripeWidth - 28, 64);
        ctx.lineTo(x - 28, 64);
        ctx.closePath();
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.set(4, 1);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const createCrateTexture = (label: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#3f4538'; // Military olive-drab
      ctx.fillRect(0, 0, 256, 256);

      // Weathered edge frame
      ctx.strokeStyle = '#272c23';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, 242, 242);

      // Diagonal cross brace line
      ctx.strokeStyle = '#2d3328';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(20, 20);
      ctx.lineTo(236, 236);
      ctx.stroke();

      // Tactical stencil label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OUTPOST-Z', 128, 90);
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = '#eab308';
      ctx.fillText(label, 128, 170);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const groundTex = createAsphaltTexture();
    const hazardTex = createHazardTexture();
    const crateTex = createCrateTexture('AMMO / MUNITION');

    // 6. Lighting Setup: Sunset Dusk Directional + Cool Sky Fill
    const sunsetLight = new THREE.DirectionalLight(0xff7a33, 2.4);
    sunsetLight.position.set(40, 25, -35);
    sunsetLight.castShadow = !isSoftwareGl;
    if (sunsetLight.castShadow) {
      sunsetLight.shadow.mapSize.width = 1024;
      sunsetLight.shadow.mapSize.height = 1024;
      sunsetLight.shadow.camera.near = 0.5;
      sunsetLight.shadow.camera.far = 120;
      sunsetLight.shadow.camera.left = -35;
      sunsetLight.shadow.camera.right = 35;
      sunsetLight.shadow.camera.top = 35;
      sunsetLight.shadow.camera.bottom = -35;
      sunsetLight.shadow.bias = -0.0005;
    }
    scene.add(sunsetLight);

    // Cool twilight sky/ground fill
    const hemiLight = new THREE.HemisphereLight(0x4c5b75, 0x1a1215, 0.7);
    scene.add(hemiLight);

    // Warm horizon glow disk at sunset source
    const sunGlowGeo = new THREE.SphereGeometry(12, 16, 16);
    const sunGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff5511,
      transparent: true,
      opacity: 0.85,
    });
    const sunGlowMesh = new THREE.Mesh(sunGlowGeo, sunGlowMat);
    sunGlowMesh.position.copy(sunsetLight.position).multiplyScalar(2.0);
    scene.add(sunGlowMesh);

    // 7. Ground Courtyard (Extended beyond compound)
    const groundGeo = new THREE.PlaneGeometry(160, 160);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.85,
      metalness: 0.15,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = !isSoftwareGl;
    scene.add(groundMesh);

    // 8. Perimeter Concrete Blast Barriers (Composite Models)
    const compoundGroup = new THREE.Group();
    scene.add(compoundGroup);

    const barrierGeo = new THREE.BoxGeometry(6, 2.2, 0.8);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.05,
    });
    const barrierHazardMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.6,
      metalness: 0.1,
    });

    const createBarrierSegment = (x: number, z: number, rotY: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = rotY;

      // Concrete block base
      const block = new THREE.Mesh(barrierGeo, barrierMat);
      block.position.y = 1.1;
      block.castShadow = !isSoftwareGl;
      block.receiveShadow = !isSoftwareGl;
      group.add(block);

      // Warning stripe top banner
      const stripeGeo = new THREE.BoxGeometry(6.02, 0.35, 0.82);
      const stripe = new THREE.Mesh(stripeGeo, barrierHazardMat);
      stripe.position.y = 1.95;
      group.add(stripe);

      // Steel rebar posts & barbed wire top
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x22262d, metalness: 0.8, roughness: 0.4 });
      for (let i = -2.5; i <= 2.5; i += 2.5) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(i, 2.5, 0);
        group.add(post);
      }

      const wireGeo = new THREE.CylinderGeometry(0.015, 0.015, 6, 4);
      const wire = new THREE.Mesh(wireGeo, postMat);
      wire.rotation.z = Math.PI / 2;
      wire.position.set(0, 2.8, 0);
      group.add(wire);

      return group;
    };

    // Build rectangular military perimeter with gap for compound gate
    const compoundHalf = 24;
    for (let x = -compoundHalf; x <= compoundHalf; x += 6) {
      // Leave entrance opening at x between -4 and 4 on front wall
      if (Math.abs(x) > 3) {
        compoundGroup.add(createBarrierSegment(x, compoundHalf, 0));
      }
      compoundGroup.add(createBarrierSegment(x, -compoundHalf, 0));
    }
    for (let z = -compoundHalf + 3; z < compoundHalf; z += 6) {
      compoundGroup.add(createBarrierSegment(compoundHalf, z, Math.PI / 2));
      compoundGroup.add(createBarrierSegment(-compoundHalf, z, Math.PI / 2));
    }

    // 9. Security Watchtowers with Glowing Floodlights (3-12 Part Procedural Composite)
    const createWatchtower = (x: number, z: number, targetCenter: THREE.Vector3) => {
      const tower = new THREE.Group();
      tower.position.set(x, 0, z);

      const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 });
      const woodPlatformMat = new THREE.MeshStandardMaterial({ color: 0x242d38, roughness: 0.85 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.5 });

      // 4 Heavy structural steel support legs
      const legGeo = new THREE.CylinderGeometry(0.18, 0.22, 10, 8);
      const legOffset = 2.4;
      const legPositions = [
        [-legOffset, -legOffset],
        [legOffset, -legOffset],
        [-legOffset, legOffset],
        [legOffset, legOffset],
      ];

      legPositions.forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, metalMat);
        leg.position.set(lx, 5, lz);
        leg.castShadow = !isSoftwareGl;
        tower.add(leg);
      });

      // Diagonal cross bracing
      const braceGeo = new THREE.CylinderGeometry(0.06, 0.06, 6.8, 6);
      const brace1 = new THREE.Mesh(braceGeo, metalMat);
      brace1.position.set(0, 5, legOffset);
      brace1.rotation.z = 0.85;
      tower.add(brace1);
      const brace2 = new THREE.Mesh(braceGeo, metalMat);
      brace2.position.set(0, 5, -legOffset);
      brace2.rotation.z = -0.85;
      tower.add(brace2);

      // Observation deck platform floor
      const platformGeo = new THREE.BoxGeometry(5.8, 0.4, 5.8);
      const platform = new THREE.Mesh(platformGeo, woodPlatformMat);
      platform.position.y = 10.2;
      platform.castShadow = !isSoftwareGl;
      tower.add(platform);

      // Deck safety railings
      const railGeo = new THREE.CylinderGeometry(0.05, 0.05, 5.6, 6);
      const railFront = new THREE.Mesh(railGeo, metalMat);
      railFront.rotation.z = Math.PI / 2;
      railFront.position.set(0, 11.2, 2.8);
      tower.add(railFront);
      const railBack = new THREE.Mesh(railGeo, metalMat);
      railBack.rotation.z = Math.PI / 2;
      railBack.position.set(0, 11.2, -2.8);
      tower.add(railBack);

      // Roof canopy
      const roofPillarGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
      legPositions.forEach(([lx, lz]) => {
        const pillar = new THREE.Mesh(roofPillarGeo, metalMat);
        pillar.position.set(lx * 0.9, 11.7, lz * 0.9);
        tower.add(pillar);
      });
      const roofGeo = new THREE.ConeGeometry(4.4, 1.4, 4);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 13.7;
      roof.castShadow = !isSoftwareGl;
      tower.add(roof);

      // Tactical Floodlight Fixture
      const lightHousingGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.7, 12);
      const housingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
      const housing = new THREE.Mesh(lightHousingGeo, housingMat);
      housing.position.set(0, 10.8, 0);
      housing.rotation.x = Math.PI / 3;
      tower.add(housing);

      // Glowing lens bulb
      const lensGeo = new THREE.SphereGeometry(0.3, 12, 12);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0xffe29a });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(0, 10.7, 0.35);
      tower.add(lens);

      // High-intensity SpotLight illuminating courtyard
      const spotLight = new THREE.SpotLight(0xfff1cf, 4.5, 55, Math.PI / 5, 0.35, 1.2);
      spotLight.position.set(x, 11, z);
      spotLight.userData = { baseIntensity: 4.5 };
      const lightTarget = new THREE.Object3D();
      lightTarget.position.copy(targetCenter);
      scene.add(lightTarget);
      spotLight.target = lightTarget;
      spotLight.castShadow = !isSoftwareGl;
      if (spotLight.castShadow) {
        spotLight.shadow.mapSize.width = 512;
        spotLight.shadow.mapSize.height = 512;
        spotLight.shadow.bias = -0.001;
      }
      scene.add(spotLight);
      courtyardSpotlights.push(spotLight);

      // Atmospheric cone beam
      const beamGeo = new THREE.ConeGeometry(6.5, 26, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfffae6,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, 6, z);
      beam.lookAt(targetCenter);
      beam.rotateX(Math.PI / 2);
      scene.add(beam);

      return tower;
    };

    const courtyardSpotlights: THREE.SpotLight[] = [];

    // Four corner watchtowers guarding the outpost
    compoundGroup.add(createWatchtower(-compoundHalf - 2, -compoundHalf - 2, new THREE.Vector3(-6, 0, -6)));
    compoundGroup.add(createWatchtower(compoundHalf + 2, -compoundHalf - 2, new THREE.Vector3(6, 0, -6)));
    compoundGroup.add(createWatchtower(-compoundHalf - 2, compoundHalf + 2, new THREE.Vector3(-6, 0, 6)));
    compoundGroup.add(createWatchtower(compoundHalf + 2, compoundHalf + 2, new THREE.Vector3(6, 0, 6)));

    // Watchtower Emergency Alarm Beacon (mounted atop northwest watchtower)
    const beaconRotator = new THREE.Group();
    beaconRotator.position.set(-compoundHalf - 2, 14.7, -compoundHalf - 2);

    const beaconBaseGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.4, 12);
    const beaconBaseMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 });
    const beaconBase = new THREE.Mesh(beaconBaseGeo, beaconBaseMat);
    beaconBase.position.set(-compoundHalf - 2, 14.3, -compoundHalf - 2);
    compoundGroup.add(beaconBase);

    // Glowing red glass dome
    const beaconDomeGeo = new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const beaconDomeMat = new THREE.MeshStandardMaterial({
      color: 0xff1100,
      emissive: 0xff0000,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    const beaconDome = new THREE.Mesh(beaconDomeGeo, beaconDomeMat);
    beaconDome.position.set(-compoundHalf - 2, 14.48, -compoundHalf - 2);
    compoundGroup.add(beaconDome);

    // Rotating red emergency spotlight & atmospheric beam
    const beaconSpotLight = new THREE.SpotLight(0xff1100, isSoftwareGl ? 3.0 : 6.0, 50, Math.PI / 4, 0.4, 1.2);
    beaconSpotLight.position.set(0, 0, 0);
    const beaconTarget = new THREE.Object3D();
    beaconTarget.position.set(22, -6, 0);
    beaconRotator.add(beaconTarget);
    beaconRotator.add(beaconSpotLight);
    beaconSpotLight.target = beaconTarget;

    const beaconBeamGeo = new THREE.ConeGeometry(5.2, 22, 16, 1, true);
    const beaconBeamMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beaconBeam = new THREE.Mesh(beaconBeamGeo, beaconBeamMat);
    beaconBeam.position.set(11, -3, 0);
    beaconBeam.rotation.z = -Math.PI / 2.3;
    beaconRotator.add(beaconBeam);

    compoundGroup.add(beaconRotator);

    // 10. Tactical Courtyard Props: Crates, Barrels, Sandbag Bunkers
    const crateGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const crateMat = new THREE.MeshStandardMaterial({
      map: crateTex,
      roughness: 0.7,
      metalness: 0.15,
    });

    const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.4, 16);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b, // Biohazard/fuel dark red
      roughness: 0.45,
      metalness: 0.6,
    });
    const barrelYellowMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Toxic fuel amber
      roughness: 0.5,
      metalness: 0.5,
    });

    const addCrateStack = (cx: number, cz: number, rot: number) => {
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      g.rotation.y = rot;

      const c1 = new THREE.Mesh(crateGeo, crateMat);
      c1.position.set(0, 0.8, 0);
      c1.castShadow = !isSoftwareGl;
      c1.receiveShadow = !isSoftwareGl;
      g.add(c1);

      const c2 = new THREE.Mesh(crateGeo, crateMat);
      c2.position.set(1.65, 0.8, 0);
      c2.castShadow = !isSoftwareGl;
      g.add(c2);

      const c3 = new THREE.Mesh(crateGeo, crateMat);
      c3.position.set(0.8, 2.4, 0);
      c3.rotation.y = 0.1;
      c3.castShadow = !isSoftwareGl;
      g.add(c3);

      compoundGroup.add(g);
    };

    addCrateStack(-7, -6, 0.2);
    addCrateStack(9, -8, -0.4);
    addCrateStack(-11, 8, 0.7);
    addCrateStack(12, 6, -0.6);

    // Barrel clusters
    const addBarrelCluster = (bx: number, bz: number) => {
      const g = new THREE.Group();
      g.position.set(bx, 0, bz);

      const b1 = new THREE.Mesh(barrelGeo, barrelMat);
      b1.position.set(0, 0.7, 0);
      b1.castShadow = !isSoftwareGl;
      g.add(b1);

      const b2 = new THREE.Mesh(barrelGeo, barrelYellowMat);
      b2.position.set(0.85, 0.7, 0.4);
      b2.castShadow = !isSoftwareGl;
      g.add(b2);

      const b3 = new THREE.Mesh(barrelGeo, barrelMat);
      b3.position.set(-0.6, 0.7, 0.6);
      b3.castShadow = !isSoftwareGl;
      g.add(b3);

      compoundGroup.add(g);
    };

    addBarrelCluster(-5, 4);
    addBarrelCluster(7, -3);
    addBarrelCluster(14, -14);
    addBarrelCluster(-14, -12);

    // Central Sandbag Defense Checkpoint in Courtyard
    const sandbagGeo = new THREE.BoxGeometry(1.2, 0.45, 0.6);
    const sandbagMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.95,
      metalness: 0.05,
    });

    const bunkerGroup = new THREE.Group();
    bunkerGroup.position.set(0, 0, 1.5);
    for (let x = -3; x <= 3; x += 1.1) {
      const sb1 = new THREE.Mesh(sandbagGeo, sandbagMat);
      sb1.position.set(x, 0.22, 0);
      sb1.castShadow = !isSoftwareGl;
      bunkerGroup.add(sb1);

      const sb2 = new THREE.Mesh(sandbagGeo, sandbagMat);
      sb2.position.set(x + 0.1, 0.65, 0);
      sb2.castShadow = !isSoftwareGl;
      bunkerGroup.add(sb2);

      const sb3 = new THREE.Mesh(sandbagGeo, sandbagMat);
      sb3.position.set(x - 0.05, 1.08, 0);
      sb3.castShadow = !isSoftwareGl;
      bunkerGroup.add(sb3);
    }
    compoundGroup.add(bunkerGroup);

    // 11. Floating Dust & Ember Particle System
    const particleCount = isSoftwareGl ? 80 : 250;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 50;
      particlePositions[i * 3 + 1] = Math.random() * 12 + 0.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      particleVelocities.push({
        x: (Math.random() - 0.5) * 0.015 + 0.01,
        y: Math.random() * 0.01 + 0.005,
        z: (Math.random() - 0.5) * 0.015,
      });
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    // Glow ember point texture
    const emberCanvas = document.createElement('canvas');
    emberCanvas.width = 32;
    emberCanvas.height = 32;
    const emberCtx = emberCanvas.getContext('2d')!;
    const grad = emberCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 180, 80, 1)');
    grad.addColorStop(0.4, 'rgba(255, 120, 30, 0.6)');
    grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
    emberCtx.fillStyle = grad;
    emberCtx.fillRect(0, 0, 32, 32);

    const emberTex = new THREE.CanvasTexture(emberCanvas);
    const particleMat = new THREE.PointsMaterial({
      size: 0.35,
      map: emberTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 12. Operative First-Person Multi-Weapon Arsenal Models & Tumbling Brass Physics
    const weaponArsenal = createWeaponArsenal(isSoftwareGl);
    const weaponGroup = weaponArsenal.rootGroup;
    camera.add(weaponGroup);
    scene.add(camera);

    // Muzzle flash light (flickers on fireKick)
    const muzzleLight = new THREE.PointLight(0xffaa33, 0, 8);
    muzzleLight.position.set(0, 0.05, -0.42);
    weaponGroup.add(muzzleLight);

    // 13. Practice Target Dummies, Live Walker & Runner Zombies & Combat Visual Effects
    const targetManager = new TargetManager(scene);
    const vfxManager = new VFXManager(scene, weaponGroup);
    let weaponSystem: WeaponSystem;
    let barrelManager: ExplosiveBarrelManager | null = null;
    const zombieManager = new ZombieManager(scene, {
      onZombieKilled: (isHeadshot, zombieType, kills) => {
        stateRef.current.onZombieKilled?.(isHeadshot);
      },
      onPlayerDamage: (damage) => {
        stateRef.current.onPlayerDamaged?.(damage);
      },
      onWaveCleared: (wave, scoreBonus, coinsBonus) => {
        weaponSystem?.refillAllMags();
        stateRef.current.onWaveCleared?.(wave, scoreBonus, coinsBonus);
      },
      onWaveStarted: (wave, totalHostiles) => {
        barrelManager?.resetWaveBarrels();
        stateRef.current.onWaveStarted?.(wave, totalHostiles);
      },
      onHostilesCountChanged: (remaining, total) => {
        stateRef.current.onHostilesCountChanged?.(remaining, total);
      },
      onScoreEarned: (pts, coins) => {
        stateRef.current.onScoreEarned?.(pts, coins);
      },
    });
    const envMeshes = [groundMesh, compoundGroup];

    // 14. Interactive Exploding Fuel Barrels Manager
    barrelManager = new ExplosiveBarrelManager(
      scene,
      zombieManager,
      vfxManager,
      () => (controllerRef.current ? controllerRef.current.getPosition() : camera.position),
      {
        onScoreEarned: (pts, coins) => stateRef.current.onScoreEarned?.(pts, coins),
        onZombieEliminated: (isHeadshot) => stateRef.current.onZombieKilled?.(isHeadshot),
        onPlayerDamaged: (dmg) => stateRef.current.onPlayerDamaged?.(dmg),
        onRecoilKick: (amt) => stateRef.current.onRecoilKick?.(amt),
        onHitMarker: (isKill, isHeadshot) => stateRef.current.onHitMarker?.(isKill, isHeadshot),
      }
    );
    barrelManager.resetWaveBarrels();

    // 15. Multi-Weapon Raycasting Weapon System
    weaponSystem = new WeaponSystem(
      camera,
      weaponGroup,
      targetManager,
      zombieManager,
      vfxManager,
      envMeshes,
      {
        onAmmoChanged: (ammo, res) => stateRef.current.onAmmoChanged?.(ammo, res),
        onWeaponChanged: (wId, name, ammo, maxAmmo, res) =>
          stateRef.current.onWeaponChanged?.(wId, name, ammo, maxAmmo, res),
        onScoreEarned: (pts, coins) => stateRef.current.onScoreEarned?.(pts, coins),
        onHitMarker: (isKill, isHeadshot) => stateRef.current.onHitMarker?.(isKill, isHeadshot),
        onZombieEliminated: (isHeadshot) => stateRef.current.onZombieKilled?.(isHeadshot),
        onReloadStarted: () => stateRef.current.onReloadStarted?.(),
        onReloadProgress: (prog) => stateRef.current.onReloadProgress?.(prog),
        onReloadCompleted: () => stateRef.current.onReloadCompleted?.(),
        onEmptyAlert: () => stateRef.current.onEmptyAlert?.(),
        onRecoilKick: (amount) => stateRef.current.onRecoilKick?.(amount),
      }
    );
    // 14.5 Claymore Minefield Manager
    let claymoreManager: ClaymoreManager | null = null;
    claymoreManager = new ClaymoreManager(scene, zombieManager, vfxManager, {
      onScoreEarned: (pts, coins) => stateRef.current.onScoreEarned?.(pts, coins),
      onZombieKilled: (isHeadshot) => stateRef.current.onZombieKilled?.(isHeadshot),
      onRecoilKick: (amt) => stateRef.current.onRecoilKick?.(amt),
    });
    if (barrelManager) {
      claymoreManager.setBarrelManager(barrelManager);
    }

    weaponSystem.setBarrelManager(barrelManager);
    weaponSystem.setArsenal(weaponArsenal);

    if (fireTriggerRef) {
      fireTriggerRef.current = () => weaponSystem.fire();
    }
    if (reloadTriggerRef) {
      reloadTriggerRef.current = () => weaponSystem.reload();
    }
    if (switchWeaponTriggerRef) {
      switchWeaponTriggerRef.current = (wId: WeaponId) => weaponSystem.switchWeapon(wId);
    }
    if (unlockWeaponTriggerRef) {
      unlockWeaponTriggerRef.current = (wId: WeaponId) => weaponSystem.unlockWeapon(wId);
    }
    if (addAmmoTriggerRef) {
      addAmmoTriggerRef.current = (wId: WeaponId, amt: number) => weaponSystem.addReserveAmmo(wId, amt);
    }
    if (airburstTriggerRef) {
      airburstTriggerRef.current = () => {
        const res = zombieManager.triggerAirburst(playerController.getPosition());
        return res;
      };
    }
    if (knockbackZombiesTriggerRef) {
      knockbackZombiesTriggerRef.current = (radius = 5.0) => {
        zombieManager.knockbackNearbyZombies(playerController.getPosition(), radius, 6.0);
      };
    }
    if (refillAllWeaponsTriggerRef) {
      refillAllWeaponsTriggerRef.current = () => {
        weaponSystem.refillAllMags();
      };
    }
    if (spawnZombieTriggerRef) {
      spawnZombieTriggerRef.current = () => zombieManager.spawnFromRandomGate();
    }
    if (spawnRunnerTriggerRef) {
      spawnRunnerTriggerRef.current = () => zombieManager.spawnRunner();
    }
    if (spawnBruteTriggerRef) {
      spawnBruteTriggerRef.current = () => zombieManager.spawnBrute();
    }
    if (killAllZombiesTriggerRef) {
      killAllZombiesTriggerRef.current = () => zombieManager.killAll();
    }
    if (clearWaveTriggerRef) {
      clearWaveTriggerRef.current = () => zombieManager.clearCurrentWave();
    }
    if (skipToWaveTriggerRef) {
      skipToWaveTriggerRef.current = (w: number) => zombieManager.skipToWave(w);
    }
    if (startNextWaveTriggerRef) {
      startNextWaveTriggerRef.current = (w: number) => {
        barrelManager?.resetWaveBarrels();
        zombieManager.startWave(w);
      };
    }
    if (plantClaymoreTriggerRef) {
      plantClaymoreTriggerRef.current = () => {
        if (!controllerRef.current || !claymoreManager) return false;
        return claymoreManager.plantClaymore(
          controllerRef.current.getPosition(),
          controllerRef.current.getYaw()
        );
      };
    }
    if (redeployTriggerRef) {
      redeployTriggerRef.current = (startWave = 1) => {
        deathCollapseTimer = 0;
        deathFinished = false;
        playerController.reset(0, 4.0, 0);
        barrelManager?.resetWaveBarrels();
        claymoreManager?.reset();
        zombieManager.reset(startWave);
        weaponSystem.reset();
        vfxManager.reset();
        camera.rotation.set(0, 0, 0);
        camera.position.set(0, 1.75, 4.0);
        weaponGroup.visible = true;
        weaponGroup.position.set(0.24, -0.2, -0.48);
        weaponGroup.rotation.set(0.03, -0.05, 0);
      };
    }

    // 15. Player First-Person Controller (Pointer lock, WASD, Collisions, Weapon Sway, Footsteps, Weapon Switching)
    const playerController = new PlayerController({
      camera,
      weaponGroup,
      domElement: renderer.domElement,
      mouseSensitivity: stateRef.current.mouseSensitivity ?? 1.0,
      onPointerLockChange: (locked) => {
        stateRef.current.onPointerLockChange?.(locked);
      },
      onFire: () => {
        if (stateRef.current.gameState === 'PLAYING') {
          weaponSystem.fire();
        }
      },
      onReload: () => {
        if (stateRef.current.gameState === 'PLAYING') {
          weaponSystem.reload();
        }
      },
      onSwitchWeapon: (slot: 1 | 2 | 3 | 4 | 5 | 6) => {
        if (stateRef.current.gameState === 'PLAYING') {
          const map: Record<1 | 2 | 3 | 4 | 5 | 6, WeaponId> = {
            1: 'PISTOL',
            2: 'SHOTGUN',
            3: 'SMG',
            4: 'RIFLE',
            5: 'LMG',
            6: 'SNIPER',
          };
          weaponSystem.switchWeapon(map[slot]);
        }
      },
      onCycleWeapon: (direction: 1 | -1) => {
        if (stateRef.current.gameState === 'PLAYING') {
          const weaponOrder: WeaponId[] = ['PISTOL', 'SHOTGUN', 'SMG', 'RIFLE', 'LMG', 'SNIPER'];
          const available = weaponOrder.filter((w) => weaponSystem.unlockedWeapons[w]);
          const currIdx = available.indexOf(weaponSystem.equippedWeapon);
          if (currIdx !== -1 && available.length > 1) {
            let nextIdx = (currIdx + direction) % available.length;
            if (nextIdx < 0) nextIdx += available.length;
            weaponSystem.switchWeapon(available[nextIdx]);
          }
        }
      },
      onAirburst: () => {
        if (stateRef.current.gameState === 'PLAYING') {
          stateRef.current.onAirburstTriggered?.();
        }
      },
      onPlantClaymore: () => {
        if (stateRef.current.gameState === 'PLAYING') {
          stateRef.current.onPlantClaymoreTriggered?.();
        }
      },
    });
    controllerRef.current = playerController;

    if (touchMoveRef) {
      touchMoveRef.current = (f: number, r: number, s?: boolean) => playerController.setTouchMove(f, r, s);
    }
    if (touchLookRef) {
      touchLookRef.current = (dx: number, dy: number) => {
        playerController.addTouchLook(dx, dy, stateRef.current.touchLookSensitivity ?? 1.0);
      };
    }
    if (touchTriggerRef) {
      touchTriggerRef.current = (held: boolean) => playerController.setTouchTrigger(held);
    }
    if (quickTurnRef) {
      quickTurnRef.current = () => playerController.quickTurn180();
    }
    if (snapTurnRef) {
      snapTurnRef.current = (angle: number) => playerController.snapTurn(angle);
    }

    const handleCanvasClick = () => {
      // Do not request pointer lock if mobile touch controls are actively being used
      if (stateRef.current.isMobileTouchActive) return;
      if (stateRef.current.gameState === 'PLAYING' && !playerController.isLocked) {
        playerController.requestLock();
      }
    };
    renderer.domElement.addEventListener('click', handleCanvasClick);

    // 16. Animation Loop & Camera Kinematics
    const clock = new THREE.Clock();
    let frameId = 0;
    let menuAngle = 0;
    let deathCollapseTimer = 0;
    let deathFinished = false;

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const current = stateRef.current;

      // Update camera FOV if adjusted in settings
      if (camera.fov !== current.fov) {
        camera.fov = current.fov;
        camera.updateProjectionMatrix();
      }

      // Standby / Pause: Freeze delta simulation and world updates while preserving exact coordinates
      if (current.gameState === 'PAUSED') {
        weaponGroup.visible = true;
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(tick);
        return;
      }

      // Rotate Watchtower Emergency Alarm Beacon
      beaconRotator.rotation.y += delta * 2.4;

      // Subtle electrical flicker modulation on courtyard spotlights
      const time = clock.getElapsedTime();
      courtyardSpotlights.forEach((spot, idx) => {
        const flicker = Math.sin(time * 24 + idx * 1.5) * 0.04 + (Math.random() < 0.006 ? -0.25 : 0);
        spot.intensity = spot.userData.baseIntensity * Math.max(0.65, 1 + flicker);
      });

      // Update Target Dummies, Live Zombies, Exploding Barrels, VFX Particles, and Weapon System
      vfxManager.setVisualQuality(current.visualQuality || 'standard');
      targetManager.update(delta);
      barrelManager?.update(delta);
      zombieManager.update(delta, playerController.getPosition());
      vfxManager.update(delta);
      weaponSystem.update(delta);
      claymoreManager?.update(delta);

      // Floating particles animation
      const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArray[i * 3] += particleVelocities[i].x;
        posArray[i * 3 + 1] += particleVelocities[i].y;
        posArray[i * 3 + 2] += particleVelocities[i].z;

        if (posArray[i * 3 + 1] > 14) {
          posArray[i * 3 + 1] = 0.5;
          posArray[i * 3] = (Math.random() - 0.5) * 50;
          posArray[i * 3 + 2] = (Math.random() - 0.5) * 50;
        }
      }
      posAttr.needsUpdate = true;

      // Camera transitions based on isDying and GameState
      if (current.isDying) {
        // Freeze player controller and release pointer lock
        if (!playerController.isFrozen) {
          playerController.isFrozen = true;
          playerController.exitLock();
        }

        deathCollapseTimer += delta;
        const progress = Math.min(1.0, deathCollapseTimer / 0.8);
        const ease = progress * progress; // Smooth collapse

        const posX = playerController.position.x;
        const posZ = playerController.position.z;
        camera.position.x = posX;
        camera.position.z = posZ;
        camera.position.y = THREE.MathUtils.lerp(1.75, 0.35, ease);

        camera.rotation.order = 'YXZ';
        camera.rotation.y = playerController.yaw;
        camera.rotation.x = THREE.MathUtils.lerp(playerController.pitch, 0.15, ease);
        camera.rotation.z = THREE.MathUtils.lerp(0, 0.48, ease);

        // Weapon tilts and drops downward
        weaponGroup.visible = true;
        weaponGroup.position.y = THREE.MathUtils.lerp(-0.2, -0.9, ease);
        weaponGroup.rotation.x = THREE.MathUtils.lerp(0.03, 0.6, ease);

        if (progress >= 1.0 && !deathFinished) {
          deathFinished = true;
          stateRef.current.onDeathCompleted?.();
        }
      } else if (current.gameState === 'MENU') {
        weaponGroup.visible = false;
        // Cinematic sweeping low-angle panoramic arc around the dusk compound
        menuAngle += delta * 0.12;
        const radius = 28;
        _camPosTarget.set(
          Math.sin(menuAngle) * radius,
          3.5 + Math.sin(menuAngle * 0.5) * 1.5,
          Math.cos(menuAngle) * radius
        );
        _camLookTarget.set(0, 2.5, 0);

        camera.position.lerp(_camPosTarget, 0.04);
        _camCurrentLook.lerp(_camLookTarget, 0.05);
        camera.lookAt(_camCurrentLook);
      } else if (current.gameState === 'PLAYING') {
        weaponGroup.visible = true;

        // Continuous automatic firing for Assault Rifle
        if (playerController.isTriggerHeld && weaponSystem.equippedWeapon === 'RIFLE') {
          weaponSystem.fire();
        }

        // Update player first-person movement, collision, camera, sway, and footsteps
        playerController.mouseSensitivity = current.mouseSensitivity ?? 1.0;
        playerController.update(delta, current.fireKick, current.damageKick, current.cameraSway);

        // Muzzle flash light pulse
        if (current.fireKick > 0.1) {
          muzzleLight.intensity = Math.random() * 3.5 + 2.0;
        } else {
          muzzleLight.intensity = 0;
        }
      } else if (current.gameState === 'GAMEOVER') {
        weaponGroup.visible = false;
        // Operative KIA: fallen camera tilted down on the bloodstained asphalt at operative's position
        const posX = playerController.position.x;
        const posZ = playerController.position.z;
        _camPosTarget.set(posX + 0.3, 0.35, posZ + 0.3);
        camera.position.lerp(_camPosTarget, 0.05);
        _camLookTarget.set(posX + 1.2, 0.1, posZ - 1.0);
        camera.lookAt(_camLookTarget);
        camera.rotation.z = 0.45; // Tilted angle
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    // 17. Responsive Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const newWidth = mountRef.current.clientWidth || window.innerWidth;
      const newHeight = mountRef.current.clientHeight || window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // 18. Clean Disposal on Unmount
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      playerController.dispose();
      controllerRef.current = null;
      targetManager.dispose(scene);
      barrelManager?.dispose();
      zombieManager.dispose();
      vfxManager.dispose();
      if (fireTriggerRef) fireTriggerRef.current = null;
      if (reloadTriggerRef) reloadTriggerRef.current = null;
      if (switchWeaponTriggerRef) switchWeaponTriggerRef.current = null;
      if (unlockWeaponTriggerRef) unlockWeaponTriggerRef.current = null;
      if (addAmmoTriggerRef) addAmmoTriggerRef.current = null;
      if (airburstTriggerRef) airburstTriggerRef.current = null;
      if (knockbackZombiesTriggerRef) knockbackZombiesTriggerRef.current = null;
      if (refillAllWeaponsTriggerRef) refillAllWeaponsTriggerRef.current = null;
      if (spawnZombieTriggerRef) spawnZombieTriggerRef.current = null;
      if (spawnRunnerTriggerRef) spawnRunnerTriggerRef.current = null;
      if (spawnBruteTriggerRef) spawnBruteTriggerRef.current = null;
      if (killAllZombiesTriggerRef) killAllZombiesTriggerRef.current = null;
      if (clearWaveTriggerRef) clearWaveTriggerRef.current = null;
      if (skipToWaveTriggerRef) skipToWaveTriggerRef.current = null;
      if (startNextWaveTriggerRef) startNextWaveTriggerRef.current = null;
      if (redeployTriggerRef) redeployTriggerRef.current = null;
      if (touchMoveRef) touchMoveRef.current = null;
      if (touchLookRef) touchLookRef.current = null;
      if (touchTriggerRef) touchTriggerRef.current = null;
      if (plantClaymoreTriggerRef) plantClaymoreTriggerRef.current = null;
      if (quickTurnRef) quickTurnRef.current = null;
      if (snapTurnRef) snapTurnRef.current = null;

      claymoreManager?.dispose();
      weaponArsenal.dispose();

      // Dispose geometries, materials, and textures
      groundGeo.dispose();
      groundMat.dispose();
      groundTex.dispose();
      hazardTex.dispose();
      crateTex.dispose();
      barrierGeo.dispose();
      barrierMat.dispose();
      barrierHazardMat.dispose();
      crateGeo.dispose();
      crateMat.dispose();
      barrelGeo.dispose();
      barrelMat.dispose();
      barrelYellowMat.dispose();
      sandbagGeo.dispose();
      sandbagMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      emberTex.dispose();
      roomEnvTexture?.dispose();

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`absolute inset-0 w-full h-full overflow-hidden z-0 select-none ${
        gameState === 'PLAYING' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
      }`}
      style={{ touchAction: 'none' }}
    />
  );
};
