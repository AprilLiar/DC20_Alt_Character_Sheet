import { getStats, getSessionStats } from '../helpers/stats.mjs';

const SAVE_LABELS = {
  mig: 'Might Save',
  agi: 'Agility Save',
  cha: 'Charisma Save',
  int: 'Intelligence Save',
};

function fmtAvg(sum, count) {
  if (!count) return '—';
  return (sum / count).toFixed(1);
}

function fmtVal(v) {
  return v === null || v === undefined ? '—' : v;
}

/** Resolve a roll key like "item:abc", "skill:athletics", "save:mig" to display data. */
function resolveRollable(actor, key, count) {
  const colon = key.indexOf(':');
  const type = colon >= 0 ? key.slice(0, colon) : 'item';
  const id   = colon >= 0 ? key.slice(colon + 1) : key;

  if (type === 'item') {
    const item = actor.items.get(id);
    if (!item) return null;
    return { key, type: 'item', name: item.name, img: item.img, count };
  }

  if (type === 'skill') {
    const skill = actor.system?.skills?.[id] ?? actor.system?.trades?.[id];
    const name  = skill?.label ?? skill?.name ?? id;
    return { key, type: 'skill', name, img: null, count };
  }

  if (type === 'save') {
    const name = SAVE_LABELS[id] ?? `${id} Save`;
    return { key, type: 'save', name, img: null, count };
  }

  // Generic check — use the raw id as label
  return { key, type: 'check', name: id, img: null, count };
}

/** Build top-5 rollables sorted by lifetime count, including session counts. */
function buildTopUsed(actor, lifeStats, sessStats) {
  // Merge rollCounts with legacy itemUseCounts so old data still appears
  const merged = { ...lifeStats.rollCounts };
  for (const [itemId, n] of Object.entries(lifeStats.itemUseCounts ?? {})) {
    const key = `item:${itemId}`;
    merged[key] = (merged[key] ?? 0) + n;
  }

  const sessCounts = sessStats.rollCounts ?? {};

  const sorted = Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const results = [];
  for (const [key, lifeCount] of sorted) {
    const resolved = resolveRollable(actor, key, lifeCount);
    if (resolved) results.push({ ...resolved, sessCount: sessCounts[key] ?? 0 });
  }
  return results;
}

export async function prepareStatistics(actor) {
  const life = getStats(actor);
  const sess = getSessionStats(actor.id);

  const topUsed = buildTopUsed(actor, life, sess);

  return {
    // Lifetime roll stats
    d20Avg:    fmtAvg(life.d20.sum, life.d20.count),
    d20Count:  life.d20.count,
    nat20:     life.d20.nat20,
    nat1:      life.d20.nat1,
    // Session roll stats
    sessD20Avg:   fmtAvg(sess.d20.sum, sess.d20.count),
    sessD20Count: sess.d20.count,
    sessNat20:    sess.d20.nat20,
    sessNat1:     sess.d20.nat1,

    // Lifetime damage dealt
    dealtHighest: fmtVal(life.damageDealt.highest),
    dealtLowest:  fmtVal(life.damageDealt.lowest),
    dealtTotal:   life.damageDealt.total,
    // Session damage dealt
    sessDealtHighest: fmtVal(sess.damageDealt.highest),
    sessDealtLowest:  fmtVal(sess.damageDealt.lowest),
    sessDealtTotal:   sess.damageDealt.total,

    // Lifetime damage taken
    takenHighest: fmtVal(life.damageTaken.highest),
    takenLowest:  fmtVal(life.damageTaken.lowest),
    takenTotal:   life.damageTaken.total,
    // Session damage taken
    sessTakenHighest: fmtVal(sess.damageTaken.highest),
    sessTakenLowest:  fmtVal(sess.damageTaken.lowest),
    sessTakenTotal:   sess.damageTaken.total,

    topUsed,
  };
}
