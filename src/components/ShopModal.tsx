/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HUDState, WeaponId } from '../types/gameTypes';
import { SHOP_PRICES, WEAPON_CONFIGS } from '../config/gameConfig';
import { soundManager } from '../utils/audio';
import {
  ShoppingCart,
  Shield,
  Heart,
  Zap,
  Check,
  ChevronRight,
  Crosshair,
  PackageCheck,
  Coins,
  X,
  Bomb,
  Flame,
  Radio,
  Lock,
  HeartPulse,
} from 'lucide-react';

interface ShopModalProps {
  hudState: HUDState;
  onBuyWeapon: (weapon: WeaponId) => void;
  onSwitchWeapon?: (weapon: WeaponId) => void;
  onBuyAmmo: (weapon: WeaponId) => void;
  onBuyReviveLife: () => void;
  onBuyHealth: () => void;
  onBuyArmor: () => void;
  onBuyAirburst: () => void;
  onBuyClaymores: () => void;
  onClose: () => void;
}

const WEAPON_DISPLAY_ORDER: { id: WeaponId; slot: number; price?: number; iconColor: string }[] = [
  { id: 'PISTOL', slot: 1, iconColor: 'text-zinc-300' },
  { id: 'SHOTGUN', slot: 2, price: SHOP_PRICES.UNLOCK_SHOTGUN, iconColor: 'text-red-400' },
  { id: 'SMG', slot: 3, price: SHOP_PRICES.UNLOCK_SMG, iconColor: 'text-cyan-400' },
  { id: 'RIFLE', slot: 4, price: SHOP_PRICES.UNLOCK_RIFLE, iconColor: 'text-amber-400' },
  { id: 'LMG', slot: 5, price: SHOP_PRICES.UNLOCK_LMG, iconColor: 'text-emerald-400' },
  { id: 'SNIPER', slot: 6, price: SHOP_PRICES.UNLOCK_SNIPER, iconColor: 'text-purple-400' },
];

