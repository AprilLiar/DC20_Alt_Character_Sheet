import { DC20AltCharacterSheet } from './sheets/DC20AltCharacterSheet.mjs';
import { registerHandlebarsHelpers } from './helpers/handlebars.mjs';
import { registerItemUseHook } from './hooks/trackItemUse.mjs';

export const MODULE_ID = 'dc20-alt-character-sheet';

Hooks.once('init', () => {
  registerHandlebarsHelpers();

  Actors.registerSheet(MODULE_ID, DC20AltCharacterSheet, {
    types: ['character'],
    makeDefault: false,
    label: 'DC20AltSheet.sheetLabel',
  });
});

Hooks.once('ready', () => {
  registerItemUseHook();
});
