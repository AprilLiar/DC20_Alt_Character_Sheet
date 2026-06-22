import { MODULE_ID } from '../dc20-alt-sheet.mjs';

const ATTR_LABELS = {
  mig: 'DC20AltSheet.attr.might',
  agi: 'DC20AltSheet.attr.agility',
  cha: 'DC20AltSheet.attr.charisma',
  int: 'DC20AltSheet.attr.intelligence',
};

const ITEM_TYPE_MAP = {
  weapon:      'weapons',
  equipment:   'equipment',
  consumable:  'consumables',
  loot:        'loot',
  feature:     'features',
  maneuver:    'maneuvers',
  spell:       'spells',
  technique:   'techniques',
  basicAction: 'basicActions',
};

export class DC20AltCharacterSheet extends foundry.applications.sheets.ActorSheetV2 {

  static DEFAULT_OPTIONS = {
    classes: ['dc20-alt-sheet'],
    position: { width: 980, height: 820 },
    actions: {
      rollAttribute:  DC20AltCharacterSheet._onRollAttribute,
      rollSave:       DC20AltCharacterSheet._onRollSave,
      rollSkill:      DC20AltCharacterSheet._onRollSkill,
      createItem:     DC20AltCharacterSheet._onCreateItem,
      editItem:       DC20AltCharacterSheet._onEditItem,
      deleteItem:     DC20AltCharacterSheet._onDeleteItem,
      toggleEquip:    DC20AltCharacterSheet._onToggleEquip,
      useItem:        DC20AltCharacterSheet._onUseItem,
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    header: {
      template: `modules/${MODULE_ID}/templates/parts/header.hbs`,
    },
    tabs: {
      template: 'templates/generic/tab-navigation.hbs',
    },
    'tab-main': {
      template: `modules/${MODULE_ID}/templates/parts/tab-main.hbs`,
      scrollable: ['.tab-body'],
    },
    'tab-combat': {
      template: `modules/${MODULE_ID}/templates/parts/tab-combat.hbs`,
      scrollable: ['.tab-body'],
    },
    'tab-features': {
      template: `modules/${MODULE_ID}/templates/parts/tab-features.hbs`,
      scrollable: ['.tab-body'],
    },
    'tab-inventory': {
      template: `modules/${MODULE_ID}/templates/parts/tab-inventory.hbs`,
      scrollable: ['.tab-body'],
    },
    'tab-details': {
      template: `modules/${MODULE_ID}/templates/parts/tab-details.hbs`,
      scrollable: ['.tab-body'],
    },
  };

  tabGroups = {
    primary: 'tab-main',
  };

  /* -------------------------------------------- */
  /*  Context Preparation                          */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;

    context.actor = actor;
    context.system = system;
    context.isEditable = this.isEditable;
    context.tabs = this._prepareTabs();

    context.attributes  = this._prepareAttributes(system.attributes ?? {});
    context.resources   = system.resources ?? {};
    context.defences    = system.defences ?? {};
    context.movement    = system.movement ?? {};
    context.senses      = system.senses ?? {};
    context.conditions  = system.conditions ?? {};
    context.damageReduction = system.damageReduction ?? {};
    context.details     = system.details ?? {};
    context.skills      = this._prepareSkills(system.skills ?? {});
    context.languages   = system.languages ?? {};
    context.currency    = system.currency ?? {};
    context.combatTraining = system.combatTraining ?? {};
    context.death       = system.death ?? {};
    context.saveDC      = system.saveDC ?? {};
    context.checkMod    = system.checkMod ?? {};
    context.attackMod   = system.attackMod ?? {};
    context.known       = system.known ?? {};
    context.size        = system.size ?? '';
    context.equipmentSlots = system.equipmentSlots ?? {};

    const groups = this._prepareItems(actor.items);
    Object.assign(context, groups);

    context.biography = await TextEditor.enrichHTML(
      system.details?.biography?.value ?? '',
      { relativeTo: actor, secrets: actor.isOwner },
    );

    return context;
  }

