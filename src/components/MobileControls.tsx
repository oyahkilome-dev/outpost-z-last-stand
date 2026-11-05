/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { WeaponId, UnlockedWeapons } from '../types/gameTypes';
import { soundManager } from '../utils/audio';
import { RotateCcw, Zap, Pause, Crosshair, Lock, Undo2, Redo2, Bomb } from 'lucide-react';

interface MobileControlsProps {
  onFireStart: () => void;
  onFireEnd: () => void;
  onReload: () => void;
  onAirburst: () => void;
  onSwitchWeapon: (id: WeaponId) => void;
  onPause: () => void;
  onTouchMove: (forward: number, right: number, sprint?: boolean) => void;
  onTouchLook: (deltaX: number, deltaY: number) => void;
  onQuickTurn?: () => void;
  onSnapTurn?: (angleInRadians: number) => void;
  onPlantClaymore?: () => void;
  claymores?: number;
  equippedWeapon: WeaponId;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  airburstCharges: number;
  unlockedWeapons: UnlockedWeapons;
  isDying?: boolean;
  isModalOpen?: boolean;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onFireStart,
  onFireEnd,
  onReload,
  onAirburst,
  onSwitchWeapon,
  onPause,
  onTouchMove,
  onTouchLook,
  onQuickTurn,
  onSnapTurn,
  onPlantClaymore,
  claymores = 0,
  equippedWeapon,
  ammo,
  maxAmmo,
  isReloading,
  airburstCharges,
  unlockedWeapons,
  isDying = false,
  isModalOpen = false,
}) => {
  // Static Virtual Joystick Constants
  const JOYSTICK_MAX_RADIUS = 48; // Max displacement in pixels

  // Joystick DOM & Tracking
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [joystickKnob, setJoystickKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);
  const [isSprintActive, setIsSprintActive] = useState(false);

  // Multi-Touch Identifier Tracking
  const moveTouchIdRef = useRef<number | null>(null);
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number } | null>(null);

  // Desktop Mouse Fallback Tracking (for testing mobile controls via mouse on desktop)
  const isMouseDraggingJoystickRef = useRef(false);
  const isMouseDraggingLookRef = useRef(false);
  const lastMouseLookPosRef = useRef<{ x: number; y: number } | null>(null);

  // Trigger button state
  const [isFiring, setIsFiring] = useState(false);

  // Helper to calculate offset from joystick base center and dispatch onTouchMove
  const updateJoystickMovement = useCallback(
    (clientX: number, clientY: number) => {
      const baseEl = joystickBaseRef.current;
      if (!baseEl) return;

      const rect = baseEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      let clampedX = dx;
      let clampedY = dy;
      if (dist > JOYSTICK_MAX_RADIUS) {
        clampedX = (dx / dist) * JOYSTICK_MAX_RADIUS;
        clampedY = (dy / dist) * JOYSTICK_MAX_RADIUS;
      }

      setJoystickKnob({ x: clampedX, y: clampedY });

      // Normalized coordinates: forward is negative Y on screen, right is positive X
      const forward = -clampedY / JOYSTICK_MAX_RADIUS;
      const right = clampedX / JOYSTICK_MAX_RADIUS;
      const isSprint = dist > JOYSTICK_MAX_RADIUS * 0.82;

      setIsSprintActive(isSprint);
      onTouchMove(forward, right, isSprint);
    },
    [onTouchMove]
  );

  // Reset joystick knob to center and stop movement
  const resetJoystick = useCallback(() => {
    moveTouchIdRef.current = null;
    isMouseDraggingJoystickRef.current = false;
    setIsDraggingJoystick(false);
    setIsSprintActive(false);
    setJoystickKnob({ x: 0, y: 0 });
    onTouchMove(0, 0, false);
  }, [onTouchMove]);

  // Reset look drag
  const resetLook = useCallback(() => {
    lookTouchIdRef.current = null;
    lastLookPosRef.current = null;
    isMouseDraggingLookRef.current = false;
    lastMouseLookPosRef.current = null;
  }, []);

  // ==========================================
  // NATIVE MULTI-TOUCH HANDLERS (Independent Touch IDs)
  // ==========================================

  // Left Side / Joystick Touch Start
  const handleLeftTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDying) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (moveTouchIdRef.current === null) {
        moveTouchIdRef.current = touch.identifier;
        setIsDraggingJoystick(true);
        updateJoystickMovement(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  // Right Side / Aim Look Touch Start
  const handleRightTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDying) return;

    // Ignore touches that land inside tactical action buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (lookTouchIdRef.current === null) {
        lookTouchIdRef.current = touch.identifier;
        lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
        break;
      }
    }
  };

  // Window-level native Touch Move and End to avoid losing touches across containers
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      // 1. Process movement touch (Touch ID 1)
      if (moveTouchIdRef.current !== null) {
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          if (touch.identifier === moveTouchIdRef.current) {
            updateJoystickMovement(touch.clientX, touch.clientY);
            break;
          }
        }
      }

      // 2. Process look/aim touch (Touch ID 2)
      if (lookTouchIdRef.current !== null && lastLookPosRef.current) {
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          if (touch.identifier === lookTouchIdRef.current) {
            const deltaX = touch.clientX - lastLookPosRef.current.x;
            const deltaY = touch.clientY - lastLookPosRef.current.y;
            lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };

            // Prevent unnatural jumps if fingers wrap
            if (Math.abs(deltaX) < 180 && Math.abs(deltaY) < 180) {
              onTouchLook(deltaX, deltaY);
            }
            break;
          }
        }
      }
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      // Check if movement touch ended
      if (moveTouchIdRef.current !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === moveTouchIdRef.current) {
            resetJoystick();
            break;
          }
        }
      }

      // Check if look touch ended
      if (lookTouchIdRef.current !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
            lookTouchIdRef.current = null;
            lastLookPosRef.current = null;
            break;
          }
        }
      }
    };

    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    window.addEventListener('touchend', handleGlobalTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleGlobalTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [updateJoystickMovement, resetJoystick, onTouchLook]);

  // ==========================================
  // DESKTOP MOUSE HANDLERS (for preview testing)
  // ==========================================

  const handleJoystickMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDying) return;
    e.preventDefault();
    e.stopPropagation();
    isMouseDraggingJoystickRef.current = true;
    setIsDraggingJoystick(true);
    updateJoystickMovement(e.clientX, e.clientY);
  };

  const handleLeftZoneMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDying) return;
    if (joystickBaseRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
    e.stopPropagation();
    isMouseDraggingJoystickRef.current = true;
    setIsDraggingJoystick(true);
    updateJoystickMovement(e.clientX, e.clientY);
  };

  const handleRightZoneMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDying) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    e.preventDefault();
    isMouseDraggingLookRef.current = true;
    lastMouseLookPosRef.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isMouseDraggingJoystickRef.current) {
        updateJoystickMovement(e.clientX, e.clientY);
      }
      if (isMouseDraggingLookRef.current && lastMouseLookPosRef.current) {
        const deltaX = e.clientX - lastMouseLookPosRef.current.x;
        const deltaY = e.clientY - lastMouseLookPosRef.current.y;
        lastMouseLookPosRef.current = { x: e.clientX, y: e.clientY };
        if (Math.abs(deltaX) < 180 && Math.abs(deltaY) < 180) {
          onTouchLook(deltaX, deltaY);
        }
      }
    };

    const handleMouseUp = () => {
      if (isMouseDraggingJoystickRef.current) {
        resetJoystick();
      }
      if (isMouseDraggingLookRef.current) {
        isMouseDraggingLookRef.current = false;
        lastMouseLookPosRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateJoystickMovement, resetJoystick, onTouchLook]);

  // Clean trigger release if operative dies or modal opens
  useEffect(() => {
    if (isDying || isModalOpen) {
      if (isFiring) {
        setIsFiring(false);
        onFireEnd();
      }
      resetJoystick();
      resetLook();
    }
  }, [isDying, isModalOpen, isFiring, onFireEnd, resetJoystick, resetLook]);

  if (isModalOpen) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none z-30 overflow-hidden"
      style={{
        display: isModalOpen ? 'none' : 'block',
        pointerEvents: isModalOpen ? 'none' : 'auto',
        touchAction: 'none',
      }}
    >
      {/* 1. Left Half Zone: Captures touch/mouse movement inputs */}
      <div
        onTouchStart={handleLeftTouchStart}
        onMouseDown={handleLeftZoneMouseDown}
        className="absolute left-0 top-0 w-1/2 h-full pointer-events-auto"
        style={{ touchAction: 'none' }}
      />

      {/* 2. Permanent Static Virtual Movement Joystick Base (Bottom-Left: 35px, 35px) */}
      <div
        ref={joystickBaseRef}
        onTouchStart={handleLeftTouchStart}
        onMouseDown={handleJoystickMouseDown}
        className="fixed bottom-[35px] left-[35px] w-[130px] h-[130px] rounded-full pointer-events-auto z-40 select-none flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow duration-150"
        style={{
          border: '2px solid rgba(255, 170, 0, 0.45)',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          touchAction: 'none',
          boxShadow: isDraggingJoystick
            ? '0 0 25px rgba(245, 158, 11, 0.5)'
            : '0 0 15px rgba(245, 158, 11, 0.18)',
        }}
        title="Movement Joystick (Click & drag with mouse or thumb)"
      >
        {/* Subtle Cardinal Directional Indicators */}
        <span className="absolute top-1 text-[9px] font-mono-tactical font-black text-amber-400/60 pointer-events-none select-none">
          ▲ W
        </span>
        <span className="absolute bottom-1 text-[9px] font-mono-tactical font-black text-amber-400/60 pointer-events-none select-none">
          ▼ S
        </span>
        <span className="absolute left-1.5 text-[9px] font-mono-tactical font-black text-amber-400/60 pointer-events-none select-none">
          ◄ A
        </span>
        <span className="absolute right-1.5 text-[9px] font-mono-tactical font-black text-amber-400/60 pointer-events-none select-none">
          D ►
        </span>

        {/* Dotted Inner Ring indicating sprint threshold */}
        <div className="absolute w-[82px] h-[82px] rounded-full border border-dashed border-amber-500/30 pointer-events-none" />

        {/* Draggable Central Thumb Knob (~55px, #f59e0b) */}
        <div
          className="w-[55px] h-[55px] rounded-full flex flex-col items-center justify-center select-none shadow-[0_0_15px_rgba(245,158,11,0.6)] transition-transform duration-75"
          style={{
            backgroundColor: '#f59e0b',
            border: '2px solid rgba(254, 240, 138, 0.9)',
            transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)`,
            touchAction: 'none',
          }}
        >
          {/* Knob Inner Precision Ring & Dot */}
          <div className="w-5 h-5 rounded-full bg-amber-600/70 border border-amber-200/50 flex items-center justify-center shadow-inner">
            <div className="w-2 h-2 rounded-full bg-white shadow-xs" />
          </div>
          {isSprintActive && (
            <span className="text-[8px] font-mono-tactical font-black text-zinc-950 uppercase tracking-tighter -mt-0.5">
              RUN
            </span>
          )}
        </div>
      </div>

      {/* 3. Right Half Zone: Multi-Touch Drag Look & Aiming */}
      <div
        onTouchStart={handleRightTouchStart}
        onMouseDown={handleRightZoneMouseDown}
        className="absolute right-0 top-0 w-1/2 h-full pointer-events-auto"
        style={{ touchAction: 'none' }}
      >
        {/* Subtle Aim Hint */}
        <div className="absolute bottom-4 left-6 pointer-events-none opacity-30 select-none">
          <span className="font-mono-tactical text-[9px] text-zinc-400 uppercase tracking-widest">
            Drag to Aim
          </span>
        </div>
      </div>

      {/* 4. Top-Right Tactical Pause Button */}
      <div className="absolute top-3 right-3 pointer-events-auto z-40">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            soundManager.playUIClick();
            onPause();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            soundManager.playUIClick();
            onPause();
          }}
          className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-700 text-zinc-300 hover:text-amber-400 active:scale-95 shadow-lg flex items-center justify-center cursor-pointer"
          style={{ touchAction: 'manipulation' }}
          title="Pause Tactical Simulation"
        >
          <Pause className="w-5 h-5" />
        </button>
      </div>

      {/* 5. Right Side Tactical Action Cluster */}
      <div
        className="absolute bottom-6 right-5 flex flex-col items-end gap-3 pointer-events-none z-40"
        style={{ touchAction: 'none' }}
      >
        {/* Row A: Secondary Tactical Actions (Weapon Dock, Claymores, Airburst & Reload) */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto flex-wrap justify-end">
          {/* Quick Weapon Dock Selector for Mobile (All 6 Weapons) */}
          <div className="flex items-center gap-1 bg-zinc-950/95 border border-zinc-800 p-1 rounded-lg shadow-xl overflow-x-auto max-w-[270px] sm:max-w-none">
            {(['PISTOL', 'SHOTGUN', 'SMG', 'RIFLE', 'LMG', 'SNIPER'] as WeaponId[]).map((wId, idx) => {
              const isUnlocked = unlockedWeapons[wId];
              const isEquipped = equippedWeapon === wId;
              const slotNum = idx + 1;
              const shortName =
                wId === 'PISTOL'
                  ? 'M9'
                  : wId === 'SHOTGUN'
                  ? 'SPAS'
                  : wId === 'SMG'
                  ? 'MP5'
                  : wId === 'RIFLE'
                  ? 'AK'
                  : wId === 'LMG'
                  ? 'M249'
                  : 'M82';

              return (
                <button
                  key={wId}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isUnlocked) {
                      soundManager.playUIClick();
                      onSwitchWeapon(wId);
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    if (isUnlocked) {
                      soundManager.playUIClick();
                      onSwitchWeapon(wId);
                    }
                  }}
                  disabled={!isUnlocked}
                  className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded flex items-center gap-0.5 sm:gap-1 font-mono-tactical text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    isEquipped
                      ? 'bg-emerald-600 text-white border border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                      : isUnlocked
                      ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 active:scale-95 border border-zinc-700'
                      : 'bg-zinc-950 text-zinc-600 opacity-40 border border-zinc-900 cursor-not-allowed'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  <span>[{slotNum}]</span>
                  <span>{shortName}</span>
                  {!isUnlocked && <Lock className="w-2.5 h-2.5 ml-0.5" />}
                </button>
              );
            })}
          </div>

          {/* Tactical Claymore Mine Deployment Button [E] */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlantClaymore?.();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onPlantClaymore?.();
            }}
            disabled={claymores <= 0}
            className={`relative p-2.5 sm:p-3 rounded-xl border flex items-center justify-center transition-all ${
              claymores > 0
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)] active:scale-92 cursor-pointer'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed'
            }`}
            style={{ touchAction: 'manipulation' }}
            title="Deploy Proximity Claymore Mine [E]"
          >
            <Bomb className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-zinc-950 font-mono-tactical text-[10px] font-black border border-emerald-300 shadow-sm">
              {claymores}
            </span>
          </button>

          {/* Emergency Airburst Strike Button [G] */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAirburst();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onAirburst();
            }}
            disabled={airburstCharges <= 0}
            className={`relative p-3 rounded-xl border flex items-center justify-center transition-all ${
              airburstCharges > 0
                ? 'bg-amber-950/80 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)] active:scale-92 cursor-pointer'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed'
            }`}
            style={{ touchAction: 'manipulation' }}
            title="Emergency Airburst Strike [G]"
          >
            <Zap className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-zinc-950 font-mono-tactical text-[10px] font-black border border-amber-300 shadow-sm">
              {airburstCharges}
            </span>
          </button>

          {/* Tactical Reload Button [R] */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReload();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onReload();
            }}
            disabled={isReloading || ammo === maxAmmo}
            className={`p-3 rounded-xl border flex items-center justify-center transition-all ${
              ammo === 0
                ? 'bg-red-950/90 border-red-500 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)] cursor-pointer'
                : 'bg-zinc-900/90 border-zinc-700 text-zinc-200 active:scale-92 cursor-pointer hover:border-zinc-500'
            }`}
            style={{ touchAction: 'manipulation' }}
            title="Reload Magazine [R]"
          >
            <RotateCcw className={`w-6 h-6 ${isReloading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Row B: Tactical Flank Turn Buttons Cluster (90° Left, 180° Reverse, 90° Right) */}
        <div className="flex items-center gap-2 pointer-events-auto justify-end">
          {/* Snap Turn 90° Left */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundManager.playUIClick();
              if (onSnapTurn) onSnapTurn(Math.PI / 2);
              else onQuickTurn?.();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              soundManager.playUIClick();
              if (onSnapTurn) onSnapTurn(Math.PI / 2);
              else onQuickTurn?.();
            }}
            className="h-11 px-3 rounded-xl border border-amber-500/70 bg-zinc-950/95 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] flex items-center gap-1.5 cursor-pointer active:scale-92 transition-all select-none hover:border-amber-400 hover:text-amber-200"
            style={{ touchAction: 'manipulation' }}
            title="Snap Turn 90° Left (+90°)"
          >
            <Undo2 className="w-4 h-4 text-amber-400" />
            <span className="font-display-tactical text-[11px] sm:text-xs font-black tracking-wider uppercase">
              90° L
            </span>
          </button>

          {/* Snap Turn 180° Reverse */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundManager.playUIClick();
              if (onSnapTurn) onSnapTurn(Math.PI);
              else onQuickTurn?.();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              soundManager.playUIClick();
              if (onSnapTurn) onSnapTurn(Math.PI);
              else onQuickTurn?.();
            }}
            className="h-11 px-3.5 rounded-xl border-2 border-amber-400/90 bg-amber-950/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)] flex items-center gap-1.5 cursor-pointer active:scale-92 transition-all select-none hover:border-amber-300 hover:text-amber-100"
            style={{ touchAction: 'manipulation' }}
            title="Snap Turn 180° Reverse (Quick Turn)"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span className="font-display-tactical text-[11px] sm:text-xs font-black tracking-wider uppercase">
              180°
            </span>
          </button>

          {/* Snap Turn 90° Right */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundManager.playUIClick();
              if (onSnapTurn) onSnapTurn(-Math.PI / 2);
              else onQuickTurn?.();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              soundManager.playUIClick();
              if (onSnapTurn) onSnapTurn(-Math.PI / 2);
              else onQuickTurn?.();
            }}
            className="h-11 px-3 rounded-xl border border-amber-500/70 bg-zinc-950/95 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] flex items-center gap-1.5 cursor-pointer active:scale-92 transition-all select-none hover:border-amber-400 hover:text-amber-200"
            style={{ touchAction: 'manipulation' }}
            title="Snap Turn 90° Right (-90°)"
          >
            <Redo2 className="w-4 h-4 text-amber-400" />
            <span className="font-display-tactical text-[11px] sm:text-xs font-black tracking-wider uppercase">
              90° R
            </span>
          </button>
        </div>

        {/* Row C: Main Fire Trigger Button */}
        <div className="flex items-center gap-3 pointer-events-auto">

          {/* Main Fire Trigger Button */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              setIsFiring(true);
              onFireStart();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setIsFiring(false);
              onFireEnd();
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              setIsFiring(false);
              onFireEnd();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              setIsFiring(true);
              onFireStart();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              setIsFiring(false);
              onFireEnd();
            }}
            onTouchCancel={(e) => {
              e.stopPropagation();
              setIsFiring(false);
              onFireEnd();
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={`w-22 h-22 sm:w-24 sm:h-24 rounded-full border-3 flex flex-col items-center justify-center transition-all select-none cursor-pointer ${
              isFiring
                ? 'bg-gradient-to-b from-red-600 to-amber-600 border-amber-300 text-white scale-95 shadow-[0_0_30px_rgba(239,68,68,0.9)]'
                : ammo === 0
                ? 'bg-gradient-to-b from-zinc-900 to-red-950 border-red-500/80 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                : 'bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 border-amber-500/70 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95'
            }`}
            style={{ touchAction: 'none' }}
          >
            <Crosshair className={`w-8 h-8 ${isFiring ? 'scale-110' : ''}`} />
            <span className="font-display-tactical text-xs font-black tracking-widest mt-0.5">
              {ammo === 0 ? 'EMPTY' : 'FIRE'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
