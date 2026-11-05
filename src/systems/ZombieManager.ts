/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { WalkerZombie } from '../entities/WalkerZombie';
import { RunnerZombie } from '../entities/RunnerZombie';
import { BruteZombie } from '../entities/BruteZombie';
import { soundManager } from '../utils/audio';
import { MAX_ACTIVE_ZOMBIES, AIRBURST_RADIUS_METERS, AIRBURST_DAMAGE } from '../config/gameConfig';
import { WaveState } from '../types/gameTypes';

export type AnyZombie = WalkerZombie | RunnerZombie | BruteZombie;

export interface ZombieObstacle {
  x: number;
  z: number;
  radius: number;
}

export interface ZombieManagerCallbacks {
  onZombieKilled?: (isHeadshot: boolean, zombieType: 'WALKER' | 'RUNNER' | 'BRUTE', killsCount: number) => void;
  onPlayerDamage?: (damage: number) => void;
  onWaveCleared?: (wave: number, bonusScore: number, bonusCoins: number) => void;
  onWaveStarted?: (wave: number, totalHostiles: number) => void;
  onHostilesCountChanged?: (remaining: number, total: number) => void;
  onScoreEarned?: (score: number, coins: number) => void;
}

export class ZombieManager {
  private scene: THREE.Scene;
  public zombies: AnyZombie[] = [];
  public hitMeshes: THREE.Mesh[] = [];

  // Wave Progression State
  public waveNumber: number = 1;
  public waveState: WaveState = 'IN_PROGRESS';
  public totalWaveHostiles: number = 6;
  public remainingWaveHostiles: number = 6;
  private pendingSpawnQueue: ('WALKER' | 'RUNNER' | 'BRUTE')[] = [];
  private spawnCooldown: number = 0.5;

  private zombieIdCounter: number = 1;
  private totalKills: number = 0;

  // Ambient audio timer
  private nextGroanTimer: number = 3.5;

  // Invulnerability & damage cadence tracking
  private lastPlayerDamageTime: number = 0;

  // Courtyard Perimeter Gates (North, South, East, West)
  private readonly spawnGates: THREE.Vector3[] = [
    new THREE.Vector3(0, 0, -22.5),  // North Gate
    new THREE.Vector3(0, 0, 22.5),   // South Gate
    new THREE.Vector3(22.5, 0, 0),   // East Gate
    new THREE.Vector3(-22.5, 0, 0),  // West Gate
  ];

  // Courtyard Static Obstacles for AI Steering Avoidance
  private readonly obstacles: ZombieObstacle[] = [
    { x: 0, z: 1.5, radius: 3.8 },
    { x: -7, z: -6, radius: 2.3 },
    { x: 9, z: -8, radius: 2.3 },
    { x: -11, z: 8, radius: 2.3 },
    { x: 12, z: 6, radius: 2.3 },
    { x: -5, z: 4, radius: 1.8 },
    { x: 7, z: -3, radius: 1.8 },
    { x: 14, z: -14, radius: 1.8 },
    { x: -14, z: -12, radius: 1.8 },
    { x: -3.5, z: -8.0, radius: 1.4 },
    { x: 7.0, z: -14.0, radius: 1.4 },
    { x: -9.0, z: -20.0, radius: 1.4 },
  ];

  private callbacks: ZombieManagerCallbacks;

  // Reusable vector objects to eliminate GC in update tick
  private static _toPlayer = new THREE.Vector3();
  private static _steerForce = new THREE.Vector3();
  private static _avoidance = new THREE.Vector3();
  private static _separation = new THREE.Vector3();

  constructor(scene: THREE.Scene, callbacks: ZombieManagerCallbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;

    // Start with Wave 1
    this.startWave(1);
  }

