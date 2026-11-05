/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { TargetManager } from './TargetManager';
import { ZombieManager, AnyZombie } from './ZombieManager';
import { VFXManager } from './VFXManager';
import { ExplosiveBarrelManager, ExplosiveBarrel } from './ExplosiveBarrelManager';
import { soundManager } from '../utils/audio';
import { WeaponId, UnlockedWeapons, WeaponReserves, WeaponMags } from '../types/gameTypes';
import {
  PISTOL_CONFIG,
  SHOTGUN_CONFIG,
  SMG_CONFIG,
  RIFLE_CONFIG,
  LMG_CONFIG,
  SNIPER_CONFIG,
  WEAPON_CONFIGS,
} from '../config/gameConfig';
import { ArsenalModels } from '../entities/WeaponModels';

export interface WeaponSystemCallbacks {
  onAmmoChanged: (ammo: number, reserve?: number) => void;
  onWeaponChanged?: (weaponId: WeaponId, name: string, ammo: number, maxAmmo: number, reserve: number) => void;
  onScoreEarned: (points: number, coins: number) => void;
  onHitMarker: (isKill: boolean, isHeadshot?: boolean) => void;
  onZombieEliminated?: (isHeadshot: boolean) => void;
  onReloadStarted: () => void;
  onReloadProgress: (progress: number) => void;
  onReloadCompleted: () => void;
  onEmptyAlert: () => void;
  onRecoilKick: (amount: number) => void;
}

export class WeaponSystem {
  private camera: THREE.PerspectiveCamera;
  private weaponGroup: THREE.Group;
  private targetManager: TargetManager;
  private zombieManager: ZombieManager;
  private vfxManager: VFXManager;
  private barrelManager?: ExplosiveBarrelManager;
  private environmentMeshes: THREE.Object3D[] = [];
  private callbacks: WeaponSystemCallbacks;

  // Multi-Weapon Arsenal State
  public equippedWeapon: WeaponId = 'PISTOL';
  public unlockedWeapons: UnlockedWeapons = {
    PISTOL: true,
    SHOTGUN: false,
    SMG: false,
    RIFLE: false,
    LMG: false,
    SNIPER: false,
  };
  public weaponMags: WeaponMags = {
    PISTOL: PISTOL_CONFIG.magSize,
    SHOTGUN: SHOTGUN_CONFIG.magSize,
    SMG: SMG_CONFIG.magSize,
    RIFLE: RIFLE_CONFIG.magSize,
    LMG: LMG_CONFIG.magSize,
    SNIPER: SNIPER_CONFIG.magSize,
  };
  public weaponReserves: WeaponReserves = {
    PISTOL: Infinity,
    SHOTGUN: 24,
    SMG: 120,
    RIFLE: 90,
    LMG: 200,
    SNIPER: 15,
  };

  public ammo: number = PISTOL_CONFIG.magSize;
  public maxAmmo: number = PISTOL_CONFIG.magSize;
  public isReloading: boolean = false;
  public lastFireTime: number = 0;
  private reloadTimer: number = 0;

  // Viewmodel Arsenal Manager
  public arsenal?: ArsenalModels;

  // Raycaster pre-allocated helpers
  private raycaster = new THREE.Raycaster();
  private screenCenter = new THREE.Vector2(0, 0);
  private muzzleWorldPos = new THREE.Vector3();
  private rayOrigin = new THREE.Vector3();
  private rayDirection = new THREE.Vector3();
  private pelletSpreadVec = new THREE.Vector2();

  constructor(
    camera: THREE.PerspectiveCamera,
    weaponGroup: THREE.Group,
    targetManager: TargetManager,
    zombieManager: ZombieManager,
    vfxManager: VFXManager,
    environmentMeshes: THREE.Object3D[],
    callbacks: WeaponSystemCallbacks
  ) {
    this.camera = camera;
    this.weaponGroup = weaponGroup;
    this.targetManager = targetManager;
    this.zombieManager = zombieManager;
    this.vfxManager = vfxManager;
    this.environmentMeshes = environmentMeshes;
    this.callbacks = callbacks;

    this.raycaster.far = 160;
  }

