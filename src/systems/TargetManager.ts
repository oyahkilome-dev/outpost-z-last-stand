/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { soundManager } from '../utils/audio';

export interface TargetDummyData {
  id: string;
  name: string;
  position: THREE.Vector3;
  distanceLabel: string;
}

export interface TargetHitResult {
  target: TargetDummy;
  hitPoint: THREE.Vector3;
  damage: number;
  isKilled: boolean;
  scoreAwarded: number;
}

export class TargetDummy {
  public id: string;
  public name: string;
  public basePosition: THREE.Vector3;
  public group: THREE.Group;
  public maxHealth: number = 50;
  public currentHealth: number = 50;
  public isDestroyed: boolean = false;

  // Meshes that raycaster tests against
  public hitMesh: THREE.Mesh;
  private faceMaterial: THREE.MeshStandardMaterial;
  private plateMaterial: THREE.MeshStandardMaterial;

  // Hit reaction spring physics
  private wobbleAngle: number = 0;
  private wobbleVelocity: number = 0;
  private flashTimer: number = 0;
  private respawnTimer: number = 0;
  private readonly RESPAWN_DELAY = 4.0; // 4 seconds

  // Reference to pivoting upper assembly
  private pivotGroup: THREE.Group;

  constructor(data: TargetDummyData, scene: THREE.Scene) {
    this.id = data.id;
    this.name = data.name;
    this.basePosition = data.position.clone();

    this.group = new THREE.Group();
    this.group.position.copy(this.basePosition);

    // 1. Heavy Metal Cross Base / Pedestal (Stands on courtyard asphalt)
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.8,
      roughness: 0.35,
    });
    const legGeo = new THREE.BoxGeometry(1.4, 0.08, 0.16);
    const leg1 = new THREE.Mesh(legGeo, baseMat);
    leg1.position.y = 0.04;
    this.group.add(leg1);

    const leg2 = new THREE.Mesh(legGeo, baseMat);
    leg2.position.y = 0.04;
    leg2.rotation.y = Math.PI / 2;
    this.group.add(leg2);

    // 2. Vertical Steel Support Stand
    const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.3, 10);
    const pole = new THREE.Mesh(poleGeo, baseMat);
    pole.position.y = 0.65;
    this.group.add(pole);

    // 3. Pivoting Upper Target Assembly (Rotates on hit impact wobble)
    this.pivotGroup = new THREE.Group();
    this.pivotGroup.position.y = 1.3;
    this.group.add(this.pivotGroup);

    // Hinge bracket
    const hingeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8);
    const hinge = new THREE.Mesh(hingeGeo, baseMat);
    hinge.rotation.z = Math.PI / 2;
    this.pivotGroup.add(hinge);

    // Upper spine neck
    const neckGeo = new THREE.BoxGeometry(0.06, 0.45, 0.04);
    const neck = new THREE.Mesh(neckGeo, baseMat);
    neck.position.y = 0.22;
    this.pivotGroup.add(neck);

    // 4. Backing Target Board (Weathered plywood / steel plate)
    this.plateMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.6,
      roughness: 0.4,
    });
    const plateGeo = new THREE.BoxGeometry(0.85, 1.05, 0.04);
    const plate = new THREE.Mesh(plateGeo, this.plateMaterial);
    plate.position.y = 0.7;
    this.pivotGroup.add(plate);

    // 5. Circular Bullseye Face Disc with Procedural Rings Texture
    const bullseyeCanvas = document.createElement('canvas');
    bullseyeCanvas.width = 256;
    bullseyeCanvas.height = 256;
    const ctx = bullseyeCanvas.getContext('2d')!;

    // Outer white / light ring
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    // 2nd Ring (Dark tactical gray)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(128, 128, 92, 0, Math.PI * 2);
    ctx.fill();

    // 3rd Ring (Bright tactical yellow/amber)
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(128, 128, 64, 0, Math.PI * 2);
    ctx.fill();

    // 4th Ring (Combat Red)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(128, 128, 38, 0, Math.PI * 2);
    ctx.fill();

    // Center Bullseye Dot (White precision center)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(128, 128, 14, 0, Math.PI * 2);
    ctx.fill();

    // Crosshairs on target face
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(128, 8);
    ctx.lineTo(128, 248);
    ctx.moveTo(8, 128);
    ctx.lineTo(248, 128);
    ctx.stroke();

    const bullseyeTex = new THREE.CanvasTexture(bullseyeCanvas);
    bullseyeTex.colorSpace = THREE.SRGBColorSpace;

    this.faceMaterial = new THREE.MeshStandardMaterial({
      map: bullseyeTex,
      roughness: 0.5,
      metalness: 0.2,
      emissive: new THREE.Color(0x000000),
    });

    const discGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.02, 32);
    this.hitMesh = new THREE.Mesh(discGeo, this.faceMaterial);
    this.hitMesh.rotation.x = Math.PI / 2;
    this.hitMesh.position.set(0, 0.72, 0.03);
    // User data tag for fast identification during raycasting
    this.hitMesh.userData = { targetId: this.id, isTargetDummy: true };
    this.pivotGroup.add(this.hitMesh);

    // Stencil Name Tag plate ("ALPHA-01", etc.)
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 128;
    tagCanvas.height = 32;
    const tagCtx = tagCanvas.getContext('2d')!;
    tagCtx.fillStyle = '#0f172a';
    tagCtx.fillRect(0, 0, 128, 32);
    tagCtx.strokeStyle = '#f59e0b';
    tagCtx.lineWidth = 3;
    tagCtx.strokeRect(2, 2, 124, 28);
    tagCtx.fillStyle = '#f59e0b';
    tagCtx.font = 'bold 16px monospace';
    tagCtx.textAlign = 'center';
    tagCtx.fillText(this.name, 64, 21);

    const tagTex = new THREE.CanvasTexture(tagCanvas);
    tagTex.colorSpace = THREE.SRGBColorSpace;
    const tagMat = new THREE.MeshBasicMaterial({ map: tagTex });
    const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), tagMat);
    tagMesh.position.set(0, 0.25, 0.03);
    this.pivotGroup.add(tagMesh);

    scene.add(this.group);
  }

  /**
   * Take damage from raycast shot
   */
  public takeDamage(amount: number): { isKilled: boolean; score: number } {
    if (this.isDestroyed) {
      return { isKilled: false, score: 0 };
    }

    this.currentHealth = Math.max(0, this.currentHealth - amount);

    // Impact wobble impulse (kick backward on X-axis)
    this.wobbleVelocity -= 9.5;

    // Flash white on hit
    this.flashTimer = 0.09;
    this.faceMaterial.emissive.setHex(0xffffff);

    // Play impact sound
    soundManager.playTargetImpact();

    if (this.currentHealth <= 0) {
      this.isDestroyed = true;
      this.respawnTimer = this.RESPAWN_DELAY;
      this.pivotGroup.visible = false;
      soundManager.playTargetDestroy();
      return { isKilled: true, score: 100 };
    }

    return { isKilled: false, score: 25 };
  }

  /**
   * Update wobble spring physics & respawn timer
   */
  public update(delta: number): boolean {
    // 1. Respawn timer if destroyed
    if (this.isDestroyed) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.respawn();
        return true; // Just respawned
      }
      return false;
    }

    // 2. White flash fade
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.faceMaterial.emissive.setHex(0x000000);
      }
    }

    // 3. Spring physics wobble back-and-forth
    const springK = 80.0;
    const damping = 9.0;
    const accel = -springK * this.wobbleAngle - damping * this.wobbleVelocity;

    this.wobbleVelocity += accel * delta;
    this.wobbleAngle += this.wobbleVelocity * delta;

    this.pivotGroup.rotation.x = this.wobbleAngle;
    return false;
  }

  private respawn() {
    this.isDestroyed = false;
    this.currentHealth = this.maxHealth;
    this.wobbleAngle = 0;
    this.wobbleVelocity = 4.0; // Spring pop-up entry
    this.pivotGroup.visible = true;
    this.faceMaterial.emissive.setHex(0x000000);
  }

  public dispose(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}

