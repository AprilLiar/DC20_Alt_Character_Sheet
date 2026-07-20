import { getFavourites, getLastUsed } from '../helpers/tracking.mjs';
import { MODULE_ID } from '../constants.mjs';

/**
 * The four fixed DC20 basic checks (rolled via actor.roll(key, 'check')).
 * `path` matches the roll-data property DC20's own DC20Roll.prepareCheckDetails
 * (roll/rollApi.mjs) resolves each key's formula against — e.g. "att" adds
 * "+ @attack.martial" — so reading actor.getRollData() at that same path
 * gives the exact bonus DC20 itself would use, including anything from
 * active effects, modifiers, or (for prime) the useMaxPrime game setting.
 */
const BASIC_ROLLS = [
  { key: 'att',   label: 'Attack Check',  path: 'attack.martial' },
  { key: 'spe',   label: 'Spell Check',   path: 'check.spell'    },
  { key: 'mar',   label: 'Martial Check', path: 'check.martial'  },
  { key: 'prime', label: 'Prime Check',   path: 'prime'          },
];

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

  // Only non-zero movement values — try all known DC20 field variants
  const movement = Object.entries(system.movement ?? {})
    .filter(([, mv]) => typeof mv === 'object' && mv !== null &&
      (mv.total ?? mv.current ?? mv.value ?? mv.base ?? mv.max ?? 0) > 0)
    .map(([key, mv]) => ({
      key,
      label: mv.label ?? key,
      value: mv.total ?? mv.current ?? mv.value ?? mv.base ?? mv.max,
    }));

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

  // Custom user-defined rolls (name + flat bonus)
  const customRolls = (actor.flags?.[MODULE_ID]?.customRolls ?? []).map(r => ({
    id:    r.id,
    name:  r.name,
    bonus: Number(r.bonus) || 0,
  }));

  function splitGroups(allGroups) {
    return allGroups.map(g => ({
      ...g,
      masteredItems:   g.items.filter(i => i.mastery),
      unmasteredItems: g.items.filter(i => !i.mastery),
      hasBoth: g.items.some(i => i.mastery) && g.items.some(i => !i.mastery),
    }));
  }

  return {
    attributes,
    skills,
    trades,
    skillGroups: splitGroups(groupByAttr(skills)),
    tradeGroups: splitGroups(groupByAttr(trades)),
    skillGroupsMastered,
    tradeGroupsMastered,
    languages,
    movement,
    senses,
    basicRolls: (() => {
      const rollData = actor.getRollData();
      return BASIC_ROLLS.map(r => ({
        ...r,
        bonus: Number(foundry.utils.getProperty(rollData, r.path)) || 0,
      }));
    })(),
    customRolls,
    favourites,
    lastUsed,
    details: system.details ?? {},
    portrait: actor.img,
    actorName: actor.name,
    death: system.death ?? {},
    size: system.size?.size ?? '',
  };
}