  public setEnvironmentMeshes(meshes: THREE.Object3D[]) {
    this.environmentMeshes = meshes;
  }

  public setBarrelManager(manager: ExplosiveBarrelManager) {
    this.barrelManager = manager;
  }

  public setArsenal(arsenal: ArsenalModels) {
    this.arsenal = arsenal;
    this.updateModelVisibility();
  }

  private updateModelVisibility() {
    if (!this.arsenal) return;
    (Object.keys(this.arsenal.models) as WeaponId[]).forEach((wId) => {
      const data = this.arsenal!.models[wId];
      if (data) {
        data.group.visible = this.equippedWeapon === wId;
      }
    });
  }

  /**
   * Switch equipped weapon
   */
  public async switchWeapon(weaponId: WeaponId, force: boolean = false): Promise<boolean> {
    if (!force && this.equippedWeapon === weaponId) return false;
    if (!this.unlockedWeapons[weaponId]) return false;

    // Save current weapon magazine
    this.weaponMags[this.equippedWeapon] = this.ammo;

    // Cancel active reload
    this.isReloading = false;
    this.reloadTimer = 0;

    this.equippedWeapon = weaponId;
    const config = WEAPON_CONFIGS[weaponId];
    this.ammo = this.weaponMags[weaponId];
    this.maxAmmo = config.magSize;

    this.updateModelVisibility();

    await soundManager.ensureAudioContext();
    soundManager.playWeaponSwitch();

    this.callbacks.onWeaponChanged?.(
      weaponId,
      config.name,
      this.ammo,
      this.maxAmmo,
      this.weaponReserves[weaponId]
    );
    this.callbacks.onAmmoChanged(this.ammo, this.weaponReserves[weaponId]);

    return true;
  }

  /**
   * Unlock a newly purchased weapon and immediately auto-equip it
   */
  public unlockWeapon(weaponId: WeaponId) {
    this.unlockedWeapons[weaponId] = true;
    this.switchWeapon(weaponId, true);
  }

  /**
   * Add reserve ammunition for a weapon
   */
  public addReserveAmmo(weaponId: WeaponId, amount: number) {
    if (this.weaponReserves[weaponId] !== Infinity) {
      this.weaponReserves[weaponId] += amount;
      if (this.equippedWeapon === weaponId) {
        this.callbacks.onAmmoChanged(this.ammo, this.weaponReserves[weaponId]);
      }
    }
  }

  /**
   * Attempt to fire weapon
   */
  public async fire(): Promise<boolean> {
    const now = performance.now();
    const config = WEAPON_CONFIGS[this.equippedWeapon];

    if (now - this.lastFireTime < config.fireRateMs) {
      return false;
    }

    if (this.isReloading) {
      return false;
    }

    // Magazine empty check
    if (this.ammo <= 0) {
      await soundManager.ensureAudioContext();
      soundManager.playDryFire();
      this.callbacks.onEmptyAlert();
      this.lastFireTime = now;
      return false;
    }

    this.lastFireTime = now;

    // 1. Consume 1 round
    this.ammo -= 1;
    this.weaponMags[this.equippedWeapon] = this.ammo;
    this.callbacks.onAmmoChanged(this.ammo, this.weaponReserves[this.equippedWeapon]);

    // Automatic Empty Magazine Reload: initiate reload if ammo reaches 0
    if (this.ammo <= 0) {
      if (this.weaponReserves[this.equippedWeapon] > 0) {
        setTimeout(() => {
          if (!this.isReloading && this.ammo <= 0) {
            this.reload();
          }
        }, 100);
      } else {
        this.callbacks.onEmptyAlert();
      }
    }

    // 2. Physical slide blowback recoil & Brass Shell Ejection
    if (this.arsenal) {
      this.arsenal.triggerSlideRecoil(this.equippedWeapon);
      this.arsenal.ejectBrassShell(this.equippedWeapon, this.camera);
    }

    // 3. Audio & Weapon-Specific Ballistics
    await soundManager.ensureAudioContext();

    const modelData = this.arsenal?.models[this.equippedWeapon];
    if (modelData) {
      modelData.group.localToWorld(this.muzzleWorldPos.copy(modelData.muzzleLocalPos));
    } else {
      this.weaponGroup.localToWorld(this.muzzleWorldPos.set(0, 0.05, -0.45));
    }

    switch (this.equippedWeapon) {
      case 'PISTOL':
        this.callbacks.onRecoilKick(0.9);
        soundManager.playGunshot();
        this.fireSingleRay(PISTOL_CONFIG.damage, true);
        break;

      case 'SHOTGUN':
        this.callbacks.onRecoilKick(2.4);
        soundManager.playShotgun();
        this.fireShotgunBuckshot();
        break;

      case 'SMG':
        this.callbacks.onRecoilKick(0.5);
        soundManager.playSMG();
        this.fireSubmachineRound();
        break;

      case 'RIFLE':
        this.callbacks.onRecoilKick(0.75);
        soundManager.playRifle();
        this.fireRifleRound();
        break;

      case 'LMG':
        this.callbacks.onRecoilKick(1.1);
        soundManager.playLMG();
        this.fireLMGRound();
        break;

      case 'SNIPER':
        this.callbacks.onRecoilKick(3.2);
        soundManager.playSniper();
        this.fireSniperPiercingRound();
        break;
    }

    this.vfxManager.triggerMuzzleFlash();
    return true;
  }

