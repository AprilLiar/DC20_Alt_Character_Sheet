import {
  recordD20Roll,
  recordDamageDealt,
  recordDamageTaken,
  recordItemUseForStats,
} from '../helpers/stats.mjs';

export function registerRollStatsHook() {

  // Parse d20 face values and damage dealt from any chat message attributed to an actor.
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
      // DC20 sets flags['dc20rpg'].itemId on item-based messages.
      const hasItemFlag = !!(
        message.flags?.['dc20rpg']?.itemId ??
        message.flags?.['dc20rpg']?.item?.id
      );
      if (!hasD20 && hasItemFlag && roll.total > 0) {
        recordDamageDealt(actor, roll.total);
      }
    }

    // Item use count for "most used item"
    const itemId = message.flags?.['dc20rpg']?.itemId
      ?? message.flags?.['dc20rpg']?.item?.id;
    if (itemId) recordItemUseForStats(actor, itemId);
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
