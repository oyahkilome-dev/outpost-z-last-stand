/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { soundManager } from '../utils/audio';
import { ZombieState, ZombieHitResult } from './WalkerZombie';
import { getSharedGeometries, getSharedTextures } from './ZombieModelAssets';

export class BruteZombie {
  public id: string;
  public readonly isBrute: boolean = true;
  public group: THREE.Group;
  public state: ZombieState = 'SPAWNING';
  public currentHealth: number = 250;
  public maxHealth: number = 250;
  public speed: number = 1.4; // Ponderous, unstoppable juggernaut
  public position: THREE.Vector3 = new THREE.Vector3();
  public isEliminated: boolean = false;

  // Raycasting hitboxes
  public headHitbox: THREE.Mesh;
  public bodyHitbox: THREE.Mesh;
  public hitMeshes: THREE.Mesh[] = [];

  // Skeletal hierarchy groups
  private upperBodyGroup: THREE.Group;
  private headGroup: THREE.Group;
  private leftArmGroup: THREE.Group;
  private rightArmGroup: THREE.Group;
  private leftLegGroup: THREE.Group;
  private rightLegGroup: THREE.Group;

  // Materials
  private skinMaterial: THREE.MeshStandardMaterial;
  private armorMaterial: THREE.MeshStandardMaterial;
  private plateMaterial: THREE.MeshStandardMaterial;
  private eyeMaterial: THREE.MeshStandardMaterial;
  private mouthMaterial: THREE.MeshStandardMaterial;
  private teethMaterial: THREE.MeshStandardMaterial;

  // Animation & combat state
  private animTimer: number = Math.random() * 10;
  private flinchTimer: number = 0;
  private flinchType: 'HEAD' | 'BODY' = 'HEAD';
  private deathTimer: number = 0;
  private flashTimer: number = 0;
  public attackCooldown: number = 0.4;
  private lastStompTime: number = 0;

  constructor(id: string, spawnPosition: THREE.Vector3, scene: THREE.Scene) {
    this.id = id;
    this.position.copy(spawnPosition);

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // 1.4x scale for imposing juggernaut presence
    this.group.scale.set(1.4, 1.4, 1.4);

    const geos = getSharedGeometries();
    const texs = getSharedTextures();

    // 1. Heavy Armored Corrupted Soldier Materials
    this.skinMaterial = new THREE.MeshStandardMaterial({
      map: texs.bruteSkin,
      color: 0x6e7a6c, // Dark scarred necrotic skin
      roughness: 0.88,
      metalness: 0.05,
    });

    this.armorMaterial = new THREE.MeshStandardMaterial({
      map: texs.bruteArmor,
      roughness: 0.82,
      metalness: 0.2,
    });

    this.plateMaterial = new THREE.MeshStandardMaterial({
      color: 0x2e353d, // Scratched steel ballistic plates & helmet
      roughness: 0.38,
      metalness: 0.8,
    });

    // Glowing crimson death eyes
    this.eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xdc2626,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.mouthMaterial = new THREE.MeshStandardMaterial({
      color: 0x120406,
      roughness: 0.95,
      metalness: 0.05,
    });

    this.teethMaterial = new THREE.MeshStandardMaterial({
      color: 0xb5a08c,
      roughness: 0.65,
      metalness: 0.1,
    });

    // 2. Colossal Pelvis & Hips in Kevlar Combat Pants
    const pelvisMesh = new THREE.Mesh(geos.pelvis, this.armorMaterial);
    pelvisMesh.scale.set(1.45, 1.35, 1.45);
    pelvisMesh.position.y = 0.95;
    pelvisMesh.castShadow = true;
    this.group.add(pelvisMesh);

    const beltMesh = new THREE.Mesh(geos.belt, this.plateMaterial);
    beltMesh.scale.set(1.48, 1.4, 1.48);
    beltMesh.position.y = 0.98;
    this.group.add(beltMesh);

    // 3. Heavy Armored Torso (Chest, Blast Vest, Steel Trauma Plates, Pauldrons)
    this.upperBodyGroup = new THREE.Group();
    this.upperBodyGroup.position.set(0, 1.05, 0);
    this.group.add(this.upperBodyGroup);

    // Muscular Chest in Cracked Tactical Armor
    const chestMesh = new THREE.Mesh(geos.chestTorso, this.armorMaterial);
    chestMesh.scale.set(1.55, 1.4, 1.6);
    chestMesh.position.y = 0.35;
    chestMesh.castShadow = true;
    this.upperBodyGroup.add(chestMesh);

    // Heavy Steel Ballistic Breastplate
    const breastplate = new THREE.Mesh(geos.bruteChestPlate, this.plateMaterial);
    breastplate.position.set(0, 0.36, 0.21);
    this.upperBodyGroup.add(breastplate);

    // Heavy Ballistic Shoulder Pauldrons
    const leftPauldron = new THREE.Mesh(geos.brutePauldron, this.plateMaterial);
    leftPauldron.position.set(-0.48, 0.60, 0);
    this.upperBodyGroup.add(leftPauldron);

    const rightPauldron = new THREE.Mesh(geos.brutePauldron, this.plateMaterial);
    rightPauldron.position.set(0.48, 0.60, 0);
    this.upperBodyGroup.add(rightPauldron);

    // 4. Head & Fragmented Ballistic Helmet Assembly
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.72, 0.04);
    this.upperBodyGroup.add(this.headGroup);