  /**
   * Shotgun 8-pellet spread cone firing
   */
  private fireShotgunBuckshot() {
    const pelletCount = SHOTGUN_CONFIG.pellets ?? 8;
    const spreadAngle = SHOTGUN_CONFIG.spreadAngle ?? 0.052;
    const pelletDamage = SHOTGUN_CONFIG.damage;

    this.camera.getWorldPosition(this.rayOrigin);

    for (let i = 0; i < pelletCount; i++) {
      const r = Math.sqrt(Math.random()) * spreadAngle;
      const theta = Math.random() * Math.PI * 2;
      this.pelletSpreadVec.set(Math.cos(theta) * r, Math.sin(theta) * r);

      this.raycaster.setFromCamera(this.pelletSpreadVec, this.camera);
      this.rayDirection.copy(this.raycaster.ray.direction);

      this.resolveRaycastHit(pelletDamage, false, false);
    }
  }

  /**
   * SMG tight rapid dispersion
   */
  private fireSubmachineRound() {
    const spread = 0.005;
    this.pelletSpreadVec.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
    this.raycaster.setFromCamera(this.pelletSpreadVec, this.camera);
    this.camera.getWorldPosition(this.rayOrigin);
    this.rayDirection.copy(this.raycaster.ray.direction);

    this.resolveRaycastHit(SMG_CONFIG.damage, false, false);
  }

  /**
   * Assault Rifle single high-velocity round
   */
  private fireRifleRound() {
    const spread = 0.007;
    this.pelletSpreadVec.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
    this.raycaster.setFromCamera(this.pelletSpreadVec, this.camera);
    this.camera.getWorldPosition(this.rayOrigin);
    this.rayDirection.copy(this.raycaster.ray.direction);

    this.resolveRaycastHit(RIFLE_CONFIG.damage, true, false);
  }

  /**
   * LMG suppressive burst with heavy thump
   */
  private fireLMGRound() {
    const spread = 0.012;
    this.pelletSpreadVec.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
    this.raycaster.setFromCamera(this.pelletSpreadVec, this.camera);
    this.camera.getWorldPosition(this.rayOrigin);
    this.rayDirection.copy(this.raycaster.ray.direction);

    this.resolveRaycastHit(LMG_CONFIG.damage, true, false);
  }

