/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { soundManager } from '../utils/audio';

export interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CollisionCircle {
  x: number;
  z: number;
  radius: number;
}

export interface PlayerControllerOptions {
  camera: THREE.PerspectiveCamera;
  weaponGroup: THREE.Group;
  domElement: HTMLElement;
  mouseSensitivity: number;
  onPointerLockChange?: (isLocked: boolean) => void;
  onFire?: () => void;
  onReload?: () => void;
  onSwitchWeapon?: (slot: 1 | 2 | 3 | 4 | 5 | 6) => void;
  onCycleWeapon?: (direction: 1 | -1) => void;
  onAirburst?: () => void;
  onPlantClaymore?: () => void;
}

export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private weaponGroup: THREE.Group;
  private domElement: HTMLElement;

  // Camera orientation angles (Euler: Yaw Y, Pitch X)
  public yaw: number = 0;
  public pitch: number = 0;

  // Player position & physics
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.75, 4.0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Movement constants
  private readonly WALK_SPEED = 6.0;
  private readonly SPRINT_SPEED = 9.5;
  private readonly ACCELERATION = 40.0;
  private readonly FRICTION = 10.0;
  private readonly PLAYER_RADIUS = 0.45;
  private readonly EYE_HEIGHT = 1.75;

  // Playable compound boundaries (inside concrete perimeter)
  private readonly BOUNDS = {
    minX: -22.2,
    maxX: 22.2,
    minZ: -22.2,
    maxZ: 22.2,
  };

  // Obstacle collision shapes in the courtyard
  private obstacleBoxes: CollisionBox[] = [
    // Crate stack 1: (-7, -6)
    { minX: -8.0, maxX: -4.4, minZ: -7.2, maxZ: -4.8 },
    // Crate stack 2: (9, -8)
    { minX: 8.0, maxX: 11.6, minZ: -9.2, maxZ: -6.8 },
    // Crate stack 3: (-11, 8)
    { minX: -12.0, maxX: -8.4, minZ: 6.8, maxZ: 9.2 },
    // Crate stack 4: (12, 6)
    { minX: 11.0, maxX: 14.6, minZ: 4.8, maxZ: 7.2 },
    // Central Sandbag Bunker: (0, 1.5)
    { minX: -3.8, maxX: 3.8, minZ: 1.0, maxZ: 2.0 },
  ];

  private obstacleCircles: CollisionCircle[] = [
    // Barrel cluster 1
    { x: -5, z: 4, radius: 1.35 },
    // Barrel cluster 2
    { x: 7, z: -3, radius: 1.35 },
    // Barrel cluster 3
    { x: 14, z: -14, radius: 1.35 },
    // Barrel cluster 4
    { x: -14, z: -12, radius: 1.35 },
    // Practice Target 1 Stand (Near)
    { x: -3.5, z: -8.0, radius: 0.65 },
    // Practice Target 2 Stand (Mid)
    { x: 7.0, z: -14.0, radius: 0.65 },
    // Practice Target 3 Stand (Far)
    { x: -9.0, z: -20.0, radius: 0.65 },
  ];

  // Active inputs
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };

  // State
  public isLocked: boolean = false;
  public isFrozen: boolean = false;
  public isTriggerHeld: boolean = false;
  public mouseSensitivity: number = 1.0;
  private onPointerLockChangeCallback?: (isLocked: boolean) => void;
  private onFireCallback?: () => void;
  private onReloadCallback?: () => void;
  private onSwitchWeaponCallback?: (slot: 1 | 2 | 3 | 4 | 5 | 6) => void;
  private onCycleWeaponCallback?: (direction: 1 | -1) => void;
  private onAirburstCallback?: () => void;
  private onPlantClaymoreCallback?: () => void;

  // Mobile touch joystick & drag look state
  public touchMove = { forward: 0, right: 0 };
  public touchSprint: boolean = false;

  public setTouchMove(forward: number, right: number, sprint: boolean = false) {
    this.touchMove.forward = Math.max(-1, Math.min(1, forward));
    this.touchMove.right = Math.max(-1, Math.min(1, right));
    this.touchSprint = sprint;
  }

  public addTouchLook(deltaX: number, deltaY: number, sensitivity: number = 1.0) {
    if (this.isFrozen) return;
    const factor = 0.0034 * sensitivity;
    this.yaw -= deltaX * factor;
    this.pitch -= deltaY * factor;
    const maxPitch = (85 * Math.PI) / 180;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  public rotateYaw(deltaYaw: number) {
    if (this.isFrozen) return;
    this.yaw -= deltaYaw;
  }

  public rotatePitch(deltaPitch: number) {
    if (this.isFrozen) return;
    this.pitch -= deltaPitch;
    const maxPitch = (85 * Math.PI) / 180;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  // Tactical Flank Turn State (60ms smooth rotational ease)
  private snapTurnRemaining: number = 0;
  private snapTurnDuration: number = 0.06; // 60ms rotational ease
  private snapTurnSpeed: number = 0;

  /**
   * Snaps the camera yaw by a target angle with a crisp 60ms rotational ease.
   * angle > 0 rotates left (+90°), angle < 0 rotates right (-90°), angle === PI reverses (180°).
   */
  public snapTurn(angleInRadians: number) {
    if (this.isFrozen) return;
    this.snapTurnRemaining = angleInRadians;
    this.snapTurnSpeed = angleInRadians / this.snapTurnDuration;
  }

  public snapTurnLeft() {
    this.snapTurn(Math.PI / 2);
  }

  public snapTurnAround() {
    this.snapTurn(Math.PI);
  }

  public snapTurnRight() {
    this.snapTurn(-Math.PI / 2);
  }

  public quickTurn180() {
    this.snapTurnAround();
  }

  public setTouchTrigger(held: boolean) {
    this.isTriggerHeld = held;
    if (held && !this.isFrozen && this.onFireCallback) {
      this.onFireCallback();
    }
  }

  public triggerTouchReload() {
    if (!this.isFrozen && this.onReloadCallback) {
      this.onReloadCallback();
    }
  }

  public triggerTouchAirburst() {
    if (!this.isFrozen && this.onAirburstCallback) {
      this.onAirburstCallback();
    }
  }

  public triggerTouchSwitchWeapon(slot: 1 | 2 | 3 | 4 | 5 | 6) {
    if (!this.isFrozen && this.onSwitchWeaponCallback) {
      this.onSwitchWeaponCallback(slot);
    }
  }

  public triggerTouchPlantClaymore() {
    if (!this.isFrozen && this.onPlantClaymoreCallback) {
      this.onPlantClaymoreCallback();
    }
  }

  // Weapon sway & head bob state
  private swayOffset = new THREE.Vector2(0, 0);
  private swayVelocity = new THREE.Vector2(0, 0);
  private bobTimer = 0;
  private footstepTimer = 0;

  // Bound listeners for clean disposal
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;
  private handleMouseMoveBound: (e: MouseEvent) => void;
  private handleMouseDownBound: (e: MouseEvent) => void;
  private handleMouseUpBound: (e: MouseEvent) => void;
  private handleWheelBound: (e: WheelEvent) => void;
  private handlePointerLockChangeBound: () => void;

  constructor(options: PlayerControllerOptions) {
    this.camera = options.camera;
    this.weaponGroup = options.weaponGroup;
    this.domElement = options.domElement;
    this.mouseSensitivity = options.mouseSensitivity || 1.0;
    this.onPointerLockChangeCallback = options.onPointerLockChange;
    this.onFireCallback = options.onFire;
    this.onReloadCallback = options.onReload;
    this.onSwitchWeaponCallback = options.onSwitchWeapon;
    this.onCycleWeaponCallback = options.onCycleWeapon;
    this.onAirburstCallback = options.onAirburst;
    this.onPlantClaymoreCallback = options.onPlantClaymore;

    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.handleKeyUpBound = this.handleKeyUp.bind(this);
    this.handleMouseMoveBound = this.handleMouseMove.bind(this);
    this.handleMouseDownBound = this.handleMouseDown.bind(this);
    this.handleMouseUpBound = this.handleMouseUp.bind(this);
    this.handleWheelBound = this.handleWheel.bind(this);
    this.handlePointerLockChangeBound = this.handlePointerLockChange.bind(this);

    this.attachEventListeners();
  }

  private attachEventListeners() {
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    document.addEventListener('mousemove', this.handleMouseMoveBound);
    document.addEventListener('mousedown', this.handleMouseDownBound);
    document.addEventListener('mouseup', this.handleMouseUpBound);
    document.addEventListener('wheel', this.handleWheelBound, { passive: true });
    document.addEventListener('pointerlockchange', this.handlePointerLockChangeBound);
  }

  public requestLock() {
    try {
      this.domElement.requestPointerLock();
    } catch (e) {
      console.warn('Pointer lock request error:', e);
    }
  }

  public exitLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  private handlePointerLockChange() {
    const locked = document.pointerLockElement === this.domElement || document.pointerLockElement === document.body;
    this.isLocked = locked;
    if (!locked) {
      this.isTriggerHeld = false;
    }
    if (this.onPointerLockChangeCallback) {
      this.onPointerLockChangeCallback(locked);
    }
  }

  private handleMouseDown(e: MouseEvent) {
    if (!this.isLocked || this.isFrozen) return;
    if (e.button === 0) {
      this.isTriggerHeld = true;
      if (this.onFireCallback) {
        this.onFireCallback();
      }
    }
  }

  private handleMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this.isTriggerHeld = false;
    }
  }

  private handleWheel(e: WheelEvent) {
    if (this.isFrozen) return;
    const direction = e.deltaY > 0 ? 1 : -1;
    this.onCycleWeaponCallback?.(direction);
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isLocked || this.isFrozen) return;

    // Base sensitivity calibrated for smooth, precise aiming
    const baseSensitivity = 0.0022;
    const sens = baseSensitivity * this.mouseSensitivity;

    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;

    // Yaw (horizontal 360°)
    this.yaw -= movementX * sens;

    // Pitch (vertical clamped to [-85°, 85°])
    this.pitch -= movementY * sens;
    const maxPitch = (85 * Math.PI) / 180;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Weapon sway lag reaction
    this.swayVelocity.x += movementX * 0.00035;
    this.swayVelocity.y -= movementY * 0.00035;
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
      return;
    }
    if (this.isFrozen) {
      return;
    }

    // Weapon slot keybinds (1: Pistol, 2: Shotgun, 3: SMG, 4: Rifle, 5: LMG, 6: Sniper)
    if (e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1') {
      this.onSwitchWeaponCallback?.(1);
      return;
    }
    if (e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2') {
      this.onSwitchWeaponCallback?.(2);
      return;
    }
    if (e.code === 'Digit3' || e.code === 'Numpad3' || e.key === '3') {
      this.onSwitchWeaponCallback?.(3);
      return;
    }
    if (e.code === 'Digit4' || e.code === 'Numpad4' || e.key === '4') {
      this.onSwitchWeaponCallback?.(4);
      return;
    }
    if (e.code === 'Digit5' || e.code === 'Numpad5' || e.key === '5') {
      this.onSwitchWeaponCallback?.(5);
      return;
    }
    if (e.code === 'Digit6' || e.code === 'Numpad6' || e.key === '6') {
      this.onSwitchWeaponCallback?.(6);
      return;
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = true;
        break;
      case 'KeyR':
        if (this.onReloadCallback) {
          this.onReloadCallback();
        }
        break;
      case 'KeyE':
        this.onPlantClaymoreCallback?.();
        break;
      case 'KeyG':
      case 'KeyF':
        this.onAirburstCallback?.();
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false;
        break;
    }
  }

  /**
   * Main per-frame update loop called from ThreeCanvas render loop
   */
  public update(delta: number, fireKick: number, damageKick: number, cameraSway: boolean = true) {
    if (delta <= 0) return;
    if (this.isFrozen) {
      this.velocity.set(0, 0, 0);
      return;
    }
    const dt = Math.min(delta, 0.1);

    // 0. Smooth 60ms rotational ease for tactical flank turn snaps
    if (Math.abs(this.snapTurnRemaining) > 0.0001) {
      const step = this.snapTurnSpeed * dt;
      if (Math.abs(step) >= Math.abs(this.snapTurnRemaining)) {
        this.yaw += this.snapTurnRemaining;
        this.snapTurnRemaining = 0;
      } else {
        this.yaw += step;
        this.snapTurnRemaining -= step;
      }
    }

    // 1. Calculate desired movement direction relative to camera yaw
    let moveForward = this.touchMove.forward;
    let moveRight = this.touchMove.right;

    if (this.keys.forward) moveForward += 1;
    if (this.keys.backward) moveForward -= 1;
    if (this.keys.right) moveRight += 1;
    if (this.keys.left) moveRight -= 1;

    // Clamp combined movement to [-1, 1]
    moveForward = Math.max(-1, Math.min(1, moveForward));
    moveRight = Math.max(-1, Math.min(1, moveRight));

    // Normalize diagonal movement vector
    const inputLen = Math.hypot(moveForward, moveRight);
    let targetVx = 0;
    let targetVz = 0;
    const isSprintingInput = this.keys.sprint || this.touchSprint;
    const targetSpeed = isSprintingInput ? this.SPRINT_SPEED : this.WALK_SPEED;

    if (inputLen > 0.001) {
      const normF = moveForward / inputLen;
      const normR = moveRight / inputLen;

      // Forward vector based on yaw: [-sin(yaw), -cos(yaw)]
      // Right vector based on yaw: [cos(yaw), -sin(yaw)]
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);

      const dirX = -sinY * normF + cosY * normR;
      const dirZ = -cosY * normF - sinY * normR;

      targetVx = dirX * targetSpeed;
      targetVz = dirZ * targetSpeed;
    }

    // 2. Smooth acceleration and deceleration (damping)
    const accelRate = inputLen > 0 ? this.ACCELERATION : this.FRICTION;
    this.velocity.x += (targetVx - this.velocity.x) * Math.min(accelRate * dt, 1.0);
    this.velocity.z += (targetVz - this.velocity.z) * Math.min(accelRate * dt, 1.0);

    // 3. Sliding Collision Resolution (X-axis then Z-axis independently without wall snagging)
    const proposedX = this.position.x + this.velocity.x * dt;
    if (!this.checkCollisionX(proposedX, this.position.z)) {
      this.position.x = proposedX;
    } else {
      this.velocity.x = 0;
    }

    const proposedZ = this.position.z + this.velocity.z * dt;
    if (!this.checkCollisionZ(this.position.x, proposedZ)) {
      this.position.z = proposedZ;
    } else {
      this.velocity.z = 0;
    }

    // Clamp inside compound perimeter blast walls with safe player radius offset
    const safeMinX = this.BOUNDS.minX + this.PLAYER_RADIUS + 0.02;
    const safeMaxX = this.BOUNDS.maxX - this.PLAYER_RADIUS - 0.02;
    const safeMinZ = this.BOUNDS.minZ + this.PLAYER_RADIUS + 0.02;
    const safeMaxZ = this.BOUNDS.maxZ - this.PLAYER_RADIUS - 0.02;
    this.position.x = Math.max(safeMinX, Math.min(safeMaxX, this.position.x));
    this.position.z = Math.max(safeMinZ, Math.min(safeMaxZ, this.position.z));

    // 4. Head Bob & Footstep Audio Timing
    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    let headBobY = 0;
    let headBobRoll = 0;

    if (currentSpeed > 0.8) {
      const isSprinting = isSprintingInput && currentSpeed > 6.5;
      const bobFreq = isSprinting ? 14.0 : 10.0;
      this.bobTimer += dt * bobFreq;

      headBobY = Math.sin(this.bobTimer) * (isSprinting ? 0.045 : 0.026);
      headBobRoll = Math.cos(this.bobTimer * 0.5) * 0.008;

      // Footstep cadence
      const stepInterval = isSprinting ? 0.32 : 0.46;
      this.footstepTimer += dt;
      if (this.footstepTimer >= stepInterval) {
        this.footstepTimer = 0;
        soundManager.playFootstep(isSprinting);
      }
    } else {
      // Idle breathing sway
      this.footstepTimer = 0.35; // Prime for immediate first step when moving
      if (cameraSway) {
        headBobY = Math.sin(performance.now() * 0.0025) * 0.008;
      }
    }

    // 5. Update Camera Position & Rotation
    this.camera.position.set(
      this.position.x,
      this.EYE_HEIGHT + headBobY,
      this.position.z
    );

    // Camera Euler rotation (YXZ order)
    this.camera.rotation.order = 'YXZ';
    const kickPitch = fireKick * 0.06;
    const damageJoltPitch = damageKick * 0.04;
    const damageJoltRoll = (Math.sin(performance.now() * 0.05) * damageKick) * 0.04;

    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + kickPitch + damageJoltPitch;
    this.camera.rotation.z = headBobRoll + damageJoltRoll;

    // 6. Viewmodel Sway Lag & Bobbing
    // Spring return to center
    this.swayVelocity.x += -this.swayOffset.x * 24.0 * dt;
    this.swayVelocity.y += -this.swayOffset.y * 24.0 * dt;
    this.swayVelocity.x *= Math.max(0, 1.0 - 12.0 * dt);
    this.swayVelocity.y *= Math.max(0, 1.0 - 12.0 * dt);

    this.swayOffset.x += this.swayVelocity.x * dt;
    this.swayOffset.y += this.swayVelocity.y * dt;

    // Clamp sway
    this.swayOffset.x = Math.max(-0.04, Math.min(0.04, this.swayOffset.x));
    this.swayOffset.y = Math.max(-0.04, Math.min(0.04, this.swayOffset.y));

    // Weapon bobbing relative to camera
    const gunBaseX = 0.24 + this.swayOffset.x + (currentSpeed > 0.8 ? Math.cos(this.bobTimer * 0.5) * 0.012 : 0);
    const gunBaseY = -0.2 + this.swayOffset.y - headBobY * 0.8;
    const gunBaseZ = -0.48 + fireKick * 0.08;

    this.weaponGroup.position.set(gunBaseX, gunBaseY, gunBaseZ);
    this.weaponGroup.rotation.set(
      0.03 + fireKick * 0.16 + this.swayOffset.y * 1.5,
      -0.05 - this.swayOffset.x * 1.5,
      -this.swayOffset.x * 0.8
    );
  }

  /**
   * Independent X-axis collision test against perimeter and obstacles
   */
  private checkCollisionX(x: number, z: number): boolean {
    const r = this.PLAYER_RADIUS;
    if (x - r < this.BOUNDS.minX || x + r > this.BOUNDS.maxX) {
      return true;
    }
    return this.checkObstacleCollision(x, z);
  }

  /**
   * Independent Z-axis collision test against perimeter and obstacles
   */
  private checkCollisionZ(x: number, z: number): boolean {
    const r = this.PLAYER_RADIUS;
    if (z - r < this.BOUNDS.minZ || z + r > this.BOUNDS.maxZ) {
      return true;
    }
    return this.checkObstacleCollision(x, z);
  }

  /**
   * Combined obstacle check (crates, sandbags, barrels)
   */
  private checkObstacleCollision(x: number, z: number): boolean {
    const r = this.PLAYER_RADIUS;

    // AABB obstacle check (crates and sandbags)
    for (const box of this.obstacleBoxes) {
      if (
        x + r > box.minX &&
        x - r < box.maxX &&
        z + r > box.minZ &&
        z - r < box.maxZ
      ) {
        return true;
      }
    }

    // Cylinder / circle obstacle check (barrels)
    for (const circle of this.obstacleCircles) {
      const dx = x - circle.x;
      const dz = z - circle.z;
      const minDist = circle.radius + r;
      if (dx * dx + dz * dz < minDist * minDist) {
        return true;
      }
    }

    return false;
  }

  public checkCollision(x: number, z: number): boolean {
    return this.checkCollisionX(x, z) || this.checkCollisionZ(x, z);
  }

  public getPosition(): THREE.Vector3 {
    return this.position;
  }

  public getYaw(): number {
    return this.yaw;
  }

  public resetPosition(x = 0, z = 4.0, yaw = 0) {
    this.isFrozen = false;
    this.position.set(x, this.EYE_HEIGHT, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.swayOffset.set(0, 0);
    this.swayVelocity.set(0, 0);
    this.bobTimer = 0;
    this.footstepTimer = 0;
    this.keys.forward = false;
    this.keys.backward = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.sprint = false;
  }

  public reset(x = 0, z = 4.0, yaw = 0) {
    this.resetPosition(x, z, yaw);
  }

  public dispose() {
    this.exitLock();
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    document.removeEventListener('mousemove', this.handleMouseMoveBound);
    document.removeEventListener('mousedown', this.handleMouseDownBound);
    document.removeEventListener('mouseup', this.handleMouseUpBound);
    document.removeEventListener('wheel', this.handleWheelBound);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChangeBound);
  }
}
