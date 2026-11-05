/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ZombieManager } from '../systems/ZombieManager';
import { VFXManager } from '../systems/VFXManager';
import { ExplosiveBarrelManager } from '../systems/ExplosiveBarrelManager';
import { soundManager } from '../utils/audio';

export interface PlantedClaymore {
  group: THREE.Group;
  position: THREE.Vector3;
  forward: THREE.Vector3;
  laserMesh: THREE.Mesh;
  isArmed: boolean;
  armTimer: number;
  isDetonated: boolean;
}

export interface ClaymoreCallbacks {
  onScoreEarned?: (points: number, coins: number) => void;
  onZombieKilled?: (isHeadshot: boolean) => void;
  onRecoilKick?: (amount: number) => void;
}

export class ClaymoreManager {
  private scene: THREE.Scene;
  private zombieManager: ZombieManager;
  private vfxManager: VFXManager;
  private barrelManager?: ExplosiveBarrelManager;
  private callbacks: ClaymoreCallbacks;

  public claymores: PlantedClaymore[] = [];

  // Shared Materials & Geometries
  private bodyMat: THREE.MeshStandardMaterial;
  private legMat: THREE.MeshStandardMaterial;
  private capMat: THREE.MeshStandardMaterial;
  private laserMat: THREE.MeshBasicMaterial;

