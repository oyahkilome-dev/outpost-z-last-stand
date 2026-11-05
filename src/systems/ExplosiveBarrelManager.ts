/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { ZombieManager, AnyZombie } from './ZombieManager';
import type { VFXManager } from './VFXManager';
import { soundManager } from '../utils/audio';

export interface ExplosiveBarrelCallbacks {
  onScoreEarned: (points: number, coins: number) => void;
  onZombieEliminated?: (isHeadshot: boolean) => void;
  onPlayerDamaged?: (damage: number) => void;
  onRecoilKick?: (amount: number) => void;
  onHitMarker?: (isKill: boolean, isHeadshot?: boolean) => void;
}

export interface ExplosiveBarrel {
  id: number;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  isDetonated: boolean;
  group: THREE.Group;
  barrelMesh: THREE.Group;
  drumMesh: THREE.Mesh;
  charredRimMesh: THREE.Group;
  barrelMat: THREE.MeshStandardMaterial;
  flashTimer: number;
}

export class ExplosiveBarrelManager {
  private scene: THREE.Scene;
  private zombieManager: ZombieManager;
  private vfxManager: VFXManager;
  private getPlayerPosition: () => THREE.Vector3;
  private callbacks: ExplosiveBarrelCallbacks;

  public barrels: ExplosiveBarrel[] = [];
  public hitMeshes: THREE.Object3D[] = [];

  // 4 Strategic Courtyard Spawn Coordinates
  private readonly barrelSpawns: THREE.Vector3[] = [
    new THREE.Vector3(-13.5, 0, -8.5), // Northwest choke point corridor
    new THREE.Vector3(13.5, 0, -9.5),  // Northeast crate depot flank
    new THREE.Vector3(-9.0, 0, 8.5),   // Southwest sandbag bunker flank
    new THREE.Vector3(9.0, 0, 11.5),   // Southeast main gate choke point
  ];

  constructor(
    scene: THREE.Scene,
    zombieManager: ZombieManager,
    vfxManager: VFXManager,
    getPlayerPosition: () => THREE.Vector3,
    callbacks: ExplosiveBarrelCallbacks
  ) {
    this.scene = scene;
    this.zombieManager = zombieManager;
    this.vfxManager = vfxManager;
    this.getPlayerPosition = getPlayerPosition;
    this.callbacks = callbacks;

    this.createBarrels();
  }

