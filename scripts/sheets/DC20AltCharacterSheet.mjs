import { MODULE_ID }        from '../constants.mjs';
import { prepareHeader }    from '../context/prepareHeader.mjs';
import { prepareCore }      from '../context/page1-core.mjs';
import { prepareCombat }    from '../context/page2-combat.mjs';
import { prepareFeatures }  from '../context/page3-features.mjs';
import { prepareInventory } from '../context/page4-inventory.mjs';
import { prepareBiography } from '../context/page5-biography.mjs';
import { addFavourite, removeFavourite, isFavourite, recordItemUse } from '../helpers/tracking.mjs';

export class DC20AltCharacterSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {

  static DEFAULT_OPTIONS = {
    classes: ['dc20-alt-sheet'],
    position: { width: 1020, height: 980 },
    actions: {
      rollAttribute: DC20AltCharacterSheet._onRollAttribute,
      rollSave:      DC20AltCharacterSheet._onRollSave,
      rollSkill:     DC20AltCharacterSheet._onRollSkill,
      createItem:    DC20AltCharacterSheet._onCreateItem,
      editItem:      DC20AltCharacterSheet._onEditItem,
      deleteItem:    DC20AltCharacterSheet._onDeleteItem,
      toggleEquip:   DC20AltCharacterSheet._onToggleEquip,
      useItem:       DC20AltCharacterSheet._onUseItem,
    },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    header:           { template: `modules/${MODULE_ID}/templates/parts/header.hbs` },
    nav:              { template: `modules/${MODULE_ID}/templates/parts/navigation.hbs` },
    'page-core':      { template: `modules/${MODULE_ID}/templates/parts/page-core.hbs`,      scrollable: ['.page-scroll'] },
    'page-combat':    { template: `modules/${MODULE_ID}/templates/parts/page-combat.hbs`,    scrollable: ['.page-scroll'] },
    'page-features':  { template: `modules/${MODULE_ID}/templates/parts/page-features.hbs`,  scrollable: ['.page-scroll'] },
    'page-inventory': { template: `modules/${MODULE_ID}/templates/parts/page-inventory.hbs`, scrollable: ['.page-scroll'] },
    'page-biography': { template: `modules/${MODULE_ID}/templates/parts/page-biography.hbs`, scrollable: ['.page-scroll'] },
  };

  /** Tracks which page is currently active — persists across re-renders */
  _currentPage = 'core';
  /** Tracks which combat filter is active */
  _combatFilter = 'all';

