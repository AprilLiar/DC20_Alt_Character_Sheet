import { getFavourites, getLastUsed } from '../helpers/tracking.mjs';

const ATTR_CONFIG = {
  mig: { label: 'Might',        abbr: 'MIG' },
  agi: { label: 'Agility',      abbr: 'AGI' },
  cha: { label: 'Charisma',     abbr: 'CHA' },
  int: { label: 'Intelligence', abbr: 'INT' },
};

function groupByAttr(items) {
  const groups = {};
  for (const item of items) {
    const a = item.attribute ?? '_other';
    if (!groups[a]) groups[a] = { attr: a, label: ATTR_CONFIG[a]?.label ?? String(a).toUpperCase(), items: [] };
    groups[a].items.push(item);
  }
  // Known attributes in ATTR_CONFIG order first, then any extras (handles version differences)
  const known = Object.keys(ATTR_CONFIG).filter(k => groups[k]).map(k => groups[k]);
  const extra = Object.keys(groups).filter(k => !(k in ATTR_CONFIG)).map(k => groups[k]);
  return [...known, ...extra];
}

export async function prepareCore(actor) {
  const system = actor.system;

  const attributes = Object.entries(ATTR_CONFIG).map(([key, cfg]) => ({
    key,
    ...cfg,
    ...(system.attributes?.[key] ?? {}),
  }));

  const cm = system.details?.combatMastery ?? 0;

  const skills = Object.entries(system.skills ?? {}).map(([key, skill]) => {
    const attrCheck = system.attributes?.[skill.attribute]?.check ?? 0;
    return { key, ...skill, bonus: attrCheck + (skill.mastery ?? 0) * cm };
  });

  const trades = Object.entries(system.trades ?? {}).map(([key, trade]) => {
    const attrCheck = system.attributes?.[trade.attribute]?.check ?? 0;
    return { key, ...trade, bonus: attrCheck + (trade.mastery ?? 0) * cm };
  });

  const languages = Object.entries(system.languages ?? {}).map(([key, lang]) => ({
    key,
    ...lang,
  }));

  // Only non-zero movement values
  const movement = Object.entries(system.movement ?? {})
    .filter(([, mv]) => (mv.current ?? mv.value ?? 0) > 0)
    .map(([key, mv]) => ({ key, label: mv.label ?? key, value: mv.current ?? mv.value }));

  // Only non-zero senses
  const senses = Object.entries(system.senses ?? {})
    .filter(([, s]) => (s.overridenRange ?? s.range ?? 0) > 0)
    .map(([key, s]) => ({ key, label: s.label ?? key, range: s.overridenRange ?? s.range }));

  // Favourites — resolve item IDs to item data
  const favIds = getFavourites(actor);
  const favourites = favIds
    .map(id => actor.items.get(id))
    .filter(Boolean)
    .map(item => ({ id: item.id, name: item.name, img: item.img, type: item.type }));

  // Last 3 used
  const lastIds = getLastUsed(actor);
  const lastUsed = lastIds
    .map(id => actor.items.get(id))
    .filter(Boolean)
    .map(item => ({ id: item.id, name: item.name, img: item.img, type: item.type }));

  const skillGroupsMastered = groupByAttr(skills.filter(s => s.mastery));
  const tradeGroupsMastered = groupByAttr(trades.filter(t => t.mastery));

  return {
    attributes,
    skills,
    trades,
    skillGroups: groupByAttr(skills),
    tradeGroups: groupByAttr(trades),
    skillGroupsMastered,
    tradeGroupsMastered,
    languages,
    movement,
    senses,
    favourites,
    lastUsed,
    details: system.details ?? {},
    portrait: actor.img,
    actorName: actor.name,
    death: system.death ?? {},
    size: system.size?.size ?? '',
  };
}
