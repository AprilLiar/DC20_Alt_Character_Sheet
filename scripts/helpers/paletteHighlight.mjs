/**
 * Flashes whichever elements on any open character sheet currently render
 * with a given CSS variable's color, so the palette-editing dialog can show
 * the user exactly what a swatch affects — without a hand-maintained
 * variable-to-selector map, which would drift out of date as the sheet's
 * CSS changes. Matching is done by comparing browser-normalized computed
 * colors, since getComputedStyle always returns rgb()/rgba(), never the
 * original hex/var() the stylesheet used.
 */

let _cleanupFns = [];

function _normalizeColor(value) {
  const probe = document.createElement('div');
  probe.style.color = value;
  document.body.appendChild(probe);
  const normalized = getComputedStyle(probe).color;
  probe.remove();
  return normalized;
}

export function clearPaletteHighlight() {
  for (const fn of _cleanupFns) fn();
  _cleanupFns = [];
}

export function highlightPaletteVar(cssVar) {
  clearPaletteHighlight();
  const sheets = document.querySelectorAll('.dc20-alt-sheet');
  if (!sheets.length) return;

  const props = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];

  for (const sheet of sheets) {
    const raw = getComputedStyle(sheet).getPropertyValue(cssVar).trim();
    if (!raw) continue;
    const target = _normalizeColor(raw);
    if (target === 'rgba(0, 0, 0, 0)') continue;

    const matches = [];
    for (const el of sheet.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (props.some(p => cs[p] === target)) matches.push(el);
    }
    for (const el of matches) el.classList.add('palette-highlight-flash');
    _cleanupFns.push(() => matches.forEach(el => el.classList.remove('palette-highlight-flash')));
  }
}
