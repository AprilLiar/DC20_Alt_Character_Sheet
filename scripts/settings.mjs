import { MODULE_ID } from './constants.mjs';
import { applyCustomPalette } from './helpers/applyPalette.mjs';
import { ColorPaletteApp } from './apps/ColorPaletteApp.mjs';

export { applyCustomPalette };

const BODY_FONTS = {
  "Signika, Arial, sans-serif":                          'Signika (default)',
  "'Crimson Text', 'Palatino Linotype', Georgia, serif": 'Crimson Text',
  "'Palatino Linotype', 'Book Antiqua', Palatino, serif": 'Palatino',
  "Georgia, 'Times New Roman', serif":                   'Georgia',
  "'EB Garamond', Garamond, serif":                      'EB Garamond',
  "Arial, Helvetica, sans-serif":                        'Arial',
  "'Trebuchet MS', Verdana, sans-serif":                 'Trebuchet MS',
};

const HEADING_FONTS = {
  "Georgia, 'Times New Roman', serif":                    'Georgia (default)',
  "Cinzel, 'Palatino Linotype', 'Book Antiqua', serif":  'Cinzel',
  "'Palatino Linotype', 'Book Antiqua', Palatino, serif": 'Palatino',
  "'EB Garamond', Garamond, serif":                       'EB Garamond',
  "Signika, Arial, sans-serif":                           'Signika',
  "Arial, Helvetica, sans-serif":                         'Arial',
};

export function registerSettings() {
  game.settings.register(MODULE_ID, 'uiLanguage', {
    name: 'DC20 Alt Sheet: UI Language',
    hint: 'Select the language for the character sheet interface.',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'en': 'English',
      'ru': 'Русский (Russian)',
    },
    default: 'en',
    onChange: applyLanguageSetting,
  });

  game.settings.register(MODULE_ID, 'uiScale', {
    name: 'DC20 Alt Sheet: UI Scale',
    hint: 'Scales layout elements (spacing, buttons, images, tab sizes). 0.75 = compact, 1.0 = default.',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0.75, max: 3.0, step: 0.25 },
    default: 1.0,
    onChange: applySheetSettings,
  });

  game.settings.register(MODULE_ID, 'fontScale', {
    name: 'DC20 Alt Sheet: Font Size',
    hint: 'Scales all text on the character sheet independently of layout. 1.0 = small, 1.25 = default.',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 1.0, max: 4.0, step: 0.25 },
    default: 1.25,
    onChange: applySheetSettings,
  });

  game.settings.register(MODULE_ID, 'fontFamily', {
    name: 'DC20 Alt Sheet: Body Font',
    hint: 'Font used for body text and UI elements.',
    scope: 'client',
    config: true,
    type: String,
    choices: BODY_FONTS,
    default: "Signika, Arial, sans-serif",
    onChange: applySheetSettings,
  });

  game.settings.register(MODULE_ID, 'headingFont', {
    name: 'DC20 Alt Sheet: Heading Font',
    hint: 'Font used for section headings and labels.',
    scope: 'client',
    config: true,
    type: String,
    choices: HEADING_FONTS,
    default: "Georgia, 'Times New Roman', serif",
    onChange: applySheetSettings,
  });

  // Holds the user's custom color overrides; edited via the ColorPaletteApp
  // menu below, not shown as a raw config field.
  game.settings.register(MODULE_ID, 'customPalette', {
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });

  game.settings.registerMenu(MODULE_ID, 'colorPaletteMenu', {
    name:  'DC20 Alt Sheet: Color Palette',
    label: 'Configure Colors',
    hint:  'Customize the color of every themed element on the character sheet.',
    icon:  'fas fa-palette',
    type:  ColorPaletteApp,
    restricted: false,
  });
}

/**
 * Apply the module's UI language independently of Foundry's core language.
 *
 * Foundry loads translations once at startup from the core language setting,
 * so simply setting `game.i18n.lang` does nothing — the `{{localize}}` helper
 * reads the already-loaded `game.i18n.translations`. Instead we fetch our own
 * language file for the chosen language and merge its keys over the live
 * translations table, then re-render open sheets. Because en.json and ru.json
 * share the same key set, this fully overrides in either direction.
 */
export async function applyLanguageSetting() {
  let lang = 'en';
  try { lang = game.settings.get(MODULE_ID, 'uiLanguage') || 'en'; } catch { /* pre-ready */ }

  try {
    const path = `modules/${MODULE_ID}/lang/${lang}.json`;
    const url  = foundry.utils?.getRoute?.(path) ?? `/${path}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      // Deep-merge our chosen-language keys over the live translations table.
      // game.i18n.translations is a plain nested object in every Foundry
      // version this module has targeted; guard the shape defensively in
      // case a future core version changes it (e.g. to a Map), rather than
      // throwing and leaving the language switch half-applied.
      if (game.i18n.translations && typeof game.i18n.translations === 'object') {
        foundry.utils.mergeObject(game.i18n.translations, data, { inplace: true });
      } else {
        console.warn('DC20 Alt Sheet | game.i18n.translations has an unexpected shape; language override skipped');
      }
      game.i18n.lang = lang;
    } else {
      console.warn(`DC20 Alt Sheet | language file not found: ${url} (${resp.status})`);
    }
  } catch (err) {
    console.error('DC20 Alt Sheet | failed to apply language setting', err);
  }

  // Re-render all open DC20 Alt Character Sheets to apply the language change.
  for (const app of Object.values(ui.windows ?? {})) {
    if (app?.constructor?.name === 'DC20AltCharacterSheet') app.render();
  }
}

export function applySheetSettings() {
  const uiScale  = game.settings.get(MODULE_ID, 'uiScale');
  const fontScale = (() => {
    try { return game.settings.get(MODULE_ID, 'fontScale'); } catch { return uiScale; }
  })();
  const body    = game.settings.get(MODULE_ID, 'fontFamily');
  const heading = game.settings.get(MODULE_ID, 'headingFont');

  let el = document.getElementById('dc20-alt-sheet-settings');
  if (!el) {
    el = document.createElement('style');
    el.id = 'dc20-alt-sheet-settings';
    document.head.appendChild(el);
  }

  el.textContent = `.dc20-alt-sheet {
  --dc20-scale:   ${uiScale};
  --font-scale:   ${fontScale};
  --font-body:    ${body};
  --font-ui:      ${body};
  --font-heading: ${heading};
}`;
}
