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

  /* ── Combat actions (usable items with resource costs + all weapons) ── */
  const combatActions = [];
  for (const item of actor.items) {
    const costs = item.system.costs ?? item.system.usable?.costs;
    const isWeapon = item.type === 'weapon';
    const filterType = TYPE_TO_FILTER[item.type];
    if (!filterType) continue;

    const hasResourceCost = costs
      ? Object.entries(costs).some(([k, v]) => ['ap','sp','sta','stamina','mp','mana','map','grit','health'].includes(k) && v)
      : false;

    if (!isWeapon && !hasResourceCost) continue;

    combatActions.push({
      id:           item.id,
      name:         item.name,
      img:          item.img,
      type:         item.type,
      filterType,
      costs:        costs ?? {},
      rangeType:    item.system.attackFormula?.rangeType ?? '',
      attackBonus:  item.system.attackFormula?.rollBonus ?? 0,
      checkType:    item.system.attackFormula?.checkType ?? item.system.check?.checkKey ?? '',
      isEquipped:   item.system.statuses?.equipped ?? false,
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
