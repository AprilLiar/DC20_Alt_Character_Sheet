import {
  recordD20Roll,
  recordDamageDealt,
  recordDamageTaken,
  recordRollableUse,
} from '../helpers/stats.mjs';

export function registerRollStatsHook() {

  // Parse d20 face values, damage dealt, and rollable usage from chat messages.
  Hooks.on('createChatMessage', (message) => {
    const actorId = message.speaker?.actor;
    const actor   = actorId ? game.actors.get(actorId) : null;
    if (!actor) return;

    for (const roll of (message.rolls ?? [])) {
      let hasD20 = false;

      for (const die of (roll.dice ?? [])) {
        if (die.faces !== 20) continue;
        hasD20 = true;
        for (const result of (die.results ?? [])) {
          // result.active is false for dropped dice (e.g. disadvantage)
          if (result.active !== false) {
            recordD20Roll(actor, result.result);
          }
        }
      }

      // Non-d20 roll from an item activation = treat as damage dealt.
      const dc20flags = message.flags?.['dc20rpg'] ?? {};
      const hasItemFlag = !!(dc20flags.itemId ?? dc20flags.item?.id);
      if (!hasD20 && hasItemFlag && roll.total > 0) {
        recordDamageDealt(actor, roll.total);
      }
    }

    // Track what was rolled for "Top Used"
    const dc20flags = message.flags?.['dc20rpg'] ?? {};

    const itemId   = dc20flags.itemId ?? dc20flags.item?.id;
    // DC20 puts the skill key in several possible fields depending on version
    const skillKey = dc20flags.skillKey ?? dc20flags.skillId ?? dc20flags.skill;
    // Save attribute key (mig / agi / cha / int)
    const saveAttr = dc20flags.saveKey ?? dc20flags.saveAttribute ?? dc20flags.saveAttr;
    // Generic check type label
    const checkType = dc20flags.checkType ?? dc20flags.type ?? dc20flags.rollType ?? '';

    if (itemId) {
      recordRollableUse(actor, `item:${itemId}`);
    } else if (skillKey) {
      recordRollableUse(actor, `skill:${skillKey}`);
    } else if (saveAttr) {
      recordRollableUse(actor, `save:${saveAttr}`);
    } else if (checkType && message.rolls?.some(r => r.dice?.some(d => d.faces === 20))) {
      recordRollableUse(actor, `check:${checkType}`);
    }
  });

  // Damage taken = HP decrease on any actor (GM-applied or incoming hit).
  Hooks.on('preUpdateActor', (actor, changes) => {
    const oldHp = actor.system?.resources?.health?.value;
    const newHp = changes.system?.resources?.health?.value;
    if (typeof oldHp === 'number' && typeof newHp === 'number' && newHp < oldHp) {
      recordDamageTaken(actor, oldHp - newHp);
    }
  });
}
