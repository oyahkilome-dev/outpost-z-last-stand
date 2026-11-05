/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameSettings, ServiceRecord, CrosshairColor } from '../types/gameTypes';
import { CROSSHAIR_COLORS } from '../config/gameConfig';
import { soundManager } from '../utils/audio';
import { SettingsModal } from './SettingsModal';
import { CreditsModal } from './CreditsModal';
import {
  Play,
  FileText,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  Trophy,
  ShieldAlert,
  Flame,
  Radio,
  X,
  Target,
  Crosshair,
  Keyboard,
  Info,
  Coins,
  Award,
} from 'lucide-react';

interface MainMenuProps {
  onDeploy: (startWave?: number) => void;
  serviceRecord: ServiceRecord;
  settings: GameSettings;
  highestUnlockedWave?: number;
  selectedStartWave?: number;
  onSelectStartWave?: (wave: number) => void;
  persistentCoins?: number;
  onUpdateSettings: (settings: GameSettings) => void;
  onPlayClickSound: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onDeploy,
  serviceRecord,
  settings,
  highestUnlockedWave = 1,
  selectedStartWave = 1,
  onSelectStartWave,
  persistentCoins = 0,
  onUpdateSettings,
  onPlayClickSound,
}) => {
  const [showBriefing, setShowBriefing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  const handleCrosshairSelect = (color: CrosshairColor) => {
    onPlayClickSound();
    onUpdateSettings({ ...settings, crosshairColor: color });
  };

  const handleAudioToggle = () => {
    onPlayClickSound();
    onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled });
  };

  const handleVolumeChange = (vol: number) => {
    onUpdateSettings({ ...settings, soundVolume: vol });
  };

  const handleFovChange = (fov: number) => {
    onUpdateSettings({ ...settings, fov });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none overflow-y-auto">
      {/* Top Header & Outpost Classification */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 border border-zinc-800 rounded text-xs font-mono-tactical text-zinc-400">
          <Radio className="w-3.5 h-3.5 text-red-500" />
          <span className="text-zinc-500">SECTOR:</span>
          <span className="text-zinc-200 font-semibold">GRID-DELTA // OUTPOST Z</span>
          <span className="ml-2 text-[10px] px-1.5 py-0.2 bg-red-950/80 text-red-400 border border-red-800/60 rounded">
            LEVEL 5 INFESTATION
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Persistent Coin Bank Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/70 border border-amber-500/70 rounded text-xs font-mono-tactical text-amber-300 font-bold shadow-md">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>BANK: {persistentCoins} COINS</span>
          </div>

          {/* Quick Audio Mute Toggle on Top-Right */}
          <button
            onClick={handleAudioToggle}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 border border-zinc-800 rounded text-xs font-mono-tactical text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-500" />
            )}
            <span>{settings.soundEnabled ? 'AUDIO: ON' : 'AUDIO: MUTED'}</span>
          </button>
        </div>
      </div>

      {/* Center Hero Title & Primary Action */}
      <div className="my-auto max-w-xl flex flex-col items-start gap-4 pointer-events-auto">
        {/* Military Sub-Tag */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-amber-500 rounded-xs" />
          <span className="text-xs uppercase tracking-[0.25em] font-mono-tactical text-amber-500 font-bold">
            STAGE 1 // FOUNDATIONAL DEPLOYMENT
          </span>
        </div>

        {/* Main Title */}
        <h1 className="font-display-tactical text-5xl sm:text-7xl font-black tracking-tight text-white leading-none drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
          OUTPOST Z:
          <span className="block text-amber-400">LAST STAND</span>
        </h1>

        <p className="text-zinc-300 text-sm sm:text-base font-medium max-w-md border-l-2 border-amber-500/80 pl-3 leading-relaxed">
          Tactical First-Person Zombie Wave Defense. Hold the line at the abandoned dusk compound.
          Manage munitions, brace barricades, and survive the infected swarm.
        </p>

        {/* Deployment Wave Select / Checkpoint Selector */}
        <div className="w-full bg-zinc-950/90 border border-zinc-800/90 rounded-xl p-3.5 sm:p-4 shadow-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs font-mono-tactical">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>DEPLOYMENT WAVE SELECT // CHECKPOINT</span>
            </div>
            <span className="text-zinc-500 font-semibold">HIGHEST UNLOCKED: WAVE {highestUnlockedWave}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {Array.from({ length: Math.max(1, highestUnlockedWave) }).map((_, i) => {
              const w = i + 1;
              const isSelected = w === selectedStartWave;
              return (
                <button
                  key={w}
                  onClick={() => {
                    soundManager.playUIClick();
                    onSelectStartWave?.(w);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-mono-tactical font-black tracking-wider transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.6)] ring-2 ring-amber-300 scale-105'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 hover:border-zinc-500'
                  }`}
                >
                  WAVE {w}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-mono-tactical text-zinc-400 flex items-center gap-1.5">
            <span className="text-amber-400 font-semibold">SELECTED:</span>
            <span>
              {selectedStartWave === 1
                ? 'Wave 1 (Standard Deployment: 6 Walkers breach perimeter)'
                : selectedStartWave === 2
                ? 'Wave 2 (Reinforced Assault: 9 Walkers)'
                : selectedStartWave === 3
                ? 'Wave 3 (Escalation: Walkers & fast Runner mutants)'
                : selectedStartWave === 5
                ? 'Wave 5 (Heavy Boss: Brute Zombie joins horde)'
                : `Wave ${selectedStartWave} (High-Threat Scaling Incursion)`}
            </span>
          </div>
        </div>

        {/* Main Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 w-full sm:w-auto">
          <button
            onClick={async () => {
              await soundManager.ensureAudioContext();
              onPlayClickSound();
              onDeploy(selectedStartWave);
            }}
            className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display-tactical font-black text-lg tracking-wider rounded transition-all duration-150 hover:shadow-[0_0_25px_rgba(245,158,11,0.6)] active:scale-98 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current transition-transform group-hover:scale-110" />
            <span>DEPLOY TO WAVE {selectedStartWave}</span>
          </button>

          <button
            onClick={() => {
              onPlayClickSound();
              setShowBriefing(true);
            }}
            className="flex items-center justify-center gap-2 px-5 py-4 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-zinc-200 font-mono-tactical text-sm tracking-wide rounded transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>BRIEFING & INTEL</span>
          </button>

          <button
            onClick={() => {
              onPlayClickSound();
              setShowCredits(true);
            }}
            className="flex items-center justify-center gap-2 px-5 py-4 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-amber-400 font-mono-tactical text-sm tracking-wide rounded transition-all cursor-pointer"
            title="Operative Dossier & Credits"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>CREDITS & DOSSIER</span>
          </button>

          <button
            onClick={() => {
              onPlayClickSound();
              setShowSettings(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-4 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-zinc-200 font-mono-tactical text-sm tracking-wide rounded transition-all cursor-pointer"
            title="Tactical Settings"
          >
            <SettingsIcon className="w-4 h-4 text-zinc-400" />
            <span className="sm:hidden">SETTINGS</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Service Record Intel Panel & Tactical Version Badge */}
      <div className="flex flex-col sm:flex-row justify-between items-end gap-4 pointer-events-auto pt-6 border-t border-zinc-800/80">
        {/* Service Record Panel */}
        <div className="flex flex-wrap items-center gap-3 bg-zinc-950/85 border border-zinc-800 px-4 py-3 rounded-lg shadow-xl">
          <div className="flex items-center gap-2 pr-3 border-r border-zinc-800">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-wider font-mono-tactical text-amber-400 font-bold">
              CAREER DOSSIER
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono-tactical">
            <div>
              <span className="text-zinc-500 mr-1.5">HIGH SCORE:</span>
              <span className="text-white font-bold">{serviceRecord.highScore.toLocaleString()}</span>
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <div>
              <span className="text-zinc-500 mr-1.5">HIGHEST WAVE:</span>
              <span className="text-amber-400 font-bold">WAVE {serviceRecord.highestWave}</span>
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <div>
              <span className="text-zinc-500 mr-1.5">LIFETIME KILLS:</span>
              <span className="text-red-400 font-bold">{serviceRecord.totalKills.toLocaleString()}</span>
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <div>
              <span className="text-zinc-500 mr-1.5">HEADSHOTS:</span>
              <span className="text-amber-300 font-bold">{(serviceRecord.totalHeadshots || 0).toLocaleString()}</span>
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <div>
              <span className="text-zinc-500 mr-1.5">MISSIONS:</span>
              <span className="text-zinc-300 font-bold">{serviceRecord.missionsDeployed}</span>
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <div className="flex items-center gap-1 text-amber-400 font-bold">
              <Coins className="w-3.5 h-3.5" />
              <span>{persistentCoins.toLocaleString()} COINS</span>
            </div>
          </div>
        </div>

        {/* Tactical Readiness Badge & Version Stamp */}
        <div className="text-[11px] font-mono-tactical text-zinc-500 text-right space-y-0.5">
          <div className="px-2 py-0.5 bg-amber-950/40 border border-amber-600/30 rounded text-amber-400 font-bold tracking-wide">
            OUTPOST Z: LAST STAND — v1.0.0 RELEASE | OPERATIVE SYSTEMS ACTIVE
          </div>
          <div className="text-zinc-400 text-[10px]">ENGINE: THREE.JS WEBGL RENDERER // WEB AUDIO PROCEDURAL SYNTH</div>
        </div>
      </div>

      {/* MODAL 1: Briefing & Controls */}
      {showBriefing && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              soundManager.playUIClick();
              setShowBriefing(false);
            }
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto"
          style={{ touchAction: 'pan-y' }}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative flex flex-col max-h-[min(90vh,750px)] pointer-events-auto"
            style={{ touchAction: 'pan-y' }}
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-display-tactical text-xl font-bold text-white tracking-wide">
                  OPERATIONAL BRIEFING & CONTROLS
                </h3>
              </div>
              <button
                onClick={() => {
                  soundManager.playUIClick();
                  setShowBriefing(false);
                }}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close briefing"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className="tactical-modal-scroll mt-4 space-y-4 text-sm text-zinc-300 font-sans flex-1 min-h-0 pr-2 select-text"
              style={{
                maxHeight: 'min(80vh, 650px)',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                touchAction: 'pan-y',
                pointerEvents: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div className="bg-zinc-900/60 p-3.5 rounded border border-zinc-800/80">
                <h4 className="font-mono-tactical text-xs text-amber-400 uppercase tracking-wider font-semibold mb-1">
                  // Mission Directive: Outpost Perimeter Defense
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed font-mono-tactical">
                  You are stationed at Sector Delta, an abandoned forward operating base.
                  At dusk, infected hostiles will breach perimeter fences in waves.
                  Conserve your ammunition, execute headshots, and hold ground.
                </p>
              </div>

              <div>
                <h4 className="font-mono-tactical text-xs text-zinc-400 uppercase tracking-wider font-bold mb-2">
                  Tactical Keybinds:
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono-tactical">
                  <div className="flex items-center justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-400">Mouse Move</span>
                    <span className="text-amber-400 font-semibold">Pitch & Yaw Look</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-400">W / A / S / D</span>
                    <span className="text-amber-400 font-semibold">Courtyard Movement</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-400">Left Shift</span>
                    <span className="text-amber-400 font-semibold">Tactical Sprint (9.5 m/s)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-400">Left Mouse Button</span>
                    <span className="text-amber-400 font-semibold">Fire M9 Pistol</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-400">R Key</span>
                    <span className="text-amber-400 font-semibold">Reload Magazine</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                    <span className="text-zinc-400">ESC / P Key</span>
                    <span className="text-amber-400 font-semibold">Pause Simulation</span>
                  </div>
                </div>

                <div className="mt-2.5 bg-emerald-950/40 p-2.5 rounded border border-emerald-800/60">
                  <h5 className="font-mono-tactical text-[11px] text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
                    <span>📱 MOBILE TOUCH CONTROLS SUPPORTED:</span>
                  </h5>
                  <p className="text-[11px] text-zinc-300 font-mono-tactical leading-relaxed">
                    Touch Left Screen for Virtual Movement Thumbstick. Drag Right Screen to Aim Reticle. Tap dedicated touch buttons for FIRE, RELOAD, AIRBURST [G], WEAPON SWAP [1][2][3], and PAUSE.
                  </p>
                </div>
              </div>

              <div className="text-xs text-zinc-500 font-mono-tactical pt-1">
                STAGE 3: Tactical pistol combat system, 3D center raycasting hit detection, glowing bullet tracers,
                muzzle flashes, surface impact sparks, practice target dummies with wobble physics, and dynamic hit markers.
              </div>
            </div>

            <div className="mt-6 flex justify-end shrink-0">
              <button
                onClick={() => {
                  soundManager.playUIClick();
                  setShowBriefing(false);
                }}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-mono-tactical text-xs rounded transition-colors cursor-pointer active:scale-95"
              >
                ACKNOWLEDGE & CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Tactical Settings */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />

      {/* MODAL 3: Operative Dossier & Credits */}
      <CreditsModal
        isOpen={showCredits}
        onClose={() => setShowCredits(false)}
      />
    </div>
  );
};
