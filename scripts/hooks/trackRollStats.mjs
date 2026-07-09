import {
  recordD20Roll,
  recordDamageDealt,
  recordRollableUse,
  recordDamageTaken,
} from '../helpers/stats.mjs';

/**
 * Strip the volatile suffixes DC20 appends to a core roll's label so rolls
 * of the same kind group together in "Top Used" (e.g. "Athletics vs 15" and
 * "Athletics" both become "Athletics"; "Might Save [Auto Fail]" becomes
 * "Might Save"). See helpers/rollHelper.mjs#evaluateCoreRoll and
 * roll/rollApi.mjs#DC20Roll.#prepareRollDetails in the dc20rpg source.
 */
function _cleanLabel(label) {
  if (!label) return null;
  return label
    .replace(/\s*\[(Auto Crit|Auto Fail)\]\s*$/i, '')
    .replace(/\s+vs\s+.+$/i, '')
    .trim() || null;
}

export function registerRollStatsHook() {

  // Parse d20 face values, damage dealt, and rollable usage from chat messages.
  //
  // Verified against the live dc20rpg source (helpers/rollHelper.mjs):
  // - The core check/save/attack roll is marked `coreFormula: true` and its
  //   `.label` is the already-localized display name (e.g. "Athletics",
  //   "Might Save") — no separate skillKey/saveKey/checkType flag exists
  //   anywhere in the system, contrary to what this hook previously assumed.
  // - Damage/healing formula rolls are stored TWICE per hit: once with
  //   `.clear === true` (pre-mitigation) and once with `.clear === false`
  //   (the actual applied amount). Only the latter should be counted, or
  //   every hit gets double-booked.
  // - `.type` on a formula roll is a damage-type key (e.g. "fire") for
  //   damage, a healing-type key for healing, and unset for "other"
  //   formula rolls — checked live against CONFIG.DC20RPG.DROPDOWN_DATA so
  //   damage is never confused with healing.
  Hooks.on('createChatMessage', (message) => {
    const actorId = message.speaker?.actor;
    const actor   = actorId ? game.actors.get(actorId) : null;
    if (!actor) return;

    const dc20flags   = message.flags?.['dc20rpg'] ?? {};
    const itemId      = dc20flags.itemId ?? dc20flags.item?.id ?? null;
    const damageTypes = CONFIG.DC20RPG?.DROPDOWN_DATA?.damageTypes ?? {};

    let coreRoll = null;

    for (const roll of (message.rolls ?? [])) {
      if (roll.coreFormula) {
        coreRoll = roll;
        for (const die of (roll.dice ?? [])) {
          if (die.faces !== 20) continue;
          for (const result of (die.results ?? [])) {
            // result.active is false for a dropped die (e.g. disadvantage)
            if (result.active !== false) recordD20Roll(actor, result.result);
          }
        }
        continue;
      }

      // Only the "modified" (final, post-mitigation) copy of a damage
      // formula roll represents an actual amount dealt.
      if (roll.clear === false && roll.type && damageTypes[roll.type] !== undefined && roll.total > 0) {
        recordDamageDealt(actor, roll.total);
      }
    }

    // Item usage — one count per message regardless of how many rolls it
    // carries. Items also produce their own coreFormula roll (the to-hit /
    // check), so we count the item and stop rather than also bucketing that
    // roll under "check" below.
    if (itemId) {
      recordRollableUse(actor, `item:${itemId}`);
      return;
    }

    // Non-item sheet rolls (skill / save / attribute / initiative checks).
    if (coreRoll) {
      const label = _cleanLabel(coreRoll.label);
      if (label) recordRollableUse(actor, `check:${label}`);
    }
  });

  // Damage taken = HP decrease on any actor (GM-applied or incoming hit).
  // Confirmed against the live dc20rpg source (subsystems/target/target.mjs
  // #applyDamage): damage is applied as a direct write to
  // system.resources.health.value, which is exactly what this compares.
  Hooks.on('preUpdateActor', (actor, changes) => {
    const oldHp = actor.system?.resources?.health?.value;
    const newHp = changes.system?.resources?.health?.value;
    if (typeof oldHp === 'number' && typeof newHp === 'number' && newHp < oldHp) {
      recordDamageTaken(actor, oldHp - newHp);
    }
  });
}
