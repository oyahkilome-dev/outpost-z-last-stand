/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HUDState, GameSettings, WeaponId } from '../types/gameTypes';
import { CROSSHAIR_COLORS } from '../config/gameConfig';
import { soundManager } from '../utils/audio';
import {
  ShieldAlert,
  Shield,
  Skull,
  Coins,
  Trophy,
  Heart,
  Pause,
  RotateCcw,
  MousePointer,
  FastForward,
  AlertTriangle,
  Lock,
  ShoppingCart,
  Radio,
  Zap,
  Bomb,
} from 'lucide-react';

interface HUDProps {
  hudState: HUDState;
  settings: GameSettings;
  fireKick: number;
  damageKick: number;
  airburstFlash?: boolean;
  reviveShieldActive?: boolean;
  autoStimAlert?: { active: boolean; livesRemaining: number } | null;
  isPointerLocked?: boolean;
  hitMarker?: { active: boolean; isKill: boolean; isHeadshot?: boolean };
  emptyAlert?: boolean;
  onPause: () => void;
  onReload: () => void;
  onStartNextWave?: () => void;
  onOpenShop?: () => void;
  onAirburst?: () => void;
  onPlantClaymore?: () => void;
  onSwitchWeapon?: (id: WeaponId) => void;
  isMobileTouchActive?: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  hudState,
  settings,
  fireKick,
  damageKick,
  airburstFlash = false,
  reviveShieldActive = false,
  autoStimAlert = null,
  isPointerLocked = false,
  hitMarker = { active: false, isKill: false, isHeadshot: false },
  emptyAlert = false,
  onPause,
  onReload,
  onStartNextWave,
  onOpenShop,
  onAirburst,
  onPlantClaymore,
  onSwitchWeapon,
  isMobileTouchActive = false,
}) => {
  const {
    health,
    maxHealth,
    armor,
    maxArmor,
    operativeLives = 5,
    maxOperativeLives = 5,
    airburstCharges,
    maxAirburstCharges,
    claymores = 0,
    maxClaymores = 6,
    equippedWeapon,
    reserveAmmo,
    unlockedWeapons,
    wave,
    score,
    coins,
    zombiesRemaining,
    waveTotalZombies,
    waveState,
    waveBannerText,
    waveBannerSubtext,
    weaponName,
    ammo,
    maxAmmo,
    isReloading,
    reloadProgress,
  } = hudState;

  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const armorPercent = Math.max(0, Math.min(100, (armor / maxArmor) * 100));
  const isCriticalHealth = health <= 30;

  // Crosshair styling based on settings and weapon recoil kick
  const activeColor = CROSSHAIR_COLORS[settings.crosshairColor] || CROSSHAIR_COLORS.GREEN;
  const kickOffset = Math.round(fireKick * 18);
  const baseGap = 7;
  const spread = baseGap + kickOffset;

  const isWaveCleared = waveState === 'WAVE_CLEARED' || waveState === 'INTERMISSION';

  // Ensure pointer lock is released on wave clear so cursor and tap focus are available immediately
  React.useEffect(() => {
    if (isWaveCleared && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (e) {
        console.warn('exitPointerLock error:', e);
      }
    }
  }, [isWaveCleared]);

  const [lockedTooltip, setLockedTooltip] = React.useState<string | null>(null);
  const tooltipTimerRef = React.useRef<number | null>(null);

  const showLockedTooltip = (msg: string) => {
    soundManager.playDryFire();
    setLockedTooltip(msg);
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
    }
    tooltipTimerRef.current = window.setTimeout(() => {
      setLockedTooltip(null);
      tooltipTimerRef.current = null;
    }, 2000);
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
      {/* 1. Fullscreen Airburst Detonation Flash */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-300 ease-out z-20"
        style={{
          backgroundColor: '#fef08a',
          opacity: airburstFlash ? 0.95 : 0,
        }}
      />

      {/* Fullscreen Golden/Emerald Auto-Stim Revive Shield Flash */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-300 ease-out z-20"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.3) 25%, rgba(234, 179, 8, 0.45) 85%, rgba(16, 185, 129, 0.7) 100%)',
          opacity: reviveShieldActive ? 0.95 : 0,
        }}
      />

      {/* Fullscreen Damage Flash Vignette */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-100 ease-out z-10"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(239, 68, 68, 0.15) 25%, rgba(185, 28, 28, 0.88) 100%)',
          opacity: Math.min(1.0, damageKick * 1.1),
        }}
      />

      {/* Persistent Pulsing Low-Health Crimson Border (< 30 HP) */}
      {isCriticalHealth && (
        <div
          className="fixed inset-0 pointer-events-none z-10 animate-pulse border-4 sm:border-[6px] border-red-600/60 shadow-[inset_0_0_90px_rgba(220,38,38,0.55)] transition-opacity duration-300"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(185, 28, 28, 0) 45%, rgba(153, 27, 27, 0.35) 100%)',
          }}
        />
      )}

      {/* Emergency Auto-Stim Revive Notification Banner */}
      {autoStimAlert?.active && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-emerald-950/95 border-2 border-emerald-400 px-6 py-3 rounded-xl shadow-[0_0_50px_rgba(16,185,129,0.7)] backdrop-blur-md animate-bounce pointer-events-auto">
          <div className="p-2 bg-emerald-500/20 border border-emerald-400/50 rounded-lg text-emerald-300">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-display-tactical text-sm sm:text-base font-black text-emerald-200 tracking-wider uppercase">
              ⚡ EMERGENCY AUTO-STIM ACTIVATED!
            </span>
            <span className="text-xs font-mono-tactical text-emerald-300 font-bold">
              +100% FULL HEALTH RESTORED // {autoStimAlert.livesRemaining} LIVES REMAINING // 2.5s INVULNERABLE
            </span>
          </div>
        </div>
      )}

      {/* 2. TOP ROW HUD */}
      <div className="flex justify-between items-start w-full gap-4">
        {/* TOP-LEFT: Operative Vitality, Armor & 5x Lives Pips */}
        <div className="flex flex-col gap-2 pointer-events-auto bg-zinc-950/90 backdrop-blur-xs border border-zinc-800/80 px-4 py-3 rounded-lg shadow-2xl min-w-[260px] sm:min-w-[300px]">
          {/* Operative Lives / Auto-Revive Badges */}
          <div className="flex items-center justify-between border-b border-zinc-800/70 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Heart className={`w-3.5 h-3.5 ${operativeLives > 1 ? 'text-red-400 fill-red-400' : 'text-red-500 fill-red-500 animate-pulse'}`} />
              <span className="text-[11px] uppercase tracking-widest text-zinc-300 font-mono-tactical font-bold">
                OPERATIVE LIVES
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1">
                {Array.from({ length: maxOperativeLives }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center border transition-all ${
                      i < operativeLives
                        ? 'bg-red-600/90 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                        : 'bg-zinc-900 border-zinc-800 opacity-30'
                    }`}
                    title={i < operativeLives ? 'Auto-Stim Revive Ready' : 'Life Consumed'}
                  >
                    <Heart className={`w-2 h-2 ${i < operativeLives ? 'text-white fill-current' : 'text-zinc-600'}`} />
                  </div>
                ))}
              </div>
              <span className={`font-mono-tactical text-xs font-black ml-1 ${operativeLives <= 1 ? 'text-red-500 animate-pulse' : 'text-red-400'}`}>
                {operativeLives}x
              </span>
            </div>
          </div>

          {/* Health Section */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldAlert
                  className={`w-3.5 h-3.5 ${isCriticalHealth ? 'text-red-500' : 'text-emerald-400'}`}
                />
                <span className="text-[11px] uppercase tracking-widest text-zinc-400 font-mono-tactical font-semibold">
                  Health
                </span>
              </div>
              <span
                className={`font-mono-tactical text-xs font-bold tracking-wider ${
                  isCriticalHealth ? 'text-red-400 animate-pulse' : 'text-emerald-400'
                }`}
              >
                {health} / {maxHealth} HP
              </span>
            </div>

            <div className="relative w-full h-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xs overflow-hidden p-0.5">
              <div
                className={`h-full transition-all duration-200 rounded-2xs ${
                  isCriticalHealth
                    ? 'bg-linear-to-r from-red-700 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                    : health <= 60
                    ? 'bg-linear-to-r from-amber-600 to-amber-400'
                    : 'bg-linear-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                }`}
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>

          {/* Armor Section */}
          <div className="flex flex-col gap-1 border-t border-zinc-800/60 pt-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] uppercase tracking-widest text-zinc-400 font-mono-tactical font-semibold">
                  Kevlar Armor
                </span>
              </div>
              <span className="font-mono-tactical text-xs font-bold tracking-wider text-cyan-400">
                {armor} / {maxArmor} AP
              </span>
            </div>

            <div className="relative w-full h-2 bg-zinc-900 border border-zinc-700/80 rounded-xs overflow-hidden p-0.5">
              <div
                className="h-full bg-linear-to-r from-cyan-600 to-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)] transition-all duration-200 rounded-2xs"
                style={{ width: `${armorPercent}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono-tactical">
            <span>STATUS: {isCriticalHealth ? 'CRITICAL - MEDIC' : 'COMBAT READY'}</span>
            <span>AUTO-REVIVE ON KIA</span>
          </div>
        </div>

        {/* TOP CENTER: Large High-Visibility Live Zombie Target Counter */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2.5 sm:gap-3.5 bg-zinc-950/95 border-2 border-red-500/80 px-5 sm:px-7 py-2 sm:py-2.5 rounded-lg shadow-[0_0_30px_rgba(239,68,68,0.45)] backdrop-blur-md pointer-events-auto">
            <div className="flex items-center gap-2 pr-3 sm:pr-4 border-r border-zinc-800">
              <Skull className="w-5 h-5 text-red-500 animate-pulse" />
              <span className="font-mono-tactical text-xs sm:text-sm uppercase tracking-widest text-amber-400 font-bold whitespace-nowrap">
                WAVE {wave} TARGET:
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="font-display-tactical text-3xl sm:text-4xl font-black text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] leading-none">
                {zombiesRemaining}
              </span>
              <span className="font-display-tactical text-base sm:text-lg text-zinc-400 font-bold leading-none">
                / {waveTotalZombies}
              </span>
              <span className="font-mono-tactical text-[10px] sm:text-xs uppercase tracking-wider text-zinc-300 font-semibold ml-1 whitespace-nowrap">
                ZOMBIES REMAINING
              </span>
            </div>
          </div>

          {/* Incoming Wave banner overlay if recently started */}
          {waveBannerText && !isWaveCleared && (
            <div className="mt-2 flex items-center gap-2 bg-red-950/90 border border-red-600/80 px-4 py-1 rounded-md shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-in fade-in duration-200">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />
              <span className="font-display-tactical text-xs font-black text-red-300 tracking-wider uppercase">
                {waveBannerText}
              </span>
              {waveBannerSubtext && (
                <span className="text-[10px] font-mono-tactical text-zinc-400 border-l border-red-800/80 pl-2">
                  {waveBannerSubtext}
                </span>
              )}
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Score, Coins & Pause */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto min-w-[200px]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-zinc-950/90 border border-zinc-800/80 px-3 py-1.5 rounded-lg text-xs font-mono-tactical text-zinc-300 shadow-xl">
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-zinc-400">SCORE:</span>
              <span className="font-bold text-white tracking-wide">{score}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-950/90 border border-zinc-800/80 px-3 py-1.5 rounded-lg text-xs font-mono-tactical text-amber-400 shadow-xl">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">{coins}</span>
            </div>
          </div>

          <div className="flex items-center justify-end w-full">
            <button
              onClick={onPause}
              className="flex items-center gap-1 text-[11px] font-mono-tactical text-zinc-400 hover:text-zinc-100 bg-zinc-950/80 border border-zinc-800/80 hover:bg-zinc-800 px-2.5 py-1 rounded transition-colors cursor-pointer"
              title="Pause Game [ESC / P]"
            >
              <Pause className="w-3 h-3" />
              <span>PAUSE [P]</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. CENTER: Dynamic Crosshair with Recoil Reaction */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-16 h-16 flex items-center justify-center">
          {/* Top Line */}
          <div
            className={`absolute w-0.5 h-2.5 ${activeColor.tailwindBg} transition-transform duration-75`}
            style={{
              transform: `translateY(-${spread}px)`,
              boxShadow: `0 0 6px ${activeColor.shadow}`,
            }}
          />
          {/* Bottom Line */}
          <div
            className={`absolute w-0.5 h-2.5 ${activeColor.tailwindBg} transition-transform duration-75`}
            style={{
              transform: `translateY(${spread}px)`,
              boxShadow: `0 0 6px ${activeColor.shadow}`,
            }}
          />
          {/* Left Line */}
          <div
            className={`absolute h-0.5 w-2.5 ${activeColor.tailwindBg} transition-transform duration-75`}
            style={{
              transform: `translateX(-${spread}px)`,
              boxShadow: `0 0 6px ${activeColor.shadow}`,
            }}
          />
          {/* Right Line */}
          <div
            className={`absolute h-0.5 w-2.5 ${activeColor.tailwindBg} transition-transform duration-75`}
            style={{
              transform: `translateX(${spread}px)`,
              boxShadow: `0 0 6px ${activeColor.shadow}`,
            }}
          />

          {/* Center Precision Pip */}
          <div
            className={`w-1 h-1 rounded-full ${activeColor.tailwindBg}`}
            style={{ boxShadow: `0 0 4px ${activeColor.shadow}` }}
          />

          {/* Dynamic Hit Marker 'X' Ticks (120ms flash on hit) */}
          {hitMarker.active && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-75 scale-110">
              <div className="relative w-8 h-8 flex items-center justify-center">
                {hitMarker.isHeadshot && (
                  <div className="absolute -top-7 text-[10px] font-mono-tactical font-black text-amber-400 tracking-widest drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] uppercase whitespace-nowrap">
                    CRITICAL HEADSHOT
                  </div>
                )}
                {/* Top-Left */}
                <div
                  className={`absolute top-0.5 left-0.5 w-3 h-0.5 -rotate-45 origin-left rounded-2xs ${
                    hitMarker.isHeadshot
                      ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)]'
                      : hitMarker.isKill
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]'
                      : 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
                  }`}
                />
                {/* Top-Right */}
                <div
                  className={`absolute top-0.5 right-0.5 w-3 h-0.5 rotate-45 origin-right rounded-2xs ${
                    hitMarker.isHeadshot
                      ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)]'
                      : hitMarker.isKill
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]'
                      : 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
                  }`}
                />
                {/* Bottom-Left */}
                <div
                  className={`absolute bottom-0.5 left-0.5 w-3 h-0.5 rotate-45 origin-left rounded-2xs ${
                    hitMarker.isHeadshot
                      ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)]'
                      : hitMarker.isKill
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]'
                      : 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
                  }`}
                />
                {/* Bottom-Right */}
                <div
                  className={`absolute bottom-0.5 right-0.5 w-3 h-0.5 -rotate-45 origin-right rounded-2xs ${
                    hitMarker.isHeadshot
                      ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)]'
                      : hitMarker.isKill
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]'
                      : 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Empty Magazine Prompt (under reticle) */}
        {(ammo === 0 || emptyAlert) && !isWaveCleared && (
          <div className="absolute top-[56%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/85 border border-red-600 rounded text-xs font-mono-tactical font-black text-red-400 tracking-wider shadow-xl animate-pulse">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isReloading ? 'AUTO-RELOADING MAGAZINE...' : 'MAGAZINE EMPTY [RELOADING]'}</span>
            </div>
          </div>
        )}

        {/* Subtle Centered Pointer Lock Hint Overlay (Desktop only) */}
        {!isPointerLocked && !isWaveCleared && !isMobileTouchActive && (
          <div className="absolute top-[62%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300">
            <div className="bg-zinc-950/90 border border-amber-500/70 px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-xs">
              <div className="p-1.5 bg-amber-500/10 rounded border border-amber-500/40 text-amber-400">
                <MousePointer className="w-4 h-4 animate-pulse" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-display-tactical text-xs font-bold text-amber-400 tracking-wider">
                  CLICK SCREEN TO AIM & FIRE
                </span>
                <span className="text-[10px] font-mono-tactical text-zinc-300">
                  WASD: Move // [1][2][3]: Weapons // [G]: Airburst // ESC: Pause
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. BOTTOM ROW: Tactical Munitions (Airburst & Claymores) & Multi-Weapon Arsenal HUD */}
      <div className="flex justify-between items-end w-full gap-4">
        {/* BOTTOM-LEFT: Emergency Airburst & Proximity Claymores (Hidden on Mobile to keep joystick clear) */}
        <div className={`${isMobileTouchActive ? 'hidden' : 'pointer-events-auto flex items-center gap-2.5'}`}>
          {/* Airburst Panic Button */}
          <button
            onClick={async () => {
              await soundManager.ensureAudioContext();
              onAirburst?.();
            }}
            disabled={airburstCharges <= 0 || isWaveCleared}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 font-mono-tactical transition-all duration-150 shadow-2xl cursor-pointer ${
              airburstCharges > 0 && !isWaveCleared
                ? 'bg-linear-to-r from-amber-950/90 to-yellow-950/90 hover:from-amber-900 hover:to-yellow-900 border-amber-400 text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.45)] hover:shadow-[0_0_35px_rgba(245,158,11,0.7)] active:scale-95'
                : 'bg-zinc-950/80 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
            }`}
            title="Detonate Emergency Airburst Strike [G or F] (clears 20m radius)"
          >
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/60 text-amber-400 shadow-inner">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-display-tactical text-xs font-black tracking-wider uppercase text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                AIRBURST [G]: {airburstCharges} READY
              </span>
              <span className="text-[10px] text-zinc-400">
                {airburstCharges > 0 ? 'ARMED // 20M RADIUS' : 'DEPLETED (BUY IN SHOP)'}
              </span>
            </div>
          </button>

          {/* Proximity Claymore Mine Deploy Button [E] */}
          <button
            onClick={async () => {
              await soundManager.ensureAudioContext();
              onPlantClaymore?.();
            }}
            disabled={claymores <= 0 || isWaveCleared}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 font-mono-tactical transition-all duration-150 shadow-2xl cursor-pointer ${
              claymores > 0 && !isWaveCleared
                ? 'bg-linear-to-r from-emerald-950/90 to-zinc-950/90 hover:from-emerald-900 hover:to-zinc-900 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95'
                : 'bg-zinc-950/80 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
            }`}
            title="Deploy Proximity Claymore Mine [E] (Detonates when hostiles approach)"
          >
            <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-400/60 text-emerald-400 shadow-inner">
              <Bomb className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-display-tactical text-xs font-black tracking-wider uppercase text-emerald-300">
                CLAYMORE [E]: {claymores} READY
              </span>
              <span className="text-[10px] text-zinc-400">
                {claymores > 0 ? 'ARMED // PRESS E TO PLANT' : 'DEPLETED (BUY IN ARMORY)'}
              </span>
            </div>
          </button>
        </div>

        {/* BOTTOM-RIGHT: Multi-Weapon Arsenal Readout & Selection */}
        <div className={`relative pointer-events-auto flex flex-col items-end gap-2 bg-zinc-950/95 border border-zinc-800/90 rounded-xl shadow-2xl transition-all ${
          isMobileTouchActive
            ? 'px-3 py-2 min-w-[170px] sm:min-w-[420px] max-w-[280px] sm:max-w-none'
            : 'px-4 py-3.5 min-w-[420px] max-w-[620px]'
        }`}>
          {/* Locked Weapon Tooltip Toast */}
          {lockedTooltip && (
            <div className="absolute -top-10 right-2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-red-950 border border-red-500 text-red-200 text-xs font-mono-tactical font-black rounded shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-bounce">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>{lockedTooltip}</span>
            </div>
          )}

          {/* Interactive HUD Weapon Bar: 6 Clickable Weapon Cards */}
          <div className={`${isMobileTouchActive ? 'hidden sm:grid' : 'grid'} grid-cols-6 gap-1.5 w-full border-b border-zinc-800/80 pb-2.5`}>
            {([
              { id: 'PISTOL' as WeaponId, slot: 1, label: 'M9 PISTOL', sub: '9mm' },
              { id: 'SHOTGUN' as WeaponId, slot: 2, label: 'SPAS-12', sub: '12-Gauge' },
              { id: 'SMG' as WeaponId, slot: 3, label: 'MP5 SMG', sub: '9mm Auto' },
              { id: 'RIFLE' as WeaponId, slot: 4, label: 'AK-47', sub: '7.62mm' },
              { id: 'LMG' as WeaponId, slot: 5, label: 'M249 LMG', sub: '5.56 Belt' },
              { id: 'SNIPER' as WeaponId, slot: 6, label: 'M82 .50', sub: '.50 BMG' },
            ]).map(({ id, slot, label, sub }) => {
              const isUnlocked = unlockedWeapons?.[id];
              const isEquipped = equippedWeapon === id;

              return (
                <button
                  key={id}
                  onClick={() => {
                    if (isUnlocked) {
                      onSwitchWeapon?.(id);
                    } else {
                      showLockedTooltip(`BUY ${label} IN ARMORY`);
                    }
                  }}
                  className={`flex flex-col items-start p-1.5 rounded-lg border text-left transition-all ${
                    isUnlocked
                      ? isEquipped
                        ? 'bg-emerald-950/70 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.45)] cursor-pointer'
                        : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 cursor-pointer'
                      : 'bg-zinc-950/80 border-zinc-900 text-zinc-500 opacity-55 hover:opacity-100 hover:border-red-700/80 cursor-pointer'
                  }`}
                  title={`Slot [${slot}]: ${label} (${isUnlocked ? 'Press ' + slot : 'LOCKED - Buy in Shop'})`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono-tactical text-[9px] font-black text-amber-400">[{slot}]</span>
                    {isUnlocked ? (
                      <span
                        className={`text-[8px] font-mono-tactical px-0.5 rounded font-bold uppercase ${
                          isEquipped ? 'bg-emerald-400/20 text-emerald-300' : 'text-zinc-500'
                        }`}
                      >
                        {isEquipped ? 'ON' : 'OK'}
                      </span>
                    ) : (
                      <Lock className="w-2.5 h-2.5 text-zinc-600" />
                    )}
                  </div>
                  <span className="font-display-tactical text-[10px] font-black tracking-tight text-zinc-100 mt-0.5 truncate w-full">
                    {label}
                  </span>
                  <span className="text-[8px] font-mono-tactical text-zinc-500 truncate w-full">
                    {sub}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Weapon Name & Caliber */}
          <div className="flex items-center justify-between w-full">
            <span className="font-display-tactical text-xs tracking-wider uppercase font-bold text-zinc-200">
              {weaponName}
            </span>
            <span className="text-[9px] font-mono-tactical text-amber-400 font-semibold uppercase">
              {equippedWeapon === 'PISTOL'
                ? '9x19mm SEMI // INF RESERVE'
                : equippedWeapon === 'SHOTGUN'
                ? '12-GAUGE BUCKSHOT // 8 PELLETS'
                : equippedWeapon === 'SMG'
                ? '9x19mm HIGH-CYCLIC // 85MS'
                : equippedWeapon === 'RIFLE'
                ? '7.62x39mm ASSAULT // RAPID'
                : equippedWeapon === 'LMG'
                ? '5.56x45mm NATO // 100-RND DRUM'
                : '.50 BMG ANTI-MATERIEL // PIERCING'}
            </span>
          </div>

          {/* Ammo Counter Numerical & Reserve */}
          <div className="flex items-baseline justify-between w-full pt-0.5">
            <div className="flex items-baseline gap-1">
              <span
                className={`font-display-tactical text-4xl font-black tracking-tighter ${
                  ammo === 0
                    ? 'text-red-500 animate-pulse'
                    : ammo <= Math.ceil(maxAmmo * 0.25)
                    ? 'text-amber-400'
                    : 'text-zinc-100'
                }`}
              >
                {String(ammo).padStart(2, '0')}
              </span>
              <span className="text-zinc-500 font-mono-tactical text-sm font-semibold">
                / {maxAmmo}
              </span>
            </div>

            <div className="flex items-center gap-1 text-zinc-400 font-mono-tactical text-xs">
              <span className="text-[10px] text-zinc-500">RES:</span>
              <span className="text-base font-bold text-emerald-400">
                {reserveAmmo === Infinity ? '∞' : reserveAmmo}
              </span>
            </div>
          </div>

          {/* Cartridge Pips Representation */}
          <div className="flex gap-0.5 w-full justify-between py-1 overflow-hidden">
            {Array.from({ length: Math.min(30, maxAmmo) }).map((_, idx) => (
              <div
                key={idx}
                className={`h-2.5 flex-1 rounded-2xs transition-colors duration-70 ${
                  idx < ammo
                    ? 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.6)]'
                    : 'bg-zinc-800 border border-zinc-700/40'
                }`}
              />
            ))}
          </div>

          {/* Reload Status / Progress Bar */}
          {isReloading ? (
            <div className="w-full flex flex-col gap-1 mt-0.5">
              <div className="flex justify-between text-[10px] font-mono-tactical text-amber-400 font-semibold tracking-wider">
                <span className="flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 animate-spin" />
                  RELOADING...
                </span>
                <span>{Math.round(reloadProgress * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-75"
                  style={{ width: `${reloadProgress * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-between items-center text-[10px] font-mono-tactical text-zinc-500">
              <span>{ammo === 0 ? 'EMPTY - PRESS [R]' : 'READY'}</span>
              <button
                onClick={async () => {
                  await soundManager.ensureAudioContext();
                  onReload();
                }}
                disabled={ammo === maxAmmo || reserveAmmo === 0}
                className="text-zinc-400 hover:text-amber-400 transition-colors disabled:opacity-40 disabled:hover:text-zinc-400 cursor-pointer"
              >
                RELOAD [R]
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Definite Wave Cleared Victory Modal Overlay with Full Health & Airburst Supply */}
      {isWaveCleared && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto select-none animate-in fade-in duration-200"
          style={{
            zIndex: 9999,
            pointerEvents: 'auto',
            touchAction: 'auto',
          }}
        >
          <div
            className="relative w-full max-w-lg mx-4 bg-zinc-950/95 border-2 border-amber-500/90 rounded-xl p-6 sm:p-8 shadow-[0_0_60px_rgba(245,158,11,0.35)] flex flex-col items-center text-center pointer-events-auto"
            style={{
              zIndex: 10000,
              pointerEvents: 'auto',
              touchAction: 'auto',
            }}
          >
            {/* Decorative tactical corner brackets */}
            <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-amber-400 pointer-events-none" />
            <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-amber-400 pointer-events-none" />
            <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-amber-400 pointer-events-none" />
            <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-amber-400 pointer-events-none" />

            {/* Victory Badge */}
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-400 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(245,158,11,0.5)]">
              <Trophy className="w-9 h-9 text-amber-400 animate-pulse" />
            </div>

            <span className="text-xs font-mono-tactical uppercase tracking-widest text-amber-400 font-bold mb-1">
              SECTOR DEFENSE ACCOMPLISHED
            </span>

            <h2 className="font-display-tactical text-3xl sm:text-4xl font-black text-amber-300 tracking-wider mb-1 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]">
              🎖️ WAVE {wave} CLEARED!
            </h2>

            <p className="font-mono-tactical text-xs sm:text-sm text-zinc-300 uppercase tracking-widest mb-4">
              ALL SECTOR HOSTILES NEUTRALIZED
            </p>

            {/* Reward Summary */}
            <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 mb-3 flex items-center justify-around">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono-tactical text-zinc-400 uppercase">Clear Bonus</span>
                  <span className="font-mono-tactical text-sm sm:text-base font-bold text-white">
                    +{wave * 250} Score
                  </span>
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono-tactical text-zinc-400 uppercase">Munition Pay</span>
                  <span className="font-mono-tactical text-sm sm:text-base font-bold text-amber-400">
                    +{wave * 50} Coins
                  </span>
                </div>
              </div>
            </div>

            {/* Stage 7 Directives: Full Health Restoration & Tactical Airburst Supply */}
            <div className="w-full flex flex-col gap-1.5 mb-4">
              <div className="w-full py-1.5 px-3 bg-emerald-950/50 border border-emerald-500/60 rounded text-xs font-mono-tactical text-emerald-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Heart className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span className="font-bold tracking-wide">MEDIC RECOVERY: +100% FULL HEALTH RESTORED</span>
              </div>
              <div className="w-full py-1.5 px-3 bg-amber-950/50 border border-amber-500/60 rounded text-xs font-mono-tactical text-amber-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold tracking-wide">TACTICAL SUPPLY: +2 AIRBURST CHARGES RECEIVED</span>
              </div>
              <div className="w-full py-1.5 px-3 bg-zinc-900 border border-zinc-700/60 rounded text-xs font-mono-tactical text-zinc-300 flex items-center justify-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                <span>ALL WEAPON MAGAZINES AUTO-REFILLED FREE</span>
              </div>
            </div>

            {/* Actions: Armory Shop & Start Wave */}
            <div className="w-full flex flex-col gap-2.5">
              {/* Armory Shop Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundManager.playUIClick();
                  onOpenShop?.();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  soundManager.playUIClick();
                  onOpenShop?.();
                }}
                style={{ pointerEvents: 'auto', touchAction: 'manipulation', zIndex: 10000 }}
                className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 border-2 border-amber-500/80 hover:border-amber-400 text-amber-400 font-display-tactical text-base font-black tracking-wider uppercase rounded-lg shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <span>🛒 OPEN ARMORY SHOP (UPGRADE ARSENAL)</span>
              </button>

              {/* Start Next Wave Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundManager.playUIClick();
                  onStartNextWave?.();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  soundManager.playUIClick();
                  onStartNextWave?.();
                }}
                style={{ pointerEvents: 'auto', touchAction: 'manipulation', zIndex: 10000 }}
                className="w-full py-3.5 px-6 bg-linear-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-zinc-950 font-display-tactical text-base sm:text-lg font-black tracking-wider uppercase rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.6)] hover:shadow-[0_0_40px_rgba(245,158,11,0.8)] transition-all duration-150 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3 cursor-pointer"
              >
                <FastForward className="w-5 h-5 fill-current" />
                <span>▶ START WAVE {wave + 1} NOW (or Press SPACE)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