  _prepareTabs() {
    const defs = [
      { id: 'tab-main',      group: 'primary', icon: 'fas fa-user',         label: 'DC20AltSheet.tabs.main' },
      { id: 'tab-combat',    group: 'primary', icon: 'fas fa-shield-alt',   label: 'DC20AltSheet.tabs.combat' },
      { id: 'tab-features',  group: 'primary', icon: 'fas fa-star',         label: 'DC20AltSheet.tabs.features' },
      { id: 'tab-inventory', group: 'primary', icon: 'fas fa-backpack',     label: 'DC20AltSheet.tabs.inventory' },
      { id: 'tab-details',   group: 'primary', icon: 'fas fa-book',         label: 'DC20AltSheet.tabs.details' },
    ];
    const tabs = {};
    for (const t of defs) {
      t.active = this.tabGroups[t.group] === t.id;
      t.cssClass = t.active ? 'active' : '';
      tabs[t.id] = t;
    }
    return tabs;
  }

  _prepareAttributes(attributes) {
    return ['mig', 'agi', 'cha', 'int'].map(key => ({
      key,
      label: ATTR_LABELS[key],
      ...(attributes[key] ?? {}),
    }));
  }

  _prepareSkills(skills) {
    return Object.entries(skills).map(([key, skill]) => ({
      key,
      ...skill,
    }));
  }

  _prepareItems(items) {
    const groups = {
      weapons: [], equipment: [], consumables: [], loot: [],
      features: [], maneuvers: [], spells: [], techniques: [], basicActions: [],
    };
    for (const item of items) {
      const bucket = ITEM_TYPE_MAP[item.type];
      if (bucket) {
        const data = item.toObject();
        data.id  = item.id;
        data.img = item.img;
        groups[bucket].push(data);
      }
    }
    return groups;
  }

  /* -------------------------------------------- */
  /*  Action Handlers                              */
  /* -------------------------------------------- */

  static async _onRollAttribute(event, target) {
    const attrKey = target.closest('[data-attr]').dataset.attr;
    const actor = this.actor;
    if (typeof actor.rollAttributeCheck === 'function') {
      return actor.rollAttributeCheck(attrKey);
    }
    const attr = actor.system.attributes?.[attrKey];
    const roll = new Roll('1d20 + @check', { check: attr?.check ?? 0 });
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format('DC20AltSheet.roll.attribute', { attr: attrKey }),
    });
  }

  static async _onRollSave(event, target) {
    const attrKey = target.closest('[data-attr]').dataset.attr;
    const actor = this.actor;
    if (typeof actor.rollSave === 'function') {
      return actor.rollSave(attrKey);
    }
    const attr = actor.system.attributes?.[attrKey];
    const roll = new Roll('1d20 + @save', { save: attr?.save ?? 0 });
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format('DC20AltSheet.roll.save', { attr: attrKey }),
    });
  }

  static async _onRollSkill(event, target) {
    const skillKey = target.closest('[data-skill]').dataset.skill;
    const actor = this.actor;
    if (typeof actor.rollSkillCheck === 'function') {
      return actor.rollSkillCheck(skillKey);
    }
    const skill = actor.system.skills?.[skillKey];
    const roll = new Roll('1d20 + @bonus', { bonus: skill?.bonus ?? 0 });
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: skillKey,
    });
  }

  static async _onCreateItem(event, target) {
    const type = target.dataset.type ?? 'feature';
    const name = game.i18n.format('DC20AltSheet.newItem', { type });
    const [item] = await this.actor.createEmbeddedDocuments('Item', [{ name, type }]);
    item?.sheet?.render(true);
  }

  static async _onEditItem(event, target) {
    const itemId = target.closest('[data-item-id]').dataset.itemId;
    this.actor.items.get(itemId)?.sheet?.render(true);
  }

  static async _onDeleteItem(event, target) {
    const li = target.closest('[data-item-id]');
    const item = this.actor.items.get(li.dataset.itemId);
    if (!item) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('DC20AltSheet.deleteConfirm.title') },
      content: game.i18n.format('DC20AltSheet.deleteConfirm.content', { name: item.name }),
    });
    if (confirmed) item.delete();
  }

  static async _onToggleEquip(event, target) {
    const itemId = target.closest('[data-item-id]').dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    await item.update({ 'system.statuses.equipped': !item.system.statuses?.equipped });
  }

  static async _onUseItem(event, target) {
    const itemId = target.closest('[data-item-id]').dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (typeof item?.use === 'function') item.use();
  }
}
