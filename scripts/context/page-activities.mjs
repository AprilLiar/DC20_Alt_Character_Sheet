import { MODULE_ID } from '../constants.mjs';

/** The four DC20 rest types, in order of magnitude. */
const REST_TYPES = [
  { type: 'quick', label: 'Quick Rest', icon: 'fa-mug-hot' },
  { type: 'short', label: 'Short Rest', icon: 'fa-campground' },
  { type: 'long',  label: 'Long Rest',  icon: 'fa-bed' },
  { type: 'full',  label: 'Full Rest',  icon: 'fa-house-chimney' },
];

export function prepareActivities(actor) {
  const details = actor.system.details ?? {};
  const flags   = actor.flags?.[MODULE_ID] ?? {};

  const trackXP  = !!flags.trackXP;
  const xpValue  = Number(flags.xpValue) || 0;
  const xpMax    = Number(flags.xpMax) || 100;
  const xpPct    = xpMax > 0 ? Math.max(0, Math.min(100, Math.round((xpValue / xpMax) * 100))) : 0;

  const hasClass    = !!details.class?.id;
  // When XP tracking is on, level-up is gated on a full bar; otherwise always allowed.
  const canLevelUp  = !trackXP || (xpMax > 0 && xpValue >= xpMax);
  const levelDisabled = !hasClass || !canLevelUp;

  return {
    level:         details.level ?? 1,
    combatMastery: details.combatMastery ?? 0,
    hasClass,
    trackXP,
    xpValue,
    xpMax,
    xpPct,
    canLevelUp,
    levelDisabled,
    restTypes:     REST_TYPES,
  };
}
