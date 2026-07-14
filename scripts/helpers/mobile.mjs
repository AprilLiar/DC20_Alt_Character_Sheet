const MOBILE_MODULE_ID = 'dc20-mobile';

/** Whether the companion "DC20 Mobile" module is installed and active. */
export function isDC20MobileActive() {
  return !!game.modules?.get(MOBILE_MODULE_ID)?.active;
}