  /**
   * M82 .50 Cal Sniper Rifle: Pierces through multiple hostiles in a line!
   */
  private fireSniperPiercingRound() {
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    this.camera.getWorldPosition(this.rayOrigin);
    this.camera.getWorldDirection(this.rayDirection);

    const hitZombies = this.zombieManager.hitMeshes.length > 0
      ? this.raycaster.intersectObjects(this.zombieManager.hitMeshes, false)
      : [];

    let piercedCount = 0;
    const MAX_PIERCE = 4;
    const handledZombies = new Set<AnyZombie>();

    for (const hit of hitZombies) {
      if (piercedCount >= MAX_PIERCE) break;

      const hitInfo = this.zombieManager.findZombieHit(hit.object);
      if (hitInfo && !hitInfo.zombie.isEliminated && !handledZombies.has(hitInfo.zombie)) {
        handledZombies.add(hitInfo.zombie);
        piercedCount++;

        const { zombie, isHead, isRunner, isBrute } = hitInfo;
        const damage = isHead ? SNIPER_CONFIG.damage * 2.5 : SNIPER_CONFIG.damage;

        const res = zombie.takeDamage(damage, isHead);
        this.vfxManager.spawnBloodSplatter(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), isHead);

        if (isHead) {
          soundManager.playHeadshotChime();
        }
        soundManager.playHitTick(res.isKilled);
        this.callbacks.onHitMarker(res.isKilled, isHead);

        if (res.isKilled) {
          const pts = isBrute ? 400 : isRunner ? 160 : 120;
          const coins = isBrute ? 60 : isRunner ? 22 : 16;
          this.callbacks.onScoreEarned(pts, coins);
          this.vfxManager.spawnZombieAshDissolve(zombie.position);
          this.zombieManager.registerElimination(zombie, isHead);
          this.callbacks.onZombieEliminated?.(isHead);
        } else {
          this.callbacks.onScoreEarned(50, 6);
        }
      }
    }