export class TargetManager {
  public targets: TargetDummy[] = [];
  public targetMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    // 3 Courtyard practice targets at varying distances:
    // Near target: (-3.5m X, -8.0m Z) ~12m from player spawn
    // Mid target:  (7.0m X, -14.0m Z) ~18m from player spawn
    // Far target:  (-9.0m X, -20.0m Z) ~24m from player spawn
    const targetsConfig: TargetDummyData[] = [
      {
        id: 'target-near',
        name: 'T-01 [NEAR]',
        position: new THREE.Vector3(-3.5, 0, -8.0),
        distanceLabel: '12m',
      },
      {
        id: 'target-mid',
        name: 'T-02 [MID]',
        position: new THREE.Vector3(7.0, 0, -14.0),
        distanceLabel: '18m',
      },
      {
        id: 'target-far',
        name: 'T-03 [FAR]',
        position: new THREE.Vector3(-9.0, 0, -20.0),
        distanceLabel: '24m',
      },
    ];

    targetsConfig.forEach((cfg) => {
      const dummy = new TargetDummy(cfg, scene);
      this.targets.push(dummy);
      this.targetMeshes.push(dummy.hitMesh);
    });
  }

  public findTargetByMesh(mesh: THREE.Object3D): TargetDummy | undefined {
    return this.targets.find((t) => {
      if (t.hitMesh === mesh || mesh.userData?.targetId === t.id) return true;
      let curr: THREE.Object3D | null = mesh;
      while (curr) {
        if (curr === t.group) return true;
        curr = curr.parent;
      }
      return false;
    });
  }

  public update(delta: number) {
    for (const target of this.targets) {
      target.update(delta);
    }
  }

  public dispose(scene: THREE.Scene) {
    for (const target of this.targets) {
      target.dispose(scene);
    }
    this.targets = [];
    this.targetMeshes = [];
  }
}
