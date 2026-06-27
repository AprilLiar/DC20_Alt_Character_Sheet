/**
 * Conditions tab context.
 *
 * Mirrors the official DC20 sheet: a grid of the system's basic conditions
 * (CONFIG.DC20RPG.DROPDOWN_DATA.conditions) showing applied state + stack
 * counts, plus the actor's passive and temporary Active Effects.
 *
 * Toggling is delegated to actor.toggleStatusEffect(id, { active }) so the
 * stacking/immunity/linked-status rules of the system all apply.
 */
export function prepareConditions(actor) {
  const conditionLabels = CONFIG.DC20RPG?.DROPDOWN_DATA?.conditions ?? {};
  const conditionIds    = new Set(Object.keys(conditionLabels));
  const statusEffects   = CONFIG.statusEffects ?? [];
  const statusById      = new Map(statusEffects.map(s => [s.id, s]));

  const allEffects = actor.allEffects ?? actor.effects ?? [];

  // Count active (non-disabled) stacks per condition id, matching the system:
  // first occurrence = 1, additional occurrences only count for stackable ones.
  const activeStacks = {};
  for (const effect of allEffects) {
    if (effect.disabled) continue;
    for (const statusId of (effect.statuses ?? [])) {
      if (!conditionIds.has(statusId)) continue;
      const def = statusById.get(statusId);
      if (!activeStacks[statusId]) activeStacks[statusId] = 1;
      else if (def?.stackable) activeStacks[statusId] += 1;
    }
  }

  // Build the grid only from conditions that actually exist as status effects,
  // so every cell is safely toggleable.
  const conditions = statusEffects
    .filter(s => conditionIds.has(s.id))
    .map(s => {
      const stacks = activeStacks[s.id] ?? 0;
      return {
        id:        s.id,
        label:     s.label ?? s.name ?? conditionLabels[s.id] ?? s.id,
        img:       s.img ?? s.icon ?? null,
        stackable: !!s.stackable,
        stacks,
        active:    stacks > 0,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  // Passive / temporary Active Effects (excluding condition markers).
  const passiveEffects   = [];
  const temporaryEffects = [];
  for (const effect of allEffects) {
    if (effect.disabled) continue;
    const isCondition = [...(effect.statuses ?? [])].some(s => conditionIds.has(s));
    if (isCondition) continue;

    const d = effect.duration;
    const isTemporary = Boolean(d?.remaining || d?.turns || d?.rounds || d?.seconds);
    const entry = {
      id:       effect.id,
      name:     effect.name,
      icon:     effect.img ?? effect.icon,
      duration: d?.label ?? '',
    };
    if (isTemporary) temporaryEffects.push(entry);
    else passiveEffects.push(entry);
  }

  return { conditions, passiveEffects, temporaryEffects };
}
