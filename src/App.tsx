/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, HUDState, GameSettings, ServiceRecord, WeaponId } from './types/gameTypes';
import { INITIAL_HUD_STATE, PISTOL_CONFIG, SHOP_PRICES, OPERATIVE_MAX_LIVES, STARTING_AIRBURST_CHARGES, MAX_AIRBURST_CHARGES, WEAPON_CONFIGS } from './config/gameConfig';
import { loadServiceRecord, saveServiceRecord, loadSettings, saveSettings, loadPersistentCoins, savePersistentCoins, loadUnlockedWaves, saveUnlockedWaves } from './utils/storage';
import { soundManager } from './utils/audio';
import { ThreeCanvas } from './components/ThreeCanvas';
import { MainMenu } from './components/MainMenu';
import { HUD } from './components/HUD';
import { ShopModal } from './components/ShopModal';
import { Stage1TestConsole } from './components/Stage1TestConsole';
import { PauseMenu } from './components/PauseMenu';
import { GameOverScreen } from './components/GameOverScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileControls } from './components/MobileControls';
import { shouldEnableTouchControls } from './utils/device';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [hudState, setHudState] = useState<HUDState>(() => ({
    ...INITIAL_HUD_STATE,
    coins: loadPersistentCoins(),
  }));
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [serviceRecord, setServiceRecord] = useState<ServiceRecord>(loadServiceRecord);
  const [highestUnlockedWave, setHighestUnlockedWave] = useState<number>(() => {
    const saved = loadUnlockedWaves();
    const record = loadServiceRecord();
    return Math.max(saved, record.highestWave, 1);
  });
  const [selectedStartWave, setSelectedStartWave] = useState<number>(1);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [showDebugConsole, setShowDebugConsole] = useState(false);

  // Armory Shop, Auto-Stim Revive & Airburst Screen VFX State
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [airburstFlash, setAirburstFlash] = useState(false);
  const [reviveShieldActive, setReviveShieldActive] = useState(false);
  const [autoStimAlert, setAutoStimAlert] = useState<{ active: boolean; livesRemaining: number } | null>(null);

  // Combat Visual Effects & Hit Marker State
  const [hitMarker, setHitMarker] = useState<{ active: boolean; isKill: boolean; isHeadshot?: boolean }>({
    active: false,
    isKill: false,
    isHeadshot: false,
  });
  const [emptyAlert, setEmptyAlert] = useState(false);

  // Refs to call into 3D Raycasting WeaponSystem, ZombieManager & Wave System
  const fireTriggerRef = useRef<(() => void) | null>(null);
  const reloadTriggerRef = useRef<(() => void) | null>(null);
  const switchWeaponTriggerRef = useRef<((w: WeaponId) => void) | null>(null);
  const unlockWeaponTriggerRef = useRef<((w: WeaponId) => void) | null>(null);
  const addAmmoTriggerRef = useRef<((w: WeaponId, amt: number) => void) | null>(null);
  const airburstTriggerRef = useRef<(() => void) | null>(null);
  const knockbackZombiesTriggerRef = useRef<((radius?: number) => void) | null>(null);
  const refillAllWeaponsTriggerRef = useRef<(() => void) | null>(null);
  const spawnZombieTriggerRef = useRef<(() => void) | null>(null);
  const spawnRunnerTriggerRef = useRef<(() => void) | null>(null);
  const spawnBruteTriggerRef = useRef<(() => void) | null>(null);
  const killAllZombiesTriggerRef = useRef<(() => void) | null>(null);
  const clearWaveTriggerRef = useRef<(() => void) | null>(null);
  const skipToWaveTriggerRef = useRef<((wave: number) => void) | null>(null);
  const startNextWaveTriggerRef = useRef<((wave: number) => void) | null>(null);
  const redeployTriggerRef = useRef<((startWave?: number) => void) | null>(null);
  const plantClaymoreTriggerRef = useRef<(() => boolean) | null>(null);

  // Mobile touch control refs
  const touchMoveRef = useRef<((forward: number, right: number, sprint?: boolean) => void) | null>(null);
  const touchLookRef = useRef<((deltaX: number, deltaY: number) => void) | null>(null);
  const touchTriggerRef = useRef<((held: boolean) => void) | null>(null);
  const quickTurnRef = useRef<(() => void) | null>(null);
  const snapTurnRef = useRef<((angle: number) => void) | null>(null);

  const isMobileTouchActive = shouldEnableTouchControls(settings.mobileTouchControls);

  // Intermission rest countdown & wave banner timers
  const intermissionTimerRef = useRef<number | null>(null);
  const waveBannerTimerRef = useRef<number | null>(null);

  // Invulnerability grace period (0.5s i-frame timestamp or 2.5s auto-stim shield)
  const lastDamageTimeRef = useRef(0);
  const isInvulnerableRef = useRef(false);
  const [isDying, setIsDying] = useState(false);

  // Pointer lock change handler - auto-pause if user exits pointer lock (e.g. presses ESC on desktop)
  const handlePointerLockChange = useCallback((locked: boolean) => {
    setIsPointerLocked(locked);
    if (!locked && !isShopOpen && !shouldEnableTouchControls(settings.mobileTouchControls)) {
      setGameState((current) => {
        if (current === 'PLAYING') {
          return 'PAUSED';
        }
        return current;
      });
    }
  }, [isShopOpen, settings.mobileTouchControls]);

  // Visual kick states for recoil and damage flash
  const [fireKick, setFireKick] = useState(0);
  const [damageKick, setDamageKick] = useState(0);

  // Sync sound settings with audio engine
  useEffect(() => {
    soundManager.setConfig(settings.soundEnabled, settings.soundVolume);
    soundManager.setAmbienceVolume(settings.ambienceVolume ?? 0.6);
    saveSettings(settings);
  }, [settings]);

  // Atmospheric Dusk Ambience & Dynamic Cinematic Low-Pass Filter
  useEffect(() => {
    if (gameState === 'PLAYING' && !isDying) {
      soundManager.startAmbience();
      soundManager.setLowpassFilter(isShopOpen);
    } else if (gameState === 'PAUSED') {
      soundManager.setLowpassFilter(true);
    } else {
      soundManager.stopAmbience();
      soundManager.setLowpassFilter(false);
    }
  }, [gameState, isDying, isShopOpen]);

  // Persist coins immediately whenever coin balance changes
  useEffect(() => {
    savePersistentCoins(hudState.coins);
  }, [hudState.coins]);

  // Low-health sub-bass heartbeat audio loop (starts when HP <= 30, stops on heal/death/redeploy)
  useEffect(() => {
    if (gameState === 'PLAYING' && !isDying && hudState.health <= 30 && hudState.health > 0) {
      soundManager.playHeartbeat();
    } else {
      soundManager.stopHeartbeat();
    }
    return () => {
      soundManager.stopHeartbeat();
    };
  }, [gameState, isDying, hudState.health]);

  // Ensure pointer lock is explicitly released when wave clear or intermission screen appears
  useEffect(() => {
    if (hudState.waveState === 'WAVE_CLEARED' || hudState.waveState === 'INTERMISSION') {
      if (document.pointerLockElement) {
        try {
          document.exitPointerLock();
        } catch (err) {
          console.warn('Pointer lock exit error:', err);
        }
      }
      setIsPointerLocked(false);
    }
  }, [hudState.waveState]);

  // Smooth decay loop for recoil and damage kicks
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      setFireKick((prev) => (prev > 0.01 ? Math.max(0, prev - dt * 5.5) : 0));
      setDamageKick((prev) => (prev > 0.01 ? Math.max(0, prev - dt * 3.8) : 0));

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Hit marker trigger with 120ms flash duration
  const triggerHitMarker = useCallback((isKill: boolean, isHeadshot: boolean = false) => {
    setHitMarker({ active: true, isKill, isHeadshot });
    setTimeout(() => {
      setHitMarker({ active: false, isKill: false, isHeadshot: false });
    }, 120);
  }, []);

  // Zombie eliminated handler (tracks kills and headshots)
  const handleZombieKilled = useCallback((isHeadshot: boolean) => {
    setHudState((prev) => ({
      ...prev,
      kills: prev.kills + 1,
      headshots: (prev.headshots || 0) + (isHeadshot ? 1 : 0),
    }));
  }, []);

  // Hostiles count updated from 3D wave manager
  const handleHostilesCountChanged = useCallback((remaining: number, total: number) => {
    setHudState((prev) => ({
      ...prev,
      zombiesRemaining: remaining,
      waveTotalZombies: total,
    }));
  }, []);

  // Wave Started Handler (triggers military alert banner & guarantees full health)
  const handleWaveStarted = useCallback((waveNum: number, totalHostiles: number) => {
    if (intermissionTimerRef.current !== null) {
      clearInterval(intermissionTimerRef.current);
      intermissionTimerRef.current = null;
    }
    if (waveBannerTimerRef.current !== null) {
      clearTimeout(waveBannerTimerRef.current);
      waveBannerTimerRef.current = null;
    }

    soundManager.playWaveAlert();

    setHighestUnlockedWave((prev) => {
      const next = Math.max(prev, waveNum);
      saveUnlockedWaves(next);
      saveServiceRecord({ highestWave: next });
      return next;
    });

    setHudState((prev) => ({
      ...prev,
      wave: waveNum,
      waveTotalZombies: totalHostiles,
      zombiesRemaining: totalHostiles,
      health: prev.maxHealth, // Auto restore 100% full health when starting new wave
      waveState: 'IN_PROGRESS',
      intermissionTimeRemaining: 0,
      waveBannerText: `WAVE ${waveNum} INCOMING`,
      waveBannerSubtext: `${totalHostiles} HOSTILES DETECTED AT PERIMETER`,
    }));

    waveBannerTimerRef.current = window.setTimeout(() => {
      setHudState((prev) => ({
        ...prev,
        waveBannerText: null,
        waveBannerSubtext: null,
      }));
      waveBannerTimerRef.current = null;
    }, 2500);
  }, []);

  // Wave Cleared Handler (awards +100% full health, +2 free Airburst charges, auto-refills all mags)
  const handleWaveCleared = useCallback((waveNum: number, bonusScore: number, bonusCoins: number) => {
    if (waveBannerTimerRef.current !== null) {
      clearTimeout(waveBannerTimerRef.current);
      waveBannerTimerRef.current = null;
    }

    // Release pointer lock so player can easily interact with victory modal or armory shop
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    setIsPointerLocked(false);

    // Refill all active weapon magazines to full
    refillAllWeaponsTriggerRef.current?.();

    // Advance unlocked wave for the upcoming round
    const nextWaveNum = waveNum + 1;
    setHighestUnlockedWave((prev) => {
      const next = Math.max(prev, nextWaveNum);
      saveUnlockedWaves(next);
      saveServiceRecord({ highestWave: next });
      return next;
    });

    // Automatically refill health to 100%, award +2 airburst charges (capping at 9), and display Wave Cleared modal
    setHudState((prev) => {
      const nextAirburst = Math.min(MAX_AIRBURST_CHARGES, prev.airburstCharges + 2);
      return {
        ...prev,
        waveState: 'WAVE_CLEARED',
        score: prev.score + bonusScore,
        coins: prev.coins + bonusCoins,
        health: prev.maxHealth, // 100% Full Health Restoration
        airburstCharges: nextAirburst, // +2 free Emergency Airburst charges
        ammo: prev.maxAmmo,
        isReloading: false,
        reloadProgress: 0,
        intermissionTimeRemaining: 0,
        waveBannerText: null,
        waveBannerSubtext: null,
      };
    });
  }, []);

  // Explicit Start Next Wave action (advances strictly on player confirmation: Click or SPACE)
  const handleStartNextWave = useCallback(async () => {
    setIsShopOpen(false);
    await soundManager.ensureAudioContext();
    soundManager.playWaveAlert();

    // Guarantee full health and refilled mags upon deployment
    setHudState((prev) => ({
      ...prev,
      health: prev.maxHealth,
    }));
    refillAllWeaponsTriggerRef.current?.();

    const nextWave = hudState.wave + 1;
    startNextWaveTriggerRef.current?.(nextWave);

    // Re-engage pointer lock upon starting new wave
    try {
      document.body.requestPointerLock();
    } catch (err) {
      console.warn('Pointer lock request error:', err);
    }
  }, [hudState.wave]);

  // Empty magazine alert trigger
  const triggerEmptyAlert = useCallback(() => {
    setEmptyAlert(true);
    setTimeout(() => {
      setEmptyAlert(false);
    }, 1400);
  }, []);

  // Weapon Switch Handler
  const handleSwitchWeapon = useCallback((weaponId: WeaponId) => {
    if (gameState !== 'PLAYING' || isDying) return;
    switchWeaponTriggerRef.current?.(weaponId);
  }, [gameState, isDying]);

  // Weapon details changed from 3D scene
  const handleWeaponChanged = useCallback((
    weapon: WeaponId,
    name: string,
    ammo: number,
    maxAmmo: number,
    reserve: number
  ) => {
    setHudState((prev) => ({
      ...prev,
      equippedWeapon: weapon,
      weaponName: name,
      ammo,
      maxAmmo,
      reserveAmmo: reserve,
    }));
  }, []);

  // Reload action handler (routes through 3D WeaponSystem)
  const handleReload = useCallback(async () => {
    if (gameState !== 'PLAYING' || isDying) return;
    await soundManager.ensureAudioContext();
    if (reloadTriggerRef.current) {
      reloadTriggerRef.current();
    }
  }, [gameState, isDying]);

  // Fire shot action handler (routes through 3D Raycasting WeaponSystem)
  const handleFireShot = useCallback(async () => {
    if (gameState !== 'PLAYING' || isDying) return;
    await soundManager.ensureAudioContext();

    if (fireTriggerRef.current) {
      fireTriggerRef.current();
    }
  }, [gameState, isDying]);

  // Emergency Compound Airburst Panic Button Trigger
  const handleAirburst = useCallback(async () => {
    if (gameState !== 'PLAYING' || isDying) return;
    if (hudState.airburstCharges <= 0) return;

    await soundManager.ensureAudioContext();
    soundManager.playAirburst();

    // Visual shockwave and detonation flash
    setDamageKick(1.5);
    setAirburstFlash(true);
    setTimeout(() => setAirburstFlash(false), 280);

    // Consume 1 charge
    setHudState((prev) => ({
      ...prev,
      airburstCharges: Math.max(0, prev.airburstCharges - 1),
    }));

    // Trigger detonation in 3D scene
    airburstTriggerRef.current?.();
  }, [gameState, isDying, hudState.airburstCharges]);

  // Auto-Stim Revive Trigger Routine
  const triggerAutoRevive = useCallback(async (newLives: number) => {
    await soundManager.ensureAudioContext();
    soundManager.playRevive();

    // 2.5s invulnerability shield
    isInvulnerableRef.current = true;
    setReviveShieldActive(true);
    lastDamageTimeRef.current = performance.now() + 2500;

    // Defensive shockwave: knock back all nearby hostiles within 5m
    knockbackZombiesTriggerRef.current?.(5.0);

    // Prominent HUD alert notification
    setAutoStimAlert({ active: true, livesRemaining: newLives });

    setTimeout(() => {
      isInvulnerableRef.current = false;
      setReviveShieldActive(false);
    }, 2500);

    setTimeout(() => {
      setAutoStimAlert(null);
    }, 3500);
  }, []);

  // Damage hit action handler with Armor Absorption, 5x Auto-Revive lives, and i-frame grace periods
  const handleTakeHit = useCallback(async (amount: number = 15) => {
    if (gameState !== 'PLAYING' || isDying) return;
    if (isInvulnerableRef.current) return;

    const now = performance.now();
    if (now - lastDamageTimeRef.current < 500) {
      return;
    }
    lastDamageTimeRef.current = now;

    await soundManager.ensureAudioContext();
    soundManager.playPlayerHurt();
    setDamageKick(1.0);

    setHudState((prev) => {
      // Armor absorbs damage first!
      const damageToArmor = Math.min(prev.armor, amount);
      const remainingDamage = amount - damageToArmor;
      const nextArmor = Math.max(0, prev.armor - damageToArmor);
      const calculatedHealth = prev.health - remainingDamage;

      // Auto-Stim Revive check if damage would be fatal
      if (calculatedHealth <= 0) {
        if (prev.operativeLives > 0) {
          const newLives = prev.operativeLives - 1;
          triggerAutoRevive(newLives);
          return {
            ...prev,
            armor: 0,
            health: prev.maxHealth, // Immediately restore to full 100/100 HP!
            operativeLives: newLives,
          };
        } else {
          return {
            ...prev,
            armor: 0,
            health: 0,
          };
        }
      }

      return {
        ...prev,
        armor: nextArmor,
        health: calculatedHealth,
      };
    });
  }, [gameState, isDying, triggerAutoRevive]);

  // Proximity Claymore Mine Deployment Handler
  const handlePlantClaymore = useCallback(async () => {
    if (gameState !== 'PLAYING' || isDying) return;
    if (hudState.claymores <= 0) {
      soundManager.playDryFire();
      return;
    }

    const success = plantClaymoreTriggerRef.current?.();
    if (success) {
      setHudState((prev) => ({
        ...prev,
        claymores: Math.max(0, prev.claymores - 1),
      }));
    }
  }, [gameState, isDying, hudState.claymores]);

  // Armory Shop Purchase Callbacks (All 6 Weapons & Tactical Consumables)
  const handleBuyWeapon = useCallback((weaponId: WeaponId) => {
    const priceMap: Record<WeaponId, number> = {
      PISTOL: 0,
      SHOTGUN: SHOP_PRICES.UNLOCK_SHOTGUN,
      SMG: SHOP_PRICES.UNLOCK_SMG,
      RIFLE: SHOP_PRICES.UNLOCK_RIFLE,
      LMG: SHOP_PRICES.UNLOCK_LMG,
      SNIPER: SHOP_PRICES.UNLOCK_SNIPER,
    };
    const cost = priceMap[weaponId] || 0;
    const config = WEAPON_CONFIGS[weaponId];
    setHudState((prev) => ({
      ...prev,
      coins: Math.max(0, prev.coins - cost),
      equippedWeapon: weaponId,
      weaponName: config.name,
      maxAmmo: config.magSize,
      ammo: config.magSize,
      unlockedWeapons: {
        ...prev.unlockedWeapons,
        [weaponId]: true,
      },
    }));
    unlockWeaponTriggerRef.current?.(weaponId);
    switchWeaponTriggerRef.current?.(weaponId);
  }, []);

  const handleBuyAmmo = useCallback((weaponId: WeaponId) => {
    const ammoPriceMap: Partial<Record<WeaponId, number>> = {
      SHOTGUN: SHOP_PRICES.SHOTGUN_AMMO,
      SMG: SHOP_PRICES.SMG_AMMO,
      RIFLE: SHOP_PRICES.RIFLE_AMMO,
      LMG: SHOP_PRICES.LMG_AMMO,
      SNIPER: SHOP_PRICES.SNIPER_AMMO,
    };
    const ammoAmountMap: Partial<Record<WeaponId, number>> = {
      SHOTGUN: 16,
      SMG: 80,
      RIFLE: 60,
      LMG: 100,
      SNIPER: 10,
    };
    const cost = ammoPriceMap[weaponId] ?? 100;
    const amount = ammoAmountMap[weaponId] ?? 30;

    setHudState((prev) => {
      const nextReserves = {
        ...prev.weaponReserves,
        [weaponId]: (prev.weaponReserves[weaponId] || 0) + amount,
      };
      return {
        ...prev,
        coins: Math.max(0, prev.coins - cost),
        weaponReserves: nextReserves,
        reserveAmmo: prev.equippedWeapon === weaponId ? nextReserves[weaponId] : prev.reserveAmmo,
      };
    });
    addAmmoTriggerRef.current?.(weaponId, amount);
  }, []);

  const handleBuyReviveLife = useCallback(() => {
    setHudState((prev) => {
      const maxLives = prev.maxOperativeLives || OPERATIVE_MAX_LIVES;
      if (prev.operativeLives >= maxLives || prev.coins < (SHOP_PRICES.REVIVE_LIFE || 250)) {
        return prev;
      }
      return {
        ...prev,
        coins: Math.max(0, prev.coins - (SHOP_PRICES.REVIVE_LIFE || 250)),
        operativeLives: Math.min(maxLives, prev.operativeLives + 1),
      };
    });
  }, []);

  const handleBuyHealth = useCallback(() => {
    setHudState((prev) => {
      if (prev.health >= prev.maxHealth || prev.coins < SHOP_PRICES.MEDKIT) {
        return prev;
      }
      return {
        ...prev,
        coins: Math.max(0, prev.coins - SHOP_PRICES.MEDKIT),
        health: Math.min(prev.maxHealth, prev.health + 50),
      };
    });
  }, []);

  const handleBuyArmor = useCallback(() => {
    setHudState((prev) => ({
      ...prev,
      coins: Math.max(0, prev.coins - SHOP_PRICES.ARMOR),
      armor: Math.min(prev.maxArmor, prev.armor + 50),
    }));
  }, []);

  const handleBuyAirburst = useCallback(() => {
    setHudState((prev) => ({
      ...prev,
      coins: Math.max(0, prev.coins - SHOP_PRICES.AIRBURST),
      airburstCharges: Math.min(MAX_AIRBURST_CHARGES, prev.airburstCharges + 1),
    }));
  }, []);

  const handleBuyClaymores = useCallback(() => {
    setHudState((prev) => ({
      ...prev,
      coins: Math.max(0, prev.coins - SHOP_PRICES.CLAYMORES),
      claymores: Math.min(prev.maxClaymores, prev.claymores + 3),
    }));
  }, []);

  // Check for Operative KIA trigger (starts camera collapse ONLY when HP reaches 0 and ALL lives are exhausted)
  useEffect(() => {
    if (gameState === 'PLAYING' && !isDying && hudState.health <= 0 && hudState.operativeLives <= 0) {
      setIsDying(true);
      setIsShopOpen(false);
      if (intermissionTimerRef.current !== null) {
        clearInterval(intermissionTimerRef.current);
        intermissionTimerRef.current = null;
      }
      soundManager.stopHeartbeat();
      soundManager.playGameOver();
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      setIsPointerLocked(false);
    }
  }, [gameState, isDying, hudState.health, hudState.operativeLives]);

  // Invoked when 800ms camera collapse animation completes
  const handleDeathCompleted = useCallback(() => {
    setIsDying(false);
    const isNewBest = hudState.score > serviceRecord.highScore;
    setIsNewHighScore(isNewBest);

    const recordHighest = Math.max(hudState.wave, highestUnlockedWave);
    const updatedRecord = saveServiceRecord({
      highScore: hudState.score,
      highestWave: recordHighest,
      totalKills: hudState.kills,
      totalHeadshots: hudState.headshots || 0,
      missionsDeployed: 1,
    });
    setServiceRecord(updatedRecord);
    savePersistentCoins(hudState.coins);
    saveUnlockedWaves(recordHighest);
    setGameState('GAMEOVER');
  }, [hudState.score, hudState.wave, hudState.kills, hudState.headshots, hudState.coins, highestUnlockedWave, serviceRecord.highScore]);

  // Heal action helper
  const handleHeal = useCallback(() => {
    if (gameState !== 'PLAYING' || isDying) return;
    soundManager.playUIClick();
    setHudState((prev) => ({
      ...prev,
      health: Math.min(prev.maxHealth, prev.health + 25),
    }));
  }, [gameState, isDying]);

  // Manual next wave trigger (for test console)
  const handleNextWave = useCallback(() => {
    if (gameState !== 'PLAYING' || isDying) return;
    const nextWave = hudState.wave + 1;
    startNextWaveTriggerRef.current?.(nextWave);
  }, [gameState, isDying, hudState.wave]);

  // Trigger fatal hit (tests auto-revive if lives > 0; true KIA if lives === 0)
  const handleTriggerFatalHit = useCallback(() => {
    if (gameState !== 'PLAYING' || isDying) return;
    setHudState((prev) => {
      if (prev.operativeLives > 0) {
        const newLives = prev.operativeLives - 1;
        triggerAutoRevive(newLives);
        return {
          ...prev,
          armor: 0,
          health: prev.maxHealth,
          operativeLives: newLives,
        };
      } else {
        return { ...prev, health: 0, operativeLives: 0 };
      }
    });
  }, [gameState, isDying, triggerAutoRevive]);

  // Deplete all lives directly (to test true Game Over screen)
  const handleDepleteAllLives = useCallback(() => {
    if (gameState !== 'PLAYING' || isDying) return;
    setHudState((prev) => ({ ...prev, operativeLives: 0, health: 0 }));
  }, [gameState, isDying]);

  // Deployment from Menu or Checkpoint
  const handleDeploy = async (targetWave?: number) => {
    await soundManager.ensureAudioContext();
    soundManager.stopHeartbeat();
    if (intermissionTimerRef.current !== null) {
      clearInterval(intermissionTimerRef.current);
      intermissionTimerRef.current = null;
    }
    if (waveBannerTimerRef.current !== null) {
      clearTimeout(waveBannerTimerRef.current);
      waveBannerTimerRef.current = null;
    }
    setIsDying(false);
    setIsShopOpen(false);
    isInvulnerableRef.current = false;
    setReviveShieldActive(false);
    setAutoStimAlert(null);
    lastDamageTimeRef.current = 0;

    const startWave = Math.max(1, targetWave ?? selectedStartWave ?? 1);
    const persistentCoins = loadPersistentCoins();

    setHudState({
      ...INITIAL_HUD_STATE,
      wave: startWave,
      coins: persistentCoins, // Retain player's saved coin bank!
      ammo: PISTOL_CONFIG.magSize,
      health: INITIAL_HUD_STATE.maxHealth,
      armor: INITIAL_HUD_STATE.armor,
      operativeLives: OPERATIVE_MAX_LIVES,
      maxOperativeLives: OPERATIVE_MAX_LIVES,
      airburstCharges: STARTING_AIRBURST_CHARGES,
      maxAirburstCharges: MAX_AIRBURST_CHARGES,
    });
    setFireKick(0);
    setDamageKick(0);
    setIsNewHighScore(false);
    if (redeployTriggerRef.current) {
      redeployTriggerRef.current(startWave);
    }
    setGameState('PLAYING');
  };

  // Seamless Match Restart after Game Over or from Pause Menu
  const handleRestart = (targetWave?: number) => {
    handleDeploy(targetWave);
  };

  // Return to Menu
  const handleReturnToMenu = () => {
    soundManager.stopHeartbeat();
    if (intermissionTimerRef.current !== null) {
      clearInterval(intermissionTimerRef.current);
      intermissionTimerRef.current = null;
    }
    if (waveBannerTimerRef.current !== null) {
      clearTimeout(waveBannerTimerRef.current);
      waveBannerTimerRef.current = null;
    }
    setIsDying(false);
    setIsShopOpen(false);
    isInvulnerableRef.current = false;
    setReviveShieldActive(false);
    setAutoStimAlert(null);
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    setIsPointerLocked(false);
    setGameState('MENU');
  };

  // Tactical Pause toggles
  const handlePause = () => {
    if (gameState === 'PLAYING') {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      setIsPointerLocked(false);
      soundManager.playUIClick();
      setGameState('PAUSED');
    }
  };

  const handleResume = () => {
    if (gameState === 'PAUSED') {
      soundManager.playUIClick();
      setGameState('PLAYING');
    }
  };

  // Global Keyboard & Mouse Shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      await soundManager.ensureAudioContext();

      if (e.key === 'F1') {
        e.preventDefault();
        setShowDebugConsole((prev) => !prev);
        return;
      }

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (isShopOpen) {
          setIsShopOpen(false);
        } else if (gameState === 'PLAYING') {
          handlePause();
        } else if (gameState === 'PAUSED') {
          handleResume();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (gameState === 'PLAYING' && !isShopOpen) {
          handleReload();
        }
      } else if (e.key === '1') {
        if (gameState === 'PLAYING') {
          handleSwitchWeapon('PISTOL');
        }
      } else if (e.key === '2') {
        if (gameState === 'PLAYING' && hudState.unlockedWeapons?.SHOTGUN) {
          handleSwitchWeapon('SHOTGUN');
        }
      } else if (e.key === '3') {
        if (gameState === 'PLAYING' && hudState.unlockedWeapons?.SMG) {
          handleSwitchWeapon('SMG');
        }
      } else if (e.key === '4') {
        if (gameState === 'PLAYING' && hudState.unlockedWeapons?.RIFLE) {
          handleSwitchWeapon('RIFLE');
        }
      } else if (e.key === '5') {
        if (gameState === 'PLAYING' && hudState.unlockedWeapons?.LMG) {
          handleSwitchWeapon('LMG');
        }
      } else if (e.key === '6') {
        if (gameState === 'PLAYING' && hudState.unlockedWeapons?.SNIPER) {
          handleSwitchWeapon('SNIPER');
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (gameState === 'PLAYING' && !isShopOpen) {
          handlePlantClaymore();
        }
      } else if (e.key === 'g' || e.key === 'G' || e.key === 'f' || e.key === 'F') {
        if (gameState === 'PLAYING' && !isShopOpen) {
          handleAirburst();
        }
      } else if (e.code === 'Space') {
        if (gameState === 'PLAYING') {
          e.preventDefault();
          if (isShopOpen) {
            setIsShopOpen(false);
          } else if (hudState.waveState === 'INTERMISSION' || hudState.waveState === 'WAVE_CLEARED') {
            handleStartNextWave();
          } else {
            handleFireShot();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState,
    isShopOpen,
    handlePause,
    handleResume,
    handleReload,
    handleFireShot,
    handleAirburst,
    handlePlantClaymore,
    handleSwitchWeapon,
    handleStartNextWave,
    hudState.waveState,
    hudState.unlockedWeapons,
  ]);

  // Click on viewport to fire when playing (if not clicking interactive UI buttons)
  const handleViewportClick = async (e: React.MouseEvent) => {
    if (gameState !== 'PLAYING' || isMobileTouchActive) return;

    if (isShopOpen || hudState.waveState === 'INTERMISSION' || hudState.waveState === 'WAVE_CLEARED') {
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('.pointer-events-auto')) {
      return;
    }

    await soundManager.ensureAudioContext();

    if (!document.pointerLockElement) {
      try {
        document.body.requestPointerLock();
      } catch (err) {
        console.warn('Pointer lock request failed:', err);
      }
    } else {
      handleFireShot();
    }
  };

  return (
    <div
      onClick={handleViewportClick}
      className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans"
    >
      {/* 1. Procedural 3D Compound Canvas (Three.js WebGL) */}
      <ErrorBoundary fallbackTitle="Tactical Compound 3D Engine">
        <ThreeCanvas
          gameState={gameState}
          fireKick={fireKick}
          damageKick={damageKick}
          isDying={isDying}
          fov={settings.fov}
          cameraSway={settings.cameraSway}
          mouseSensitivity={settings.mouseSensitivity}
          visualQuality={settings.visualQuality}
          touchLookSensitivity={settings.touchLookSensitivity ?? 1.0}
          isMobileTouchActive={isMobileTouchActive}
          onPointerLockChange={handlePointerLockChange}
          onPlayerDamaged={handleTakeHit}
          onAmmoChanged={(ammo, reserve) =>
            setHudState((prev) => ({
              ...prev,
              ammo,
              reserveAmmo: reserve !== undefined ? reserve : prev.reserveAmmo,
            }))
          }
          onWeaponChanged={handleWeaponChanged}
          onAirburstTriggered={handleAirburst}
          onScoreEarned={(pts, coins) =>
            setHudState((prev) => ({
              ...prev,
              score: prev.score + pts,
              coins: prev.coins + coins,
            }))
          }
          onHitMarker={triggerHitMarker}
          onZombieKilled={handleZombieKilled}
          onWaveCleared={handleWaveCleared}
          onWaveStarted={handleWaveStarted}
          onHostilesCountChanged={handleHostilesCountChanged}
          onReloadStarted={() => setHudState((prev) => ({ ...prev, isReloading: true, reloadProgress: 0 }))}
          onReloadProgress={(progress) => setHudState((prev) => ({ ...prev, reloadProgress: progress }))}
          onReloadCompleted={() => setHudState((prev) => ({ ...prev, isReloading: false, reloadProgress: 0 }))}
          onEmptyAlert={triggerEmptyAlert}
          onRecoilKick={(amount) => setFireKick(amount)}
          onDeathCompleted={handleDeathCompleted}
          fireTriggerRef={fireTriggerRef}
          reloadTriggerRef={reloadTriggerRef}
          switchWeaponTriggerRef={switchWeaponTriggerRef}
          airburstTriggerRef={airburstTriggerRef}
          knockbackZombiesTriggerRef={knockbackZombiesTriggerRef}
          refillAllWeaponsTriggerRef={refillAllWeaponsTriggerRef}
          addAmmoTriggerRef={addAmmoTriggerRef}
          unlockWeaponTriggerRef={unlockWeaponTriggerRef}
          spawnZombieTriggerRef={spawnZombieTriggerRef}
          spawnRunnerTriggerRef={spawnRunnerTriggerRef}
          spawnBruteTriggerRef={spawnBruteTriggerRef}
          killAllZombiesTriggerRef={killAllZombiesTriggerRef}
          clearWaveTriggerRef={clearWaveTriggerRef}
          skipToWaveTriggerRef={skipToWaveTriggerRef}
          startNextWaveTriggerRef={startNextWaveTriggerRef}
          redeployTriggerRef={redeployTriggerRef}
          touchMoveRef={touchMoveRef}
          touchLookRef={touchLookRef}
          touchTriggerRef={touchTriggerRef}
          quickTurnRef={quickTurnRef}
          snapTurnRef={snapTurnRef}
          plantClaymoreTriggerRef={plantClaymoreTriggerRef}
          onPlantClaymoreTriggered={handlePlantClaymore}
        />
      </ErrorBoundary>

      {/* Subtle Military CRT scanlines and vignette overlay */}
      <div className="absolute inset-0 scanlines pointer-events-none z-10" />
      <div className="absolute inset-0 crt-vignette pointer-events-none z-10" />

      {/* 2. Main Menu */}
      {gameState === 'MENU' && (
        <MainMenu
          onDeploy={handleDeploy}
          serviceRecord={serviceRecord}
          settings={settings}
          highestUnlockedWave={highestUnlockedWave}
          selectedStartWave={selectedStartWave}
          onSelectStartWave={setSelectedStartWave}
          persistentCoins={hudState.coins}
          onUpdateSettings={setSettings}
          onPlayClickSound={() => soundManager.playUIClick()}
        />
      )}

      {/* 3. Tactical 4-Corner HUD (Visible during PLAYING and PAUSED) */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <>
          <HUD
            hudState={hudState}
            settings={settings}
            fireKick={fireKick}
            damageKick={damageKick}
            airburstFlash={airburstFlash}
            reviveShieldActive={reviveShieldActive}
            autoStimAlert={autoStimAlert}
            isPointerLocked={isPointerLocked}
            hitMarker={hitMarker}
            emptyAlert={emptyAlert}
            isMobileTouchActive={isMobileTouchActive}
            onPause={handlePause}
            onReload={handleReload}
            onStartNextWave={handleStartNextWave}
            onOpenShop={() => {
              soundManager.playUIClick();
              setIsShopOpen(true);
            }}
            onAirburst={handleAirburst}
            onPlantClaymore={handlePlantClaymore}
            onSwitchWeapon={handleSwitchWeapon}
          />

          {/* Mobile Touch Dual-Zone Joystick & Action Cluster Overlay */}
          {(() => {
            const isModalOpen =
              gameState !== 'PLAYING' ||
              isShopOpen ||
              hudState.waveState === 'WAVE_CLEARED' ||
              hudState.waveState === 'INTERMISSION';

            if (gameState !== 'PLAYING' || isModalOpen || !isMobileTouchActive) return null;

            return (
              <MobileControls
                onFireStart={() => touchTriggerRef.current?.(true)}
                onFireEnd={() => touchTriggerRef.current?.(false)}
                onReload={handleReload}
                onAirburst={handleAirburst}
                onSwitchWeapon={handleSwitchWeapon}
                onPause={handlePause}
                onTouchMove={(f, r, s) => touchMoveRef.current?.(f, r, s)}
                onTouchLook={(dx, dy) => touchLookRef.current?.(dx, dy)}
                onQuickTurn={() => quickTurnRef.current?.()}
                onSnapTurn={(angle) => snapTurnRef.current?.(angle)}
                onPlantClaymore={handlePlantClaymore}
                claymores={hudState.claymores}
                equippedWeapon={hudState.equippedWeapon}
                ammo={hudState.ammo}
                maxAmmo={hudState.maxAmmo}
                isReloading={hudState.isReloading}
                airburstCharges={hudState.airburstCharges}
                unlockedWeapons={hudState.unlockedWeapons}
                isDying={isDying}
                isModalOpen={isModalOpen}
              />
            );
          })()}

          {/* Developer Testing Console (Press F1 or toggle in Pause Menu) */}
          {showDebugConsole && (
            <Stage1TestConsole
              onFireShot={handleFireShot}
              onReload={handleReload}
              onTakeHit={handleTakeHit}
              onHeal={handleHeal}
              onNextWave={handleNextWave}
              onTriggerKIA={handleTriggerFatalHit}
              onSpawnZombie={() => spawnZombieTriggerRef.current?.()}
              onSpawnRunner={() => spawnRunnerTriggerRef.current?.()}
              onSpawnBrute={() => spawnBruteTriggerRef.current?.()}
              onAirburstStrike={handleAirburst}
              onAddCoins={(amount) => setHudState((prev) => ({ ...prev, coins: prev.coins + amount }))}
              onOpenShop={() => setIsShopOpen(true)}
              onKillAllZombies={() => killAllZombiesTriggerRef.current?.()}
              onClearCurrentWave={() => clearWaveTriggerRef.current?.()}
              onSkipToWave3={() => skipToWaveTriggerRef.current?.(3)}
              onDepleteAllLives={handleDepleteAllLives}
              isReloading={hudState.isReloading}
              ammo={hudState.ammo}
            />
          )}
        </>
      )}

      {/* Between-Wave Armory Shop Modal Overlay */}
      {isShopOpen && (
        <ShopModal
          hudState={hudState}
          onBuyWeapon={handleBuyWeapon}
          onSwitchWeapon={handleSwitchWeapon}
          onBuyAmmo={handleBuyAmmo}
          onBuyReviveLife={handleBuyReviveLife}
          onBuyHealth={handleBuyHealth}
          onBuyArmor={handleBuyArmor}
          onBuyAirburst={handleBuyAirburst}
          onBuyClaymores={handleBuyClaymores}
          onClose={() => setIsShopOpen(false)}
        />
      )}

      {/* 4. Pause Menu Overlay */}
      {gameState === 'PAUSED' && (
        <PauseMenu
          onResume={handleResume}
          onRestart={handleRestart}
          onReturnToMenu={handleReturnToMenu}
          settings={settings}
          onUpdateSettings={setSettings}
          onPlayClickSound={() => soundManager.playUIClick()}
          showDebugConsole={showDebugConsole}
          onToggleDebugConsole={() => setShowDebugConsole((prev) => !prev)}
        />
      )}

      {/* 5. Operative KIA (Game Over) Screen */}
      {gameState === 'GAMEOVER' && (
        <GameOverScreen
          score={hudState.score}
          wave={hudState.wave}
          kills={hudState.kills}
          coins={hudState.coins}
          serviceRecord={serviceRecord}
          isNewHighScore={isNewHighScore}
          highestUnlockedWave={highestUnlockedWave}
          selectedStartWave={selectedStartWave}
          onSelectStartWave={setSelectedStartWave}
          onRestart={handleRestart}
          onReturnToMenu={handleReturnToMenu}
          onPlayClickSound={() => soundManager.playUIClick()}
        />
      )}
    </div>
  );
}
