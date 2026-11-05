/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameSettings, HUDState, WeaponConfig, WeaponId } from '../types/gameTypes';

export const MAX_ACTIVE_ZOMBIES = 25;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MAX_ARMOR = 100;
export const OPERATIVE_MAX_LIVES = 5;
export const STARTING_AIRBURST_CHARGES = 5;
export const MAX_AIRBURST_CHARGES = 9;
export const AIRBURST_RADIUS_METERS = 20;
export const AIRBURST_DAMAGE = 300;
export const MAX_CLAYMORES = 6;
export const STARTING_CLAYMORES = 0;

// Slot 1: M9 Beretta Tactical Pistol
export const PISTOL_CONFIG: WeaponConfig = {
  id: 'PISTOL',
  name: 'M9 Tactical Pistol',
  caliber: '9x19mm Parabellum',
  magSize: 18,
  reloadTimeMs: 1500,
  fireRateMs: 220,
  damage: 38,
  isAutomatic: false,
  description: 'Precision standard-issue military sidearm with rapid trigger response.',
};

// Slot 2: SPAS-12 Combat Shotgun
export const SHOTGUN_CONFIG: WeaponConfig = {
  id: 'SHOTGUN',
  name: 'SPAS-12 Combat Shotgun',
  caliber: '12-Gauge 00-Buck',
  magSize: 8,
  reloadTimeMs: 2200,
  fireRateMs: 800,
  damage: 28, // 28 per pellet * 8 pellets = 224 max point-blank
  pellets: 8,
  spreadAngle: 0.052,
  isAutomatic: false,
  initialReserve: 24,
  description: 'Dual-mode combat shotgun discharging 8 heavy pellets per blast.',
};

// Slot 3: MP5 Tactical SMG
export const SMG_CONFIG: WeaponConfig = {
  id: 'SMG',
  name: 'MP5 Tactical SMG',
  caliber: '9x19mm Submachine',
  magSize: 40,
  reloadTimeMs: 1500,
  fireRateMs: 85, // ~700 RPM cyclic rate
  damage: 26,
  isAutomatic: true,
  initialReserve: 120,
  description: 'High-cyclic close-quarters submachine gun with ultra-low recoil.',
};

// Slot 4: AK-47 Assault Rifle
export const RIFLE_CONFIG: WeaponConfig = {
  id: 'RIFLE',
  name: 'AK-47 Assault Rifle',
  caliber: '7.62x39mm Soviet',
  magSize: 30,
  reloadTimeMs: 1800,
  fireRateMs: 110, // ~545 RPM
  damage: 36,
  isAutomatic: true,
  initialReserve: 90,
  description: 'Rugged gas-operated assault rifle delivering high stopping power.',
};

// Slot 5: M249 Heavy LMG
export const LMG_CONFIG: WeaponConfig = {
  id: 'LMG',
  name: 'M249 Heavy LMG',
  caliber: '5.56x45mm NATO Belt',
  magSize: 100,
  reloadTimeMs: 3200,
  fireRateMs: 95, // ~630 RPM
  damage: 32,
  isAutomatic: true,
  initialReserve: 200,
  description: 'Squad automatic weapon with 100-round drum for sustained suppressive fire.',
};

// Slot 6: M82 .50 Cal Sniper Rifle
export const SNIPER_CONFIG: WeaponConfig = {
  id: 'SNIPER',
  name: 'M82 .50 Cal Sniper',
  caliber: '.50 BMG Anti-Materiel',
  magSize: 5,
  reloadTimeMs: 2500,
  fireRateMs: 1100,
  damage: 400, // Massive damage, pierces multiple zombies
  isAutomatic: false,
  initialReserve: 15,
  pierceCount: 4,
  description: 'Anti-materiel rifle whose heavy .50 BMG rounds tear through lines of hostiles.',
};

export const WEAPON_CONFIGS: Record<WeaponId, WeaponConfig> = {
  PISTOL: PISTOL_CONFIG,
  SHOTGUN: SHOTGUN_CONFIG,
  SMG: SMG_CONFIG,
  RIFLE: RIFLE_CONFIG,
  LMG: LMG_CONFIG,
  SNIPER: SNIPER_CONFIG,
};

