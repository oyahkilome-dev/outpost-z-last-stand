/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export type WaveState = 'IN_PROGRESS' | 'WAVE_CLEARED' | 'INTERMISSION';

export type CrosshairColor = 'GREEN' | 'AMBER' | 'CYAN' | 'RED';

export type WeaponId = 'PISTOL' | 'SHOTGUN' | 'SMG' | 'RIFLE' | 'LMG' | 'SNIPER';

export interface UnlockedWeapons {
  PISTOL: boolean;
  SHOTGUN: boolean;
  SMG: boolean;
  RIFLE: boolean;
  LMG: boolean;
  SNIPER: boolean;
}

export interface WeaponReserves {
  PISTOL: number; // Infinity
  SHOTGUN: number;
  SMG: number;
  RIFLE: number;
  LMG: number;
  SNIPER: number;
}

export interface WeaponMags {
  PISTOL: number;
  SHOTGUN: number;
  SMG: number;
  RIFLE: number;
  LMG: number;
  SNIPER: number;
}

export interface HUDState {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  operativeLives: number;
  maxOperativeLives: number;
  autoStimAlert?: { active: boolean; livesRemaining: number } | null;
  wave: number;
  score: number;
  coins: number;
  zombiesRemaining: number;
  waveTotalZombies: number;
  waveState: WaveState;
  intermissionTimeRemaining: number;
  waveBannerText: string | null;
  waveBannerSubtext: string | null;
  equippedWeapon: WeaponId;
  weaponName: string;
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number; // 0.0 to 1.0
  kills: number;
  headshots: number;
  airburstCharges: number;
  maxAirburstCharges: number;
  claymores: number;
  maxClaymores: number;
  unlockedWeapons: UnlockedWeapons;
  weaponReserves: WeaponReserves;
  weaponMags: WeaponMags;
}

export interface GameSettings {
  soundEnabled: boolean;
  soundVolume: number;
  ambienceVolume: number;
  visualQuality: 'standard' | 'optimized';
  crosshairColor: CrosshairColor;
  fov: number;
  cameraSway: boolean;
  mouseSensitivity: number;
  showTestConsole: boolean;
  mobileTouchControls: 'AUTO' | 'ON' | 'OFF';
  touchLookSensitivity: number;
}

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  caliber: string;
  magSize: number;
  reloadTimeMs: number;
  fireRateMs: number;
  damage: number;
  isAutomatic?: boolean;
  pellets?: number;
  spreadAngle?: number;
  initialReserve?: number;
  pierceCount?: number;
  description: string;
}

export interface ServiceRecord {
  highScore: number;
  highestWave: number;
  totalKills: number;
  totalHeadshots: number;
  missionsDeployed: number;
  lastPlayedDate?: string;
}