    // Continue raycast to env or barrels
    this.resolveRaycastHit(SNIPER_CONFIG.damage, false, false);
  }

  /**
   * Single center-screen raycast (used by Pistol)
   */
  private fireSingleRay(baseDamage: number, canInstaKillHeadshot: boolean) {
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    this.camera.getWorldPosition(this.rayOrigin);
    this.camera.getWorldDirection(this.rayDirection);

    this.resolveRaycastHit(baseDamage, false, canInstaKillHeadshot);
  }

  /**
   * Core raycast intersection and damage resolution logic
   */
  private resolveRaycastHit(baseDamage: number, isRifle: boolean, canInstaKillHeadshot: boolean) {
    const zombieIntersects = this.zombieManager.hitMeshes.length > 0
      ? this.raycaster.intersectObjects(this.zombieManager.hitMeshes, false)
      : [];

    const targetIntersects = this.targetManager.targetMeshes.length > 0
      ? this.raycaster.intersectObjects(this.targetManager.targetMeshes, false)
      : [];

    const barrelIntersects = this.barrelManager && this.barrelManager.hitMeshes.length > 0
      ? this.raycaster.intersectObjects(this.barrelManager.hitMeshes, true)
      : [];

    const envIntersects = this.raycaster.intersectObjects(this.environmentMeshes, true);

    let closestType: 'ZOMBIE' | 'TARGET' | 'BARREL' | 'ENV' | 'NONE' = 'NONE';
    let closestDist = Infinity;
    let hitPoint: THREE.Vector3 | null = null;
    let hitNormal = new THREE.Vector3(0, 1, 0);

    let hitZombieHitInfo: { zombie: AnyZombie; isHead: boolean; isRunner: boolean; isBrute: boolean } | null = null;
    let hitTargetDummy: any = null;
    let hitBarrel: ExplosiveBarrel | null = null;

    if (envIntersects.length > 0) {
      closestType = 'ENV';
      closestDist = envIntersects[0].distance;
      hitPoint = envIntersects[0].point;
      if (envIntersects[0].face) hitNormal.copy(envIntersects[0].face.normal);
    }

    if (targetIntersects.length > 0 && targetIntersects[0].distance < closestDist) {
      const dummy = this.targetManager.findTargetByMesh(targetIntersects[0].object);
      if (dummy) {
        closestType = 'TARGET';
        closestDist = targetIntersects[0].distance;
        hitPoint = targetIntersects[0].point;
        if (targetIntersects[0].face) hitNormal.copy(targetIntersects[0].face.normal);
        hitTargetDummy = dummy;
      }
    }

    if (barrelIntersects.length > 0 && barrelIntersects[0].distance < closestDist) {
      const b = this.barrelManager?.findBarrelByMesh(barrelIntersects[0].object);
      if (b && !b.isDetonated) {
        closestType = 'BARREL';
        closestDist = barrelIntersects[0].distance;
        hitPoint = barrelIntersects[0].point;
        if (barrelIntersects[0].face) hitNormal.copy(barrelIntersects[0].face.normal);
        hitBarrel = b;
      }
    }

    if (zombieIntersects.length > 0 && zombieIntersects[0].distance < closestDist) {
      const hitInfo = this.zombieManager.findZombieHit(zombieIntersects[0].object);
      if (hitInfo && !hitInfo.zombie.isEliminated) {
        closestType = 'ZOMBIE';
        closestDist = zombieIntersects[0].distance;
        hitPoint = zombieIntersects[0].point;
        if (zombieIntersects[0].face) hitNormal.copy(zombieIntersects[0].face.normal);
        hitZombieHitInfo = hitInfo;
      }
    }

    // Tracer line
    const tracerEndPoint = hitPoint ? hitPoint.clone() : this.rayOrigin.clone().addScaledVector(this.rayDirection, 80);
    this.vfxManager.spawnTracer(this.muzzleWorldPos, tracerEndPoint);

    // Handle Impact
    if (closestType === 'ZOMBIE' && hitZombieHitInfo && hitPoint) {
      const { zombie, isHead, isRunner, isBrute } = hitZombieHitInfo;

      let calculatedDamage = baseDamage;
      if (isHead) {
        if (canInstaKillHeadshot && !isBrute) {
          calculatedDamage = zombie.maxHealth;
        } else {
          calculatedDamage = isBrute ? baseDamage * 2 : baseDamage * 2.5;
        }
      }

      const damageResult = zombie.takeDamage(calculatedDamage, isHead);
      this.vfxManager.spawnBloodSplatter(hitPoint, hitNormal, isHead);

      if (isHead) {
        soundManager.playHeadshotChime();
        soundManager.playHitTick(true);
        this.callbacks.onHitMarker(true, true);

        if (damageResult.isKilled) {
          const pts = isBrute ? 400 : isRunner ? 150 : 100;
          const coins = isBrute ? 60 : isRunner ? 20 : 15;
          this.callbacks.onScoreEarned(pts, coins);
          this.vfxManager.spawnZombieAshDissolve(zombie.position);
          this.zombieManager.registerElimination(zombie, true);
          this.callbacks.onZombieEliminated?.(true);
        } else {
          this.callbacks.onScoreEarned(isBrute ? 40 : 25, isBrute ? 8 : 4);
        }
      } else {
        if (damageResult.isKilled) {
          soundManager.playZombieDeath();
          soundManager.playHitTick(true);
          this.callbacks.onHitMarker(true, false);
          const pts = isBrute ? 300 : isRunner ? 120 : 50;
          const coins = isBrute ? 50 : isRunner ? 18 : 10;
          this.callbacks.onScoreEarned(pts, coins);
          this.vfxManager.spawnZombieAshDissolve(zombie.position);
          this.zombieManager.registerElimination(zombie, false);
          this.callbacks.onZombieEliminated?.(false);
        } else {
          soundManager.playZombieHurt();
          soundManager.playHitTick(false);
          this.callbacks.onHitMarker(false, false);
          this.callbacks.onScoreEarned(isBrute ? 20 : isRunner ? 20 : 15, isBrute ? 4 : isRunner ? 3 : 2);
        }
      }
    } else if (closestType === 'TARGET' && hitTargetDummy && hitPoint) {
      const damageResult = hitTargetDummy.takeDamage(baseDamage);
      this.vfxManager.spawnImpactParticles(hitPoint, hitNormal, 12, true);
      soundManager.playHitTick(damageResult.isKilled);
      this.callbacks.onHitMarker(damageResult.isKilled, false);

      if (damageResult.isKilled) {
        this.vfxManager.spawnTargetDebris(hitTargetDummy.group.position);
        this.callbacks.onScoreEarned(100, 15);
      } else {
        this.callbacks.onScoreEarned(25, 5);
      }
    } else if (closestType === 'BARREL' && hitBarrel && hitPoint) {
      this.vfxManager.spawnImpactParticles(hitPoint, hitNormal, 10, true);
      soundManager.playHitTick(false);
      this.callbacks.onHitMarker(false, false);
      this.barrelManager?.damageBarrel(hitBarrel, baseDamage);
    } else if (closestType === 'ENV' && hitPoint) {
      this.vfxManager.spawnImpactParticles(hitPoint, hitNormal, 8, false);
      soundManager.playRicochet();
    }
  }

  /**
   * Reload weapon from reserve ammunition
   */
  public async reload() {
    if (this.isReloading || this.ammo >= this.maxAmmo) return;
    if (this.weaponReserves[this.equippedWeapon] <= 0) {
      this.callbacks.onEmptyAlert();
      return;
    }

    this.isReloading = true;
    this.reloadTimer = 0;
    this.callbacks.onReloadStarted();

    await soundManager.ensureAudioContext();
    soundManager.playReload();
  }

  /**
   * Per-frame weapon system update loop
   */
  public update(delta: number) {
    if (this.arsenal) {
      this.arsenal.update(delta);
    }

    if (this.isReloading) {
      this.reloadTimer += delta;
      const config = WEAPON_CONFIGS[this.equippedWeapon];
      const progress = Math.min(1.0, this.reloadTimer / (config.reloadTimeMs / 1000));
      this.callbacks.onReloadProgress(progress);

      if (progress >= 1.0) {
        const needed = this.maxAmmo - this.ammo;
        const reserve = this.weaponReserves[this.equippedWeapon];

        if (reserve === Infinity) {
          this.ammo = this.maxAmmo;
        } else {
          const take = Math.min(needed, reserve);
          this.weaponReserves[this.equippedWeapon] -= take;
          this.ammo += take;
        }

        this.weaponMags[this.equippedWeapon] = this.ammo;
        this.isReloading = false;
        this.callbacks.onAmmoChanged(this.ammo, this.weaponReserves[this.equippedWeapon]);
        this.callbacks.onReloadCompleted();
      }
    }
  }

  /**
   * Refill all 6 active magazines to full capacity free of charge upon wave clear
   */
  public refillAllMags() {
    this.weaponMags.PISTOL = PISTOL_CONFIG.magSize;
    this.weaponMags.SHOTGUN = SHOTGUN_CONFIG.magSize;
    this.weaponMags.SMG = SMG_CONFIG.magSize;
    this.weaponMags.RIFLE = RIFLE_CONFIG.magSize;
    this.weaponMags.LMG = LMG_CONFIG.magSize;
    this.weaponMags.SNIPER = SNIPER_CONFIG.magSize;

    this.ammo = this.weaponMags[this.equippedWeapon];
    this.isReloading = false;
    this.reloadTimer = 0;
    this.callbacks.onAmmoChanged(this.ammo, this.weaponReserves[this.equippedWeapon]);
  }

  public reset() {
    this.equippedWeapon = 'PISTOL';
    this.unlockedWeapons = {
      PISTOL: true,
      SHOTGUN: false,
      SMG: false,
      RIFLE: false,
      LMG: false,
      SNIPER: false,
    };
    this.weaponMags = {
      PISTOL: PISTOL_CONFIG.magSize,
      SHOTGUN: SHOTGUN_CONFIG.magSize,
      SMG: SMG_CONFIG.magSize,
      RIFLE: RIFLE_CONFIG.magSize,
      LMG: LMG_CONFIG.magSize,
      SNIPER: SNIPER_CONFIG.magSize,
    };
    this.weaponReserves = {
      PISTOL: Infinity,
      SHOTGUN: 24,
      SMG: 120,
      RIFLE: 90,
      LMG: 200,
      SNIPER: 15,
    };
    this.ammo = PISTOL_CONFIG.magSize;
    this.maxAmmo = PISTOL_CONFIG.magSize;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.updateModelVisibility();
    this.callbacks.onWeaponChanged?.('PISTOL', PISTOL_CONFIG.name, this.ammo, this.maxAmmo, Infinity);
    this.callbacks.onAmmoChanged(this.ammo, Infinity);
  }
}
