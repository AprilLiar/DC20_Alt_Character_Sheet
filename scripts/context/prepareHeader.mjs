export function prepareHeader(actor) {
  const res = actor.system.resources ?? {};
  return {
    ap:      { value: res.ap?.value       ?? 0, max: res.ap?.max       ?? 4 },
    hp:      { value: res.health?.value   ?? 0, max: res.health?.max   ?? 0 },
    stamina: { value: res.stamina?.value  ?? 0, max: res.stamina?.max  ?? 0 },
    mana:    { value: res.mana?.value     ?? 0, max: res.mana?.max     ?? 0 },
  };
}