export const SHOP_PRICES = {
  // Weapon Unlocks
  UNLOCK_SHOTGUN: 500,
  UNLOCK_SMG: 600,
  UNLOCK_RIFLE: 750,
  UNLOCK_LMG: 1200,
  UNLOCK_SNIPER: 1500,

  // Munitions Resupply
  SHOTGUN_AMMO: 80,  // +16 shells
  SMG_AMMO: 90,      // +80 rounds
  RIFLE_AMMO: 100,   // +60 rounds
  LMG_AMMO: 160,     // +100 rounds
  SNIPER_AMMO: 140,  // +10 rounds

  // Tactical Consumables
  REVIVE_LIFE: 250,  // +1 Operative Life
  CLAYMORES: 300,    // +3 Claymore Mines
  ARMOR: 150,        // +50 Armor
  MEDKIT: 100,       // +50 HP
  AIRBURST: 200,     // +1 Charge
};

export const INITIAL_HUD_STATE: HUDState = {
  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  armor: 0,
  maxArmor: PLAYER_MAX_ARMOR,
  operativeLives: OPERATIVE_MAX_LIVES,
  maxOperativeLives: OPERATIVE_MAX_LIVES,
  wave: 1,
  score: 0,
  coins: 50,
  zombiesRemaining: 6,
  waveTotalZombies: 6,
  waveState: 'IN_PROGRESS',
  intermissionTimeRemaining: 0,
  waveBannerText: 'WAVE 1 INCOMING',
  waveBannerSubtext: '6 HOSTILES DETECTED AT PERIMETER',
  equippedWeapon: 'PISTOL',
  weaponName: PISTOL_CONFIG.name,
  ammo: PISTOL_CONFIG.magSize,
  maxAmmo: PISTOL_CONFIG.magSize,
  reserveAmmo: Infinity,
  isReloading: false,
  reloadProgress: 0,
  kills: 0,
  headshots: 0,
  airburstCharges: STARTING_AIRBURST_CHARGES,
  maxAirburstCharges: MAX_AIRBURST_CHARGES,
  claymores: STARTING_CLAYMORES,
  maxClaymores: MAX_CLAYMORES,
  unlockedWeapons: {
    PISTOL: true,
    SHOTGUN: false,
    SMG: false,
    RIFLE: false,
    LMG: false,
    SNIPER: false,
  },
  weaponReserves: {
    PISTOL: Infinity,
    SHOTGUN: 24,
    SMG: 120,
    RIFLE: 90,
    LMG: 200,
    SNIPER: 15,
  },
  weaponMags: {
    PISTOL: PISTOL_CONFIG.magSize,
    SHOTGUN: SHOTGUN_CONFIG.magSize,
    SMG: SMG_CONFIG.magSize,
    RIFLE: RIFLE_CONFIG.magSize,
    LMG: LMG_CONFIG.magSize,
    SNIPER: SNIPER_CONFIG.magSize,
  },
};

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  soundVolume: 0.8,
  ambienceVolume: 0.6,
  visualQuality: 'standard',
  crosshairColor: 'GREEN',
  fov: 75,
  cameraSway: true,
  mouseSensitivity: 1.0,
  showTestConsole: true,
  mobileTouchControls: 'AUTO',
  touchLookSensitivity: 1.0,
};

export const CROSSHAIR_COLORS: Record<string, { label: string; hex: string; tailwindBorder: string; tailwindBg: string; shadow: string }> = {
  GREEN: {
    label: 'Tactical Green',
    hex: '#22c55e',
    tailwindBorder: 'border-emerald-400',
    tailwindBg: 'bg-emerald-400',
    shadow: 'rgba(34, 197, 94, 0.6)',
  },
  AMBER: {
    label: 'Amber Warning',
    hex: '#f59e0b',
    tailwindBorder: 'border-amber-400',
    tailwindBg: 'bg-amber-400',
    shadow: 'rgba(245, 158, 11, 0.6)',
  },
  CYAN: {
    label: 'Night Vision Cyan',
    hex: '#06b6d4',
    tailwindBorder: 'border-cyan-400',
    tailwindBg: 'bg-cyan-400',
    shadow: 'rgba(6, 182, 212, 0.6)',
  },
  RED: {
    label: 'Combat Red',
    hex: '#ef4444',
    tailwindBorder: 'border-red-500',
    tailwindBg: 'bg-red-500',
    shadow: 'rgba(239, 68, 68, 0.6)',
  },
};
