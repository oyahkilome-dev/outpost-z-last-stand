/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { WeaponId } from '../types/gameTypes';
import { soundManager } from '../utils/audio';

export interface WeaponModelData {
  group: THREE.Group;
  slideOrBolt?: THREE.Object3D;
  slideRestZ: number;
  muzzleLocalPos: THREE.Vector3;
  ejectionLocalPos: THREE.Vector3;
}

export interface ArsenalModels {
  models: Record<WeaponId, WeaponModelData>;
  rootGroup: THREE.Group;
  triggerSlideRecoil: (weaponId: WeaponId) => void;
  update: (delta: number) => void;
  ejectBrassShell: (weaponId: WeaponId, camera: THREE.Camera) => void;
  dispose: () => void;
}

interface ActiveBrassShell {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  lifetime: number;
  bounces: number;
}

export function createWeaponArsenal(isSoftwareGl: boolean): ArsenalModels {
  const rootGroup = new THREE.Group();

  // 1. Realistic PBR Materials with Authentically Calibrated Roughness & Metalness
  const gunmetalSteel = new THREE.MeshStandardMaterial({
    color: 0x1d2026,
    metalness: 0.88,
    roughness: 0.32,
  });

  const stampedSteel = new THREE.MeshStandardMaterial({
    color: 0x282b33,
    metalness: 0.90,
    roughness: 0.28,
  });

  const mattePolymer = new THREE.MeshStandardMaterial({
    color: 0x0d0e12,
    roughness: 0.82,
    metalness: 0.12,
  });

  const darkWood = new THREE.MeshStandardMaterial({
    color: 0x3b2314,
    roughness: 0.65,
    metalness: 0.08,
  });

  const militaryOliveDrab = new THREE.MeshStandardMaterial({
    color: 0x2a3628,
    roughness: 0.72,
    metalness: 0.2,
  });

  const polishedBrass = new THREE.MeshStandardMaterial({
    color: 0xe5b838,
    metalness: 0.95,
    roughness: 0.22,
  });

  const tritiumGreen = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const tritiumRed = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const lensGlass = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    metalness: 0.2,
    roughness: 0.1,
  });

  // =========================================================================
  // 1. M9 BERETTA TACTICAL PISTOL (Multi-Part Viewmodel with Cycling Slide)
  // =========================================================================
  const pistolGroup = new THREE.Group();
  pistolGroup.name = 'PISTOL';

  // Lower frame with integral Picatinny rail
  const pistolFrame = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.07, 0.32), mattePolymer);
  pistolFrame.position.set(0, 0, -0.04);
  pistolGroup.add(pistolFrame);

  // Textured pistol grip & magazine baseplate
  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.2, 0.095), mattePolymer);
  pistolGrip.position.set(0, -0.095, 0.07);
  pistolGrip.rotation.x = 0.22;
  pistolGroup.add(pistolGrip);

  const pistolMagBase = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.1), stampedSteel);
  pistolMagBase.position.set(0, -0.19, 0.09);
  pistolMagBase.rotation.x = 0.22;
  pistolGroup.add(pistolMagBase);

  // Trigger guard & curved trigger
  const pistolGuard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.065, 0.09), gunmetalSteel);
  pistolGuard.position.set(0, -0.045, -0.02);
  pistolGroup.add(pistolGuard);

  const pistolTrigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.035, 0.01), gunmetalSteel);
  pistolTrigger.position.set(0, -0.04, -0.01);
  pistolTrigger.rotation.x = 0.3;
  pistolGroup.add(pistolTrigger);

  // Tactical under-barrel flashlight/laser mount
  const pistolTacLight = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 12), gunmetalSteel);
  pistolTacLight.rotation.x = Math.PI / 2;
  pistolTacLight.position.set(0, -0.035, -0.15);
  pistolGroup.add(pistolTacLight);

  // Fixed rifled barrel (protruding forward)
  const pistolBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 12), gunmetalSteel);
  pistolBarrel.rotation.x = Math.PI / 2;
  pistolBarrel.position.set(0, 0.038, -0.22);
  pistolGroup.add(pistolBarrel);

  // Slide Group (Mechanical Blowback part)
  const pistolSlideGroup = new THREE.Group();
  pistolSlideGroup.position.set(0, 0.04, -0.04);
  const pistolSlideRestZ = -0.04;

  const pistolSlide = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.055, 0.34), stampedSteel);
  pistolSlideGroup.add(pistolSlide);

  // Ejection Port cutout on right side of slide
  const pistolEjectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.07), gunmetalSteel);
  pistolEjectionPort.position.set(0.02, 0.01, -0.02);
  pistolSlideGroup.add(pistolEjectionPort);

  // Rear slide serrations
  for (let s = -0.03; s <= 0.03; s += 0.015) {
    const serration = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.04, 0.004), gunmetalSteel);
    serration.position.set(0, 0, 0.1 + s);
    pistolSlideGroup.add(serration);
  }

  // Front & rear tritium night sights
  const pFrontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.016, 0.012), gunmetalSteel);
  pFrontSight.position.set(0, 0.032, -0.155);
  const pFrontDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), tritiumGreen);
  pFrontDot.position.set(0, 0.032, -0.15);
  pistolSlideGroup.add(pFrontSight, pFrontDot);

  const pRearSight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.016, 0.015), gunmetalSteel);
  pRearSight.position.set(0, 0.032, 0.14);
  const pRearDotL = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), tritiumGreen);
  pRearDotL.position.set(-0.012, 0.032, 0.145);
  const pRearDotR = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), tritiumGreen);
  pRearDotR.position.set(0.012, 0.032, 0.145);
  pistolSlideGroup.add(pRearSight, pRearDotL, pRearDotR);

  pistolGroup.add(pistolSlideGroup);
  rootGroup.add(pistolGroup);

  // =========================================================================
  // 2. SPAS-12 COMBAT SHOTGUN (Heavy 12-Gauge Dual Barrel & Perforated Heat Shield)
  // =========================================================================
  const shotgunGroup = new THREE.Group();
  shotgunGroup.name = 'SHOTGUN';
  shotgunGroup.visible = false;

  // Heavy steel receiver
  const sgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.1, 0.44), stampedSteel);
  sgReceiver.position.set(0, 0.04, -0.06);
  shotgunGroup.add(sgReceiver);

  // Side ejection port
  const sgEjection = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.12), gunmetalSteel);
  sgEjection.position.set(0.03, 0.05, -0.04);
  shotgunGroup.add(sgEjection);

  // Long 12-Gauge Barrel
  const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.65, 12), gunmetalSteel);
  sgBarrel.rotation.x = Math.PI / 2;
  sgBarrel.position.set(0, 0.065, -0.46);
  shotgunGroup.add(sgBarrel);

  // Tubular Magazine Tube beneath barrel
  const sgMagTube = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.62, 10), gunmetalSteel);
  sgMagTube.rotation.x = Math.PI / 2;
  sgMagTube.position.set(0, 0.02, -0.44);
  shotgunGroup.add(sgMagTube);

  // Perforated heat shield over barrel
  const sgHeatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.38, 12, 1, true), stampedSteel);
  sgHeatShield.rotation.x = Math.PI / 2;
  sgHeatShield.position.set(0, 0.065, -0.38);
  shotgunGroup.add(sgHeatShield);

  // Ribbed pump forend
  const sgPump = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.082, 0.22), mattePolymer);
  sgPump.position.set(0, 0.022, -0.3);
  shotgunGroup.add(sgPump);

  // Pistol grip & folded stock arm
  const sgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.22, 0.11), mattePolymer);
  sgGrip.position.set(0, -0.085, 0.1);
  sgGrip.rotation.x = 0.28;
  shotgunGroup.add(sgGrip);

  // Folded steel stock arm rested over top receiver
  const sgStockBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.018, 0.42), stampedSteel);
  sgStockBar.position.set(0, 0.105, -0.06);
  shotgunGroup.add(sgStockBar);

  // Front fiber optic bead sight
  const sgBeadSight = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), tritiumRed);
  sgBeadSight.position.set(0, 0.092, -0.76);
  shotgunGroup.add(sgBeadSight);

  // Mechanical bolt cycle part
  const sgBoltGroup = new THREE.Group();
  sgBoltGroup.position.set(0.025, 0.055, -0.05);
  const sgBoltRestZ = -0.05;
  const sgBoltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), gunmetalSteel);
  sgBoltHandle.rotation.z = Math.PI / 2;
  sgBoltGroup.add(sgBoltHandle);
  shotgunGroup.add(sgBoltGroup);

  rootGroup.add(shotgunGroup);

  // =========================================================================
  // 3. MP5 TACTICAL SMG (High-Cyclic 9mm Submachine Gun)
  // =========================================================================
  const smgGroup = new THREE.Group();
  smgGroup.name = 'SMG';
  smgGroup.visible = false;

  // Cylindrical stamped upper receiver
  const smgUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 16), stampedSteel);
  smgUpper.rotation.x = Math.PI / 2;
  smgUpper.position.set(0, 0.05, -0.08);
  smgGroup.add(smgUpper);

  // Cocking tube & front sight base
  const smgCockingTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 12), gunmetalSteel);
  smgCockingTube.rotation.x = Math.PI / 2;
  smgCockingTube.position.set(0, 0.085, -0.15);
  smgGroup.add(smgCockingTube);

  // Ribbed tactical forend
  const smgForend = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.08, 0.22), mattePolymer);
  smgForend.position.set(0, 0.035, -0.22);
  smgGroup.add(smgForend);

  // Lower trigger housing & grip
  const smgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.21, 0.095), mattePolymer);
  smgGrip.position.set(0, -0.08, 0.08);
  smgGrip.rotation.x = 0.26;
  smgGroup.add(smgGrip);

  // Curved 40-round 9mm banana magazine
  const smgMag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.24, 0.09), stampedSteel);
  smgMag.position.set(0, -0.11, -0.1);
  smgMag.rotation.x = -0.18;
  smgGroup.add(smgMag);

  // Hooded front sight ring & post
  const smgSightHood = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 16), gunmetalSteel);
  smgSightHood.position.set(0, 0.088, -0.42);
  const smgFrontPost = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.02, 6), tritiumGreen);
  smgFrontPost.position.set(0, 0.088, -0.42);
  smgGroup.add(smgSightHood, smgFrontPost);

  // Rear rotating diopter drum
  const smgDiopter = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.025, 12), gunmetalSteel);
  smgDiopter.position.set(0, 0.095, 0.08);
  smgGroup.add(smgDiopter);

  // 3-Lug Muzzle Flash Hider
  const smgFlashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 10), gunmetalSteel);
  smgFlashHider.rotation.x = Math.PI / 2;
  smgFlashHider.position.set(0, 0.05, -0.44);
  smgGroup.add(smgFlashHider);

  // Retractable wire stock arms
  const smgStockL = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.28, 8), gunmetalSteel);
  smgStockL.rotation.x = Math.PI / 2;
  smgStockL.position.set(-0.038, 0.03, 0.18);
  const smgStockR = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.28, 8), gunmetalSteel);
  smgStockR.rotation.x = Math.PI / 2;
  smgStockR.position.set(0.038, 0.03, 0.18);
  smgGroup.add(smgStockL, smgStockR);

  // Bolt carrier assembly
  const smgBoltGroup = new THREE.Group();
  smgBoltGroup.position.set(0.028, 0.06, -0.06);
  const smgBoltRestZ = -0.06;
  const smgBolt = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 0.06), gunmetalSteel);
  smgBoltGroup.add(smgBolt);
  smgGroup.add(smgBoltGroup);

  rootGroup.add(smgGroup);

  // =========================================================================
  // 4. AK-47 ASSAULT RIFLE (7.62x39mm Gas-Operated Tactical Carbine)
  // =========================================================================
  const rifleGroup = new THREE.Group();
  rifleGroup.name = 'RIFLE';
  rifleGroup.visible = false;

  // Stamped steel receiver with reinforcement dimples
  const akReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.11, 0.46), stampedSteel);
  akReceiver.position.set(0, 0.05, -0.08);
  rifleGroup.add(akReceiver);

  // Gas piston cylinder tube & barrel
  const akGasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.38, 12), gunmetalSteel);
  akGasTube.rotation.x = Math.PI / 2;
  akGasTube.position.set(0, 0.09, -0.32);
  rifleGroup.add(akGasTube);

  const akBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 12), gunmetalSteel);
  akBarrel.rotation.x = Math.PI / 2;
  akBarrel.position.set(0, 0.06, -0.48);
  rifleGroup.add(akBarrel);

  // Slant compensator muzzle brake
  const akMuzzleComp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.06, 10), gunmetalSteel);
  akMuzzleComp.rotation.x = Math.PI / 2;
  akMuzzleComp.position.set(0, 0.06, -0.78);
  rifleGroup.add(akMuzzleComp);

  // Wooden / tactical polymer upper and lower handguard
  const akHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.095, 0.28), darkWood);
  akHandguard.position.set(0, 0.05, -0.33);
  rifleGroup.add(akHandguard);

  // Heavy steel 30-round curved banana magazine
  const akMag = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.26, 0.12), stampedSteel);
  akMag.position.set(0, -0.13, -0.12);
  akMag.rotation.x = -0.25;
  rifleGroup.add(akMag);

  // Ergonomic pistol grip
  const akGrip = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.21, 0.095), mattePolymer);
  akGrip.position.set(0, -0.09, 0.09);
  akGrip.rotation.x = 0.28;
  rifleGroup.add(akGrip);

  // Front post sight with protective wing ears
  const akFrontSight = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.045, 0.015), gunmetalSteel);
  akFrontSight.position.set(0, 0.095, -0.72);
  const akFrontDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), tritiumRed);
  akFrontDot.position.set(0, 0.105, -0.72);
  rifleGroup.add(akFrontSight, akFrontDot);

  // Rear tangent leaf sight
  const akRearSight = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.04), gunmetalSteel);
  akRearSight.position.set(0, 0.115, -0.17);
  rifleGroup.add(akRearSight);

  // Recoiling Bolt Carrier with charging handle
  const akBoltGroup = new THREE.Group();
  akBoltGroup.position.set(0.03, 0.065, -0.09);
  const akBoltRestZ = -0.09;

  const akChargingHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 8), gunmetalSteel);
  akChargingHandle.rotation.z = Math.PI / 2;
  akBoltGroup.add(akChargingHandle);
  rifleGroup.add(akBoltGroup);

  rootGroup.add(rifleGroup);

  // =========================================================================
  // 5. M249 HEAVY LMG (100-Round Drum Magazine & Squad Automatic Weapon)
  // =========================================================================
  const lmgGroup = new THREE.Group();
  lmgGroup.name = 'LMG';
  lmgGroup.visible = false;

  // Massive boxy receiver with top feed tray cover
  const lmgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.13, 0.48), stampedSteel);
  lmgReceiver.position.set(0, 0.05, -0.08);
  lmgGroup.add(lmgReceiver);

  // Heavy finned heat-dissipating barrel
  const lmgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.68, 14), gunmetalSteel);
  lmgBarrel.rotation.x = Math.PI / 2;
  lmgBarrel.position.set(0, 0.065, -0.52);
  lmgGroup.add(lmgBarrel);

  // Birdcage flash hider
  const lmgFlashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.09, 12), gunmetalSteel);
  lmgFlashHider.rotation.x = Math.PI / 2;
  lmgFlashHider.position.set(0, 0.065, -0.85);
  lmgGroup.add(lmgFlashHider);

  // Barrel carrying handle
  const lmgHandle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.08, 0.12), mattePolymer);
  lmgHandle.position.set(0.045, 0.13, -0.32);
  lmgHandle.rotation.z = 0.2;
  lmgGroup.add(lmgHandle);

  // Folded tubular bipod legs clamped beneath barrel
  const lmgBipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 8), gunmetalSteel);
  lmgBipodL.rotation.x = Math.PI / 2;
  lmgBipodL.position.set(-0.038, 0.015, -0.56);
  const lmgBipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 8), gunmetalSteel);
  lmgBipodR.rotation.x = Math.PI / 2;
  lmgBipodR.position.set(0.038, 0.015, -0.56);
  lmgGroup.add(lmgBipodL, lmgBipodR);

  // 100-Round Olive Drab Drum Magazine Box
  const lmgDrumBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.16), militaryOliveDrab);
  lmgDrumBox.position.set(-0.02, -0.12, -0.1);
  lmgGroup.add(lmgDrumBox);

  // Visible brass link ammo belt entering receiver feed chute
  const lmgBeltLink = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.06), polishedBrass);
  lmgBeltLink.position.set(-0.05, 0.04, -0.12);
  lmgGroup.add(lmgBeltLink);

  // Fixed heavy polymer stock
  const lmgStock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.22), mattePolymer);
  lmgStock.position.set(0, 0.02, 0.24);
  lmgGroup.add(lmgStock);

  // Top Picatinny Rail & Holographic Reflex Sight Frame
  const lmgRail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.015, 0.28), gunmetalSteel);
  lmgRail.position.set(0, 0.12, -0.1);
  lmgGroup.add(lmgRail);

  const lmgHoloFrame = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.055, 0.09), mattePolymer);
  lmgHoloFrame.position.set(0, 0.155, -0.1);
  const lmgHoloGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.004), lensGlass);
  lmgHoloGlass.position.set(0, 0.155, -0.09);
  const lmgRedDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), tritiumRed);
  lmgRedDot.position.set(0, 0.155, -0.095);
  lmgGroup.add(lmgHoloFrame, lmgHoloGlass, lmgRedDot);

  // Pistol grip
  const lmgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.21, 0.095), mattePolymer);
  lmgGrip.position.set(0, -0.08, 0.09);
  lmgGrip.rotation.x = 0.24;
  lmgGroup.add(lmgGrip);

  // Bolt assembly
  const lmgBoltGroup = new THREE.Group();
  lmgBoltGroup.position.set(0.045, 0.06, -0.08);
  const lmgBoltRestZ = -0.08;
  const lmgBoltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 8), gunmetalSteel);
  lmgBoltHandle.rotation.z = Math.PI / 2;
  lmgBoltGroup.add(lmgBoltHandle);
  lmgGroup.add(lmgBoltGroup);

  rootGroup.add(lmgGroup);

  // =========================================================================
  // 6. M82 .50 CAL SNIPER (Anti-Materiel Cannon with Fluted Barrel & 10x Scope)
  // =========================================================================
  const sniperGroup = new THREE.Group();
  sniperGroup.name = 'SNIPER';
  sniperGroup.visible = false;

  // Monolithic steel upper & lower receiver
  const snReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.13, 0.52), stampedSteel);
  snReceiver.position.set(0, 0.05, -0.06);
  sniperGroup.add(snReceiver);

  // Giant Fluted .50 BMG Barrel
  const snBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.95, 16), gunmetalSteel);
  snBarrel.rotation.x = Math.PI / 2;
  snBarrel.position.set(0, 0.065, -0.68);
  sniperGroup.add(snBarrel);

  // Iconic Arrowhead Dual-Chamber Muzzle Brake
  const snMuzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.14), stampedSteel);
  snMuzzleBrake.position.set(0, 0.065, -1.18);
  sniperGroup.add(snMuzzleBrake);

  // High-Magnification 10x Optical Sniper Scope
  const scopeMainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 16), gunmetalSteel);
  scopeMainTube.rotation.x = Math.PI / 2;
  scopeMainTube.position.set(0, 0.17, -0.12);
  sniperGroup.add(scopeMainTube);

  // Objective Lens Bell (Front)
  const scopeObjBell = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.024, 0.1, 16), stampedSteel);
  scopeObjBell.rotation.x = Math.PI / 2;
  scopeObjBell.position.set(0, 0.17, -0.32);
  sniperGroup.add(scopeObjBell);

  const scopeFrontLens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 16), lensGlass);
  scopeFrontLens.rotation.x = Math.PI / 2;
  scopeFrontLens.position.set(0, 0.17, -0.37);
  sniperGroup.add(scopeFrontLens);

  // Ocular Lens Bell (Rear)
  const scopeOcularBell = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.08, 16), stampedSteel);
  scopeOcularBell.rotation.x = Math.PI / 2;
  scopeOcularBell.position.set(0, 0.17, 0.06);
  sniperGroup.add(scopeOcularBell);

  // Elevation & Windage Turret Dials
  const scopeElevationTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 12), gunmetalSteel);
  scopeElevationTurret.position.set(0, 0.205, -0.12);
  const scopeWindageTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 12), gunmetalSteel);
  scopeWindageTurret.rotation.z = Math.PI / 2;
  scopeWindageTurret.position.set(0.035, 0.17, -0.12);
  sniperGroup.add(scopeElevationTurret, scopeWindageTurret);

  // Scope Mounting Rings
  const snMountL = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.045, 0.02), gunmetalSteel);
  snMountL.position.set(0, 0.135, -0.22);
  const snMountR = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.045, 0.02), gunmetalSteel);
  snMountR.position.set(0, 0.135, -0.02);
  sniperGroup.add(snMountL, snMountR);

  // Heavy 5-Round .50 BMG Box Magazine
  const snMag = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.22, 0.14), stampedSteel);
  snMag.position.set(0, -0.12, -0.08);
  snMag.rotation.x = -0.15;
  sniperGroup.add(snMag);

  // Heavy Sniper Grip
  const snGrip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.21, 0.095), mattePolymer);
  snGrip.position.set(0, -0.09, 0.12);
  snGrip.rotation.x = 0.26;
  sniperGroup.add(snGrip);

  // Recoiling Giant Bolt Assembly
  const snBoltGroup = new THREE.Group();
  snBoltGroup.position.set(0.042, 0.06, -0.04);
  const snBoltRestZ = -0.04;
  const snBoltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 8), gunmetalSteel);
  snBoltHandle.rotation.z = Math.PI / 2;
  snBoltGroup.add(snBoltHandle);
  sniperGroup.add(snBoltGroup);

  rootGroup.add(sniperGroup);

  // Position entire arsenal group at standard viewmodel resting point
  rootGroup.position.set(0.24, -0.2, -0.48);
  rootGroup.rotation.set(0.03, -0.05, 0);

  // Map of models data
  const models: Record<WeaponId, WeaponModelData> = {
    PISTOL: {
      group: pistolGroup,
      slideOrBolt: pistolSlideGroup,
      slideRestZ: pistolSlideRestZ,
      muzzleLocalPos: new THREE.Vector3(0, 0.04, -0.34),
      ejectionLocalPos: new THREE.Vector3(0.04, 0.04, -0.06),
    },
    SHOTGUN: {
      group: shotgunGroup,
      slideOrBolt: sgBoltGroup,
      slideRestZ: sgBoltRestZ,
      muzzleLocalPos: new THREE.Vector3(0, 0.065, -0.78),
      ejectionLocalPos: new THREE.Vector3(0.05, 0.05, -0.04),
    },
    SMG: {
      group: smgGroup,
      slideOrBolt: smgBoltGroup,
      slideRestZ: smgBoltRestZ,
      muzzleLocalPos: new THREE.Vector3(0, 0.05, -0.46),
      ejectionLocalPos: new THREE.Vector3(0.04, 0.06, -0.06),
    },
    RIFLE: {
      group: rifleGroup,
      slideOrBolt: akBoltGroup,
      slideRestZ: akBoltRestZ,
      muzzleLocalPos: new THREE.Vector3(0, 0.06, -0.80),
      ejectionLocalPos: new THREE.Vector3(0.05, 0.065, -0.08),
    },
    LMG: {
      group: lmgGroup,
      slideOrBolt: lmgBoltGroup,
      slideRestZ: lmgBoltRestZ,
      muzzleLocalPos: new THREE.Vector3(0, 0.065, -0.88),
      ejectionLocalPos: new THREE.Vector3(0.06, 0.06, -0.08),
    },
    SNIPER: {
      group: sniperGroup,
      slideOrBolt: snBoltGroup,
      slideRestZ: snBoltRestZ,
      muzzleLocalPos: new THREE.Vector3(0, 0.065, -1.22),
      ejectionLocalPos: new THREE.Vector3(0.06, 0.06, -0.04),
    },
  };

  // =========================================================================
  // MECHANICAL SLIDE CYCLE & RECOIL ANIMATION CONTROLLER (80ms cycle)
  // =========================================================================
  const slideRecoilStates: Record<WeaponId, { active: boolean; timer: number; maxTravel: number }> = {
    PISTOL: { active: false, timer: 0, maxTravel: 0.038 },
    SHOTGUN: { active: false, timer: 0, maxTravel: 0.045 },
    SMG: { active: false, timer: 0, maxTravel: 0.032 },
    RIFLE: { active: false, timer: 0, maxTravel: 0.038 },
    LMG: { active: false, timer: 0, maxTravel: 0.042 },
    SNIPER: { active: false, timer: 0, maxTravel: 0.055 },
  };

  const triggerSlideRecoil = (weaponId: WeaponId) => {
    const s = slideRecoilStates[weaponId];
    if (!s) return;
    s.active = true;
    s.timer = 0;
  };

  // =========================================================================
  // BRASS CASING SHELL EJECTION SYSTEM (Tumbling polished golden cylinders)
  // =========================================================================
  const MAX_ACTIVE_SHELLS = 24;
  const activeShells: ActiveBrassShell[] = [];
  const shellGeoPistol = new THREE.CylinderGeometry(0.0055, 0.0055, 0.022, 8);
  const shellGeoRifle = new THREE.CylinderGeometry(0.007, 0.007, 0.038, 8);
  const shellGeoShotgun = new THREE.CylinderGeometry(0.012, 0.012, 0.045, 10);
  const shellGeoSniper = new THREE.CylinderGeometry(0.011, 0.011, 0.065, 10);

  const ejectBrassShell = (weaponId: WeaponId, camera: THREE.Camera) => {
    const model = models[weaponId];
    if (!model || !model.group.visible) return;

    // Pick appropriate shell geometry
    let geo = shellGeoRifle;
    if (weaponId === 'PISTOL' || weaponId === 'SMG') geo = shellGeoPistol;
    else if (weaponId === 'SHOTGUN') geo = shellGeoShotgun;
    else if (weaponId === 'SNIPER') geo = shellGeoSniper;

    const shellMesh = new THREE.Mesh(geo, polishedBrass);
    shellMesh.castShadow = !isSoftwareGl;

    // Calculate initial world position from ejection port
    const worldPos = new THREE.Vector3();
    model.group.localToWorld(worldPos.copy(model.ejectionLocalPos));
    shellMesh.position.copy(worldPos);

    // Initial velocity relative to camera orientation:
    // Right (X), Slightly Up (Y), Slightly Back (Z)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);

    const ejectionSpeed = 1.8 + Math.random() * 0.8;
    const velocity = new THREE.Vector3()
      .addScaledVector(right, ejectionSpeed)
      .addScaledVector(up, 1.2 + Math.random() * 0.6)
      .addScaledVector(back, 0.4 + Math.random() * 0.3);

    // High tumbling rotational velocity
    const rotVelocity = new THREE.Vector3(
      (Math.random() - 0.5) * 28,
      (Math.random() - 0.5) * 28,
      (Math.random() - 0.5) * 28
    );

    // Add to scene (not viewmodel) so it drops in world space
    camera.parent?.add(shellMesh);

    // Reuse or discard oldest shell if over capacity
    if (activeShells.length >= MAX_ACTIVE_SHELLS) {
      const oldest = activeShells.shift();
      if (oldest) {
        camera.parent?.remove(oldest.mesh);
      }
    }

    activeShells.push({
      mesh: shellMesh,
      velocity,
      rotVelocity,
      lifetime: 0,
      bounces: 0,
    });
  };

  // Update loop for slide recoil and tumbling brass physics
  const update = (delta: number) => {
    const dt = Math.min(delta, 0.1);

    // 1. Update slide/bolt recoil animations (80ms total cycle)
    const CYCLE_DURATION = 0.08; // 80ms
    (Object.keys(slideRecoilStates) as WeaponId[]).forEach((wId) => {
      const s = slideRecoilStates[wId];
      const model = models[wId];
      if (!s.active || !model.slideOrBolt) return;

      s.timer += dt;
      const progress = s.timer / CYCLE_DURATION;

      if (progress < 0.35) {
        // Snapping backward (0 to 35% time)
        const t = progress / 0.35;
        model.slideOrBolt.position.z = model.slideRestZ + s.maxTravel * t;
      } else if (progress <= 1.0) {
        // Springing forward (35% to 100% time)
        const t = (progress - 0.35) / 0.65;
        model.slideOrBolt.position.z = model.slideRestZ + s.maxTravel * (1 - t);
      } else {
        // Reset
        model.slideOrBolt.position.z = model.slideRestZ;
        s.active = false;
        s.timer = 0;
      }
    });

    // 2. Update tumbling brass shells
    const GRAVITY = -9.8;
    for (let i = activeShells.length - 1; i >= 0; i--) {
      const shell = activeShells[i];
      shell.lifetime += dt;

      // Integrate velocity & gravity
      shell.velocity.y += GRAVITY * dt;
      shell.mesh.position.addScaledVector(shell.velocity, dt);

      // Rotate shell
      shell.mesh.rotation.x += shell.rotVelocity.x * dt;
      shell.mesh.rotation.y += shell.rotVelocity.y * dt;
      shell.mesh.rotation.z += shell.rotVelocity.z * dt;

      // Floor bounce check (asphalt ground level ~0.02)
      if (shell.mesh.position.y <= 0.02) {
        shell.mesh.position.y = 0.02;
        if (shell.bounces < 2 && Math.abs(shell.velocity.y) > 0.4) {
          shell.bounces += 1;
          shell.velocity.y = -shell.velocity.y * 0.35;
          shell.velocity.x *= 0.6;
          shell.velocity.z *= 0.6;
          shell.rotVelocity.multiplyScalar(0.5);

          // Subtle brass clink on first bounce
          if (shell.bounces === 1 && Math.random() < 0.4) {
            soundManager.playShellDrop();
          }
        } else {
          // Resting on ground
          shell.velocity.set(0, 0, 0);
          shell.rotVelocity.set(0, 0, 0);
          shell.mesh.rotation.x = Math.PI / 2;
        }
      }

      // Expire after 2.5 seconds
      if (shell.lifetime > 2.5) {
        shell.mesh.parent?.remove(shell.mesh);
        activeShells.splice(i, 1);
      }
    }
  };

  const dispose = () => {
    activeShells.forEach((s) => s.mesh.parent?.remove(s.mesh));
    activeShells.length = 0;
  };

  return {
    models,
    rootGroup,
    triggerSlideRecoil,
    update,
    ejectBrassShell,
    dispose,
  };
}
