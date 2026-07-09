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
    const entry = {
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
    };
    // Health shows real current HP (not current+temp) alongside temp HP.
    // DC20 stores `.value` as current+temp combined (used internally by its
    // own damage/heal application code) and `.current` as the real HP —
    // see subsystems/target/target.mjs#applyHeal in the dc20rpg source,
    // which writes `value: newCurrent + temp, current: newCurrent`. Editing
    // is handled by a dedicated JS binding (_bindHealthResource) that keeps
    // current/temp/value in sync together, so valuePath/tempPath here are
    // display-only bookkeeping, not form-submit paths.
    if (key === 'health') {
      const rawTemp = r.temp ?? r.tempHp ?? r.tempHP ?? 0;
      const temp    = typeof rawTemp === 'number' ? rawTemp : 0;
      const current = typeof r.current === 'number' ? r.current : Math.max(0, (r.value ?? 0) - temp);
      entry.value     = current;
      entry.pct       = clampPct(current, max); // fill bar should match the displayed current HP, not current+temp
      entry.isHealth  = true;
      entry.temp      = temp;
      entry.tempPath  = `system.resources.${key}.temp`;
    }
    resources.push(entry);
  };

  pushBuiltin('health',     'HP',   'hp-bar',   true);
  pushBuiltin('stamina',    'SP',   'sp-bar',   true);
  pushBuiltin('mana',       'MP',   'mp-bar',   true);
  pushBuiltin('restPoints', 'REST', 'rest-bar', false);

  // DC20 native custom resources (e.g. Monk Ki, Legendary points, and the
  // trackers created from this sheet — which are real system resources too).
  // A colour entry in our flag marks a resource as one we created here, which
  // makes it removable and gives its max an editable numeric formula.
  const colorMap = flags.resourceColors ?? {};
  for (const [k, c] of Object.entries(res.custom ?? {})) {
    if (!c || typeof c !== 'object') continue;
    const max = c.max ?? 0;
    const ours = colorMap[k] != null;
    resources.push({
      key:       `custom.${k}`,
      customKey: k,
      label:     c.name ?? k,
      cls:       'native-bar',
      kind:      'native',
      value:     c.value ?? 0,
      max,
      pct:       clampPct(c.value ?? 0, max),
      color:     colorMap[k] || RES_COLOR.native,
      hasMax:    max > 0 || ours,
      valuePath: `system.resources.custom.${k}.value`,
      // Resources we created store a plain numeric max formula we can edit;
      // system-granted ones keep their formula-derived max read-only.
      maxPath:   ours ? `system.resources.custom.${k}.maxFormula` : null,
      removable: ours,
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
