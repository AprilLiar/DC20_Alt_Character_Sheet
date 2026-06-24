import { getStats, getSessionStats } from '../helpers/stats.mjs';

function fmtAvg(sum, count) {
  if (!count) return '—';
  return (sum / count).toFixed(1);
}

function fmtVal(v) {
  return v === null || v === undefined ? '—' : v;
}

export async function prepareStatistics(actor) {
  const life = getStats(actor);
  const sess = getSessionStats(actor.id);

  // Most-used item: find itemId with highest count
  let mostUsedItem = null;
  const counts = life.itemUseCounts ?? {};
  let topId = null, topCount = 0;
  for (const [id, n] of Object.entries(counts)) {
    if (n > topCount) { topCount = n; topId = id; }
  }
  if (topId) {
    const item = actor.items.get(topId);
    if (item) mostUsedItem = { id: item.id, name: item.name, img: item.img, count: topCount };
  }

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

    mostUsedItem,
  };
}
