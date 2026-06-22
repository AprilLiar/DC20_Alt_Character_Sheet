import { recordItemUse } from '../helpers/tracking.mjs';

export function registerItemUseHook() {
  // DC20 system fires this when an item is rolled or activated
  Hooks.on('dc20rpg.itemUsed', (item) => {
    if (item?.actor) recordItemUse(item.actor, item.id);
  });

  // Fallback: catch chat messages that carry a DC20 item reference
  Hooks.on('createChatMessage', (message) => {
    const itemId = message.flags?.['dc20rpg']?.itemId
      ?? message.flags?.['dc20rpg']?.item?.id;
    if (!itemId) return;
    const actorId = message.speaker?.actor;
    const actor = actorId ? game.actors.get(actorId) : null;
    if (actor) recordItemUse(actor, itemId);
  });
}
