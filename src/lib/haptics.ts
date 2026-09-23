/**
 * A short vibration to confirm an action worked (Android only; ignored
 * elsewhere or when the phone's vibration is off).
 */
export function haptic(pattern: number | number[] = 15) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported: silently ignore */
  }
}