    // Steel Neck Gorget / Collar
    const collarMesh = new THREE.Mesh(geos.bruteGorget, this.plateMaterial);
    collarMesh.position.y = 0.06;
    this.headGroup.add(collarMesh);

    // Thick Scarred Cranium
    const craniumMesh = new THREE.Mesh(geos.bruteCranium, this.skinMaterial);
    craniumMesh.position.set(0, 0.24, 0);
    craniumMesh.castShadow = true;
    this.headGroup.add(craniumMesh);

    // Fragmented Ballistic Helmet
    const helmetMesh = new THREE.Mesh(geos.bruteHelmet, this.plateMaterial);
    helmetMesh.position.set(0.01, 0.35, 0.01);
    helmetMesh.rotation.z = -0.10; // Chipped combat angle
    this.headGroup.add(helmetMesh);

    // Sunken Sockets & Glowing Crimson Death Eyes
    const leftSocket = new THREE.Mesh(geos.eyeSocket, this.mouthMaterial);
    leftSocket.scale.set(1.2, 1.2, 1.2);
    leftSocket.position.set(-0.08, 0.25, 0.16);
    this.headGroup.add(leftSocket);

    const rightSocket = new THREE.Mesh(geos.eyeSocket, this.mouthMaterial);
    rightSocket.scale.set(1.2, 1.2, 1.2);
    rightSocket.position.set(0.08, 0.25, 0.16);
    this.headGroup.add(rightSocket);

    const leftEye = new THREE.Mesh(geos.eye, this.eyeMaterial);
    leftEye.scale.set(1.3, 1.3, 1.3);
    leftEye.position.set(-0.08, 0.25, 0.17);
    this.headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(geos.eye, this.eyeMaterial);
    rightEye.scale.set(1.3, 1.3, 1.3);
    rightEye.position.set(0.08, 0.25, 0.17);
    this.headGroup.add(rightEye);

    // Iron Jaw Guard & Gaping Teeth
    const jawGuard = new THREE.Mesh(geos.bruteJawGuard, this.plateMaterial);
    jawGuard.position.set(0, 0.12, 0.15);
    this.headGroup.add(jawGuard);

    const mouthMesh = new THREE.Mesh(geos.mouthCavity, this.mouthMaterial);
    mouthMesh.scale.set(1.3, 1.3, 1.3);
    mouthMesh.position.set(0, 0.14, 0.13);
    this.headGroup.add(mouthMesh);

    const teethMesh = new THREE.Mesh(geos.teeth, this.teethMaterial);
    teethMesh.scale.set(1.4, 1.3, 1.3);
    teethMesh.position.set(0, 0.15, 0.14);
    this.headGroup.add(teethMesh);

