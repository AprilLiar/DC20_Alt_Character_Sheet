import { MODULE_ID } from '../constants.mjs';

/* ── Session memory (resets on page reload) ── */
const _session = new Map();

function _defaultShape() {
  return {
    d20:         { count: 0, sum: 0, nat20: 0, nat1: 0 },
    damageDealt: { count: 0, total: 0, highest: null, lowest: null },
    damageTaken: { count: 0, total: 0, highest: null, lowest: null },
  };
}

function _sessionFor(actorId) {
  if (!_session.has(actorId)) _session.set(actorId, _defaultShape());
  return _session.get(actorId);
}

/* ── Flag helpers ── */

export function getStats(actor) {
  const s = actor.flags?.[MODULE_ID]?.stats ?? {};
  return {
    d20:          { count: 0, sum: 0, nat20: 0, nat1: 0, ...(s.d20 ?? {}) },
    damageDealt:  { count: 0, total: 0, highest: null, lowest: null, ...(s.damageDealt ?? {}) },
    damageTaken:  { count: 0, total: 0, highest: null, lowest: null, ...(s.damageTaken ?? {}) },
    itemUseCounts: s.itemUseCounts ?? {},
  };
}

export function getSessionStats(actorId) {
  return _sessionFor(actorId);
}

export async function resetLifetimeStats(actor) {
  await actor.setFlag(MODULE_ID, 'stats', null);
}

/* ── Recorders ── */

export async function recordD20Roll(actor, faceValue) {
  const s = getStats(actor);
  s.d20.count += 1;
  s.d20.sum   += faceValue;
  if (faceValue === 20) s.d20.nat20 += 1;
  if (faceValue === 1)  s.d20.nat1  += 1;
  await actor.setFlag(MODULE_ID, 'stats', s);

  const sess = _sessionFor(actor.id);
  sess.d20.count += 1;
  sess.d20.sum   += faceValue;
  if (faceValue === 20) sess.d20.nat20 += 1;
  if (faceValue === 1)  sess.d20.nat1  += 1;
}

export async function recordDamageDealt(actor, amount) {
  if (typeof amount !== 'number' || amount <= 0) return;
  const s = getStats(actor);
  s.damageDealt.count  += 1;
  s.damageDealt.total  += amount;
  if (s.damageDealt.highest === null || amount > s.damageDealt.highest) s.damageDealt.highest = amount;
  if (s.damageDealt.lowest  === null || amount < s.damageDealt.lowest)  s.damageDealt.lowest  = amount;
  await actor.setFlag(MODULE_ID, 'stats', s);

  const sess = _sessionFor(actor.id);
  sess.damageDealt.count  += 1;
  sess.damageDealt.total  += amount;
  if (sess.damageDealt.highest === null || amount > sess.damageDealt.highest) sess.damageDealt.highest = amount;
  if (sess.damageDealt.lowest  === null || amount < sess.damageDealt.lowest)  sess.damageDealt.lowest  = amount;
}

export async function recordDamageTaken(actor, amount) {
  if (typeof amount !== 'number' || amount <= 0) return;
  const s = getStats(actor);
  s.damageTaken.count  += 1;
  s.damageTaken.total  += amount;
  if (s.damageTaken.highest === null || amount > s.damageTaken.highest) s.damageTaken.highest = amount;
  if (s.damageTaken.lowest  === null || amount < s.damageTaken.lowest)  s.damageTaken.lowest  = amount;
  await actor.setFlag(MODULE_ID, 'stats', s);

  const sess = _sessionFor(actor.id);
  sess.damageTaken.count  += 1;
  sess.damageTaken.total  += amount;
  if (sess.damageTaken.highest === null || amount > sess.damageTaken.highest) sess.damageTaken.highest = amount;
  if (sess.damageTaken.lowest  === null || amount < sess.damageTaken.lowest)  sess.damageTaken.lowest  = amount;
}

export async function recordItemUseForStats(actor, itemId) {
  const s = getStats(actor);
  s.itemUseCounts[itemId] = (s.itemUseCounts[itemId] ?? 0) + 1;
  await actor.setFlag(MODULE_ID, 'stats', s);
}
