// Maps item types to the filter tab they belong to
const TYPE_TO_FILTER = {
  weapon:      'weapon',
  equipment:   'equipment',
  spell:       'spell',
  maneuver:    'maneuver',
  feature:     'feature',
  technique:   'feature',
  basicAction: 'feature',
  infusion:    'feature',
};

// These types always appear in combat regardless of cost structure
const ALWAYS_COMBAT_TYPES = new Set(['weapon', 'spell', 'maneuver']);

export async function prepareCombat(actor) {
  const system = actor.system;
  const systemConditions = system.conditions ?? {};

  /* ── Active basic conditions (from actor.effects with DC20 status IDs) ── */
  const conditionMap = new Map();
  for (const effect of actor.effects) {
    if (effect.disabled || effect.suppressed) continue;
    for (const statusId of (effect.statuses ?? [])) {
      if (!(statusId in systemConditions)) continue;
      if (conditionMap.has(statusId)) {
        conditionMap.get(statusId).stacks++;
      } else {
        conditionMap.set(statusId, {
          id: statusId,
          label: systemConditions[statusId]?.label ?? statusId,
          stacks: 1,
          icon: effect.img ?? effect.icon ?? null,
        });
      }
    }
  }
  const activeConditions = [...conditionMap.values()];

  /* ── Active Effects (passive / temporary) ── */
  const conditionStatusIds = new Set(
    [...actor.effects].flatMap(e => [...(e.statuses ?? [])]).filter(s => s in systemConditions)
  );

  const passiveEffects = [];
  const temporaryEffects = [];
  for (const effect of actor.effects) {
    if (effect.disabled) continue;
    // Skip effects that are condition markers
    const isCondition = [...(effect.statuses ?? [])].some(s => conditionStatusIds.has(s));
    if (isCondition) continue;

    const d = effect.duration;
    const isTemporary = Boolean(d?.remaining || d?.turns || d?.rounds || d?.seconds);
    const entry = {
      id: effect.id,
      name: effect.name,
      icon: effect.img ?? effect.icon,
      duration: d?.label ?? '',
    };
    if (isTemporary) temporaryEffects.push(entry);
    else passiveEffects.push(entry);
  }

  /* ── Combat actions (usable items with resource costs + weapons/spells/maneuvers) ── */
  const combatActions = [];
  for (const item of actor.items) {
    const filterType = TYPE_TO_FILTER[item.type];
    if (!filterType) continue;

    if (ALWAYS_COMBAT_TYPES.has(item.type)) {
      // Weapons, spells, maneuvers: always include
    } else {
      // Features/equipment/techniques: include only when they consume a resource.
      // Mirror the same cost check used in page3-features to stay consistent.
      const costs = item.system.costs ?? {};
      const hasResourceCost = ['ap', 'stamina', 'mana', 'grit', 'health'].some(k => costs[k]);
      if (!hasResourceCost) continue;
    }

    combatActions.push({
      id:           item.id,
      name:         item.name,
      img:          item.img,
      type:         item.type,
      filterType,
      costs:        item.system.costs ?? {},
      rangeType:    item.system.attackFormula?.rangeType ?? '',
      attackBonus:  item.system.attackFormula?.rollBonus ?? 0,
      checkType:    item.system.attackFormula?.checkType ?? item.system.check?.checkKey ?? '',
      isEquipped:   item.system.statuses?.equipped ?? false,
      isAttuned:    item.system.statuses?.attuned  ?? false,
    });
  }

  return {
    resources:        system.resources ?? {},
    defences:         system.defences  ?? {},
    saveDC:           system.saveDC    ?? {},
    checkMod:         system.checkMod  ?? {},
    attackMod:        system.attackMod ?? {},
    activeConditions,
    passiveEffects,
    temporaryEffects,
    combatActions,
    damageReduction:  system.damageReduction ?? {},
    grit:             system.resources?.grit       ?? {},
    restPoints:       system.resources?.restPoints ?? {},
  };
}
