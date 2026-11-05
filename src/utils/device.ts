/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let cachedTouchDetected = false;

// Attach persistent touch listener to permanently remember touch capability once any touch occurs
if (typeof window !== 'undefined') {
  const registerTouch = () => {
    cachedTouchDetected = true;
  };
  window.addEventListener('touchstart', registerTouch, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      cachedTouchDetected = true;
    }
  }, { passive: true });
}

/**
 * Detects whether the current device supports hardware touch events.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (cachedTouchDetected) return true;
  const detected = (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error msMaxTouchPoints is non-standard but present on older Windows touch devices
    (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0) ||
    window.matchMedia?.('(pointer: coarse)').matches === true
  );
  if (detected) {
    cachedTouchDetected = true;
  }
  return detected;
}

/**
 * Resolves whether mobile touch controls should be active based on settings.
 * When set to 'ON', it NEVER switches back to desktop mode during gameplay under any circumstances.
 * When in 'AUTO', once mobile touch capability is detected, it stays permanently active.
 */
export function shouldEnableTouchControls(setting: 'AUTO' | 'ON' | 'OFF' = 'AUTO'): boolean {
  if (setting === 'ON') return true;
  if (setting === 'OFF') return false;
  return isTouchDevice();
}
