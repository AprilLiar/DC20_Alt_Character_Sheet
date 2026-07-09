import { MODULE_ID } from '../constants.mjs';
import { buildPaletteCSSVars } from './paletteSchema.mjs';

/** Inject the user's custom palette overrides as CSS custom properties, in their own <style> tag. */
export function applyCustomPalette() {
  const custom = game.settings.get(MODULE_ID, 'customPalette') ?? {};

  let el = document.getElementById('dc20-alt-sheet-palette');
  if (!el) {
    el = document.createElement('style');
    el.id = 'dc20-alt-sheet-palette';
    document.head.appendChild(el);
  }

  const vars = buildPaletteCSSVars(custom);
  el.textContent = vars ? `.dc20-alt-sheet {\n${vars}\n}` : '';
}
