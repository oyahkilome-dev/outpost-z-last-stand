/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ServiceRecord } from '../types/gameTypes';
import {
  RotateCcw,
  Home,
  Trophy,
  Flame,
  Skull,
  Coins,
  ShieldX,
} from 'lucide-react';

interface GameOverScreenProps {
  score: number;
  wave: number;
  kills: number;
  coins: number;
  serviceRecord: ServiceRecord;
  isNewHighScore: boolean;
  highestUnlockedWave?: number;
  selectedStartWave?: number;
  onSelectStartWave?: (wave: number) => void;
  onRestart: (startWave?: number) => void;
  onReturnToMenu: () => void;
  onPlayClickSound: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  score,
  wave,
  kills,
  coins,
  serviceRecord,
  isNewHighScore,
  highestUnlockedWave = 1,
  selectedStartWave = 1,
  onSelectStartWave,
  onRestart,
  onReturnToMenu,
  onPlayClickSound,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      {/* Background red atmospheric haze */}
      <div className="absolute inset-0 pointer-events-none bg-radial from-red-950/20 via-black/60 to-black/90" />

      <div className="relative z-10 bg-zinc-950/95 border border-red-900/60 rounded-xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
        {/* Somber Military KIA Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/80 border border-red-800 text-red-400 rounded text-xs font-mono-tactical font-black tracking-widest uppercase mb-3">
          <ShieldX className="w-4 h-4 text-red-500" />
          <span>VITAL SIGNS TERMINATED</span>
        </div>

        <h1 className="font-display-tactical text-4xl sm:text-5xl font-black tracking-wider text-red-500 leading-none drop-shadow-[0_2px_15px_rgba(239,68,68,0.5)] mb-1">
          OPERATIVE KIA
        </h1>
        <p className="text-zinc-400 font-mono-tactical text-xs tracking-wider uppercase mb-6">
          OUTPOST DEFENSES OVERRUN // SECTOR COMPROMISED
        </p>

        {/* New High Score Glowing Celebration Callout */}
        {isNewHighScore && (
          <div className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border-2 border-amber-400 rounded-lg text-amber-300 font-mono-tactical text-xs font-black mb-4 shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse">
            <Trophy className="w-4 h-4 text-amber-300 animate-bounce" />
            <span className="tracking-wider uppercase">★ NEW PERSONAL BEST ESTABLISHED! ★</span>
          </div>
        )}

        {/* Mission Debrief Stats Grid */}
        <div className="w-full grid grid-cols-2 gap-2.5 mb-4 text-left">
          {/* Final Score */}
          <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-1.5 text-zinc-500 font-mono-tactical text-[10px] uppercase">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Final Score</span>
            </div>
            <div className="font-display-tactical text-2xl font-black text-white mt-0.5">
              {score.toLocaleString()}
            </div>
          </div>

          {/* Wave Reached */}
          <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-1.5 text-zinc-500 font-mono-tactical text-[10px] uppercase">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Wave Reached</span>
            </div>
            <div className="font-display-tactical text-2xl font-black text-amber-400 mt-0.5">
              WAVE {wave}
            </div>
          </div>

          {/* Hostiles Eliminated */}
          <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-1.5 text-zinc-500 font-mono-tactical text-[10px] uppercase">
              <Skull className="w-3.5 h-3.5 text-red-400" />
              <span>Hostiles Down</span>
            </div>
            <div className="font-display-tactical text-2xl font-black text-zinc-200 mt-0.5">
              {kills} Kills
            </div>
          </div>

          {/* Munitions / Coins */}
          <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-1.5 text-zinc-500 font-mono-tactical text-[10px] uppercase">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Munition Coins</span>
            </div>
            <div className="font-display-tactical text-2xl font-black text-amber-400 mt-0.5">
              {coins}
            </div>
          </div>
        </div>

        {/* Expanded Career Lifetime Record Summary */}
        <div className="w-full bg-zinc-900/70 border border-zinc-800 rounded-lg p-2.5 mb-4 text-xs font-mono-tactical text-zinc-400">
          <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest text-left mb-1.5">
            // CAREER LIFETIME METRICS //
          </div>
          <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-left">
            <div>
              <span className="text-zinc-500 text-[10px]">RECORD SCORE: </span>
              <span className="text-white font-bold">{serviceRecord.highScore.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px]">RECORD WAVE: </span>
              <span className="text-amber-400 font-bold">WAVE {serviceRecord.highestWave}</span>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px]">TOTAL KILLS: </span>
              <span className="text-red-400 font-bold">{serviceRecord.totalKills.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px]">HEADSHOTS: </span>
              <span className="text-amber-300 font-bold">{(serviceRecord.totalHeadshots || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Deployment Wave Select / Checkpoint Control */}
        <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 mb-4 text-left">
          <div className="flex items-center justify-between text-xs font-mono-tactical mb-2">
            <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              DEPLOYMENT WAVE SELECT
            </span>
            <span className="text-zinc-500 text-[10px]">CHECKPOINT (1-{highestUnlockedWave})</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {Array.from({ length: Math.max(1, highestUnlockedWave) }).map((_, i) => {
              const w = i + 1;
              const isSelected = w === selectedStartWave;
              return (
                <button
                  key={w}
                  onClick={() => {
                    onPlayClickSound();
                    onSelectStartWave?.(w);
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-mono-tactical font-black transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 shadow-[0_0_12px_rgba(245,158,11,0.6)] ring-2 ring-amber-300 scale-105'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700/60'
                  }`}
                >
                  WAVE {w}
                </button>
              );
            })}
          </div>
        </div>

        {/* Redeploy Actions */}
        <div className="w-full space-y-2.5">
          <button
            onClick={() => {
              onPlayClickSound();
              onRestart(selectedStartWave);
            }}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display-tactical font-black text-base tracking-wider rounded transition-all active:scale-98 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span>REDEPLOY AT WAVE {selectedStartWave}</span>
          </button>

          <button
            onClick={() => {
              onPlayClickSound();
              onReturnToMenu();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-mono-tactical text-xs tracking-wider rounded transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>RETURN TO MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