export const ShopModal: React.FC<ShopModalProps> = ({
  hudState,
  onBuyWeapon,
  onSwitchWeapon,
  onBuyAmmo,
  onBuyReviveLife,
  onBuyHealth,
  onBuyArmor,
  onBuyAirburst,
  onBuyClaymores,
  onClose,
}) => {
  const {
    coins,
    health,
    maxHealth,
    armor,
    maxArmor,
    operativeLives = 5,
    maxOperativeLives = 5,
    airburstCharges,
    maxAirburstCharges,
    claymores,
    maxClaymores,
    unlockedWeapons,
    weaponReserves,
    equippedWeapon,
  } = hudState;

  const handlePurchase = (action: () => void, cost: number) => {
    if (coins >= cost) {
      soundManager.playBuyItem();
      action();
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundManager.playUIClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto p-3 sm:p-4 animate-in fade-in duration-200"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="relative w-full max-w-3xl bg-zinc-950 border-2 border-amber-500/80 rounded-xl p-4 sm:p-6 shadow-[0_0_60px_rgba(245,158,11,0.25)] flex flex-col max-h-[min(92vh,800px)] pointer-events-auto"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Decorative corner brackets */}
        <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-400" />
        <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-400" />
        <div className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-400" />
        <div className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/40 rounded-lg text-amber-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display-tactical text-xl sm:text-2xl font-black text-amber-300 tracking-wider">
                OUTPOST Z ARMORY
              </h2>
              <span className="text-[11px] font-mono-tactical text-zinc-400 tracking-wide uppercase">
                6-TIER MILITARY ARSENAL & TACTICAL MUNITIONS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/60 border border-amber-500/60 rounded-md font-mono-tactical text-sm font-bold text-amber-300 shadow-md">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{coins} COINS</span>
            </div>

            <button
              onClick={() => {
                soundManager.playUIClick();
                onClose();
              }}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="Close Armory"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Shop Content */}
        <div
          className="tactical-modal-scroll flex-1 min-h-0 py-3 pr-2 flex flex-col gap-3.5 select-text"
          style={{
            maxHeight: 'min(78vh, 660px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            pointerEvents: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* SECTION 1: 6-TIER WEAPON ARSENAL */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono-tactical text-amber-400/90 tracking-widest uppercase font-bold flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5" />
                6-TIER FIREARM ARSENAL
              </span>
              <span className="text-[10px] font-mono-tactical text-zinc-500">
                PURCHASING AUTO-EQUIPS IMMEDIATELY
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {WEAPON_DISPLAY_ORDER.map(({ id, slot, price, iconColor }) => {
                const config = WEAPON_CONFIGS[id];
                const isOwned = unlockedWeapons[id];
                const isEquipped = equippedWeapon === id;

                // Calibrated stat bars (0-100%)
                const damagePercent = Math.min(100, Math.round((config.damage / 400) * 100));
                const fireRatePercent = Math.min(100, Math.round((1000 / config.fireRateMs) * 7.5));
                const magPercent = Math.min(100, Math.round((config.magSize / 100) * 100));

                return (
                  <div
                    key={id}
                    className={`flex flex-col p-3 rounded-xl border transition-all ${
                      isEquipped
                        ? 'bg-zinc-900/90 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : isOwned
                        ? 'bg-zinc-900/70 border-zinc-700/80 hover:border-zinc-500'
                        : 'bg-zinc-950/80 border-zinc-800/80 hover:border-amber-600/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-mono-tactical font-black text-xs ${iconColor}`}
                        >
                          [{slot}]
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-display-tactical text-sm font-black text-zinc-100 tracking-wide">
                              {config.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono-tactical text-amber-400 font-semibold">
                            {config.caliber}
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div>
                        {isOwned ? (
                          isEquipped ? (
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/90 text-emerald-300 border border-emerald-400 rounded text-[11px] font-mono-tactical font-bold shadow-xs">
                              <Check className="w-3 h-3 text-emerald-400" />
                              EQUIPPED
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                soundManager.playUIClick();
                                onSwitchWeapon?.(id);
                              }}
                              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/50 rounded text-xs font-mono-tactical font-bold hover:border-amber-400 transition-all cursor-pointer active:scale-95"
                            >
                              EQUIP [{slot}]
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() =>
                              handlePurchase(() => {
                                onBuyWeapon(id);
                                onSwitchWeapon?.(id);
                              }, price!)
                            }
                            disabled={coins < (price ?? 0)}
                            className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono-tactical text-xs font-black rounded shadow transition-all disabled:opacity-40 disabled:hover:bg-amber-500 cursor-pointer active:scale-95"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>BUY {price}c</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] text-zinc-400 font-mono-tactical mt-2 line-clamp-1">
                      {config.description}
                    </p>

                    {/* Stat Progress Bars */}
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-zinc-800/80">
                      <div>
                        <div className="flex justify-between text-[9px] font-mono-tactical text-zinc-400 mb-0.5">
                          <span>DMG</span>
                          <span className="text-zinc-200 font-bold">{config.damage}</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${damagePercent}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] font-mono-tactical text-zinc-400 mb-0.5">
                          <span>RATE</span>
                          <span className="text-zinc-200 font-bold">{config.fireRateMs}ms</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${fireRatePercent}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] font-mono-tactical text-zinc-400 mb-0.5">
                          <span>MAG</span>
                          <span className="text-zinc-200 font-bold">{config.magSize}</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${magPercent}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: TACTICAL CONSUMABLES & DEFENSIVE ORDINANCE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono-tactical text-amber-400/90 tracking-widest uppercase font-bold flex items-center gap-1.5">
                <Bomb className="w-3.5 h-3.5 text-amber-400" />
                TACTICAL CONSUMABLES & DEFENSIVE ORDINANCE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Emergency Revive Stim (+1 Life) */}
              <div className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-amber-500/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-950/40 border border-amber-500/60 flex items-center justify-center text-amber-400">
                    <HeartPulse className="w-5 h-5 text-amber-400 animate-pulse" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-display-tactical text-xs font-bold text-zinc-100">
                      EMERGENCY REVIVE STIM (+1 LIFE)
                    </span>
                    <span className="text-[10px] font-mono-tactical text-amber-400">
                      Operative Lives: {operativeLives} / {maxOperativeLives}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(onBuyReviveLife, SHOP_PRICES.REVIVE_LIFE || 250)}
                  disabled={operativeLives >= maxOperativeLives || coins < (SHOP_PRICES.REVIVE_LIFE || 250)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 border border-amber-400 font-mono-tactical text-xs font-bold rounded transition-all disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-zinc-700 cursor-pointer active:scale-95 shadow-sm"
                >
                  <Coins className="w-3.5 h-3.5 fill-current" />
                  <span>{SHOP_PRICES.REVIVE_LIFE || 250}c</span>
                </button>
              </div>

              {/* Field Surgical Medkit (+50 HP) */}
              <div className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-emerald-500/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-950/40 border border-red-600/60 flex items-center justify-center text-red-400">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-display-tactical text-xs font-bold text-zinc-100">
                      FIELD SURGICAL MEDKIT (+50 HP)
                    </span>
                    <span className="text-[10px] font-mono-tactical text-emerald-400">
                      Operative Health: {health} / {maxHealth}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(onBuyHealth, SHOP_PRICES.MEDKIT)}
                  disabled={health >= maxHealth || coins < SHOP_PRICES.MEDKIT}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-mono-tactical text-xs font-bold rounded transition-all disabled:opacity-40 cursor-pointer active:scale-95"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{SHOP_PRICES.MEDKIT}c</span>
                </button>
              </div>

              {/* Kevlar Vest */}
              <div className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-950/40 border border-blue-600/60 flex items-center justify-center text-blue-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-display-tactical text-xs font-bold text-zinc-200">
                      Kevlar Tactical Vest (+50 Armor)
                    </span>
                    <span className="text-[10px] font-mono-tactical text-zinc-400">
                      Current Armor: {armor} / {maxArmor}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(onBuyArmor, SHOP_PRICES.ARMOR)}
                  disabled={armor >= maxArmor || coins < SHOP_PRICES.ARMOR}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-mono-tactical text-xs font-bold rounded transition-all disabled:opacity-40 cursor-pointer active:scale-95"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{SHOP_PRICES.ARMOR}c</span>
                </button>
              </div>

              {/* Claymore Mines */}
              <div className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-950/40 border border-emerald-600/60 flex items-center justify-center text-emerald-400">
                    <Bomb className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-display-tactical text-xs font-bold text-zinc-200">
                      Claymore Mines (3x Pack)
                    </span>
                    <span className="text-[10px] font-mono-tactical text-zinc-400">
                      Planted: {claymores} / {maxClaymores} (Press E to plant)
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(onBuyClaymores, SHOP_PRICES.CLAYMORES)}
                  disabled={claymores >= maxClaymores || coins < SHOP_PRICES.CLAYMORES}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-mono-tactical text-xs font-bold rounded transition-all disabled:opacity-40 cursor-pointer active:scale-95"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{SHOP_PRICES.CLAYMORES}c</span>
                </button>
              </div>

              {/* Airburst Strike Charge */}
              <div className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-950/40 border border-amber-600/60 flex items-center justify-center text-amber-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-display-tactical text-xs font-bold text-zinc-200">
                      Airburst Strike (+1 Charge)
                    </span>
                    <span className="text-[10px] font-mono-tactical text-zinc-400">
                      Charges: {airburstCharges} / {maxAirburstCharges} (Press G)
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(onBuyAirburst, SHOP_PRICES.AIRBURST)}
                  disabled={airburstCharges >= maxAirburstCharges || coins < SHOP_PRICES.AIRBURST}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-mono-tactical text-xs font-bold rounded transition-all disabled:opacity-40 cursor-pointer active:scale-95"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{SHOP_PRICES.AIRBURST}c</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: MUNITIONS RESUPPLY PACKS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono-tactical text-amber-400/90 tracking-widest uppercase font-bold flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5 text-zinc-400" />
                AMMUNITION RESUPPLY PACKS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {/* Shotgun Ammo */}
              <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-display-tactical text-xs font-bold text-zinc-200 block">
                    SPAS 12G (+16 Shells)
                  </span>
                  <span className="text-[9px] font-mono-tactical text-zinc-400">
                    Reserves: {unlockedWeapons.SHOTGUN ? `${weaponReserves.SHOTGUN}` : 'Locked'}
                  </span>
                </div>
                <button
                  onClick={() => handlePurchase(() => onBuyAmmo('SHOTGUN'), SHOP_PRICES.SHOTGUN_AMMO)}
                  disabled={!unlockedWeapons.SHOTGUN || coins < SHOP_PRICES.SHOTGUN_AMMO}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-mono-tactical text-xs font-bold rounded disabled:opacity-40 cursor-pointer"
                >
                  {SHOP_PRICES.SHOTGUN_AMMO}c
                </button>
              </div>

              {/* SMG Ammo */}
              <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-display-tactical text-xs font-bold text-zinc-200 block">
                    MP5 9mm (+80 Rounds)
                  </span>
                  <span className="text-[9px] font-mono-tactical text-zinc-400">
                    Reserves: {unlockedWeapons.SMG ? `${weaponReserves.SMG}` : 'Locked'}
                  </span>
                </div>
                <button
                  onClick={() => handlePurchase(() => onBuyAmmo('SMG'), SHOP_PRICES.SMG_AMMO)}
                  disabled={!unlockedWeapons.SMG || coins < SHOP_PRICES.SMG_AMMO}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-mono-tactical text-xs font-bold rounded disabled:opacity-40 cursor-pointer"
                >
                  {SHOP_PRICES.SMG_AMMO}c
                </button>
              </div>

              {/* Rifle Ammo */}
              <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-display-tactical text-xs font-bold text-zinc-200 block">
                    AK 7.62 (+60 Rounds)
                  </span>
                  <span className="text-[9px] font-mono-tactical text-zinc-400">
                    Reserves: {unlockedWeapons.RIFLE ? `${weaponReserves.RIFLE}` : 'Locked'}
                  </span>
                </div>
                <button
                  onClick={() => handlePurchase(() => onBuyAmmo('RIFLE'), SHOP_PRICES.RIFLE_AMMO)}
                  disabled={!unlockedWeapons.RIFLE || coins < SHOP_PRICES.RIFLE_AMMO}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-mono-tactical text-xs font-bold rounded disabled:opacity-40 cursor-pointer"
                >
                  {SHOP_PRICES.RIFLE_AMMO}c
                </button>
              </div>

              {/* LMG Ammo */}
              <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-display-tactical text-xs font-bold text-zinc-200 block">
                    M249 5.56 (+100 Rounds)
                  </span>
                  <span className="text-[9px] font-mono-tactical text-zinc-400">
                    Reserves: {unlockedWeapons.LMG ? `${weaponReserves.LMG}` : 'Locked'}
                  </span>
                </div>
                <button
                  onClick={() => handlePurchase(() => onBuyAmmo('LMG'), SHOP_PRICES.LMG_AMMO)}
                  disabled={!unlockedWeapons.LMG || coins < SHOP_PRICES.LMG_AMMO}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-mono-tactical text-xs font-bold rounded disabled:opacity-40 cursor-pointer"
                >
                  {SHOP_PRICES.LMG_AMMO}c
                </button>
              </div>

              {/* Sniper Ammo */}
              <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-display-tactical text-xs font-bold text-zinc-200 block">
                    M82 .50 BMG (+10 Rounds)
                  </span>
                  <span className="text-[9px] font-mono-tactical text-zinc-400">
                    Reserves: {unlockedWeapons.SNIPER ? `${weaponReserves.SNIPER}` : 'Locked'}
                  </span>
                </div>
                <button
                  onClick={() => handlePurchase(() => onBuyAmmo('SNIPER'), SHOP_PRICES.SNIPER_AMMO)}
                  disabled={!unlockedWeapons.SNIPER || coins < SHOP_PRICES.SNIPER_AMMO}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-mono-tactical text-xs font-bold rounded disabled:opacity-40 cursor-pointer"
                >
                  {SHOP_PRICES.SNIPER_AMMO}c
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer / Close */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono-tactical text-zinc-500 hidden sm:block">
            SLOT KEYS: [1] M9 // [2] SPAS // [3] MP5 // [4] AK // [5] M249 // [6] M82 // [E] CLAYMORE
          </div>

          <button
            onClick={() => {
              soundManager.playUIClick();
              onClose();
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display-tactical text-sm font-bold tracking-wider uppercase rounded-lg shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all cursor-pointer active:scale-95 ml-auto"
          >
            <span>Close & Deploy</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
