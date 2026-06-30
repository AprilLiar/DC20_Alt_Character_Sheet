import { MODULE_ID } from '../constants.mjs';

/** Read the computed point pool for one knowledge type. */
function pickPoints(p) {
  return {
    left:      p?.left ?? 0,
    max:       p?.max ?? 0,
    converted: p?.converted ?? 0,
    over:      (p?.left ?? 0) < 0,
  };
}

export function prepareActivities(actor) {
  const system  = actor.system ?? {};
  const details = system.details ?? {};
  const flags   = actor.flags?.[MODULE_ID] ?? {};

  const t = (key) => game.i18n.localize(key);

  const REST_TYPES = [
    { type: 'quick', label: t('DC20AltSheet.rest.quick.label'), short: t('DC20AltSheet.rest.quick.short'), icon: 'fa-mug-hot' },
    { type: 'short', label: t('DC20AltSheet.rest.short.label'), short: t('DC20AltSheet.rest.short.short'), icon: 'fa-campground' },
    { type: 'long',  label: t('DC20AltSheet.rest.long.label'),  short: t('DC20AltSheet.rest.long.short'),  icon: 'fa-bed' },
    { type: 'full',  label: t('DC20AltSheet.rest.full.label'),  short: t('DC20AltSheet.rest.full.short'),  icon: 'fa-house-chimney' },
  ];

  /* ── Skill / Trade / Language manager ── */
  const expAutomated = new Set(system.expertise?.automated ?? []);
  const expManual    = new Set(system.expertise?.manual ?? []);
  const mapSkill = ([key, s]) => ({
    key,
    label:            s.label ?? key,
    mastery:          s.mastery ?? 0,
    masteryLimit:     s.masteryLimit ?? 1,
    masteryLabel:     s.masteryLabel ?? '',
    modifier:         s.modifier ?? 0,
    expertise:        expManual.has(key) || expAutomated.has(key),
    expertiseGranted: expAutomated.has(key),
  });
  const skills = Object.entries(system.skills ?? {}).map(mapSkill);
  const trades = Object.entries(system.trades ?? {}).map(mapSkill);
  const languages = Object.entries(system.languages ?? {})
    .filter(([key]) => key !== 'com')          // Common is always known / free
    .map(([key, l]) => ({
      key,
      label:        l.label ?? key,
      mastery:      l.mastery ?? 0,
      masteryLimit: 2,
      masteryLabel: l.masteryLabel ?? '',
    }));
  const points = {
    skill:    pickPoints(system.skillPoints?.skill),
    trade:    pickPoints(system.skillPoints?.trade),
    language: pickPoints(system.skillPoints?.language),
  };

  const trackXP  = !!flags.trackXP;
  const xpValue  = Number(flags.xpValue) || 0;
  const xpMax    = Number(flags.xpMax) || 100;
  const xpPct    = xpMax > 0 ? Math.max(0, Math.min(100, Math.round((xpValue / xpMax) * 100))) : 0;

  // Character build slots (Ancestry / Background / Class / Subclass).
  const slotItem = (id) => {
    const it = id ? actor.items.get(id) : null;
    return it ? { id: it.id, name: it.name, img: it.img } : null;
  };
  let classSlot = slotItem(details.class?.id);
  if (!classSlot) {
    const c = actor.items.find(i => i.type === 'class');
    if (c) classSlot = { id: c.id, name: c.name, img: c.img };
  }
  const charSlots = [
    { type: 'ancestry',   label: t('DC20AltSheet.act.ancestry'),   item: slotItem(details.ancestry?.id) },
    { type: 'background', label: t('DC20AltSheet.act.background'),  item: slotItem(details.background?.id) },
    { type: 'class',      label: t('DC20AltSheet.act.class'),       item: classSlot },
    { type: 'subclass',   label: t('DC20AltSheet.act.subclass'),    item: slotItem(details.subclass?.id) },
  ];

  const hasClass    = !!details.class?.id || !!actor.items?.find(i => i.type === 'class');
  // When XP tracking is on, level-up is gated on a full bar; otherwise always allowed.
  const canLevelUp  = !trackXP || (xpMax > 0 && xpValue >= xpMax);
  // Only gate the button on the XP rule; a missing class is reported on click.
  const levelDisabled = !canLevelUp;

  // Camp Actions — stored in flags, may reference an owned feature item.
  const campActions = (flags.campActions ?? []).map(a => {
    const item = a.itemId ? actor.items.get(a.itemId) : null;
    return {
      id:          a.id,
      name:        a.name ?? item?.name ?? 'Camp Action',
      description: a.description ?? '',
      roll:        a.roll ?? null,
      img:         item?.img ?? a.img ?? null,
    };
  });

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
    canLevelDown:  (details.level ?? 0) > 0 || !!classSlot,
    charSlots,
    restTypes:     REST_TYPES,
    skills,
    trades,
    languages,
    points,
    campActions,
  };
}
