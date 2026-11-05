/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { soundManager } from '../utils/audio';
import { ZombieState, ZombieHitResult } from './WalkerZombie';
import { getSharedGeometries, getSharedTextures } from './ZombieModelAssets';

export class RunnerZombie {
  public id: string;
  public readonly isRunner: boolean = true;
  public group: THREE.Group;
  public state: ZombieState = 'SPAWNING';
  public currentHealth: number = 45;
  public maxHealth: number = 45;
  public speed: number = 4.2; // High sprint velocity (4.2 m/s)
  public position: THREE.Vector3 = new THREE.Vector3();
  public isEliminated: boolean = false;

  // Raycasting hitboxes
  public headHitbox: THREE.Mesh;
  public bodyHitbox: THREE.Mesh;
  public hitMeshes: THREE.Mesh[] = [];

  // Internal skeletal hierarchy groups for procedural animations
  private upperBodyGroup: THREE.Group;
  private headGroup: THREE.Group;
  private leftArmGroup: THREE.Group;
  private rightArmGroup: THREE.Group;
  private leftLegGroup: THREE.Group;
  private rightLegGroup: THREE.Group;

  // Materials
  private skinMaterial: THREE.MeshStandardMaterial;
  private clothesMaterial: THREE.MeshStandardMaterial;
  private pantsMaterial: THREE.MeshStandardMaterial;
  private eyeMaterial: THREE.MeshStandardMaterial;
  private hairMaterial: THREE.MeshStandardMaterial;
  private mouthMaterial: THREE.MeshStandardMaterial;
  private teethMaterial: THREE.MeshStandardMaterial;

  // Animation & flinch timers
  private animTimer: number = Math.random() * 10;
  private flinchTimer: number = 0;
  private flinchType: 'HEAD' | 'BODY' = 'BODY';
  private deathTimer: number = 0;
  private flashTimer: number = 0;
  public attackCooldown: number = 0.2;
  private hasPlayedSpawnShriek: boolean = false;

