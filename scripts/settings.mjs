import { MODULE_ID } from './constants.mjs';

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
    hint: 'Scales all text on the character sheet independently of layout. 1.0 = small, 1.5 = default.',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 1.0, max: 4.0, step: 0.25 },
    default: 1.5,
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
}

export function applyLanguageSetting() {
  const lang = game.settings.get(MODULE_ID, 'uiLanguage');
  game.i18n.lang = lang;

  // Re-render all open DC20 Alt Character Sheets to apply the language change
  for (const sheet of Object.values(ui.windows)) {
    if (sheet?.constructor?.name === 'DC20AltCharacterSheet') {
      sheet.render();
    }
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
