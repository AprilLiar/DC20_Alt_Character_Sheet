import { DC20AltCharacterSheet } from './sheets/DC20AltCharacterSheet.mjs';
import { registerHandlebarsHelpers } from './helpers/handlebars.mjs';
import { registerItemUseHook } from './hooks/trackItemUse.mjs';
import { registerRollStatsHook } from './hooks/trackRollStats.mjs';
import { registerSettings, applySheetSettings } from './settings.mjs';

import { MODULE_ID } from './constants.mjs';
export { MODULE_ID };

Hooks.once('init', () => {
  registerHandlebarsHelpers();
  registerSettings();

  foundry.documents.collections.Actors.registerSheet(MODULE_ID, DC20AltCharacterSheet, {
    types: ['character'],
    makeDefault: false,
    label: 'DC20AltSheet.sheetLabel',
  });

  // Compact split-tab variants, registered as named Handlebars partials so the
  // page-split part can pull them in dynamically via {{> (concat ...)}}.
  const components = `modules/${MODULE_ID}/templates/components`;
  const loadTemplates = foundry.applications.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  loadTemplates({
    'dc20-split-core':      `${components}/split-core.hbs`,
    'dc20-split-combat':    `${components}/split-combat.hbs`,
    'dc20-split-features':  `${components}/split-features.hbs`,
    'dc20-split-inventory': `${components}/split-inventory.hbs`,
    'dc20-split-biography':   `${components}/split-biography.hbs`,
    'dc20-split-statistics':  `${components}/split-statistics.hbs`,
    'dc20-split-conditions':  `${components}/split-conditions.hbs`,
  });
});

Hooks.once('ready', () => {
  registerItemUseHook();
  registerRollStatsHook();
  applySheetSettings();
});
