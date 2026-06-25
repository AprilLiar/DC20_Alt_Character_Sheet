import { MODULE_ID } from '../constants.mjs';

/* ── Session memory (resets on page reload) ── */
const _session = new Map();

function _defaultShape() {
  return {
    d20:         { count: 0, sum: 0, nat20: 0, nat1: 0 },
    damageDealt: { count: 0, total: 0, highest: null, lowest: null },
    damageTaken: { count: 0, total: 0, highest: null, lowest: null },
    rollCounts:  {},  // key → count; e.g. "item:id", "skill:athletics", "save:mig"
  };
}

function _sessionFor(actorId) {
  if (!_session.has(actorId)) _session.set(actorId, _defaultShape());
  return _session.get(actorId);
}

/* ── Batched flag writes ──
   Multiple recorders fire in the same synchronous turn (e.g. d20 roll +
   item-use in one chat message). Without batching, every async setFlag call
   reads the same snapshot and the last writer clobbers the others' changes.
   Instead, we accumulate mutation functions and flush them in one setFlag
   call per actor at the end of the current microtask queue.
*/
const _pending = new Map(); // actorId → mutate-fn[]
let _flushQueued = false;

function _flushAll() {
  _flushQueued = false;
  for (const [actorId, mutations] of _pending) {
    const actor = game.actors?.get(actorId);
    if (actor) {
      const s = getStats(actor);
      for (const fn of mutations) fn(s);
      actor.setFlag(MODULE_ID, 'stats', s);
    }
  }
  _pending.clear();
}

function _queue(actor, mutateFn) {
  if (!_pending.has(actor.id)) _pending.set(actor.id, []);
  _pending.get(actor.id).push(mutateFn);
  if (!_flushQueued) {
    _flushQueued = true;
    Promise.resolve().then(_flushAll);
  }
}

/* ── Flag helpers ── */

export function getStats(actor) {
  const s = actor.flags?.[MODULE_ID]?.stats ?? {};
  return {
    d20:           { count: 0, sum: 0, nat20: 0, nat1: 0,                          ...(s.d20          ?? {}) },
    damageDealt:   { count: 0, total: 0, highest: null, lowest: null,               ...(s.damageDealt  ?? {}) },
    damageTaken:   { count: 0, total: 0, highest: null, lowest: null,               ...(s.damageTaken  ?? {}) },
    rollCounts:    s.rollCounts    ?? {},
    itemUseCounts: s.itemUseCounts ?? {},  // legacy — merged in context
  };
}

export function getSessionStats(actorId) {
  return _sessionFor(actorId);
}

export async function resetLifetimeStats(actor) {
  _pending.delete(actor.id); // discard any queued, unsaved mutations
  await actor.setFlag(MODULE_ID, 'stats', null);
}

/* ── Recorders ── */

export function recordD20Roll(actor, faceValue) {
  _queue(actor, (s) => {
    s.d20.count += 1;
    s.d20.sum   += faceValue;
    if (faceValue === 20) s.d20.nat20 += 1;
    if (faceValue === 1)  s.d20.nat1  += 1;
  });
  const sess = _sessionFor(actor.id);
  sess.d20.count += 1;
  sess.d20.sum   += faceValue;
  if (faceValue === 20) sess.d20.nat20 += 1;
  if (faceValue === 1)  sess.d20.nat1  += 1;
}

export function recordDamageDealt(actor, amount) {
  if (typeof amount !== 'number' || amount <= 0) return;
  _queue(actor, (s) => {
    s.damageDealt.count += 1;
    s.damageDealt.total += amount;
    if (s.damageDealt.highest === null || amount > s.damageDealt.highest) s.damageDealt.highest = amount;
    if (s.damageDealt.lowest  === null || amount < s.damageDealt.lowest)  s.damageDealt.lowest  = amount;
  });
  const sess = _sessionFor(actor.id);
  sess.damageDealt.count += 1;
  sess.damageDealt.total += amount;
  if (sess.damageDealt.highest === null || amount > sess.damageDealt.highest) sess.damageDealt.highest = amount;
  if (sess.damageDealt.lowest  === null || amount < sess.damageDealt.lowest)  sess.damageDealt.lowest  = amount;
}

export function recordDamageTaken(actor, amount) {
  if (typeof amount !== 'number' || amount <= 0) return;
  _queue(actor, (s) => {
    s.damageTaken.count += 1;
    s.damageTaken.total += amount;
    if (s.damageTaken.highest === null || amount > s.damageTaken.highest) s.damageTaken.highest = amount;
    if (s.damageTaken.lowest  === null || amount < s.damageTaken.lowest)  s.damageTaken.lowest  = amount;
  });
  const sess = _sessionFor(actor.id);
  sess.damageTaken.count += 1;
  sess.damageTaken.total += amount;
  if (sess.damageTaken.highest === null || amount > sess.damageTaken.highest) sess.damageTaken.highest = amount;
  if (sess.damageTaken.lowest  === null || amount < sess.damageTaken.lowest)  sess.damageTaken.lowest  = amount;
}

export function recordRollableUse(actor, rollKey) {
  _queue(actor, (s) => {
    s.rollCounts[rollKey] = (s.rollCounts[rollKey] ?? 0) + 1;
  });
  const sess = _sessionFor(actor.id);
  sess.rollCounts[rollKey] = (sess.rollCounts[rollKey] ?? 0) + 1;
}

/** @deprecated Use recordRollableUse(actor, `item:${itemId}`) instead. */
export function recordItemUseForStats(actor, itemId) {
  return recordRollableUse(actor, `item:${itemId}`);
}
