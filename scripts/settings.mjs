import { MODULE_ID } from './constants.mjs';

const BODY_FONTS = {
  "'Crimson Text', 'Palatino Linotype', Georgia, serif": 'Crimson Text (default)',
  "'Palatino Linotype', 'Book Antiqua', Palatino, serif": 'Palatino',
  "Georgia, 'Times New Roman', serif":                   'Georgia',
  "'EB Garamond', Garamond, serif":                      'EB Garamond',
  "Signika, Arial, sans-serif":                          'Signika',
  "Arial, Helvetica, sans-serif":                        'Arial',
  "'Trebuchet MS', Verdana, sans-serif":                 'Trebuchet MS',
};

const HEADING_FONTS = {
  "Cinzel, 'Palatino Linotype', 'Book Antiqua', serif":  'Cinzel (default)',
  "'Palatino Linotype', 'Book Antiqua', Palatino, serif": 'Palatino',
  "Georgia, 'Times New Roman', serif":                    'Georgia',
  "'EB Garamond', Garamond, serif":                       'EB Garamond',
  "Signika, Arial, sans-serif":                           'Signika',
  "Arial, Helvetica, sans-serif":                         'Arial',
};

export function registerSettings() {
  game.settings.register(MODULE_ID, 'fontScale', {
    name: 'DC20 Alt Sheet: Font Size',
    hint: 'Scale applied to all text on the character sheet. 1.0 = original size, 1.5 = default.',
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
    default: "'Crimson Text', 'Palatino Linotype', Georgia, serif",
    onChange: applySheetSettings,
  });

  game.settings.register(MODULE_ID, 'headingFont', {
    name: 'DC20 Alt Sheet: Heading Font',
    hint: 'Font used for section headings and labels.',
    scope: 'client',
    config: true,
    type: String,
    choices: HEADING_FONTS,
    default: "Cinzel, 'Palatino Linotype', 'Book Antiqua', serif",
    onChange: applySheetSettings,
  });
}

export function applySheetSettings() {
  const scale   = game.settings.get(MODULE_ID, 'fontScale');
  const body    = game.settings.get(MODULE_ID, 'fontFamily');
  const heading = game.settings.get(MODULE_ID, 'headingFont');

  let el = document.getElementById('dc20-alt-sheet-settings');
  if (!el) {
    el = document.createElement('style');
    el.id = 'dc20-alt-sheet-settings';
    document.head.appendChild(el);
  }

  el.textContent = `.dc20-alt-sheet {
  --dc20-scale:   ${scale};
  --font-body:    ${body};
  --font-ui:      ${body};
  --font-heading: ${heading};
}`;
}
