import { MODULE_ID } from '../constants.mjs';

const clampPct = (v, m) => (m > 0 ? Math.max(0, Math.min(100, Math.round((v / m) * 100))) : 0);

/** Built-in resource colours (bar fill). */
const RES_COLOR = {
  health:     'rgba(180, 40,  40,  0.72)',
  stamina:    'rgba(176, 100, 30,  0.72)',
  mana:       'rgba(90,  55,  160, 0.72)',
  restPoints: 'rgba(45,  150, 70,  0.72)',
  native:     'rgba(176, 140, 50,  0.72)',
};

export function prepareHeader(actor) {
  const sys = actor.system ?? {};
  const res = sys.resources ?? {};
  const flags = actor.flags?.[MODULE_ID] ?? {};

  /* ── Quick slots ── */
  const savedSlots = flags.quickSlots ?? [];
  const count = savedSlots.length > 0 ? savedSlots.length : 4;
  const quickSlots = Array.from({ length: count }, (_, i) => savedSlots[i] ?? null);

  /* ── Defences (PD / AD) ── */
  const def = sys.defences ?? {};
  const readDef = (...c) => {
    for (const x of c) { const v = x?.value ?? x?.total; if (typeof v === 'number') return v; }
    return null;
  };
  const pd = readDef(def.precision, def.physical, def.pd);
  const ad = readDef(def.area, def.mystical, def.mental, def.ad);

  /* ── Resource list for the dropdown ── */
  const resources = [];

  const pushBuiltin = (key, label, cls, always) => {
    const r = res[key] ?? {};
    const max = r.max ?? 0;
    if (!always && !max) return;
    resources.push({
      key, label, cls,
      kind:      'builtin',
      value:     r.value ?? 0,
      max,
      pct:       clampPct(r.value ?? 0, max),
      color:     RES_COLOR[key],
      hasMax:    true,
      valuePath: `system.resources.${key}.value`,
      maxPath:   `system.resources.${key}.max`,
      removable: false,
    });
  };

  pushBuiltin('health',     'HP',   'hp-bar',   true);
  pushBuiltin('stamina',    'SP',   'sp-bar',   true);
  pushBuiltin('mana',       'MP',   'mp-bar',   true);
  pushBuiltin('restPoints', 'REST', 'rest-bar', false);

  // DC20 native custom resources (e.g. Monk Ki, Legendary points)
  for (const [k, c] of Object.entries(res.custom ?? {})) {
    if (!c || typeof c !== 'object') continue;
    const max = c.max ?? 0;
    resources.push({
      key:       `custom.${k}`,
      label:     c.name ?? k,
      cls:       'native-bar',
      kind:      'native',
      value:     c.value ?? 0,
      max,
      pct:       clampPct(c.value ?? 0, max),
      color:     RES_COLOR.native,
      hasMax:    max > 0,
      valuePath: `system.resources.custom.${k}.value`,
      maxPath:   null,             // max is formula-derived in the system
      removable: false,
    });
  }

  // Module-managed colour trackers
  for (const t of (flags.customTrackers ?? [])) {
    const max = Number(t.max) || 0;
    resources.push({
      key:       `tracker.${t.id}`,
      label:     t.name ?? 'Tracker',
      cls:       'tracker-bar',
      kind:      'tracker',
      value:     Number(t.value) || 0,
      max,
      pct:       clampPct(Number(t.value) || 0, max),
      color:     t.color || 'rgba(120, 130, 200, 0.72)',
      hasMax:    true,
      valuePath: null,
      maxPath:   null,
      trackerId: t.id,
      removable: true,
    });
  }

  // Which resource is shown collapsed in the header
  const selectedKey = flags.headerResource ?? 'health';
  const selected = resources.find(r => r.key === selectedKey) ?? resources[0] ?? null;

  return {
    ap:   { value: res.ap?.value ?? 0, max: res.ap?.max ?? 4 },
    pd, ad,
    resources,
    selected,
    quickSlots,
  };
}