  /**
   * Procedural Flammable Hazard Label Canvas Texture
   */
  private createHazardTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Yellow hazard background
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 512, 128);

    // Black diagonal warning stripes on edges
    ctx.fillStyle = '#0f172a';
    const stripeWidth = 24;
    for (let x = -64; x < 600; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth - 28, 128);
      ctx.lineTo(x - 28, 128);
      ctx.closePath();
      ctx.fill();
    }

    // High-visibility black text block
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(90, 24, 332, 80);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 4;
    ctx.strokeRect(94, 28, 324, 72);

    // Stencil text
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ FLAMMABLE ⚠', 256, 58);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText('HIGH EXPLOSIVE FUEL', 256, 84);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Procedural Soot/Charred Floor Decal Texture
   */
  private createCharredRimTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
    grad.addColorStop(0.5, 'rgba(30, 20, 15, 0.85)');
    grad.addColorStop(0.85, 'rgba(40, 30, 20, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createBarrels() {
    const hazardTex = this.createHazardTexture();
    const sootTex = this.createCharredRimTexture();

    const drumGeo = new THREE.CylinderGeometry(0.48, 0.48, 1.4, 20);
    const ringGeo = new THREE.TorusGeometry(0.485, 0.025, 8, 24);
    const rimGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20);
    const hazardGeo = new THREE.CylinderGeometry(0.488, 0.488, 0.38, 20, 1, true);

    const metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.3,
    });

    const hazardMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.4,
      metalness: 0.2,
    });

    const charredRimGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.1, 16);
    const charredRimMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.95,
      metalness: 0.4,
    });

    const sootDecalGeo = new THREE.PlaneGeometry(2.4, 2.4);
    const sootDecalMat = new THREE.MeshBasicMaterial({
      map: sootTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.barrelSpawns.forEach((spawnPos, idx) => {
      const group = new THREE.Group();
      group.position.copy(spawnPos);

      // Intact barrel model container
      const barrelModelGroup = new THREE.Group();
      group.add(barrelModelGroup);

      // Vibrant red drum material
      const barrelMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626, // Bright crimson/scarlet red
        roughness: 0.35,
        metalness: 0.5,
      });

      // Main cylinder body (centered at y = 0.7)
      const drumMesh = new THREE.Mesh(drumGeo, barrelMat);
      drumMesh.position.y = 0.7;
      drumMesh.castShadow = true;
      drumMesh.receiveShadow = true;
      barrelModelGroup.add(drumMesh);

      // Top & bottom reinforcing chime rims
      const topChime = new THREE.Mesh(rimGeo, metalDarkMat);
      topChime.position.y = 1.38;
      topChime.castShadow = true;
      barrelModelGroup.add(topChime);

      const bottomChime = new THREE.Mesh(rimGeo, metalDarkMat);
      bottomChime.position.y = 0.04;
      barrelModelGroup.add(bottomChime);

      // Ribbed reinforcement rings
      const ring1 = new THREE.Mesh(ringGeo, metalDarkMat);
      ring1.rotation.x = Math.PI / 2;
      ring1.position.y = 0.42;
      barrelModelGroup.add(ring1);

      const ring2 = new THREE.Mesh(ringGeo, metalDarkMat);
      ring2.rotation.x = Math.PI / 2;
      ring2.position.y = 0.98;
      barrelModelGroup.add(ring2);

      // Yellow hazard band
      const hazardBand = new THREE.Mesh(hazardGeo, hazardMat);
      hazardBand.position.y = 0.7;
      barrelModelGroup.add(hazardBand);

      // Top filler bung cap
      const bungGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8);
      const bung = new THREE.Mesh(bungGeo, metalDarkMat);
      bung.position.set(0.25, 1.42, 0.1);
      barrelModelGroup.add(bung);

      // Charred collapsed rim (floor wreckage revealed upon detonation)
      const charredGroup = new THREE.Group();
      charredGroup.visible = false;
      group.add(charredGroup);

      const sootDecal = new THREE.Mesh(sootDecalGeo, sootDecalMat);
      sootDecal.rotation.x = -Math.PI / 2;
      sootDecal.position.y = 0.02;
      charredGroup.add(sootDecal);

      const charredRim = new THREE.Mesh(charredRimGeo, charredRimMat);
      charredRim.position.y = 0.06;
      charredGroup.add(charredRim);

      this.scene.add(group);

      // Associate hit detection directly with drumMesh
      drumMesh.userData = { barrelIndex: idx };
      this.hitMeshes.push(drumMesh);

      this.barrels.push({
        id: idx,
        position: spawnPos.clone().setY(0.7),
        hp: 40,
        maxHp: 40,
        isDetonated: false,
        group,
        barrelMesh: barrelModelGroup,
        drumMesh,
        charredRimMesh: charredGroup,
        barrelMat,
        flashTimer: 0,
      });
    });
  }

  /**
   * Find barrel corresponding to raycasted hit mesh
   */
  public findBarrelByMesh(object: THREE.Object3D): ExplosiveBarrel | null {
    if (object.userData && typeof object.userData.barrelIndex === 'number') {
      const idx = object.userData.barrelIndex;
      return this.barrels[idx] || null;
    }
    return null;
  }

  /**
   * Apply damage to fuel barrel
   */
  public damageBarrel(barrel: ExplosiveBarrel, amount: number) {
    if (barrel.isDetonated) return;

    barrel.hp -= amount;

    // Flash bright orange/white
    barrel.barrelMat.emissive.setHex(0xffaa22);
    barrel.barrelMat.emissiveIntensity = 1.4;
    barrel.flashTimer = 0.07;

    // Sparks at impact
    this.vfxManager.spawnImpactParticles(barrel.position, new THREE.Vector3(0, 1, 0), 10, true);

    if (barrel.hp <= 0) {
      this.detonateBarrel(barrel);
    }
  }

  /**
   * Massive 7.5m Fuel Barrel Detonation
   */
  public detonateBarrel(barrel: ExplosiveBarrel) {
    if (barrel.isDetonated) return;

    barrel.isDetonated = true;
    barrel.hp = 0;

    // Hide intact barrel, reveal charred floor rim
    barrel.barrelMesh.visible = false;
    barrel.charredRimMesh.visible = true;

    // Remove from active hit meshes so bullets pass through charred floor
    const hitIndex = this.hitMeshes.indexOf(barrel.drumMesh);
    if (hitIndex !== -1) {
      this.hitMeshes.splice(hitIndex, 1);
    }

    // 1. Audio: Heavy synthesized explosion blast
    try {
      soundManager.playExplosion?.();
    } catch {
      // Audio safety guard
    }

    // 2. 3D Expanding Spherical Fireball + Fire/Smoke Particle Shockwave
    this.vfxManager.spawnExplosion(barrel.position);

    const blastRadius = 7.5;
    const blastDamage = 350;

    // 3. Blast Damage to Hostiles
    const activeZombies = this.zombieManager.getActiveZombies();
    let killedAny = false;

    activeZombies.forEach((zombie) => {
      const dist = zombie.position.distanceTo(barrel.position);
      if (dist <= blastRadius) {
        const result = zombie.takeDamage(blastDamage, false);
        this.vfxManager.spawnBloodSplatter(zombie.position, new THREE.Vector3(0, 1, 0), false);

        if (result.isKilled) {
          killedAny = true;
          const isBrute = 'isBrute' in zombie && zombie.isBrute;
          const isRunner = 'isRunner' in zombie && zombie.isRunner;

          const pts = isBrute ? 300 : isRunner ? 120 : 50;
          const coins = isBrute ? 50 : isRunner ? 18 : 10;

          this.callbacks.onScoreEarned(pts, coins);
          this.callbacks.onZombieEliminated?.(false);
          this.zombieManager.registerElimination(zombie, false);
          this.vfxManager.spawnZombieAshDissolve(zombie.position);
          soundManager.playZombieDeath();
        }
      }
    });

    if (killedAny) {
      this.callbacks.onHitMarker?.(true, false);
    }

    // 4. Chain Reaction: Trigger neighboring barrels within 7.5m in rapid succession
    this.barrels.forEach((other) => {
      if (!other.isDetonated && other.id !== barrel.id) {
        const dist = other.position.distanceTo(barrel.position);
        if (dist <= blastRadius) {
          setTimeout(() => {
            if (!other.isDetonated) {
              this.detonateBarrel(other);
            }
          }, 120);
        }
      }
    });

    // 5. Player Safety: Splash damage if within 3.5m danger zone
    const playerPos = this.getPlayerPosition();
    const distToPlayer = playerPos.distanceTo(barrel.position);
    if (distToPlayer <= 3.5) {
      this.callbacks.onPlayerDamaged?.(20);
      this.callbacks.onRecoilKick?.(1.8); // Camera shockwave jolt
    }
  }

  /**
   * External Chain Reaction trigger (e.g. Claymore mine blast detonating nearby fuel barrels)
   */
  public triggerChainReaction(position: THREE.Vector3, radius: number = 5.0) {
    this.barrels.forEach((barrel) => {
      if (!barrel.isDetonated && barrel.position.distanceTo(position) <= radius) {
        this.detonateBarrel(barrel);
      }
    });
  }

  /**
   * Clean Wave Respawn: Re-arm all 4 red fuel barrels when a new wave starts
   */
  public resetWaveBarrels() {
    this.hitMeshes = [];

    this.barrels.forEach((barrel) => {
      barrel.isDetonated = false;
      barrel.hp = barrel.maxHp;
      barrel.barrelMesh.visible = true;
      barrel.charredRimMesh.visible = false;
      barrel.barrelMat.emissive.setHex(0x000000);
      barrel.barrelMat.emissiveIntensity = 0;
      barrel.flashTimer = 0;

      // Re-add to raycaster hit meshes
      this.hitMeshes.push(barrel.drumMesh);
    });
  }

  /**
   * Per-frame animation tick (handles damage flash decay)
   */
  public update(delta: number) {
    for (const barrel of this.barrels) {
      if (barrel.flashTimer > 0) {
        barrel.flashTimer -= delta;
        if (barrel.flashTimer <= 0) {
          barrel.barrelMat.emissive.setHex(0x000000);
          barrel.barrelMat.emissiveIntensity = 0;
        }
      }
    }
  }

  public dispose() {
    for (const b of this.barrels) {
      this.scene.remove(b.group);
    }
    this.barrels = [];
    this.hitMeshes = [];
  }
}
