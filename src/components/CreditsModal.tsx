/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { soundManager } from '../utils/audio';
import {
  X,
  Award,
  Terminal,
  Shield,
  Radio,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundManager.playUIClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto select-none"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative flex flex-col max-h-[min(90vh,750px)] pointer-events-auto"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-display-tactical text-xl font-black text-white tracking-wide">
                OPERATIVE DOSSIER & CREDITS
              </h3>
              <p className="text-[10px] font-mono-tactical text-amber-500/80 uppercase tracking-widest">
                OUTPOST Z: LAST STAND // v1.0.0 RELEASE
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playUIClick();
              onClose();
            }}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close Credits"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Dossier Content */}
        <div
          className="tactical-modal-scroll mt-4 space-y-4 text-xs font-mono-tactical text-zinc-300 flex-1 min-h-0 pr-2 select-text"
          style={{
            maxHeight: 'min(78vh, 600px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            pointerEvents: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Release Classification Banner */}
          <div className="bg-zinc-900/80 border border-amber-500/40 rounded-lg p-3.5 flex items-start gap-3">
            <Terminal className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white uppercase text-xs">
                  MISSION CLASSIFICATION: GOLD MASTER
                </span>
                <span className="px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/60 rounded text-[9px] text-emerald-300 font-bold">
                  v1.0.0 READY
                </span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Outpost Z is a high-performance tactical first-person zombie defense simulation built with modern web technologies, zero asset lag, and procedural acoustics.
              </p>
            </div>
          </div>

          {/* Core Systems Architecture */}
          <div className="space-y-2">
            <h4 className="text-zinc-400 uppercase tracking-wider font-bold text-[11px] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>CORE ARCHITECTURAL SYSTEMS</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-zinc-900/60 border border-zinc-800 p-2.5 rounded">
                <div className="text-amber-400 font-bold text-[11px] mb-1">3D Combat & Raycasting</div>
                <div className="text-zinc-400 text-[10px] leading-relaxed">
                  Three.js WebGL rendering pipeline with center-screen hitscan raycasting, dynamic muzzle velocity, procedural bullet trails, and surface impact sparks.
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 p-2.5 rounded">
                <div className="text-amber-400 font-bold text-[11px] mb-1">Realistic Weapon Models</div>
                <div className="text-zinc-400 text-[10px] leading-relaxed">
                  6 distinctive firearm viewmodels featuring Picatinny rails, mechanical cycling slides, tritium iron sights, and physical brass shell ejection physics.
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 p-2.5 rounded">
                <div className="text-amber-400 font-bold text-[11px] mb-1">Procedural Audio Engine</div>
                <div className="text-zinc-400 text-[10px] leading-relaxed">
                  Native Web Audio API synthesizer generating dynamic gunfire, reload clicks, zombie groans, and muffled low-pass filters with zero latency.
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 p-2.5 rounded">
                <div className="text-amber-400 font-bold text-[11px] mb-1">Dual Input Layer</div>
                <div className="text-zinc-400 text-[10px] leading-relaxed">
                  First-class desktop PointerLock controls alongside dual-touch virtual mobile joysticks with persistent modes and 90°/180° tactical flank snap turns.
                </div>
              </div>
            </div>
          </div>

          {/* Defense Arsenal Overview */}
          <div className="space-y-2">
            <h4 className="text-zinc-400 uppercase tracking-wider font-bold text-[11px] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>DEFENSIVE SYSTEMS & ARMORY ARSENAL</span>
            </h4>
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-3 rounded space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-white font-semibold">Firearms Available:</span>
                <span className="text-amber-400">M9 Pistol • Shotgun • MP5-SD • M4A1 • .50 BMG • Minigun</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-white font-semibold">Tactical Ordnance:</span>
                <span className="text-emerald-400">Proximity Claymores • Sat-Link Airburst Strike</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-white font-semibold">Operative Life Support:</span>
                <span className="text-sky-400">Nano-Armor • Surgical Medkit • Emergency Auto-Stim Revive</span>
              </div>
            </div>
          </div>

          {/* Production Certification & Safeguards */}
          <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px]">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>DEPLOYMENT READINESS CERTIFICATION</span>
            </div>
            <ul className="text-zinc-300 text-[10px] space-y-1 list-disc list-inside">
              <li>Protected local storage persistence (coins, unlocked checkpoints, carrier records).</li>
              <li>Safe autoplay browser audio context resumption on first user gesture.</li>
              <li>Immersive HUD with clean developer console safeguards (F1 toggle).</li>
              <li>100% offline capable single-page progressive architecture.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="text-[10px] font-mono-tactical text-zinc-500">
            BUILD: 2026.10-STAGE10-RELEASE
          </div>
          <button
            onClick={() => {
              soundManager.playUIClick();
              onClose();
            }}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono-tactical font-bold text-xs uppercase rounded transition-colors cursor-pointer active:scale-95"
          >
            DISMISS DOSSIER
          </button>
        </div>
      </div>
    </div>
  );
};