  /**
   * Balanced wave composition:
   * - Wave 1: 6 Walkers
   * - Wave 2: 9 Walkers
   * - Wave 3: 10 hostiles (7 Walkers + 3 Runners staggered in batches of 2)
   * - Wave 4: 13 hostiles (9 Walkers + 4 Runners)
   * - Wave 5+: The Heavy Brute Zombie joins the assault!
   */
  public startWave(waveNum: number) {
    this.waveNumber = waveNum;
    this.waveState = 'IN_PROGRESS';

    let total = 6;
    let runnerCount = 0;
    let bruteCount = 0;

    if (waveNum === 1) {
      total = 6;
      runnerCount = 0;
      bruteCount = 0;
    } else if (waveNum === 2) {
      total = 9;
      runnerCount = 0;
      bruteCount = 0;
    } else if (waveNum === 3) {
      // Balanced Wave 3 per Requirement 5: exactly 10 hostiles (7 Walkers + 3 Runners)
      total = 10;
      runnerCount = 3;
      bruteCount = 0;
    } else if (waveNum === 4) {
      total = 13;
      runnerCount = 4;
      bruteCount = 0;
    } else if (waveNum === 5) {
      // Wave 5: First Brute Boss encounter!
      total = 16;
      runnerCount = 5;
      bruteCount = 1;
    } else {
      // Wave 6+: Scaling wave with multiple Brutes
      total = Math.round(16 * Math.pow(1.22, waveNum - 5));
      bruteCount = Math.min(4, 1 + Math.floor((waveNum - 5) / 2));
      const runnerRatio = Math.min(0.42, 0.30 + (waveNum - 5) * 0.02);
      runnerCount = Math.round((total - bruteCount) * runnerRatio);
    }

    const walkerCount = Math.max(1, total - runnerCount - bruteCount);
    this.totalWaveHostiles = total;
    this.remainingWaveHostiles = total;

    // Populate queue with staggered distribution
    this.pendingSpawnQueue = [];

    // If Wave 3, stagger batches cleanly: 2 Walkers, 1 Runner, 2 Walkers, 1 Runner, 3 Walkers, 1 Runner
    if (waveNum === 3) {
      this.pendingSpawnQueue = [
        'WALKER', 'WALKER', 'RUNNER',
        'WALKER', 'WALKER', 'RUNNER',
        'WALKER', 'WALKER', 'WALKER', 'RUNNER'
      ];
    } else {
      for (let i = 0; i < walkerCount; i++) this.pendingSpawnQueue.push('WALKER');
      for (let i = 0; i < runnerCount; i++) this.pendingSpawnQueue.push('RUNNER');
      for (let i = 0; i < bruteCount; i++) this.pendingSpawnQueue.push('BRUTE');

      // Shuffle
      for (let i = this.pendingSpawnQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.pendingSpawnQueue[i], this.pendingSpawnQueue[j]] = [this.pendingSpawnQueue[j], this.pendingSpawnQueue[i]];
      }
    }