  constructor(
    scene: THREE.Scene,
    zombieManager: ZombieManager,
    vfxManager: VFXManager,
    callbacks: ClaymoreCallbacks
  ) {
    this.scene = scene;
    this.zombieManager = zombieManager;
    this.vfxManager = vfxManager;
    this.callbacks = callbacks;

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2b382b, // Military Olive Drab
      roughness: 0.75,
      metalness: 0.15,
    });

    this.legMat = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.35,
      metalness: 0.85,
    });

    this.capMat = new THREE.MeshStandardMaterial({
      color: 0xb45309, // Brass detonator caps
      roughness: 0.4,
      metalness: 0.9,
    });

    this.laserMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  public setBarrelManager(manager: ExplosiveBarrelManager) {
    this.barrelManager = manager;
  }

  /**
   * Plant a new Claymore mine on the ground in front of the operative
   */
  public plantClaymore(playerPos: THREE.Vector3, playerYaw: number): boolean {
    const forwardX = -Math.sin(playerYaw);
    const forwardZ = -Math.cos(playerYaw);

    const plantX = playerPos.x + forwardX * 1.4;
    const plantZ = playerPos.z + forwardZ * 1.4;

    // Boundary check
    if (Math.abs(plantX) > 23 || Math.abs(plantZ) > 23) {
      return false;
    }

    const group = new THREE.Group();
    group.position.set(plantX, 0, plantZ);
    group.rotation.y = playerYaw;

    // 1. Curved M18A1 Claymore Body
    const bodyGeo = new THREE.BoxGeometry(0.26, 0.15, 0.05);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    bodyMesh.position.y = 0.14;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Embossed "FRONT TOWARDS ENEMY" yellow tactical stencil plate
    const plateGeo = new THREE.PlaneGeometry(0.2, 0.06);
    const plateMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.set(0, 0.14, -0.026);
    group.add(plateMesh);

    // Two Top Detonator Cap Wells
    const capGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.04, 8);
    const capL = new THREE.Mesh(capGeo, this.capMat);
    capL.position.set(-0.06, 0.22, 0);
    const capR = new THREE.Mesh(capGeo, this.capMat);
    capR.position.set(0.06, 0.22, 0);
    group.add(capL, capR);

    // Scissor Wire Tripod Legs
    const legGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.18, 6);
    const legFL = new THREE.Mesh(legGeo, this.legMat);
    legFL.position.set(-0.1, 0.07, -0.04);
    legFL.rotation.z = 0.35;
    legFL.rotation.x = -0.3;

    const legFR = new THREE.Mesh(legGeo, this.legMat);
    legFR.position.set(0.1, 0.07, -0.04);
    legFR.rotation.z = -0.35;
    legFR.rotation.x = -0.3;

    const legBL = new THREE.Mesh(legGeo, this.legMat);
    legBL.position.set(-0.1, 0.07, 0.04);
    legBL.rotation.z = 0.35;
    legBL.rotation.x = 0.3;

    const legBR = new THREE.Mesh(legGeo, this.legMat);
    legBR.position.set(0.1, 0.07, 0.04);
    legBR.rotation.z = -0.35;
    legBR.rotation.x = 0.3;
    group.add(legFL, legFR, legBL, legBR);

    // Forward Proximity Laser Tripwire Fan
    const laserGeo = new THREE.ConeGeometry(1.6, 2.8, 12, 1, true);
    const laserMesh = new THREE.Mesh(laserGeo, this.laserMat);
    laserMesh.rotation.x = Math.PI / 2;
    laserMesh.position.set(0, 0.12, -1.4);
    group.add(laserMesh);

    this.scene.add(group);

    const forwardVec = new THREE.Vector3(forwardX, 0, forwardZ).normalize();

    this.claymores.push({
      group,
      position: new THREE.Vector3(plantX, 0.14, plantZ),
      forward: forwardVec,
      laserMesh,
      isArmed: false,
      armTimer: 0,
      isDetonated: false,
    });

    soundManager.playClaymorePlant();
    return true;
  }

  /**
   * Per-frame check for zombie tripwire triggers
   */
  public update(delta: number) {
    const dt = Math.min(delta, 0.1);

    for (let i = this.claymores.length - 1; i >= 0; i--) {
      const mine = this.claymores[i];
      if (mine.isDetonated) continue;

      if (!mine.isArmed) {
        mine.armTimer += dt;
        if (mine.armTimer >= 0.8) {
          mine.isArmed = true;
          (mine.laserMesh.material as THREE.MeshBasicMaterial).color.setHex(0xef4444); // Red armed tripwire
        }
        continue;
      }

      // Check proximity of alive zombies
      const DETECTION_RADIUS = 2.8;
      const zombies = this.zombieManager.zombies;

      let shouldDetonate = false;
      for (const z of zombies) {
        if (z.isEliminated) continue;

        const toZombie = new THREE.Vector3().subVectors(z.position, mine.position);
        toZombie.y = 0;
        const dist = toZombie.length();

        if (dist <= DETECTION_RADIUS) {
          // Check directional forward cone (120 degree front arc)
          toZombie.normalize();
          const dot = toZombie.dot(mine.forward);
          if (dot > 0.3) {
            shouldDetonate = true;
            break;
          }
        }
      }

      if (shouldDetonate) {
        this.detonateClaymore(mine, i);
      }
    }
  }

  /**
   * High-Explosive Claymore Detonation
   */
  private detonateClaymore(mine: PlantedClaymore, index: number) {
    mine.isDetonated = true;

    // Sound
    soundManager.playClaymoreDetonate();

    // VFX: Explosion flash & debris
    this.vfxManager.spawnImpactParticles(mine.position, new THREE.Vector3(0, 1, 0), 28, true);
    this.callbacks.onRecoilKick?.(1.4);

    // Directional blast damage: 350 damage in forward 6m cone
    const BLAST_RADIUS = 6.0;
    const BLAST_DAMAGE = 350;

    const zombies = this.zombieManager.zombies;
    for (const z of zombies) {
      if (z.isEliminated) continue;

      const toZombie = new THREE.Vector3().subVectors(z.position, mine.position);
      const dist = toZombie.length();

      if (dist <= BLAST_RADIUS) {
        toZombie.normalize();
        const dot = toZombie.dot(mine.forward);
        // Full damage in front 140° arc, partial damage in back blast
        const isForward = dot > -0.2;
        const dmg = isForward ? BLAST_DAMAGE * (1 - dist / BLAST_RADIUS * 0.4) : 120;

        const res = z.takeDamage(dmg, false);
        this.vfxManager.spawnBloodSplatter(z.position, new THREE.Vector3(0, 1, 0), false);

        if (res.isKilled) {
          this.zombieManager.registerElimination(z, false);
          this.vfxManager.spawnZombieAshDissolve(z.position);
          this.callbacks.onScoreEarned?.(150, 20);
          this.callbacks.onZombieKilled?.(false);
        }
      }
    }

    // Detonate any explosive fuel barrels within 5.0m
    if (this.barrelManager) {
      this.barrelManager.triggerChainReaction(mine.position, 5.0);
    }

    // Remove 3D model
    this.scene.remove(mine.group);
    this.claymores.splice(index, 1);
  }

  public reset() {
    this.claymores.forEach((m) => {
      this.scene.remove(m.group);
    });
    this.claymores = [];
  }

  public dispose() {
    this.reset();
  }
}
