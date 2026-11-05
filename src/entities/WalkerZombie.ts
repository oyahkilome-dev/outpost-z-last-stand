/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { getSharedGeometries, getSharedTextures } from './ZombieModelAssets';

export type ZombieState = 'SPAWNING' | 'CHASING' | 'FLINCHING' | 'ATTACKING' | 'DYING' | 'DEAD';

export interface ZombieHitResult {
  isKilled: boolean;
  isHeadshot: boolean;
  damage: number;
}

export class WalkerZombie {
  public id: string;
  public group: THREE.Group;
  public state: ZombieState = 'SPAWNING';
  public currentHealth: number = 70;
  public maxHealth: number = 70;
  public speed: number = 2.2; // Base speed 2.2 m/s
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

  // Materials (cloned/instanced for independent hit flash & dissolve)
  private skinMaterial: THREE.MeshStandardMaterial;
  private clothesMaterial: THREE.MeshStandardMaterial;
  private pantsMaterial: THREE.MeshStandardMaterial;
  private eyeMaterial: THREE.MeshStandardMaterial;
  private hairMaterial: THREE.MeshStandardMaterial;
  private leatherMaterial: THREE.MeshStandardMaterial;
  private mouthMaterial: THREE.MeshStandardMaterial;
  private teethMaterial: THREE.MeshStandardMaterial;

  // Animation & flinch timers
  private animTimer: number = Math.random() * 10;
  private flinchTimer: number = 0;
  private flinchType: 'HEAD' | 'BODY' = 'BODY';
  private deathTimer: number = 0;
  private flashTimer: number = 0;
  private attackTimer: number = 0;
  public attackCooldown: number = 0.3;

