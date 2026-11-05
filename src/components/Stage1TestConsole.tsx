/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Crosshair,
  RotateCcw,
  ShieldMinus,
  ShieldPlus,
  Skull,
  FastForward,
  ChevronDown,
  ChevronUp,
  Terminal,
  Volume2,
  Zap,
  Coins,
  ShoppingCart,
  Radio,
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { PISTOL_CONFIG } from '../config/gameConfig';

interface Stage1TestConsoleProps {
  onFireShot: () => void;
  onReload: () => void;
  onTakeHit: () => void;
  onHeal: () => void;
  onNextWave: () => void;
  onTriggerKIA: () => void;
  onSpawnZombie?: () => void;
  onSpawnRunner?: () => void;
  onSpawnBrute?: () => void;
  onAirburstStrike?: () => void;
  onAddCoins?: (amount: number) => void;
  onOpenShop?: () => void;
  onKillAllZombies?: () => void;
  onClearCurrentWave?: () => void;
  onSkipToWave3?: () => void;
  onDepleteAllLives?: () => void;
  isReloading: boolean;
  ammo: number;
}

export const Stage1TestConsole: React.FC<Stage1TestConsoleProps> = ({
  onFireShot,
  onReload,
  onTakeHit,
  onHeal,
  onNextWave,
  onTriggerKIA,
  onSpawnZombie,
  onSpawnRunner,
  onSpawnBrute,
  onAirburstStrike,
  onAddCoins,
  onOpenShop,
  onKillAllZombies,
  onClearCurrentWave,
  onSkipToWave3,
  onDepleteAllLives,
  isReloading,
  ammo,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const handleFireClick = async () => {
    await soundManager.ensureAudioContext();
    onFireShot();
  };

  const handleReloadClick = async () => {
    await soundManager.ensureAudioContext();
    onReload();
  };

  return (
    <div
      className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-auto transition-all duration-200"
      style={{
        maxWidth: 'min(1240px, 96vw)',
      }}
    >
      {/* Drawer Toggle Header / Floating Pill Badge */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsCollapsed(!isCollapsed);
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          setIsCollapsed(!isCollapsed);
        }}
        style={{ pointerEvents: 'auto', touchAction: 'manipulation', zIndex: 10000 }}
        className="flex items-center gap-1.5 px-3 py-1 bg-zinc-950/90 hover:bg-zinc-900 border border-amber-500/60 rounded-full text-[10px] font-mono-tactical text-amber-400 hover:text-amber-300 shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-95"
      >
        <Terminal className="w-3 h-3 text-amber-400" />
        <span className="font-bold tracking-wider">STAGE TEST CONSOLE</span>
        {isCollapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
        )}
      </button>

      {/* Test Toolbar Body */}
      {!isCollapsed && (
        <div className="mt-1.5 w-full bg-zinc-950/95 border border-zinc-800 p-2 sm:p-2.5 rounded-xl shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-h-[42vh] overflow-y-auto tactical-modal-scroll">
        {/* Fire Shot */}
        <button
          onClick={handleFireClick}
          disabled={isReloading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600/60 rounded text-xs font-mono-tactical font-semibold text-zinc-100 hover:border-amber-500/80 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
          title="Fire Equipped Weapon [LMB or Click]"
        >
          <Crosshair className="w-3.5 h-3.5 text-amber-400" />
          <span>Fire {ammo === 0 ? '(Empty)' : ''}</span>
        </button>

        {/* Reload [R] */}
        <button
          onClick={handleReloadClick}
          disabled={isReloading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600/60 rounded text-xs font-mono-tactical font-semibold text-zinc-100 hover:border-amber-500/80 transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-sm"
          title="Reload Magazine [R]"
        >
          <RotateCcw className={`w-3.5 h-3.5 text-amber-400 ${isReloading ? 'animate-spin' : ''}`} />
          <span>Reload [R]</span>
        </button>

        <div className="hidden sm:block h-5 w-px bg-zinc-800" />

        {/* 1. Emergency Airburst Strike [G] */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            onAirburstStrike?.();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-500 rounded text-xs font-mono-tactical font-bold text-amber-300 hover:border-amber-400 transition-all active:scale-95 cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.3)]"
          title="Trigger Emergency Compound Airburst [G or F]"
        >
          <Radio className="w-3.5 h-3.5 text-amber-400" />
          <span>Airburst [G]</span>
        </button>

        {/* 2. Spawn Heavy Brute Zombie (NEW in Stage 7) */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            onSpawnBrute?.();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-500 rounded text-xs font-mono-tactical font-bold text-red-300 hover:border-red-400 transition-all active:scale-95 cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.35)]"
          title="Spawn Heavy Armored Brute Zombie (250 HP, 30 DMG, Red Eyes)"
        >
          <Skull className="w-3.5 h-3.5 text-red-500" />
          <span>Spawn Brute</span>
        </button>

        {/* Spawn Runner Zombie */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            onSpawnRunner?.();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-950/70 hover:bg-orange-900 border border-orange-500 rounded text-xs font-mono-tactical font-semibold text-orange-200 transition-all active:scale-95 cursor-pointer"
          title="Spawn Fast Runner Zombie"
        >
          <Zap className="w-3.5 h-3.5 text-orange-400" />
          <span>Runner</span>
        </button>

        {/* Spawn Walker Zombie */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            onSpawnZombie?.();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-600/70 rounded text-xs font-mono-tactical font-semibold text-emerald-300 transition-all active:scale-95 cursor-pointer"
          title="Spawn Walker Zombie"
        >
          <Skull className="w-3.5 h-3.5 text-emerald-400" />
          <span>Walker</span>
        </button>

        <div className="hidden sm:block h-5 w-px bg-zinc-800" />

        {/* Add 500 Coins (for easy testing of Armory Shop) */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            soundManager.playBuyItem();
            onAddCoins?.(500);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-950/60 hover:bg-yellow-900 border border-yellow-500/80 rounded text-xs font-mono-tactical font-bold text-yellow-300 transition-all active:scale-95 cursor-pointer"
          title="Add +500 Coins to test Armory Shop upgrades"
        >
          <Coins className="w-3.5 h-3.5 text-yellow-400" />
          <span>+500 Coins</span>
        </button>

        {/* Open Armory Shop Modal */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            soundManager.playUIClick();
            onOpenShop?.();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-amber-500/70 rounded text-xs font-mono-tactical font-semibold text-amber-300 transition-all active:scale-95 cursor-pointer"
          title="Open Between-Wave Armory Shop Modal"
        >
          <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
          <span>Armory Shop</span>
        </button>

        {/* Clear Current Wave */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            onClearCurrentWave?.();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/60 hover:bg-amber-900 border border-amber-600/80 rounded text-xs font-mono-tactical font-semibold text-amber-300 transition-all active:scale-95 cursor-pointer"
          title="Clear current wave and trigger victory modal"
        >
          <FastForward className="w-3.5 h-3.5 text-amber-400" />
          <span>Clear Wave</span>
        </button>

        <div className="hidden sm:block h-5 w-px bg-zinc-800" />

        {/* Take Hit (-15 HP or Armor) */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            onTakeHit();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-xs font-mono-tactical font-semibold text-zinc-300 transition-all active:scale-95 cursor-pointer"
          title="Simulate zombie melee damage (-15 AP / HP)"
        >
          <ShieldMinus className="w-3.5 h-3.5 text-red-400" />
          <span>Hit (-15)</span>
        </button>

        {/* Heal (+25 HP) */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            onHeal();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-xs font-mono-tactical font-semibold text-zinc-300 transition-all active:scale-95 cursor-pointer"
          title="Field Medkit (+25 HP)"
        >
          <ShieldPlus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Heal (+25)</span>
        </button>

        {/* Fatal Hit (Triggers Auto-Stim Revive if lives > 0) */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            onTriggerKIA();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500 rounded text-xs font-mono-tactical font-bold text-emerald-300 transition-all active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)]"
          title="Simulate fatal blow to test Auto-Stim Revive (restores 100 HP, 2.5s shield, 5m knockback)"
        >
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Fatal Hit (Revive)</span>
        </button>

        {/* Deplete All Lives (True KIA) */}
        <button
          onClick={async () => {
            await soundManager.ensureAudioContext();
            onDepleteAllLives?.();
          }}
          className="flex items-center gap-1.5 px-2 py-1.5 bg-red-950/70 hover:bg-red-900 border border-red-700 rounded text-xs font-mono-tactical font-semibold text-red-400 transition-all active:scale-95 cursor-pointer"
          title="Deplete all lives to test true Game Over / Operative KIA collapse"
        >
          <Skull className="w-3.5 h-3.5" />
          <span>Deplete Lives (KIA)</span>
        </button>
      </div>
    )}
  </div>
  );
};
