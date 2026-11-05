/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameSettings, ServiceRecord } from '../types/gameTypes';
import { DEFAULT_SETTINGS } from '../config/gameConfig';

const STORAGE_KEYS = {
  SERVICE_RECORD: 'outpost_z_service_record_v1',
  SETTINGS: 'outpost_z_settings_v1',
  COINS: 'outpostz_coins',
  UNLOCKED_WAVES: 'outpostz_unlocked_waves',
};

const DEFAULT_SERVICE_RECORD: ServiceRecord = {
  highScore: 0,
  highestWave: 1,
  totalKills: 0,
  totalHeadshots: 0,
  missionsDeployed: 0,
};

// Memory fallback in case localStorage is disabled or throws
let memoryServiceRecord: ServiceRecord = { ...DEFAULT_SERVICE_RECORD };
let memorySettings: GameSettings = { ...DEFAULT_SETTINGS };
let memoryCoins = 0;
let memoryUnlockedWaves = 1;

export function loadPersistentCoins(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COINS);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
  } catch (err) {
    console.warn('localStorage not accessible for coins:', err);
  }
  return memoryCoins;
}

export function savePersistentCoins(coins: number): void {
  const safeCoins = Math.max(0, Math.floor(coins));
  memoryCoins = safeCoins;
  try {
    localStorage.setItem(STORAGE_KEYS.COINS, String(safeCoins));
  } catch (err) {
    console.warn('Failed to write coins to localStorage:', err);
  }
}

export function loadUnlockedWaves(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.UNLOCKED_WAVES);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) ? 1 : Math.max(1, parsed);
    }
  } catch (err) {
    console.warn('localStorage not accessible for unlocked waves:', err);
  }
  return memoryUnlockedWaves;
}

export function saveUnlockedWaves(wave: number): number {
  const current = loadUnlockedWaves();
  const next = Math.max(current, wave);
  memoryUnlockedWaves = next;
  try {
    localStorage.setItem(STORAGE_KEYS.UNLOCKED_WAVES, String(next));
  } catch (err) {
    console.warn('Failed to write unlocked waves to localStorage:', err);
  }
  return next;
}


export function loadServiceRecord(): ServiceRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SERVICE_RECORD);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        highScore: Number(parsed.highScore) || 0,
        highestWave: Math.max(1, Number(parsed.highestWave) || 1),
        totalKills: Number(parsed.totalKills) || 0,
        totalHeadshots: Number(parsed.totalHeadshots) || 0,
        missionsDeployed: Number(parsed.missionsDeployed) || 0,
        lastPlayedDate: parsed.lastPlayedDate || undefined,
      };
    }
  } catch (err) {
    console.warn('localStorage not accessible, using memory store:', err);
  }
  return { ...memoryServiceRecord };
}

export function saveServiceRecord(update: Partial<ServiceRecord>): ServiceRecord {
  const current = loadServiceRecord();
  const next: ServiceRecord = {
    highScore: Math.max(current.highScore, update.highScore ?? 0),
    highestWave: Math.max(current.highestWave, update.highestWave ?? 1),
    totalKills: (current.totalKills ?? 0) + (update.totalKills ?? 0),
    totalHeadshots: (current.totalHeadshots ?? 0) + (update.totalHeadshots ?? 0),
    missionsDeployed: (current.missionsDeployed ?? 0) + (update.missionsDeployed ?? 0),
    lastPlayedDate: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEYS.SERVICE_RECORD, JSON.stringify(next));
  } catch (err) {
    console.warn('Failed to write to localStorage:', err);
  }
  memoryServiceRecord = { ...next };
  return next;
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn('localStorage not accessible for settings:', err);
  }
  return { ...memorySettings };
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to write settings to localStorage:', err);
  }
  memorySettings = { ...settings };
}