  constructor(id: string, spawnPosition: THREE.Vector3, scene: THREE.Scene) {
    this.id = id;
    this.position.copy(spawnPosition);

    // Root Group (bottom-centered pivot at ground level y = 0)
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const geos = getSharedGeometries();
    const texs = getSharedTextures();

    // 1. Realistic Humanoid Materials (ashen decayed skin, torn flannel, ripped denim, glazed white dead eyes)
    this.skinMaterial = new THREE.MeshStandardMaterial({
      map: texs.walkerSkin,
      color: 0x8a9688, // Pale ashen decayed human tone (#7e8c7c / #8a9688)
      roughness: 0.88,
      metalness: 0.05,
    });

    this.clothesMaterial = new THREE.MeshStandardMaterial({
      map: texs.flannel,
      roughness: 0.92,
      metalness: 0.05,
    });

    this.pantsMaterial = new THREE.MeshStandardMaterial({
      map: texs.denim,
      roughness: 0.9,
      metalness: 0.1,
    });

    // Glazed milky white dead eyes glowing eerily in the dark
    this.eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6,
      emissive: 0x9ca3af,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c1917, // Grimy matted dark hair
      roughness: 0.98,
      metalness: 0.0,
    });

    this.leatherMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f1915, // Worn muddy work boots & belt
      roughness: 0.75,
      metalness: 0.2,
    });

    this.mouthMaterial = new THREE.MeshStandardMaterial({
      color: 0x130709, // Dark gaping oral cavity
      roughness: 0.95,
      metalness: 0.05,
    });

    this.teethMaterial = new THREE.MeshStandardMaterial({
      color: 0xb4a896, // Yellowed, blood-stained teeth
      roughness: 0.7,
      metalness: 0.1,
    });

    // 2. Pelvis & Hips (y = 0.92) - Tattered denim jeans & worn belt
    const pelvisMesh = new THREE.Mesh(geos.pelvis, this.pantsMaterial);
    pelvisMesh.position.y = 0.92;
    pelvisMesh.castShadow = true;
    this.group.add(pelvisMesh);

    const beltMesh = new THREE.Mesh(geos.belt, this.leatherMaterial);
    beltMesh.position.y = 0.95;
    this.group.add(beltMesh);

    // 3. Upper Body / Torso Assembly (Shoulders, Chest, Waist, Collar)
    this.upperBodyGroup = new THREE.Group();
    this.upperBodyGroup.position.set(0, 1.02, 0);
    // Asymmetrical drooping right shoulder characteristic of infected civilian
    this.upperBodyGroup.rotation.z = 0.07;
    this.upperBodyGroup.rotation.x = -0.16; // Hunched posture
    this.group.add(this.upperBodyGroup);

    // Waist
    const waistMesh = new THREE.Mesh(geos.waist, this.clothesMaterial);
    waistMesh.position.y = 0.10;
    waistMesh.castShadow = true;
    this.upperBodyGroup.add(waistMesh);

    // Sculpted Chest & Ribcage in torn flannel
    const chestMesh = new THREE.Mesh(geos.chestTorso, this.clothesMaterial);
    chestMesh.position.y = 0.35;
    chestMesh.castShadow = true;
    this.upperBodyGroup.add(chestMesh);

    // Torn flannel shirt collar
    const collarMesh = new THREE.Mesh(geos.shirtCollar, this.clothesMaterial);
    collarMesh.position.set(0, 0.58, 0.03);
    collarMesh.rotation.x = 0.2;
    this.upperBodyGroup.add(collarMesh);

    // Exposed necrotic flesh tear on right chest
    const exposedFleshGeo = new THREE.BoxGeometry(0.12, 0.14, 0.02);
    const exposedFleshMesh = new THREE.Mesh(exposedFleshGeo, this.skinMaterial);
    exposedFleshMesh.position.set(0.11, 0.34, 0.125);
    this.upperBodyGroup.add(exposedFleshMesh);

    // 4. Head & Face Assembly (y = 0.60 above upper body)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.60, 0.04);
    // Asymmetrical tilted head posture
    this.headGroup.rotation.z = -0.12;
    this.headGroup.rotation.x = 0.14;
    this.upperBodyGroup.add(this.headGroup);

    // Decayed Neck
    const neckMesh = new THREE.Mesh(geos.neck, this.skinMaterial);
    neckMesh.position.y = 0.06;
    this.headGroup.add(neckMesh);

    // Rounded Human Cranium (smooth skull shape)
    const craniumMesh = new THREE.Mesh(geos.cranium, this.skinMaterial);
    craniumMesh.position.set(0, 0.22, 0);
    craniumMesh.castShadow = true;
    this.headGroup.add(craniumMesh);

    // Sunken Dark Eye Sockets
    const leftSocket = new THREE.Mesh(geos.eyeSocket, this.mouthMaterial);
    leftSocket.position.set(-0.065, 0.23, 0.128);
    this.headGroup.add(leftSocket);

    const rightSocket = new THREE.Mesh(geos.eyeSocket, this.mouthMaterial);
    rightSocket.position.set(0.065, 0.23, 0.128);
    this.headGroup.add(rightSocket);

    // Glazed Milky White Dead Eyes
    const leftEye = new THREE.Mesh(geos.eye, this.eyeMaterial);
    leftEye.position.set(-0.065, 0.23, 0.138);
    this.headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(geos.eye, this.eyeMaterial);
    rightEye.position.set(0.065, 0.23, 0.138);
    this.headGroup.add(rightEye);

    // Defined Open Agape Jaw
    const jawMesh = new THREE.Mesh(geos.jaw, this.skinMaterial);
    jawMesh.position.set(0, 0.11, 0.06);
    jawMesh.rotation.x = 0.22; // Hanging mouth
    this.headGroup.add(jawMesh);

    // Dark oral cavity
    const mouthMesh = new THREE.Mesh(geos.mouthCavity, this.mouthMaterial);
    mouthMesh.position.set(0, 0.13, 0.12);
    this.headGroup.add(mouthMesh);

    // Stained teeth rows
    const topTeeth = new THREE.Mesh(geos.teeth, this.teethMaterial);
    topTeeth.position.set(0, 0.155, 0.13);
    this.headGroup.add(topTeeth);

    const bottomTeeth = new THREE.Mesh(geos.teeth, this.teethMaterial);
    bottomTeeth.position.set(0, 0.11, 0.13);
    this.headGroup.add(bottomTeeth);

    // Patchy disheveled dark hair strands
    const hairTop = new THREE.Mesh(geos.hairPatch, this.hairMaterial);
    hairTop.position.set(0, 0.35, -0.02);
    hairTop.rotation.x = -0.15;
    this.headGroup.add(hairTop);

    const hairSide = new THREE.Mesh(geos.hairStrand, this.hairMaterial);
    hairSide.position.set(-0.11, 0.28, 0.01);
    hairSide.rotation.z = 0.25;
    this.headGroup.add(hairSide);

    // 5. Articulated Arms & Grasping Hands
    // Left Arm (Reaching outward hungrily)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.28, 0.46, 0);
    this.upperBodyGroup.add(this.leftArmGroup);

    const leftUpperArm = new THREE.Mesh(geos.upperArm, this.skinMaterial);
    this.leftArmGroup.add(leftUpperArm);

    const leftSleeve = new THREE.Mesh(geos.sleeveCuff, this.clothesMaterial);
    this.leftArmGroup.add(leftSleeve);

    const leftForearmGroup = new THREE.Group();
    leftForearmGroup.position.set(0, -0.30, 0);
    this.leftArmGroup.add(leftForearmGroup);

    const leftForearmMesh = new THREE.Mesh(geos.forearm, this.skinMaterial);
    leftForearmGroup.add(leftForearmMesh);

    // Modeled Left Hand with Grasping Fingers
    const leftHandGroup = new THREE.Group();
    leftHandGroup.position.set(0, -0.28, 0);
    leftForearmGroup.add(leftHandGroup);

    const leftPalm = new THREE.Mesh(geos.handPalm, this.skinMaterial);
    leftHandGroup.add(leftPalm);

    // 4 clawing curved finger digits + thumb
    for (let f = 0; f < 4; f++) {
      const fingerMesh = new THREE.Mesh(geos.finger, this.skinMaterial);
      fingerMesh.position.set(-0.03 + f * 0.02, -0.09, 0.01);
      fingerMesh.rotation.x = -0.45; // Curved claw digit
      leftHandGroup.add(fingerMesh);
    }
    const leftThumb = new THREE.Mesh(geos.thumb, this.skinMaterial);
    leftThumb.position.set(-0.045, -0.04, 0.02);
    leftThumb.rotation.z = -0.4;
    leftThumb.rotation.x = -0.3;
    leftHandGroup.add(leftThumb);

    // Outstretch left arm forward
    this.leftArmGroup.rotation.x = -Math.PI / 2.3;
    this.leftArmGroup.rotation.z = 0.14;

    // Right Arm (Drooping slightly lower, reaching)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.28, 0.44, 0);
    this.upperBodyGroup.add(this.rightArmGroup);

    const rightUpperArm = new THREE.Mesh(geos.upperArm, this.skinMaterial);
    this.rightArmGroup.add(rightUpperArm);

    const rightSleeve = new THREE.Mesh(geos.sleeveCuff, this.clothesMaterial);
    this.rightArmGroup.add(rightSleeve);

    const rightForearmGroup = new THREE.Group();
    rightForearmGroup.position.set(0, -0.30, 0);
    this.rightArmGroup.add(rightForearmGroup);

    const rightForearmMesh = new THREE.Mesh(geos.forearm, this.skinMaterial);
    rightForearmGroup.add(rightForearmMesh);

    // Modeled Right Hand with Grasping Fingers
    const rightHandGroup = new THREE.Group();
    rightHandGroup.position.set(0, -0.28, 0);
    rightForearmGroup.add(rightHandGroup);

    const rightPalm = new THREE.Mesh(geos.handPalm, this.skinMaterial);
    rightHandGroup.add(rightPalm);

    for (let f = 0; f < 4; f++) {
      const fingerMesh = new THREE.Mesh(geos.finger, this.skinMaterial);
      fingerMesh.position.set(-0.03 + f * 0.02, -0.09, 0.01);
      fingerMesh.rotation.x = -0.55;
      rightHandGroup.add(fingerMesh);
    }
    const rightThumb = new THREE.Mesh(geos.thumb, this.skinMaterial);
    rightThumb.position.set(0.045, -0.04, 0.02);
    rightThumb.rotation.z = 0.4;
    rightThumb.rotation.x = -0.3;
    rightHandGroup.add(rightThumb);

    this.rightArmGroup.rotation.x = -Math.PI / 2.15;
    this.rightArmGroup.rotation.z = -0.16;

    // 6. Legs & Combat Boots (Torn Denim Jeans)
    // Left Leg
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.13, 0.90, 0);
    this.group.add(this.leftLegGroup);

    const leftThigh = new THREE.Mesh(geos.thigh, this.pantsMaterial);
    this.leftLegGroup.add(leftThigh);

    const leftKnee = new THREE.Mesh(geos.knee, this.pantsMaterial);
    leftKnee.position.y = -0.42;
    this.leftLegGroup.add(leftKnee);

    const leftCalf = new THREE.Mesh(geos.calf, this.pantsMaterial);
    leftCalf.position.y = -0.42;
    this.leftLegGroup.add(leftCalf);

    const leftBoot = new THREE.Mesh(geos.boot, this.leatherMaterial);
    leftBoot.position.set(0, -0.85, 0.04);
    this.leftLegGroup.add(leftBoot);

    const leftSole = new THREE.Mesh(geos.bootSole, this.leatherMaterial);
    leftSole.position.set(0, -0.91, 0.04);
    this.leftLegGroup.add(leftSole);

    // Right Leg (The dragging leg in limp)
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.13, 0.90, 0);
    this.group.add(this.rightLegGroup);

    const rightThigh = new THREE.Mesh(geos.thigh, this.pantsMaterial);
    this.rightLegGroup.add(rightThigh);

    // Exposed necrotic kneecap through tear
    const rightKnee = new THREE.Mesh(geos.knee, this.skinMaterial);
    rightKnee.position.y = -0.42;
    this.rightLegGroup.add(rightKnee);

    const rightCalf = new THREE.Mesh(geos.calf, this.pantsMaterial);
    rightCalf.position.y = -0.42;
    this.rightLegGroup.add(rightCalf);

    const rightBoot = new THREE.Mesh(geos.boot, this.leatherMaterial);
    rightBoot.position.set(0, -0.85, 0.04);
    this.rightLegGroup.add(rightBoot);

    const rightSole = new THREE.Mesh(geos.bootSole, this.leatherMaterial);
    rightSole.position.set(0, -0.91, 0.04);
    this.rightLegGroup.add(rightSole);

    // 7. Raycast Hitboxes
    const headHitboxGeo = new THREE.BoxGeometry(0.36, 0.44, 0.36);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    this.headHitbox = new THREE.Mesh(headHitboxGeo, hitboxMat);
    this.headHitbox.position.set(0, 0.22, 0);
    this.headHitbox.userData = { isZombieHead: true, zombieId: this.id };
    this.headGroup.add(this.headHitbox);

    const bodyHitboxGeo = new THREE.BoxGeometry(0.68, 1.45, 0.55);
    this.bodyHitbox = new THREE.Mesh(bodyHitboxGeo, hitboxMat);
    this.bodyHitbox.position.set(0, 0.85, 0);
    this.bodyHitbox.userData = { isZombieBody: true, zombieId: this.id };
    this.group.add(this.bodyHitbox);

    this.hitMeshes = [this.headHitbox, this.bodyHitbox];

    scene.add(this.group);
    this.state = 'CHASING';
  }

  /**
   * Take bullet damage with realistic directional flinch:
   * - Headshot snaps head backward/sideways
   * - Torso hit twists and jerks spine backward
   */
  public takeDamage(amount: number, isHeadshot: boolean): ZombieHitResult {
    if (this.state === 'DYING' || this.state === 'DEAD' || this.isEliminated) {
      return { isKilled: false, isHeadshot, damage: 0 };
    }

    const effectiveDamage = isHeadshot ? this.maxHealth : amount;
    this.currentHealth = Math.max(0, this.currentHealth - effectiveDamage);

    // Flash meshes white on hit
    this.flashTimer = 0.12;
    this.skinMaterial.emissive.setHex(0xffffff);
    this.clothesMaterial.emissive.setHex(0xffffff);
    this.pantsMaterial.emissive.setHex(0xffffff);

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
      this.flinchTimer = 0.22;
      this.headGroup.rotation.x = -0.48; // Snaps backward
      this.headGroup.rotation.y = (Math.random() - 0.5) * 0.6; // Sideways jerk
    } else {
      this.flinchType = 'BODY';
      this.flinchTimer = 0.18;
      this.upperBodyGroup.rotation.x = 0.32; // Jerks back
      this.upperBodyGroup.rotation.y = (Math.random() > 0.5 ? 0.35 : -0.35); // Torso twist
    }

    return { isKilled: false, isHeadshot, damage: effectiveDamage };
  }

  /**
   * Per-frame animation & locomotion update loop
   */
  public update(delta: number, playerPos: THREE.Vector3, steerVelocity: THREE.Vector3) {
    if (this.state === 'DEAD') return;

    // 1. Handle Hit Flash Emissive Decay
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.skinMaterial.emissive.setHex(0x000000);
        this.clothesMaterial.emissive.setHex(0x000000);
        this.pantsMaterial.emissive.setHex(0x000000);
      }
    }

    // 2. Handle Death Collapse and Ash Dissolve
    if (this.state === 'DYING') {
      this.deathTimer += delta;
      const fallProgress = Math.min(1.0, this.deathTimer / 0.55);
      const easeFall = 1 - Math.cos((fallProgress * Math.PI) / 2);
      this.group.rotation.x = -easeFall * 1.45; // Collapse backward
      this.group.position.y = -easeFall * 0.45; // Settle flush on ground

      if (this.deathTimer > 0.6) {
        const fadeProgress = (this.deathTimer - 0.6) / 1.0;
        this.skinMaterial.color.lerp(new THREE.Color(0x18181b), 0.1);
        this.clothesMaterial.color.lerp(new THREE.Color(0x0f0f10), 0.1);
        const s = Math.max(0.01, 1.0 - fadeProgress * 0.95);
        this.group.scale.set(s, s, s);

        if (this.deathTimer >= 1.6) {
          this.state = 'DEAD';
          this.group.visible = false;
        }
      }
      return;
    }

    // 3. Handle Directional Flinch Recovery
    if (this.state === 'FLINCHING') {
      this.flinchTimer -= delta;
      if (this.flinchType === 'HEAD') {
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0.14, 0.18);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, 0, 0.18);
      } else {
        this.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.x, -0.16, 0.18);
        this.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(this.upperBodyGroup.rotation.y, 0, 0.18);
      }

      if (this.flinchTimer <= 0) {
        this.upperBodyGroup.rotation.x = -0.16;
        this.upperBodyGroup.rotation.y = 0;
        this.headGroup.rotation.x = 0.14;
        this.headGroup.rotation.y = 0;
        this.state = 'CHASING';
      }
      return;
    }

    // 4. Distance to Player & State Transition
    const dx = this.position.x - playerPos.x;
    const dz = this.position.z - playerPos.z;
    const horizontalDist = Math.hypot(dx, dz);
    const dist3D = this.group.position.distanceTo(playerPos);
    const distToPlayer = Math.min(horizontalDist, dist3D);

    if (distToPlayer <= 1.85) {
      if (this.state !== 'ATTACKING') {
        this.state = 'ATTACKING';
        this.attackCooldown = Math.min(this.attackCooldown, 0.25);
      }
    } else {
      this.state = 'CHASING';
    }

    // 5. Asymmetrical Shuffling Limp & Skeletal Locomotion
    this.animTimer += delta * (this.state === 'ATTACKING' ? 6.2 : 4.4);

    if (this.state === 'CHASING') {
      this.position.x += steerVelocity.x * delta;
      this.position.z += steerVelocity.z * delta;
      this.group.position.set(this.position.x, 0, this.position.z);

      if (steerVelocity.lengthSq() > 0.01) {
        const targetAngle = Math.atan2(steerVelocity.x, steerVelocity.z);
        let diff = targetAngle - this.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.group.rotation.y += diff * Math.min(1.0, delta * 7.0);
      }

      // Asymmetrical limp: Left leg swings, Right leg drags behind with hitch
      const stepCycle = this.animTimer;
      const leftSwing = Math.sin(stepCycle);
      const rightSwing = Math.sin(stepCycle - 0.7); // Delayed drag

      this.leftLegGroup.rotation.x = leftSwing * 0.44;
      this.rightLegGroup.rotation.x = -rightSwing * 0.32 + 0.12; // Dragged behind

      // Upper body spine sway with drooping right shoulder
      this.upperBodyGroup.rotation.z = 0.07 + Math.sin(stepCycle) * 0.04;
      this.upperBodyGroup.rotation.x = -0.16 + Math.cos(stepCycle * 2) * 0.03;
      this.upperBodyGroup.rotation.y = Math.sin(stepCycle) * 0.07;

      // Reaching arms bobbing with skeletal twitch
      this.leftArmGroup.rotation.x = -Math.PI / 2.3 + Math.sin(stepCycle + 0.4) * 0.12;
      this.rightArmGroup.rotation.x = -Math.PI / 2.15 - Math.sin(stepCycle + 0.4) * 0.14;
      this.leftArmGroup.rotation.y = Math.sin(stepCycle * 0.5) * 0.08;
      this.rightArmGroup.rotation.y = -Math.sin(stepCycle * 0.5) * 0.08;
    } else if (this.state === 'ATTACKING') {
      this.attackTimer += delta;
      const tdx = playerPos.x - this.position.x;
      const tdz = playerPos.z - this.position.z;
      this.group.rotation.y = Math.atan2(tdx, tdz);

      // Aggressive clawing swipes
      const swipe = Math.sin(this.animTimer * 1.6);
      this.leftArmGroup.rotation.x = -Math.PI / 2.0 + swipe * 0.45;
      this.rightArmGroup.rotation.x = -Math.PI / 2.0 - swipe * 0.45;
      this.upperBodyGroup.rotation.x = -0.20 + Math.abs(swipe) * 0.1;

      this.leftLegGroup.rotation.x = Math.sin(this.animTimer * 0.6) * 0.1;
      this.rightLegGroup.rotation.x = -Math.sin(this.animTimer * 0.6) * 0.1;
    }
  }

  public tryAttack(delta: number): boolean {
    if (this.state !== 'ATTACKING' || this.isEliminated || this.currentHealth <= 0) {
      return false;
    }
    this.attackCooldown -= delta;
    if (this.attackCooldown <= 0) {
      this.attackCooldown = 1.0;
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
    this.leatherMaterial.dispose();
    this.mouthMaterial.dispose();
    this.teethMaterial.dispose();
  }
}
