/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameSettings } from '../types/gameTypes';
import { SettingsModal } from './SettingsModal';
import { CreditsModal } from './CreditsModal';
import {
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  LogOut,
  Award,
  Terminal,
} from 'lucide-react';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
  settings: GameSettings;
  onUpdateSettings: (settings: GameSettings) => void;
  onPlayClickSound: () => void;
  showDebugConsole?: boolean;
  onToggleDebugConsole?: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onRestart,
  onReturnToMenu,
  settings,
  onUpdateSettings,
  onPlayClickSound,
  showDebugConsole = false,
  onToggleDebugConsole,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  return (
    <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-zinc-950/95 border border-zinc-800 rounded-xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Status Tag */}
        <div className="flex items-center gap-2 mb-2 px-2.5 py-0.5 bg-amber-950/60 border border-amber-800/60 rounded text-[10px] font-mono-tactical text-amber-400 font-bold uppercase tracking-widest">
          <span>// TACTICAL STANDBY //</span>
        </div>

        <h2 className="font-display-tactical text-3xl font-black tracking-wider text-white mb-6">
          OUTPOST PAUSED
        </h2>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5">
          {/* Resume */}
          <button
            onClick={() => {
              onPlayClickSound();
              onResume();
            }}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display-tactical font-black text-sm tracking-wider rounded transition-all active:scale-98 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>RESUME MISSION [ESC]</span>
          </button>

          {/* Restart Wave / Run */}
          <button
            onClick={() => {
              onPlayClickSound();
              onRestart();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-zinc-200 font-mono-tactical text-xs tracking-wider rounded transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>RESTART OUTPOST</span>
          </button>

          {/* Tactical Settings */}
          <button
            onClick={() => {
              onPlayClickSound();
              setShowSettings(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-zinc-200 font-mono-tactical text-xs tracking-wider rounded transition-colors cursor-pointer"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span>TACTICAL SETTINGS</span>
          </button>

          {/* Operative Credits & Intel */}
          <button
            onClick={() => {
              onPlayClickSound();
              setShowCredits(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-amber-400 font-mono-tactical text-xs tracking-wider rounded transition-colors cursor-pointer"
          >
            <Award className="w-3.5 h-3.5" />
            <span>CREDITS & INTEL</span>
          </button>

          {/* Developer Test Console Discreet Toggle */}
          {onToggleDebugConsole && (
            <button
              onClick={() => {
                onPlayClickSound();
                onToggleDebugConsole();
              }}
              className="w-full flex items-center justify-between py-2 px-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 font-mono-tactical text-[11px] rounded transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-zinc-500" />
                <span>DEV TEST CONSOLE [F1]</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${showDebugConsole ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-zinc-900 text-zinc-500'}`}>
                {showDebugConsole ? 'ACTIVE' : 'OFF'}
              </span>
            </button>
          )}

          {/* Abort / Return to Main Menu */}
          <button
            onClick={() => {
              onPlayClickSound();
              onReturnToMenu();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-950 hover:bg-red-950/50 border border-zinc-800 hover:border-red-800 text-zinc-400 hover:text-red-300 font-mono-tactical text-xs tracking-wider rounded transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ABORT TO MAIN MENU</span>
          </button>
        </div>

        <div className="mt-5 text-[10px] font-mono-tactical text-zinc-500">
          PRESS [ESC] OR [P] TO RESUME
        </div>

        <div className="mt-2 text-[9px] font-mono-tactical text-zinc-600 uppercase tracking-widest">
          OUTPOST Z: LAST STAND — v1.0.0 RELEASE
        </div>
      </div>

      {/* Settings Modal within Pause */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />

      {/* Credits Modal within Pause */}
      <CreditsModal
        isOpen={showCredits}
        onClose={() => setShowCredits(false)}
      />
    </div>
  );
};

