import { DC20AltCharacterSheet } from './sheets/DC20AltCharacterSheet.mjs';
import { registerHandlebarsHelpers } from './helpers/handlebars.mjs';
import { registerItemUseHook } from './hooks/trackItemUse.mjs';

export { MODULE_ID } from './constants.mjs';

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
