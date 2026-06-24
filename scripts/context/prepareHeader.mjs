import { MODULE_ID } from '../constants.mjs';

export function prepareHeader(actor) {
  const res = actor.system.resources ?? {};
  const savedSlots = actor.flags?.[MODULE_ID]?.quickSlots ?? [];
  const count = Math.max(4, savedSlots.length);
  const quickSlots = Array.from({ length: count }, (_, i) => savedSlots[i] ?? null);
  return {
    ap:         { value: res.ap?.value          ?? 0, max: res.ap?.max          ?? 4 },
    hp:         { value: res.health?.value      ?? 0, max: res.health?.max      ?? 0 },
    stamina:    { value: res.stamina?.value     ?? 0, max: res.stamina?.max     ?? 0 },
    mana:       { value: res.mana?.value        ?? 0, max: res.mana?.max        ?? 0 },
    rest:       { value: res.restPoints?.value  ?? 0, max: res.restPoints?.max  ?? 0 },
    quickSlots,
  };
}
