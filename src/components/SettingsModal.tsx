/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameSettings, CrosshairColor } from '../types/gameTypes';
import { CROSSHAIR_COLORS } from '../config/gameConfig';
import { soundManager } from '../utils/audio';
import {
  X,
  Volume2,
  VolumeX,
  Wind,
  Sliders,
  Eye,
  Crosshair,
  Zap,
  Check,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (settings: GameSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundManager.playUIClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col max-h-[min(90vh,750px)] pointer-events-auto"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="font-display-tactical text-xl font-bold text-white tracking-wide">
              OPERATIVE TACTICAL CONFIGURATION
            </h3>
          </div>
          <button
            onClick={() => {
              soundManager.playUIClick();
              onClose();
            }}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body with Scroll */}
        <div
          className="tactical-modal-scroll mt-4 space-y-5 text-xs font-mono-tactical flex-1 min-h-0 pr-2 select-text"
          style={{
            maxHeight: 'min(80vh, 650px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            pointerEvents: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* SECTION 1: AUDIO & SOUNDSCAPE */}
          <div className="space-y-3 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
              <Volume2 className="w-3.5 h-3.5" />
              <span>AUDIO & ATMOSPHERIC SOUNDSCAPES</span>
            </div>

            {/* Master Sound Toggle */}
            <div className="flex justify-between items-center">
              <span className="text-zinc-300">Master Sound FX:</span>
              <button
                onClick={() => {
                  soundManager.playUIClick();
                  onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled });
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-bold transition-all cursor-pointer ${
                  settings.soundEnabled
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                }`}
              >
                {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>{settings.soundEnabled ? 'ENABLED' : 'MUTED'}</span>
              </button>
            </div>

            {/* Master Volume */}
            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span>Master Volume:</span>
                <span className="text-white font-bold">{Math.round(settings.soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.soundVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, soundVolume: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-500 bg-zinc-800 h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Dusk Ambience Volume */}
            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3 text-cyan-400" />
                  Dusk Wind & Ambience:
                </span>
                <span className="text-cyan-400 font-bold">{Math.round(settings.ambienceVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.ambienceVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  soundManager.setAmbienceVolume(val);
                  onUpdateSettings({ ...settings, ambienceVolume: val });
                }}
                className="w-full accent-cyan-500 bg-zinc-800 h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Test Audio Button */}
            <div className="pt-1 flex justify-end">
              <button
                onClick={async () => {
                  await soundManager.ensureAudioContext();
                  await soundManager.playGunshot();
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-emerald-600/60 rounded text-xs font-mono-tactical text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Test Weapon Audio</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: GRAPHICS & PERFORMANCE */}
          <div className="space-y-3 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
              <Zap className="w-3.5 h-3.5" />
              <span>GRAPHICS & PERFORMANCE</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-300">Visual Quality Preset:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    soundManager.playUIClick();
                    onUpdateSettings({ ...settings, visualQuality: 'standard' });
                  }}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    settings.visualQuality === 'standard'
                      ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  STANDARD
                </button>
                <button
                  onClick={() => {
                    soundManager.playUIClick();
                    onUpdateSettings({ ...settings, visualQuality: 'optimized' });
                  }}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    settings.visualQuality === 'optimized'
                      ? 'bg-emerald-500 text-zinc-950 shadow-md font-black'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  OPTIMIZED (HIGH FPS)
                </button>
              </div>
            </div>

            <div className="text-[10px] text-zinc-500">
              {settings.visualQuality === 'optimized'
                ? 'Optimized mode reduces particle counts and dynamic light loads for rock-solid 60 FPS performance.'
                : 'Standard mode delivers rich volumetric light beams, full ember density, and visceral blood splatter.'}
            </div>
          </div>

          {/* SECTION 3: CONTROLS & CAMERA */}
          <div className="space-y-3 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
              <Eye className="w-3.5 h-3.5" />
              <span>CONTROLS & CAMERA DYNAMICS</span>
            </div>

            {/* Mobile Touch Controls Mode */}
            <div className="flex flex-col gap-1.5 border-b border-zinc-800 pb-2.5">
              <div className="flex justify-between items-center">
                <span className="text-zinc-300">Mobile Touch Controls:</span>
                <div className="flex gap-1 bg-zinc-950 p-1 rounded border border-zinc-800">
                  {(['AUTO', 'ON', 'OFF'] as const).map((mode) => {
                    const isSelected = (settings.mobileTouchControls || 'AUTO') === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          soundManager.playUIClick();
                          onUpdateSettings({ ...settings, mobileTouchControls: mode });
                        }}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-zinc-950 shadow-sm'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>
              <span className="text-[10px] text-zinc-500">
                AUTO detects mobile screens. ON force-enables touch overlay; OFF hides it.
              </span>
            </div>

            {/* Touch Look Sensitivity */}
            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span>Touch Drag Look Sensitivity:</span>
                <span className="text-amber-400 font-bold">
                  {(settings.touchLookSensitivity || 1.0).toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="3.0"
                step="0.1"
                value={settings.touchLookSensitivity || 1.0}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, touchLookSensitivity: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-500 bg-zinc-800 h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Mouse Sensitivity */}
            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span>Desktop Mouse Sensitivity:</span>
                <span className="text-amber-400 font-bold">
                  {(settings.mouseSensitivity || 1.0).toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.3"
                max="3.0"
                step="0.1"
                value={settings.mouseSensitivity || 1.0}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, mouseSensitivity: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-500 bg-zinc-800 h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Field of View (FOV) */}
            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span>Field of View (FOV):</span>
                <span className="text-white font-bold">{settings.fov}°</span>
              </div>
              <input
                type="range"
                min="65"
                max="95"
                step="1"
                value={settings.fov}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, fov: parseInt(e.target.value, 10) })
                }
                className="w-full accent-amber-500 bg-zinc-800 h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Camera Sway */}
            <div className="flex justify-between items-center">
              <span className="text-zinc-300">Kinematic Camera Sway:</span>
              <button
                onClick={() => {
                  soundManager.playUIClick();
                  onUpdateSettings({ ...settings, cameraSway: !settings.cameraSway });
                }}
                className={`px-3 py-1 rounded border text-xs font-bold transition-all cursor-pointer ${
                  settings.cameraSway
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                }`}
              >
                {settings.cameraSway ? 'ENABLED' : 'OFF'}
              </button>
            </div>
          </div>

          {/* SECTION 4: TACTICAL RETICLE */}
          <div className="space-y-3 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
              <Crosshair className="w-3.5 h-3.5" />
              <span>RETICLE & CROSSHAIR CUSTOMIZATION</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CROSSHAIR_COLORS) as CrosshairColor[]).map((key) => {
                const isSelected = settings.crosshairColor === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      soundManager.playUIClick();
                      onUpdateSettings({ ...settings, crosshairColor: key });
                    }}
                    className={`p-2 rounded border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-zinc-900 text-white shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                        : 'border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shadow-xs"
                        style={{ backgroundColor: CROSSHAIR_COLORS[key].hex }}
                      />
                      <span className="text-xs">{CROSSHAIR_COLORS[key].label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-end shrink-0">
          <button
            onClick={() => {
              soundManager.playUIClick();
              onClose();
            }}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display-tactical font-black text-xs tracking-wider rounded transition-all cursor-pointer shadow-md active:scale-95"
          >
            CONFIRM & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
