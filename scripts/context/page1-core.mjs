import { getFavourites, getLastUsed } from '../helpers/tracking.mjs';

const ATTR_CONFIG = {
  mig: { label: 'MIGHT',        abbr: 'MIG' },
  agi: { label: 'AGILITY',      abbr: 'AGI' },
  cha: { label: 'CHARISMA',     abbr: 'CHA' },
  int: { label: 'INTELLIGENCE', abbr: 'INT' },
};

export async function prepareCore(actor) {
  const system = actor.system;

  const attributes = Object.entries(ATTR_CONFIG).map(([key, cfg]) => ({
    key,
    ...cfg,
    ...(system.attributes?.[key] ?? {}),
  }));

  const skills = Object.entries(system.skills ?? {}).map(([key, skill]) => ({
    key,
    ...skill,
  }));

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

  return {
    attributes,
    skills,
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
