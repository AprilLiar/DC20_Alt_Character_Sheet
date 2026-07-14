const MOBILE_MODULE_ID = 'dc20-mobile';
const MOBILE_BODY_CLASS = 'dc20-mobile-active';

/**
 * Whether the companion "DC20 Mobile" module's touch shell is actually
 * active for this user right now — not just installed. A user can have the
 * module enabled but have its shell set to "Always Off" (e.g. a GM on a
 * desktop browser), so checking module.active alone would misfire for them.
 * Prefer the module's own API (authoritative, no DOM timing dependency);
 * fall back to the body class it sets whenever the shell is running.
 */
export function isDC20MobileActive() {
  const api = game.modules?.get(MOBILE_MODULE_ID)?.api;
  if (typeof api?.isActive === 'function') return !!api.isActive();
  return !!document.body?.classList.contains(MOBILE_BODY_CLASS);
}