    // 5. Heavy Muscular Arms (Torn tactical sleeves + heavy grasping fists)
    // Left Arm
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.46, 0.56, 0);
    this.upperBodyGroup.add(this.leftArmGroup);

    const leftUpperArm = new THREE.Mesh(geos.upperArm, this.skinMaterial);
    leftUpperArm.scale.set(1.5, 1.15, 1.5);
    this.leftArmGroup.add(leftUpperArm);

    // Shredded sleeve cuff
    const leftSleeve = new THREE.Mesh(geos.sleeveCuff, this.armorMaterial);
    leftSleeve.scale.set(1.55, 1.0, 1.55);
    this.leftArmGroup.add(leftSleeve);

    const leftForearmGroup = new THREE.Group();
    leftForearmGroup.position.set(0, -0.34, 0);
    this.leftArmGroup.add(leftForearmGroup);

    const leftForearm = new THREE.Mesh(geos.forearm, this.skinMaterial);
    leftForearm.scale.set(1.45, 1.15, 1.45);
    leftForearmGroup.add(leftForearm);

    // Armored gauntlet on left wrist
    const leftGauntlet = new THREE.Mesh(geos.wrist, this.plateMaterial);
    leftGauntlet.scale.set(1.5, 1.4, 1.5);
    leftForearmGroup.add(leftGauntlet);

    const leftHandGroup = new THREE.Group();
    leftHandGroup.position.set(0, -0.32, 0);
    leftForearmGroup.add(leftHandGroup);

    const leftPalm = new THREE.Mesh(geos.handPalm, this.skinMaterial);
    leftPalm.scale.set(1.4, 1.4, 1.4);
    leftHandGroup.add(leftPalm);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(geos.finger, this.skinMaterial);
      finger.scale.set(1.4, 1.4, 1.4);
      finger.position.set(-0.04 + f * 0.026, -0.12, 0.02);
      finger.rotation.x = -0.65;
      leftHandGroup.add(finger);
    }

    // Right Arm
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.46, 0.56, 0);
    this.upperBodyGroup.add(this.rightArmGroup);

    const rightUpperArm = new THREE.Mesh(geos.upperArm, this.skinMaterial);
    rightUpperArm.scale.set(1.5, 1.15, 1.5);
    this.rightArmGroup.add(rightUpperArm);

    const rightSleeve = new THREE.Mesh(geos.sleeveCuff, this.armorMaterial);
    rightSleeve.scale.set(1.55, 1.0, 1.55);
    this.rightArmGroup.add(rightSleeve);

    const rightForearmGroup = new THREE.Group();
    rightForearmGroup.position.set(0, -0.34, 0);
    this.rightArmGroup.add(rightForearmGroup);

    const rightForearm = new THREE.Mesh(geos.forearm, this.skinMaterial);
    rightForearm.scale.set(1.45, 1.15, 1.45);
    rightForearmGroup.add(rightForearm);

    const rightGauntlet = new THREE.Mesh(geos.wrist, this.plateMaterial);
    rightGauntlet.scale.set(1.5, 1.4, 1.5);
    rightForearmGroup.add(rightGauntlet);

    const rightHandGroup = new THREE.Group();
    rightHandGroup.position.set(0, -0.32, 0);
    rightForearmGroup.add(rightHandGroup);

    const rightPalm = new THREE.Mesh(geos.handPalm, this.skinMaterial);
    rightPalm.scale.set(1.4, 1.4, 1.4);
    rightHandGroup.add(rightPalm);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(geos.finger, this.skinMaterial);
      finger.scale.set(1.4, 1.4, 1.4);
      finger.position.set(-0.04 + f * 0.026, -0.12, 0.02);
      finger.rotation.x = -0.65;
      rightHandGroup.add(finger);
    }

    // 6. Heavy Armored Legs & Combat Stomp Boots
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.20, 0.95, 0);
    this.group.add(this.leftLegGroup);

    const leftThigh = new THREE.Mesh(geos.bruteHeavyThigh, this.armorMaterial);
    this.leftLegGroup.add(leftThigh);

    const leftKnee = new THREE.Mesh(geos.knee, this.plateMaterial);
    leftKnee.scale.set(1.4, 1.4, 1.4);
    leftKnee.position.y = -0.48;
    this.leftLegGroup.add(leftKnee);

    const leftCalf = new THREE.Mesh(geos.bruteHeavyCalf, this.armorMaterial);
    leftCalf.position.y = -0.48;
    this.leftLegGroup.add(leftCalf);

    const leftBoot = new THREE.Mesh(geos.bruteHeavyBoot, this.plateMaterial);
    leftBoot.position.set(0, -0.96, 0.06);
    this.leftLegGroup.add(leftBoot);

    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.20, 0.95, 0);
    this.group.add(this.rightLegGroup);

    const rightThigh = new THREE.Mesh(geos.bruteHeavyThigh, this.armorMaterial);
    this.rightLegGroup.add(rightThigh);

    const rightKnee = new THREE.Mesh(geos.knee, this.plateMaterial);
    rightKnee.scale.set(1.4, 1.4, 1.4);
    rightKnee.position.y = -0.48;
    this.rightLegGroup.add(rightKnee);

    const rightCalf = new THREE.Mesh(geos.bruteHeavyCalf, this.armorMaterial);
    rightCalf.position.y = -0.48;
    this.rightLegGroup.add(rightCalf);

    const rightBoot = new THREE.Mesh(geos.bruteHeavyBoot, this.plateMaterial);
    rightBoot.position.set(0, -0.96, 0.06);
    this.rightLegGroup.add(rightBoot);

    // 7. Raycast Hitboxes (Scaled to Brute proportions)
    const headHitboxGeo = new THREE.BoxGeometry(0.50, 0.55, 0.50);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    this.headHitbox = new THREE.Mesh(headHitboxGeo, hitboxMat);
    this.headHitbox.position.set(0, 0.28, 0);
    this.headHitbox.userData = { isZombieHead: true, zombieId: this.id };
    this.headGroup.add(this.headHitbox);

    const bodyHitboxGeo = new THREE.BoxGeometry(1.0, 1.6, 0.75);
    this.bodyHitbox = new THREE.Mesh(bodyHitboxGeo, hitboxMat);
    this.bodyHitbox.position.set(0, 0.90, 0);
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

    // Heavy ballistic armor mitigates body damage slightly, headshot does heavy damage
    const effectiveDamage = isHeadshot ? amount * 1.5 : amount;
    this.currentHealth = Math.max(0, this.currentHealth - effectiveDamage);

    this.flashTimer = 0.12;
    this.skinMaterial.emissive.setHex(0xffffff);
    this.plateMaterial.emissive.setHex(0xffffff);

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
      this.flinchTimer = 0.24;
      this.headGroup.rotation.x = -0.38; // Heavy head recoil
      this.headGroup.rotation.y = (Math.random() - 0.5) * 0.45;
    } else {
      this.flinchType = 'BODY';
      this.flinchTimer = 0.18;
      this.upperBodyGroup.rotation.x = 0.20; // Torso shrug
      this.upperBodyGroup.rotation.y = (Math.random() > 0.5 ? 0.25 : -0.25);
    }

    return { isKilled: false, isHeadshot, damage: effectiveDamage };
  }

  public update(delta: number, playerPos: THREE.Vector3, steerVelocity: THREE.Vector3) {
    if (this.state === 'DEAD') return;

    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.skinMaterial.emissive.setHex(0x000000);
        this.plateMaterial.emissive.setHex(0x000000);
      }
    }

    if (this.state === 'DYING') {
      this.deathTimer += delta;
      const fallProgress = Math.min(1.0, this.deathTimer / 0.8);
      const ease = fallProgress * fallProgress;
      // Heavy forward face-plant collapse
      this.group.rotation.x = ease * 1.45;
      this.group.position.y = -ease * 0.55;

      if (this.deathTimer > 0.8) {
        const fade = (this.deathTimer - 0.8) / 1.0;
        this.skinMaterial.color.lerp(new THREE.Color(0x18181b), 0.1);
        this.plateMaterial.color.lerp(new THREE.Color(0x0d0d0f), 0.1);
        const s = Math.max(0.01, 1.4 * (1.0 - fade * 0.95));
        this.group.scale.set(s, s, s);

        if (this.deathTimer >= 1.8) {
          this.state = 'DEAD';
          this.group.visible = false;
        }
      }
      return;
    }

    if (this.state === 'FLINCHING') {
      this.flinchTimer -= delta;
      if (this.flinchType === 'HEAD') {
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0, 0.15);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, 0, 0.15);
      } else {
        this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.x, 0, 0.15);
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, 0, 0.15);
      }

      if (this.flinchTimer <= 0) {
        this.upperBodyGroup.rotation.x = 0;
        this.upperBodyGroup.rotation.y = 0;
        this.headGroup.rotation.x = 0;
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

    if (distToPlayer <= 2.2) {
      if (this.state !== 'ATTACKING') {
        this.state = 'ATTACKING';
        this.attackCooldown = Math.min(this.attackCooldown, 0.3);
      }
    } else {
      this.state = 'CHASING';
    }

    // 5. Heavy Ground-Thumping Stomp Walk Cycle
    this.animTimer += delta * (this.state === 'ATTACKING' ? 4.5 : 3.0);

    if (this.state === 'CHASING') {
      this.position.x += steerVelocity.x * delta;
      this.position.z += steerVelocity.z * delta;
      this.group.position.set(this.position.x, 0, this.position.z);

      if (steerVelocity.lengthSq() > 0.01) {
        const targetAngle = Math.atan2(steerVelocity.x, steerVelocity.z);
        let diff = targetAngle - this.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.group.rotation.y += diff * Math.min(1.0, delta * 5.0);
      }

      // Heavy stomping strides
      const stride = Math.sin(this.animTimer);
      this.leftLegGroup.rotation.x = stride * 0.45;
      this.rightLegGroup.rotation.x = -stride * 0.45;

      // Heavy broad shoulder shifts & torso sway
      this.upperBodyGroup.rotation.z = Math.sin(this.animTimer) * 0.08;
      this.upperBodyGroup.rotation.y = Math.cos(this.animTimer) * 0.06;

      // Heavy arm swings like battering rams
      this.leftArmGroup.rotation.x = -0.4 - stride * 0.45;
      this.rightArmGroup.rotation.x = -0.4 + stride * 0.45;

      // Footstep stomps
      const now = performance.now();
      if (Math.abs(stride) > 0.95 && now - this.lastStompTime > 600) {
        this.lastStompTime = now;
        soundManager.playBruteStomp();
      }
    } else if (this.state === 'ATTACKING') {
      const dxP = playerPos.x - this.position.x;
      const dzP = playerPos.z - this.position.z;
      this.group.rotation.y = Math.atan2(dxP, dzP);

      // Heavy double-fist overhead smash
      const smash = Math.sin(this.animTimer * 1.5);
      this.leftArmGroup.rotation.x = -Math.PI / 1.8 + smash * 0.7;
      this.rightArmGroup.rotation.x = -Math.PI / 1.8 + smash * 0.7;
      this.upperBodyGroup.rotation.x = -0.25 + smash * 0.2;
    }
  }

  public tryAttack(delta: number): boolean {
    if (this.state !== 'ATTACKING' || this.isEliminated || this.currentHealth <= 0) {
      return false;
    }
    this.attackCooldown -= delta;
    if (this.attackCooldown <= 0) {
      this.attackCooldown = 1.2;
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
    this.armorMaterial.dispose();
    this.plateMaterial.dispose();
    this.eyeMaterial.dispose();
    this.mouthMaterial.dispose();
    this.teethMaterial.dispose();
  }
}