  constructor(id: string, spawnPosition: THREE.Vector3, scene: THREE.Scene) {
    this.id = id;
    this.position.copy(spawnPosition);

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const geos = getSharedGeometries();
    const texs = getSharedTextures();

    // 1. Gaunt Feral Humanoid Materials
    this.skinMaterial = new THREE.MeshStandardMaterial({
      map: texs.runnerSkin,
      color: 0x93887c, // Gaunt mottled pale necrotic skin
      roughness: 0.82,
      metalness: 0.05,
    });

    this.clothesMaterial = new THREE.MeshStandardMaterial({
      map: texs.runnerShirt,
      roughness: 0.88,
      metalness: 0.1,
    });

    this.pantsMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f1618, // Tattered dark athletic track pants
      roughness: 0.9,
      metalness: 0.1,
    });

    // Blazing feral orange glowing eyes
    this.eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x241d1a,
      roughness: 0.98,
      metalness: 0.0,
    });

    this.mouthMaterial = new THREE.MeshStandardMaterial({
      color: 0x180608,
      roughness: 0.95,
      metalness: 0.05,
    });

    this.teethMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4c2b2,
      roughness: 0.6,
      metalness: 0.1,
    });

    // 2. Pelvis / Hips (Lean athletic build)
    const pelvisMesh = new THREE.Mesh(geos.pelvis, this.pantsMaterial);
    pelvisMesh.scale.set(0.88, 0.95, 0.92);
    pelvisMesh.position.y = 0.88;
    pelvisMesh.castShadow = true;
    this.group.add(pelvisMesh);

    // 3. Upper Body / Torso Assembly (25-degree aggressive forward sprint lean)
    this.upperBodyGroup = new THREE.Group();
    this.upperBodyGroup.position.set(0, 0.96, 0);
    this.upperBodyGroup.rotation.x = -0.44; // 25 degree forward lean!
    this.group.add(this.upperBodyGroup);

    // Lean athletic chest in shredded compression top
    const chestMesh = new THREE.Mesh(geos.chestTorso, this.clothesMaterial);
    chestMesh.scale.set(0.92, 0.96, 0.92);
    chestMesh.position.y = 0.32;
    chestMesh.castShadow = true;
    this.upperBodyGroup.add(chestMesh);

    // Exposed sinewy ribcage on left flank
    const exposedRibsGeo = new THREE.BoxGeometry(0.1, 0.16, 0.02);
    const exposedRibs = new THREE.Mesh(exposedRibsGeo, this.skinMaterial);
    exposedRibs.position.set(-0.16, 0.30, 0.115);
    this.upperBodyGroup.add(exposedRibs);

    // 4. Head Assembly (extended forward aggressively, rabid feral skull)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.56, 0.06);
    this.upperBodyGroup.add(this.headGroup);

    const neckMesh = new THREE.Mesh(geos.neck, this.skinMaterial);
    neckMesh.position.y = 0.06;
    this.headGroup.add(neckMesh);

    // Gaunt Cranium
    const craniumMesh = new THREE.Mesh(geos.cranium, this.skinMaterial);
    craniumMesh.scale.set(0.88, 1.02, 1.0);
    craniumMesh.position.set(0, 0.20, 0);
    craniumMesh.castShadow = true;
    this.headGroup.add(craniumMesh);

    // Sunken Sockets & Blazing Orange Eyes
    const leftSocket = new THREE.Mesh(geos.eyeSocket, this.mouthMaterial);
    leftSocket.position.set(-0.06, 0.21, 0.125);
    this.headGroup.add(leftSocket);

    const rightSocket = new THREE.Mesh(geos.eyeSocket, this.mouthMaterial);
    rightSocket.position.set(0.06, 0.21, 0.125);
    this.headGroup.add(rightSocket);

    const leftEye = new THREE.Mesh(geos.eye, this.eyeMaterial);
    leftEye.position.set(-0.06, 0.21, 0.135);
    this.headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(geos.eye, this.eyeMaterial);
    rightEye.position.set(0.06, 0.21, 0.135);
    this.headGroup.add(rightEye);

    // Snarling Rabid Open Jaw
    const jawMesh = new THREE.Mesh(geos.jaw, this.skinMaterial);
    jawMesh.scale.set(0.9, 0.9, 0.95);
    jawMesh.position.set(0, 0.10, 0.06);
    jawMesh.rotation.x = 0.32; // Gaping snarl
    this.headGroup.add(jawMesh);

    const mouthMesh = new THREE.Mesh(geos.mouthCavity, this.mouthMaterial);
    mouthMesh.position.set(0, 0.12, 0.11);
    this.headGroup.add(mouthMesh);

    const teethMesh = new THREE.Mesh(geos.teeth, this.teethMaterial);
    teethMesh.position.set(0, 0.14, 0.12);
    this.headGroup.add(teethMesh);

    // Wild matted hair tufts
    const hairTop = new THREE.Mesh(geos.hairPatch, this.hairMaterial);
    hairTop.position.set(0, 0.32, -0.01);
    this.headGroup.add(hairTop);

    // 5. Lean Arms & Clawing Sprint Hands
    // Left Arm
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.25, 0.42, 0);
    this.upperBodyGroup.add(this.leftArmGroup);

    const leftUpperArm = new THREE.Mesh(geos.upperArm, this.skinMaterial);
    leftUpperArm.scale.set(0.85, 1.0, 0.85);
    this.leftArmGroup.add(leftUpperArm);

    const leftSleeve = new THREE.Mesh(geos.sleeveCuff, this.clothesMaterial);
    leftSleeve.scale.set(0.9, 0.8, 0.9);
    this.leftArmGroup.add(leftSleeve);

    const leftForearmGroup = new THREE.Group();
    leftForearmGroup.position.set(0, -0.30, 0);
    this.leftArmGroup.add(leftForearmGroup);

    const leftForearm = new THREE.Mesh(geos.forearm, this.skinMaterial);
    leftForearm.scale.set(0.85, 1.0, 0.85);
    leftForearmGroup.add(leftForearm);

    const leftHandGroup = new THREE.Group();
    leftHandGroup.position.set(0, -0.28, 0);
    leftForearmGroup.add(leftHandGroup);

    const leftPalm = new THREE.Mesh(geos.handPalm, this.skinMaterial);
    leftHandGroup.add(leftPalm);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(geos.finger, this.skinMaterial);
      finger.position.set(-0.025 + f * 0.018, -0.09, 0.01);
      finger.rotation.x = -0.55;
      leftHandGroup.add(finger);
    }

    // Right Arm
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.25, 0.42, 0);
    this.upperBodyGroup.add(this.rightArmGroup);

    const rightUpperArm = new THREE.Mesh(geos.upperArm, this.skinMaterial);
    rightUpperArm.scale.set(0.85, 1.0, 0.85);
    this.rightArmGroup.add(rightUpperArm);

    const rightSleeve = new THREE.Mesh(geos.sleeveCuff, this.clothesMaterial);
    rightSleeve.scale.set(0.9, 0.8, 0.9);
    this.rightArmGroup.add(rightSleeve);

    const rightForearmGroup = new THREE.Group();
    rightForearmGroup.position.set(0, -0.30, 0);
    this.rightArmGroup.add(rightForearmGroup);

    const rightForearm = new THREE.Mesh(geos.forearm, this.skinMaterial);
    rightForearm.scale.set(0.85, 1.0, 0.85);
    rightForearmGroup.add(rightForearm);

    const rightHandGroup = new THREE.Group();
    rightHandGroup.position.set(0, -0.28, 0);
    rightForearmGroup.add(rightHandGroup);

    const rightPalm = new THREE.Mesh(geos.handPalm, this.skinMaterial);
    rightHandGroup.add(rightPalm);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(geos.finger, this.skinMaterial);
      finger.position.set(-0.025 + f * 0.018, -0.09, 0.01);
      finger.rotation.x = -0.55;
      rightHandGroup.add(finger);
    }

    // 6. Lean Legs & Running Shoes
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.12, 0.88, 0);
    this.group.add(this.leftLegGroup);

    const leftThigh = new THREE.Mesh(geos.thigh, this.pantsMaterial);
    leftThigh.scale.set(0.88, 1.0, 0.88);
    this.leftLegGroup.add(leftThigh);

    const leftCalf = new THREE.Mesh(geos.calf, this.pantsMaterial);
    leftCalf.scale.set(0.88, 1.0, 0.88);
    leftCalf.position.y = -0.42;
    this.leftLegGroup.add(leftCalf);

    const leftShoe = new THREE.Mesh(geos.boot, this.pantsMaterial);
    leftShoe.scale.set(0.85, 0.85, 0.95);
    leftShoe.position.set(0, -0.83, 0.04);
    this.leftLegGroup.add(leftShoe);

    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.12, 0.88, 0);
    this.group.add(this.rightLegGroup);

    const rightThigh = new THREE.Mesh(geos.thigh, this.pantsMaterial);
    rightThigh.scale.set(0.88, 1.0, 0.88);
    this.rightLegGroup.add(rightThigh);

    const rightCalf = new THREE.Mesh(geos.calf, this.pantsMaterial);
    rightCalf.scale.set(0.88, 1.0, 0.88);
    rightCalf.position.y = -0.42;
    this.rightLegGroup.add(rightCalf);

    const rightShoe = new THREE.Mesh(geos.boot, this.pantsMaterial);
    rightShoe.scale.set(0.85, 0.85, 0.95);
    rightShoe.position.set(0, -0.83, 0.04);
    this.rightLegGroup.add(rightShoe);

    // 7. Raycast Hitboxes
    const headHitboxGeo = new THREE.BoxGeometry(0.34, 0.40, 0.34);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    this.headHitbox = new THREE.Mesh(headHitboxGeo, hitboxMat);
    this.headHitbox.position.set(0, 0.20, 0);
    this.headHitbox.userData = { isZombieHead: true, zombieId: this.id };
    this.headGroup.add(this.headHitbox);

    const bodyHitboxGeo = new THREE.BoxGeometry(0.60, 1.40, 0.50);
    this.bodyHitbox = new THREE.Mesh(bodyHitboxGeo, hitboxMat);
    this.bodyHitbox.position.set(0, 0.80, 0);
    this.bodyHitbox.userData = { isZombieBody: true, zombieId: this.id };
    this.group.add(this.bodyHitbox);

    this.hitMeshes = [this.headHitbox, this.bodyHitbox];

    scene.add(this.group);
    this.state = 'CHASING';
  }

  public takeDamage(amount: number, isHeadshot: boolean): ZombieHitResult {
    if (this.state === 'DYING' || this.state === 'DEAD' || this.isEliminated) {
      return { isKilled: false, isHeadshot, damage: 0 };
    }

    const effectiveDamage = isHeadshot ? this.maxHealth : amount;
    this.currentHealth = Math.max(0, this.currentHealth - effectiveDamage);

    this.flashTimer = 0.12;
    this.skinMaterial.emissive.setHex(0xffffff);
    this.clothesMaterial.emissive.setHex(0xffffff);

    if (this.currentHealth <= 0) {
      this.state = 'DYING';
      this.isEliminated = true;
      this.deathTimer = 0;
      this.headHitbox.userData = {};
      this.bodyHitbox.userData = {};
      return { isKilled: true, isHeadshot, damage: effectiveDamage };
    }

    // Directional Flinch Reaction
    this.state = 'FLINCHING';
    if (isHeadshot) {
      this.flinchType = 'HEAD';
      this.flinchTimer = 0.20;
      this.headGroup.rotation.x = -0.55; // Violent snap back
      this.headGroup.rotation.y = (Math.random() - 0.5) * 0.7;
    } else {
      this.flinchType = 'BODY';
      this.flinchTimer = 0.16;
      this.upperBodyGroup.rotation.x = -0.10; // Forced upright from forward lean
      this.upperBodyGroup.rotation.y = (Math.random() > 0.5 ? 0.40 : -0.40);
    }

    return { isKilled: false, isHeadshot, damage: effectiveDamage };
  }

  public update(delta: number, playerPos: THREE.Vector3, steerVelocity: THREE.Vector3) {
    if (this.state === 'DEAD') return;

    if (!this.hasPlayedSpawnShriek && this.state === 'CHASING') {
      this.hasPlayedSpawnShriek = true;
      soundManager.playRunnerShriek();
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.skinMaterial.emissive.setHex(0x000000);
        this.clothesMaterial.emissive.setHex(0x000000);
      }
    }

    if (this.state === 'DYING') {
      this.deathTimer += delta;
      const fallProgress = Math.min(1.0, this.deathTimer / 0.45); // Runner collapses violently
      const easeFall = 1 - Math.cos((fallProgress * Math.PI) / 2);
      this.group.rotation.x = -easeFall * 1.5;
      this.group.position.y = -easeFall * 0.45;

      if (this.deathTimer > 0.5) {
        const fadeProgress = (this.deathTimer - 0.5) / 0.9;
        this.skinMaterial.color.lerp(new THREE.Color(0x18181b), 0.1);
        this.clothesMaterial.color.lerp(new THREE.Color(0x0f0f10), 0.1);
        const s = Math.max(0.01, 1.0 - fadeProgress * 0.95);
        this.group.scale.set(s, s, s);

        if (this.deathTimer >= 1.4) {
          this.state = 'DEAD';
          this.group.visible = false;
        }
      }
      return;
    }

    if (this.state === 'FLINCHING') {
      this.flinchTimer -= delta;
      if (this.flinchType === 'HEAD') {
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0.10, 0.2);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, 0, 0.2);
      } else {
        this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.x, -0.44, 0.2);
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, 0, 0.2);
      }

      if (this.flinchTimer <= 0) {
        this.upperBodyGroup.rotation.x = -0.44;
        this.upperBodyGroup.rotation.y = 0;
        this.headGroup.rotation.x = 0.10;
        this.headGroup.rotation.y = 0;
        this.state = 'CHASING';
      }
      return;
    }

    const dx = this.position.x - playerPos.x;
    const dz = this.position.z - playerPos.z;
    const horizontalDist = Math.hypot(dx, dz);
    const dist3D = this.group.position.distanceTo(playerPos);
    const distToPlayer = Math.min(horizontalDist, dist3D);

    if (distToPlayer <= 1.85) {
      if (this.state !== 'ATTACKING') {
        this.state = 'ATTACKING';
        this.attackCooldown = Math.min(this.attackCooldown, 0.20);
      }
    } else {
      this.state = 'CHASING';
    }

    // 5. Rapid Feral Sprint Animation & Rabid Twitching Head
    this.animTimer += delta * (this.state === 'ATTACKING' ? 8.5 : 7.2);

    if (this.state === 'CHASING') {
      this.position.x += steerVelocity.x * delta;
      this.position.z += steerVelocity.z * delta;
      this.group.position.set(this.position.x, 0, this.position.z);

      if (steerVelocity.lengthSq() > 0.01) {
        const targetAngle = Math.atan2(steerVelocity.x, steerVelocity.z);
        let diff = targetAngle - this.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.group.rotation.y += diff * Math.min(1.0, delta * 9.0);
      }

      const sprintCycle = this.animTimer * 1.8;

      // Aggressive high-cadence alternating stride
      this.leftLegGroup.rotation.x = Math.sin(sprintCycle) * 0.85;
      this.rightLegGroup.rotation.x = -Math.sin(sprintCycle) * 0.85;

      // Wide alternating arm pumps
      this.leftArmGroup.rotation.x = -0.3 + Math.sin(sprintCycle) * 0.90;
      this.rightArmGroup.rotation.x = -0.3 - Math.sin(sprintCycle) * 0.90;

      // Hunched 25-degree forward lean with aggressive dynamic sprint bob
      this.upperBodyGroup.rotation.x = -0.44 + Math.abs(Math.sin(sprintCycle)) * 0.08;
      this.upperBodyGroup.rotation.y = Math.sin(sprintCycle) * 0.12;

      // Rabid feral head twitching
      this.headGroup.rotation.y = Math.sin(sprintCycle * 2.8) * 0.22;
      this.headGroup.rotation.z = Math.cos(sprintCycle * 2.1) * 0.15;
    } else if (this.state === 'ATTACKING') {
      const tdx = playerPos.x - this.position.x;
      const tdz = playerPos.z - this.position.z;
      this.group.rotation.y = Math.atan2(tdx, tdz);

      // Frenzied high-speed claws
      const swipe = Math.sin(this.animTimer * 2.2);
      this.leftArmGroup.rotation.x = -Math.PI / 2.0 + swipe * 0.65;
      this.rightArmGroup.rotation.x = -Math.PI / 2.0 - swipe * 0.65;
      this.upperBodyGroup.rotation.x = -0.35 + Math.abs(swipe) * 0.15;
      this.headGroup.rotation.y = Math.sin(this.animTimer * 4.0) * 0.25;
    }
  }

  public tryAttack(delta: number): boolean {
    if (this.state !== 'ATTACKING' || this.isEliminated || this.currentHealth <= 0) {
      return false;
    }
    this.attackCooldown -= delta;
    if (this.attackCooldown <= 0) {
      this.attackCooldown = 0.8;
      return true;
    }
    return false;
  }

  public forceKill() {
    this.takeDamage(this.maxHealth, false);
  }

  public dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    this.skinMaterial.dispose();
    this.clothesMaterial.dispose();
    this.pantsMaterial.dispose();
    this.eyeMaterial.dispose();
    this.hairMaterial.dispose();
    this.mouthMaterial.dispose();
    this.teethMaterial.dispose();
  }
}
