import { DC20AltCharacterSheet } from './sheets/DC20AltCharacterSheet.mjs';
import { registerHandlebarsHelpers } from './helpers/handlebars.mjs';
import { registerItemUseHook } from './hooks/trackItemUse.mjs';

import { MODULE_ID } from './constants.mjs';
export { MODULE_ID };

Hooks.once('init', () => {
  registerHandlebarsHelpers();

  foundry.documents.collections.Actors.registerSheet(MODULE_ID, DC20AltCharacterSheet, {
    types: ['character'],
    makeDefault: false,
    label: 'DC20AltSheet.sheetLabel',
  });
});

Hooks.once('ready', () => {
  registerItemUseHook();
});
