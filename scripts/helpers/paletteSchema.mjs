/**
 * Customizable color palette schema. Defaults mirror
 * styles/themes/parchment-warm.css exactly, so an unmodified custom-palette
 * setting produces no visible change.
 */
export const PALETTE_GROUPS = [
  {
    label: 'Backgrounds',
    vars: [
      { key: '--p-bg',      label: 'Main Background',           default: '#e4e4e4' },
      { key: '--p-bg-card', label: 'Card / Panel Background',   default: '#d2d2d2' },
      { key: '--p-bg-aged', label: 'Inactive / Aged Background', default: '#bdbdbd' },
      { key: '--p-light',   label: 'Lightest Panel',             default: '#f2f2f2' },
      { key: '--p-hover',   label: 'Hover Highlight',            default: '#d8d8d8' },
    ],
  },
  {
    label: 'Borders',
    vars: [
      { key: '--p-border',       label: 'Border — Strong', default: '#3f0344' },
      { key: '--p-border-light', label: 'Border — Medium', default: '#5a265f' },
      { key: '--p-border-faint', label: 'Border — Faint',  default: '#917996' },
    ],
  },
  {
    label: 'Text',
    vars: [
      { key: '--p-ink',       label: 'Main Text',  default: '#262626' },
      { key: '--p-ink-muted', label: 'Muted Text', default: '#646464' },
    ],
  },
  {
    label: 'Accents',
    vars: [
      { key: '--p-accent',     label: 'Accent / Highlight', default: '#741a89' },
      { key: '--p-gold',       label: 'Secondary Accent',   default: '#5a265f' },
      { key: '--p-gold-light', label: 'Focus Highlight',    default: '#c490d1' },
    ],
  },
  {
    label: 'Resources',
    vars: [
      { key: '--c-hp',   label: 'Hit Points',    default: '#8b0000' },
      { key: '--c-ap',   label: 'Action Points', default: '#1a3a6b' },
      { key: '--c-sta',  label: 'Stamina',       default: '#6b3a1a' },
      { key: '--c-mana', label: 'Mana',          default: '#3a1a6b' },
      { key: '--c-grit', label: 'Grit',          default: '#1a4a1a' },
      { key: '--c-rest', label: 'Rest Points',   default: '#2a2a3a' },
    ],
  },
];

/** Flat list of every { key, label, default } row, across all groups. */
export function paletteRows() {
  return PALETTE_GROUPS.flatMap(g => g.vars);
}

/** { cssVar: defaultHex } for every customizable variable. */
export function defaultPalette() {
  const out = {};
  for (const row of paletteRows()) out[row.key] = row.default;
  return out;
}

/** Resolve the effective (custom-overridden, falling back to default) value for one key. */
export function effectiveValue(custom, key) {
  const row = paletteRows().find(r => r.key === key);
  return custom?.[key] ?? row?.default ?? null;
}

/** CSS custom-property declarations (one per line) for whatever keys are set in `custom`. */
export function buildPaletteCSSVars(custom) {
  const entries = Object.entries(custom ?? {}).filter(([, v]) => typeof v === 'string' && v);
  return entries.map(([key, value]) => `  ${key}: ${value};`).join('\n');
}