  /* -------------------------------------------- */
  /*  Context Preparation                          */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor       = this.actor;
    context.system      = this.actor.system;
    context.isEditable  = this.isEditable;
    context.currentPage = this._currentPage;
    context.header      = prepareHeader(this.actor);
    return context;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch (partId) {
      case 'page-core':      return Object.assign(context, await prepareCore(this.actor));
      case 'page-combat':    return Object.assign(context, await prepareCombat(this.actor), { combatFilter: this._combatFilter });
      case 'page-features':  return Object.assign(context, await prepareFeatures(this.actor));
      case 'page-inventory': return Object.assign(context, await prepareInventory(this.actor));
      case 'page-biography': return Object.assign(context, await prepareBiography(this.actor));
    }
    return context;
  }

  /* -------------------------------------------- */
  /*  Rendering                                    */
  /* -------------------------------------------- */

  _onRender(context, options) {
    super._onRender(context, options);
    this._bindPageTabs();
    this._bindCombatFilter();
    this._registerContextMenu();
  }

  /** Wire up right-side bookmark tabs (DOM-level, no re-render) */
  _bindPageTabs() {
    this.element.querySelectorAll('.page-tab').forEach(btn => {
      btn.addEventListener('click', () => this._switchPage(btn.dataset.page));
    });
    // Restore the correct page after every render
    this._applyPageVisibility(this._currentPage);
  }

  _switchPage(page) {
    this._currentPage = page;
    this._applyPageVisibility(page);
  }

  _applyPageVisibility(page) {
    this.element.querySelectorAll('.page-tab').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.page === page));
    this.element.querySelectorAll('[data-page]').forEach(el =>
      el.classList.toggle('active', el.dataset.page === page));
  }

  /** Wire up combat filter tabs (All / Weapons / Spells / Maneuvers / Features) */
  _bindCombatFilter() {
    this.element.querySelectorAll('.combat-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._combatFilter = btn.dataset.filter;
        this.element.querySelectorAll('.combat-filter-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.filter === this._combatFilter));
        this._applyCombatFilter(this._combatFilter);
      });
    });
    this._applyCombatFilter(this._combatFilter);
  }

  _applyCombatFilter(filter) {
    this.element.querySelectorAll('.combat-action-row').forEach(row => {
      const show = filter === 'all' || row.dataset.filterType === filter;
      row.classList.toggle('hidden', !show);
    });
  }

  /** Right-click context menu for Favourites on any item row */
  _registerContextMenu() {
    new ContextMenu(this.element, '[data-item-id]', [
      {
        name: game.i18n.localize('DC20AltSheet.ctx.addFavourite'),
        icon: '<i class="fas fa-star"></i>',
        condition: (li) => !isFavourite(this.actor, li[0]?.dataset?.itemId),
        callback: async (li) => {
          await addFavourite(this.actor, li[0]?.dataset?.itemId);
          this.render();
        },
      },
      {
        name: game.i18n.localize('DC20AltSheet.ctx.removeFavourite'),
        icon: '<i class="far fa-star"></i>',
        condition: (li) => isFavourite(this.actor, li[0]?.dataset?.itemId),
        callback: async (li) => {
          await removeFavourite(this.actor, li[0]?.dataset?.itemId);
          this.render();
        },
      },
      {
        name: game.i18n.localize('DC20AltSheet.ctx.editItem'),
        icon: '<i class="fas fa-pencil-alt"></i>',
        callback: (li) => this.actor.items.get(li[0]?.dataset?.itemId)?.sheet?.render(true),
      },
      {
        name: game.i18n.localize('DC20AltSheet.ctx.deleteItem'),
        icon: '<i class="fas fa-trash"></i>',
        callback: async (li) => {
          const item = this.actor.items.get(li[0]?.dataset?.itemId);
          if (!item) return;
          const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize('DC20AltSheet.deleteConfirm.title') },
            content: game.i18n.format('DC20AltSheet.deleteConfirm.content', { name: item.name }),
          });
          if (ok) item.delete();
        },
      },
    ]);
  }

  /* -------------------------------------------- */
  /*  Static Action Handlers                       */
  /* -------------------------------------------- */

  static async _onRollAttribute(event, target) {
    const attrKey = target.closest('[data-attr]').dataset.attr;
    const actor = this.actor;
    if (typeof actor.rollAttributeCheck === 'function') return actor.rollAttributeCheck(attrKey);
    const attr = actor.system.attributes?.[attrKey];
    const roll = new Roll('1d20 + @check', { check: attr?.check ?? 0 });
    await roll.evaluate();
    roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${attrKey.toUpperCase()} Check` });
  }

  static async _onRollSave(event, target) {
    const attrKey = target.closest('[data-attr]').dataset.attr;
    const actor = this.actor;
    if (typeof actor.rollSave === 'function') return actor.rollSave(attrKey);
    const attr = actor.system.attributes?.[attrKey];
    const roll = new Roll('1d20 + @save', { save: attr?.save ?? 0 });
    await roll.evaluate();
    roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${attrKey.toUpperCase()} Save` });
  }

  static async _onRollSkill(event, target) {
    const skillKey = target.closest('[data-skill]').dataset.skill;
    const actor = this.actor;
    if (typeof actor.rollSkillCheck === 'function') return actor.rollSkillCheck(skillKey);
    const skill = actor.system.skills?.[skillKey];
    const roll = new Roll('1d20 + @bonus', { bonus: skill?.bonus ?? 0 });
    await roll.evaluate();
    roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: skillKey });
  }

  static async _onCreateItem(event, target) {
    const type = target.dataset.type ?? 'feature';
    const [item] = await this.actor.createEmbeddedDocuments('Item', [{ name: game.i18n.format('DC20AltSheet.newItem', { type }), type }]);
    item?.sheet?.render(true);
  }

  static async _onEditItem(event, target) {
    const itemId = target.closest('[data-item-id]').dataset.itemId;
    this.actor.items.get(itemId)?.sheet?.render(true);
  }

  static async _onDeleteItem(event, target) {
    const item = this.actor.items.get(target.closest('[data-item-id]').dataset.itemId);
    if (!item) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('DC20AltSheet.deleteConfirm.title') },
      content: game.i18n.format('DC20AltSheet.deleteConfirm.content', { name: item.name }),
    });
    if (ok) item.delete();
  }

  static async _onToggleEquip(event, target) {
    const item = this.actor.items.get(target.closest('[data-item-id]').dataset.itemId);
    if (!item) return;
    item.update({ 'system.statuses.equipped': !item.system.statuses?.equipped });
  }

  static async _onUseItem(event, target) {
    const itemId = target.closest('[data-item-id]').dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    await recordItemUse(this.actor, itemId);
    if (typeof item.use === 'function') item.use();
  }
}
