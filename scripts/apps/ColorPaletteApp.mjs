import { MODULE_ID } from '../constants.mjs';
import { PALETTE_GROUPS, paletteRows } from '../helpers/paletteSchema.mjs';
import { applyCustomPalette } from '../helpers/applyPalette.mjs';
import { highlightPaletteVar, clearPaletteHighlight } from '../helpers/paletteHighlight.mjs';

/** Settings-menu dialog for customizing the sheet's color palette. */
export class ColorPaletteApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {

  static DEFAULT_OPTIONS = {
    id: 'dc20-alt-sheet-color-palette',
    tag: 'form',
    classes: ['dc20-alt-palette-app'],
    window: { title: 'DC20AltSheet.palette.title', icon: 'fas fa-palette', resizable: true },
    position: { width: 420, height: 600 },
    actions: {
      resetOne: ColorPaletteApp._onResetOne,
      resetAll: ColorPaletteApp._onResetAll,
    },
    form: { handler: ColorPaletteApp._onSubmit, submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/apps/color-palette.hbs` },
  };

  _getCustomPalette() {
    return foundry.utils.deepClone(game.settings.get(MODULE_ID, 'customPalette') ?? {});
  }

  async _prepareContext() {
    const custom = this._getCustomPalette();
    const groups = PALETTE_GROUPS.map(g => ({
      label: g.label,
      vars: g.vars.map(row => ({
        ...row,
        value: custom[row.key] ?? row.default,
        isCustom: custom[row.key] != null && custom[row.key] !== row.default,
      })),
    }));
    return { groups };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll('[data-palette-key]').forEach(row => {
      const key = row.dataset.paletteKey;
      row.addEventListener('mouseenter', () => highlightPaletteVar(key));
      row.addEventListener('mouseleave', () => clearPaletteHighlight());
      row.querySelector('input[type="color"]')?.addEventListener('focus', () => highlightPaletteVar(key));
      row.querySelector('input[type="color"]')?.addEventListener('blur', () => clearPaletteHighlight());
    });
  }

  _onClose(options) {
    clearPaletteHighlight();
    super._onClose(options);
  }

  static async _onSubmit(event, form, formData) {
    const custom = this._getCustomPalette();
    for (const row of paletteRows()) {
      const val = formData.object[row.key];
      if (typeof val === 'string' && val) custom[row.key] = val;
    }
    await game.settings.set(MODULE_ID, 'customPalette', custom);
    applyCustomPalette();
  }

  static async _onResetOne(event, target) {
    const key = target.closest('[data-palette-key]')?.dataset.paletteKey;
    if (!key) return;
    const custom = this._getCustomPalette();
    delete custom[key];
    await game.settings.set(MODULE_ID, 'customPalette', custom);
    applyCustomPalette();
    this.render();
  }

  static async _onResetAll() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:  { title: game.i18n.localize('DC20AltSheet.palette.resetAllTitle') },
      content: game.i18n.localize('DC20AltSheet.palette.resetAllContent'),
    });
    if (!confirmed) return;
    await game.settings.set(MODULE_ID, 'customPalette', {});
    applyCustomPalette();
    this.render();
  }
}