    this.spawnCooldown = 0.3;
    this.callbacks.onWaveStarted?.(waveNum, total);
    this.callbacks.onHostilesCountChanged?.(this.remainingWaveHostiles, this.totalWaveHostiles);
  }

  public spawnWalkerAt(pos: THREE.Vector3): WalkerZombie | null {
    if (this.zombies.length >= MAX_ACTIVE_ZOMBIES) return null;
    const id = `zombie-walker-${this.zombieIdCounter++}`;
    const spawnPos = pos.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)
    );
    const zombie = new WalkerZombie(id, spawnPos, this.scene);
    this.zombies.push(zombie);
    this.refreshHitMeshes();
    return zombie;
  }

  public spawnRunnerAt(pos: THREE.Vector3): RunnerZombie | null {
    if (this.zombies.length >= MAX_ACTIVE_ZOMBIES) return null;
    const id = `zombie-runner-${this.zombieIdCounter++}`;
    const spawnPos = pos.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)
    );
    const zombie = new RunnerZombie(id, spawnPos, this.scene);
    this.zombies.push(zombie);
    this.refreshHitMeshes();
    return zombie;
  }

  public spawnBruteAt(pos: THREE.Vector3): BruteZombie | null {
    if (this.zombies.length >= MAX_ACTIVE_ZOMBIES) return null;
    const id = `zombie-brute-${this.zombieIdCounter++}`;
    const spawnPos = pos.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)
    );
    const zombie = new BruteZombie(id, spawnPos, this.scene);
    this.zombies.push(zombie);
    this.refreshHitMeshes();
    return zombie;
  }

  private spawnNextFromQueue(): AnyZombie | null {
    if (this.pendingSpawnQueue.length === 0) return null;
    if (this.zombies.length >= MAX_ACTIVE_ZOMBIES) return null;

    const type = this.pendingSpawnQueue.shift()!;
    const gate = this.spawnGates[Math.floor(Math.random() * this.spawnGates.length)];

    if (type === 'RUNNER') {
      return this.spawnRunnerAt(gate);
    } else if (type === 'BRUTE') {
      return this.spawnBruteAt(gate);
    } else {
      return this.spawnWalkerAt(gate);
    }
  }

  public spawnFromRandomGate(): WalkerZombie | null {
    const randomGate = this.spawnGates[Math.floor(Math.random() * this.spawnGates.length)];
    return this.spawnWalkerAt(randomGate);
  }

  public spawnRunner(): RunnerZombie | null {
    const randomGate = this.spawnGates[Math.floor(Math.random() * this.spawnGates.length)];
    return this.spawnRunnerAt(randomGate);
  }

  public spawnBrute(): BruteZombie | null {
    const randomGate = this.spawnGates[Math.floor(Math.random() * this.spawnGates.length)];
    return this.spawnBruteAt(randomGate);
  }

  private refreshHitMeshes() {
    this.hitMeshes = [];
    for (const z of this.zombies) {
      if (z.state !== 'DYING' && z.state !== 'DEAD' && !z.isEliminated) {
        this.hitMeshes.push(...z.hitMeshes);
      }
    }
  }

  public findZombieHit(mesh: THREE.Object3D): {
    zombie: AnyZombie;
    isHead: boolean;
    isRunner: boolean;
    isBrute: boolean;
  } | null {
    const isHead = mesh.userData?.isZombieHead === true;
    const isBody = mesh.userData?.isZombieBody === true;
    const zombieId = mesh.userData?.zombieId;

    if (!isHead && !isBody && !zombieId) {
      let curr: THREE.Object3D | null = mesh;
      while (curr) {
        if (curr.userData?.isZombieHead || curr.userData?.isZombieBody) {
          const found = this.zombies.find((z) => z.id === curr!.userData.zombieId);
          if (found) {
            return {
              zombie: found,
              isHead: !!curr.userData.isZombieHead,
              isRunner: !!('isRunner' in found && found.isRunner),
              isBrute: !!('isBrute' in found && found.isBrute),
            };
          }
        }
        curr = curr.parent;
      }
      return null;
    }

    const zombie = this.zombies.find((z) => z.id === zombieId);
    if (!zombie) return null;
    return {
      zombie,
      isHead,
      isRunner: !!('isRunner' in zombie && zombie.isRunner),
      isBrute: !!('isBrute' in zombie && zombie.isBrute),
    };
  }

  public registerElimination(zombie: AnyZombie, isHeadshot: boolean) {
    this.totalKills++;
    const isRunner = 'isRunner' in zombie && zombie.isRunner;
    const isBrute = 'isBrute' in zombie && zombie.isBrute;
    const zombieType: 'WALKER' | 'RUNNER' | 'BRUTE' = isBrute ? 'BRUTE' : isRunner ? 'RUNNER' : 'WALKER';

    this.remainingWaveHostiles = Math.max(0, this.remainingWaveHostiles - 1);

    this.callbacks.onZombieKilled?.(isHeadshot, zombieType, this.totalKills);
    this.callbacks.onHostilesCountChanged?.(this.remainingWaveHostiles, this.totalWaveHostiles);

    this.checkWaveClearCondition();
  }

  private checkWaveClearCondition() {
    if (this.waveState !== 'IN_PROGRESS') return;

    const aliveActive = this.zombies.filter((z) => !z.isEliminated).length;
    if (this.remainingWaveHostiles <= 0 && aliveActive === 0) {
      this.triggerWaveCleared();
    }
  }

  private triggerWaveCleared() {
    this.waveState = 'WAVE_CLEARED';
    this.pendingSpawnQueue = []; // Strictly stop all spawning
    const bonusScore = this.waveNumber * 250;
    const bonusCoins = this.waveNumber * 50;

    soundManager.playWaveClear();
    this.callbacks.onWaveCleared?.(this.waveNumber, bonusScore, bonusCoins);
  }

  /**
   * Emergency Airburst Strike:
   * Detonates a compound airburst dealing 300 damage to all active hostiles within 20m.
   */
  public triggerAirburst(playerPos: THREE.Vector3): { killedCount: number; totalScore: number; totalCoins: number } {
    let killedCount = 0;
    let totalScore = 0;
    let totalCoins = 0;

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.isEliminated || z.state === 'DYING' || z.state === 'DEAD') continue;

      const dist = z.position.distanceTo(playerPos);
      if (dist <= AIRBURST_RADIUS_METERS) {
        const result = z.takeDamage(AIRBURST_DAMAGE, false);
        if (result.isKilled) {
          killedCount++;
          const isBrute = 'isBrute' in z && z.isBrute;
          const isRunner = 'isRunner' in z && z.isRunner;
          const score = isBrute ? 300 : isRunner ? 150 : 50;
          const coins = isBrute ? 50 : isRunner ? 20 : 10;
          totalScore += score;
          totalCoins += coins;
          this.registerElimination(z, false);
        }
      }
    }

    if (totalScore > 0 || totalCoins > 0) {
      this.callbacks.onScoreEarned?.(totalScore, totalCoins);
    }

    this.refreshHitMeshes();
    return { killedCount, totalScore, totalCoins };
  }

  /**
   * Auto-Revive Defensive Shockwave:
   * Knocks back any hostiles within specified radius away from the operative.
   */
  public knockbackNearbyZombies(playerPos: THREE.Vector3, radius: number = 5.0, pushDistance: number = 6.0) {
    for (const z of this.zombies) {
      if (z.isEliminated || z.state === 'DYING' || z.state === 'DEAD') continue;
      const dx = z.position.x - playerPos.x;
      const dz = z.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        z.position.x += nx * pushDistance;
        z.position.z += nz * pushDistance;
        // Clamp to perimeter boundaries
        const bound = 22.2;
        z.position.x = Math.max(-bound, Math.min(bound, z.position.x));
        z.position.z = Math.max(-bound, Math.min(bound, z.position.z));
      }
    }
  }

  public clearCurrentWave() {
    this.pendingSpawnQueue = [];
    this.remainingWaveHostiles = 0;
    for (const z of this.zombies) {
      if (!z.isEliminated) {
        z.forceKill();
      }
    }
    this.refreshHitMeshes();
    this.callbacks.onHostilesCountChanged?.(0, this.totalWaveHostiles);
    this.triggerWaveCleared();
  }

  public killAll() {
    this.pendingSpawnQueue = [];
    this.remainingWaveHostiles = 0;
    for (const z of this.zombies) {
      if (!z.isEliminated) {
        z.forceKill();
      }
    }
    this.refreshHitMeshes();
    this.callbacks.onHostilesCountChanged?.(0, this.totalWaveHostiles);
  }

  public skipToWave(waveNum: number) {
    for (const z of this.zombies) {
      z.dispose(this.scene);
    }
    this.zombies = [];
    this.hitMeshes = [];
    this.startWave(waveNum);
  }

  public update(delta: number, playerPos: THREE.Vector3) {
    // 1. Spawning Queue Processing (Strictly only during IN_PROGRESS)
    if (this.waveState === 'IN_PROGRESS' && this.pendingSpawnQueue.length > 0) {
      this.spawnCooldown -= delta;
      if (this.spawnCooldown <= 0) {
        this.spawnCooldown = 0.75 + Math.random() * 0.45;
        const activeAlive = this.zombies.filter((z) => !z.isEliminated).length;
        if (activeAlive < MAX_ACTIVE_ZOMBIES) {
          this.spawnNextFromQueue();
        }
      }
    }

    // 2. Periodic Ambient Groans
    this.nextGroanTimer -= delta;
    if (this.nextGroanTimer <= 0) {
      this.nextGroanTimer = 4.0 + Math.random() * 3.5;
      const aliveZombies = this.zombies.filter(
        (z) => z.state === 'CHASING' || z.state === 'ATTACKING'
      );
      if (aliveZombies.length > 0) {
        const randZombie = aliveZombies[Math.floor(Math.random() * aliveZombies.length)];
        const distToPlayer = randZombie.position.distanceTo(playerPos);
        if (distToPlayer < 28) {
          if ('isBrute' in randZombie && randZombie.isBrute) {
            soundManager.playBruteRoar();
          } else if ('isRunner' in randZombie && randZombie.isRunner) {
            soundManager.playRunnerShriek();
          } else {
            soundManager.playZombieGroan(0.9 + Math.random() * 0.2);
          }
        }
      }
    }

    // 3. Update steering & attacks
    let needsMeshRefresh = false;

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const zombie = this.zombies[i];

      if (zombie.state === 'DEAD') {
        zombie.dispose(this.scene);
        this.zombies.splice(i, 1);
        needsMeshRefresh = true;
        this.checkWaveClearCondition();
        continue;
      }

      if (zombie.state === 'DYING') {
        zombie.update(delta, playerPos, THREE.Vector3.prototype);
        continue;
      }

      ZombieManager._toPlayer.subVectors(playerPos, zombie.position);
      const distToPlayer = ZombieManager._toPlayer.length();

      ZombieManager._steerForce.copy(ZombieManager._toPlayer);
      if (distToPlayer > 0.001) {
        ZombieManager._steerForce.divideScalar(distToPlayer);
      }

      // Obstacle avoidance
      ZombieManager._avoidance.set(0, 0, 0);
      for (const obs of this.obstacles) {
        const dx = zombie.position.x - obs.x;
        const dz = zombie.position.z - obs.z;
        const distSq = dx * dx + dz * dz;
        const safeRadius = obs.radius + 0.6;
        if (distSq < safeRadius * safeRadius && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = (safeRadius - dist) / safeRadius;
          ZombieManager._avoidance.x += (dx / dist) * push * 3.5;
          ZombieManager._avoidance.z += (dz / dist) * push * 3.5;
        }
      }

      // Separation
      ZombieManager._separation.set(0, 0, 0);
      for (const other of this.zombies) {
        if (other === zombie || other.isEliminated) continue;
        const dx = zombie.position.x - other.position.x;
        const dz = zombie.position.z - other.position.z;
        const distSq = dx * dx + dz * dz;
        const sepDist = 'isBrute' in zombie && zombie.isBrute ? 1.6 : 1.1;
        if (distSq < sepDist * sepDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = (sepDist - dist) / sepDist;
          ZombieManager._separation.x += (dx / dist) * push * 2.0;
          ZombieManager._separation.z += (dz / dist) * push * 2.0;
        }
      }

      ZombieManager._steerForce.add(ZombieManager._avoidance);
      ZombieManager._steerForce.add(ZombieManager._separation);
      ZombieManager._steerForce.y = 0;

      if (ZombieManager._steerForce.lengthSq() > 0.001) {
        ZombieManager._steerForce.normalize().multiplyScalar(zombie.speed);
      }

      const bound = 22.4;
      if (zombie.position.x < -bound && ZombieManager._steerForce.x < 0) ZombieManager._steerForce.x *= -0.5;
      if (zombie.position.x > bound && ZombieManager._steerForce.x > 0) ZombieManager._steerForce.x *= -0.5;
      if (zombie.position.z < -bound && ZombieManager._steerForce.z < 0) ZombieManager._steerForce.z *= -0.5;
      if (zombie.position.z > bound && ZombieManager._steerForce.z > 0) ZombieManager._steerForce.z *= -0.5;

      zombie.update(delta, playerPos, ZombieManager._steerForce);

      // Melee reach check
      const dx = zombie.position.x - playerPos.x;
      const dz = zombie.position.z - playerPos.z;
      const horizontalDist = Math.hypot(dx, dz);
      const dist = Math.min(horizontalDist, zombie.position.distanceTo(playerPos));
      const reach = 'isBrute' in zombie && zombie.isBrute ? 2.2 : 1.85;

      if (dist <= reach && zombie.tryAttack(delta)) {
        const now = performance.now();
        if (now - this.lastPlayerDamageTime >= 500) {
          this.lastPlayerDamageTime = now;
          const isBrute = 'isBrute' in zombie && zombie.isBrute;
          const isRunner = 'isRunner' in zombie && zombie.isRunner;
          // Brute deals 30 HP, Walker 15 HP, Runner 10 HP
          const damageAmount = isBrute ? 30 : isRunner ? 10 : 15;
          this.callbacks.onPlayerDamage?.(damageAmount);
        }
      }
    }

    if (needsMeshRefresh) {
      this.refreshHitMeshes();
    }
  }

  public getActiveZombies(): AnyZombie[] {
    return this.zombies.filter((z) => !z.isEliminated);
  }

  public reset(startWave: number = 1) {
    for (const z of this.zombies) {
      z.dispose(this.scene);
    }
    this.zombies = [];
    this.hitMeshes = [];
    this.pendingSpawnQueue = [];
    this.lastPlayerDamageTime = 0;
    this.totalKills = 0;
    this.startWave(Math.max(1, startWave));
  }

  public dispose() {
    for (const z of this.zombies) {
      z.dispose(this.scene);
    }
    this.zombies = [];
    this.hitMeshes = [];
    this.pendingSpawnQueue = [];
  }
}
