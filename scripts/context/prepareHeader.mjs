import { MODULE_ID } from '../constants.mjs';

export function prepareHeader(actor) {
  const res = actor.system.resources ?? {};
  const savedSlots = actor.flags?.[MODULE_ID]?.quickSlots ?? [];
  // Default to 4 slots; grow/shrink dynamically as user adds/removes slots
  const count = savedSlots.length > 0 ? savedSlots.length : 4;
  const quickSlots = Array.from({ length: count }, (_, i) => savedSlots[i] ?? null);

  // Defences — read robustly across DC20 field-name variants.
  // Current DC20: PD = precision defence, AD = area defence.
  const def = actor.system.defences ?? {};
  const readDef = (...candidates) => {
    for (const c of candidates) {
      const v = c?.value ?? c?.total;
      if (typeof v === 'number') return v;
    }
    return null;
  };
  const pd = readDef(def.precision, def.physical, def.pd);
  const ad = readDef(def.area, def.mystical, def.mental, def.ad);

  return {
    ap:         { value: res.ap?.value          ?? 0, max: res.ap?.max          ?? 4 },
    hp:         { value: res.health?.value      ?? 0, max: res.health?.max      ?? 0 },
    stamina:    { value: res.stamina?.value     ?? 0, max: res.stamina?.max     ?? 0 },
    mana:       { value: res.mana?.value        ?? 0, max: res.mana?.max        ?? 0 },
    rest:       { value: res.restPoints?.value  ?? 0, max: res.restPoints?.max  ?? 0 },
    pd,
    ad,
    quickSlots,
  };
}
