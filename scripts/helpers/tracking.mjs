import { MODULE_ID } from '../dc20-alt-sheet.mjs';

export function getFavourites(actor) {
  return actor.getFlag(MODULE_ID, 'favourites') ?? [];
}

export async function addFavourite(actor, itemId) {
  const current = getFavourites(actor);
  if (current.includes(itemId)) return;
  await actor.setFlag(MODULE_ID, 'favourites', [...current, itemId]);
}

export async function removeFavourite(actor, itemId) {
  const current = getFavourites(actor);
  await actor.setFlag(MODULE_ID, 'favourites', current.filter(id => id !== itemId));
}

export function isFavourite(actor, itemId) {
  return getFavourites(actor).includes(itemId);
}

export function getLastUsed(actor) {
  return actor.getFlag(MODULE_ID, 'lastUsed') ?? [];
}

export async function recordItemUse(actor, itemId) {
  const current = getLastUsed(actor);
  const updated = [itemId, ...current.filter(id => id !== itemId)].slice(0, 3);
  await actor.setFlag(MODULE_ID, 'lastUsed', updated);
}
