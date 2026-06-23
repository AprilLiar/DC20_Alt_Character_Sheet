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
    'page-split':     { template: `modules/${MODULE_ID}/templates/parts/page-split.hbs`,     scrollable: ['.split-pane'] },
  };

  /** All pages the user can open, in display order */
  static PAGE_DEFS = [
    { id: 'core',      label: 'Core Stats'  },
    { id: 'combat',    label: 'Combat'      },
    { id: 'features',  label: 'Features'    },
    { id: 'inventory', label: 'Inventory'   },
    { id: 'biography', label: 'Info'        },
  ];

  /** Ordered list of currently-open tab page ids */
  _openTabs = [];
  /** Which page id is actively displayed (or null if none open) */
  _activeTab = null;
  /** Whether tab state has been loaded from actor flags */
  _tabsInitialized = false;
  /** Active combat filter */
  _combatFilter = 'all';
  /** Pending split-tab builder selection (left/right page ids) */
  _pendingSplit = { left: null, right: null };
  /** Page id currently being dragged (from a tab or the picker) */
  _dragPageId = null;

  /* -------------------------------------------- */
  /*  Tab State Persistence                        */
  /* -------------------------------------------- */

  /** True when an id refers to a split tab (two page ids joined by '+'). */
  _isSplitId(id) {
    return typeof id === 'string' && id.includes('+');
  }

  /** Validate a tab id — a single known page, or a split of two known pages. */
  _isValidTabId(id, valid) {
    if (this._isSplitId(id)) {
      const parts = id.split('+');
      return parts.length === 2 && parts.every(p => valid.has(p));
    }
    return valid.has(id);
  }

  /** Human-readable label for a single page id. */
  _labelOf(id) {
    return DC20AltCharacterSheet.PAGE_DEFS.find(p => p.id === id)?.label ?? id;
  }

  _loadTabState() {
    const state  = this.actor.flags?.[MODULE_ID]?.tabState;
    const valid  = new Set(DC20AltCharacterSheet.PAGE_DEFS.map(p => p.id));
    this._openTabs  = (state?.openTabs ?? []).filter(id => this._isValidTabId(id, valid));
    const savedActive = state?.activeTab;
    this._activeTab = (savedActive && this._isValidTabId(savedActive, valid) && this._openTabs.includes(savedActive))
      ? savedActive
      : (this._openTabs[0] ?? null);
  }

  /** Left-pane width fraction (0.25–0.75) for a split tab, persisted per id. */
  _getSplitRatio(id) {
    const r = this.actor.flags?.[MODULE_ID]?.splitRatios?.[id];
    return (typeof r === 'number') ? Math.min(0.75, Math.max(0.25, r)) : 0.5;
  }

  _saveSplitRatio(id, ratio) {
    const ratios = { ...(this.actor.flags?.[MODULE_ID]?.splitRatios ?? {}) };
    ratios[id] = Math.min(0.75, Math.max(0.25, ratio));
    this.actor.setFlag(MODULE_ID, 'splitRatios', ratios);
  }

  _saveTabState() {
    this.actor.setFlag(MODULE_ID, 'tabState', {
      openTabs:  [...this._openTabs],
      activeTab: this._activeTab,
    });
  }

  /* -------------------------------------------- */
  /*  Context Preparation                          */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    if (!this._tabsInitialized) {
      this._loadTabState();
      this._tabsInitialized = true;
    }
    const context = await super._prepareContext(options);
    context.actor      = this.actor;
    context.system     = this.actor.system;
    context.isEditable = this.isEditable;
    context.header     = prepareHeader(this.actor);
    return context;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch (partId) {
      case 'nav':
        return Object.assign(context, {
          openTabs: this._openTabs.map(id => {
            if (this._isSplitId(id)) {
              const [leftId, rightId] = id.split('+');
              return {
                id,
                isSplit: true,
                leftId,
                rightId,
                label:  `${this._labelOf(leftId)} | ${this._labelOf(rightId)}`,
                active: id === this._activeTab,
              };
            }
            return { id, isSplit: false, label: this._labelOf(id), active: id === this._activeTab };
          }),
          pageDefs: DC20AltCharacterSheet.PAGE_DEFS,
        });
      case 'page-core':      return Object.assign(context, await prepareCore(this.actor));
      case 'page-combat':    return Object.assign(context, await prepareCombat(this.actor), { combatFilter: this._combatFilter });
      case 'page-features':  return Object.assign(context, await prepareFeatures(this.actor));
      case 'page-inventory': return Object.assign(context, await prepareInventory(this.actor));
      case 'page-biography': return Object.assign(context, await prepareBiography(this.actor));
      case 'page-split':     return Object.assign(context, await this._prepareSplitContext());
    }
    return context;
  }

  /** Per-page data preparation, keyed by single-page id. */
  async _preparePageData(id) {
    switch (id) {
      case 'core':      return prepareCore(this.actor);
      case 'combat':    return prepareCombat(this.actor);
      case 'features':  return prepareFeatures(this.actor);
      case 'inventory': return prepareInventory(this.actor);
      case 'biography': return prepareBiography(this.actor);
    }
    return {};
  }

  /** Builds context for the active split tab (or an empty container). */
  async _prepareSplitContext() {
    if (!this._isSplitId(this._activeTab)) return { split: null };

    const id = this._activeTab;
    const [left, right] = id.split('+');
    const ratio = this._getSplitRatio(id);
    const common = {
      isEditable: this.isEditable,
      moduleId:   MODULE_ID,
      actor:      this.actor,
      system:     this.actor.system,
    };

    const [leftData, rightData] = await Promise.all([
      this._preparePageData(left),
      this._preparePageData(right),
    ]);

    return {
      split: {
        id,
        left,
        right,
        leftGrow:  Math.round(ratio * 100),
        rightGrow: Math.round((1 - ratio) * 100),
      },
      leftCtx:  { ...common, ...leftData },
      rightCtx: { ...common, ...rightData },
    };
  }

  /* -------------------------------------------- */
  /*  Form Submission                               */
  /* -------------------------------------------- */

  _prepareSubmitData(event, form, formData) {
    // formData.object is a deeply nested object; use foundry.utils helpers to
    // walk dot-notation paths so number inputs are coerced to integers before
    // DC20's data model validates them.
    for (const el of form.elements) {
      if (el.type !== 'number' || !el.name) continue;
      const raw = foundry.utils.getProperty(formData.object, el.name);
      if (raw === undefined || raw === null || raw === '') continue;
      const n = Number(raw);
      if (!isNaN(n)) foundry.utils.setProperty(formData.object, el.name, Math.trunc(n));
    }
    return super._prepareSubmitData(event, form, formData);
  }

  /* -------------------------------------------- */
  /*  Rendering                                    */
  /* -------------------------------------------- */

  _onRender(context, options) {
    super._onRender(context, options);
    this._bindBrowserTabs();
    this._bindCombatFilter();
    this._bindApPips();
    this._bindSplitBuilder();
    this._bindSplitDivider();
    this._registerContextMenu();
  }

  /* -------------------------------------------- */
  /*  Browser Tab Logic                            */
  /* -------------------------------------------- */

  _bindBrowserTabs() {
    const el = this.element;

    // Click on tab body → switch to that tab
    el.querySelectorAll('.browser-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        if (e.target.closest('.btab-close')) return;
        this._switchToTab(tab.dataset.page);
      });
    });

    // × close button
    el.querySelectorAll('.btab-close').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._closeTab(btn.dataset.closePage);
      });
    });

    // + button → toggle picker
    el.querySelector('.btab-add')?.addEventListener('click', e => {
      e.stopPropagation();
      this._togglePicker();
    });

    // Picker item → open (or switch to) a tab
    el.querySelectorAll('.picker-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this._openTab(btn.dataset.openPage);
        this._closePicker();
      });
    });

    // Click anywhere outside picker → close it
    el.addEventListener('click', e => {
      if (!e.target.closest('.tab-picker') && !e.target.closest('.btab-add')) {
        this._closePicker();
      }
    });

    this._bindTabDragDrop();
    this._applyPageVisibility();
  }

  _openTab(pageId) {
    if (!this._openTabs.includes(pageId)) {
      this._openTabs.push(pageId);
    }
    this._activeTab = pageId;
    this._saveTabState();
    this.render();
  }

  _closeTab(pageId) {
    const idx = this._openTabs.indexOf(pageId);
    if (idx === -1) return;
    this._openTabs.splice(idx, 1);
    if (this._activeTab === pageId) {
      this._activeTab = this._openTabs[Math.max(0, idx - 1)] ?? this._openTabs[0] ?? null;
    }
    this._saveTabState();
    this.render();
  }

  _switchToTab(pageId) {
    if (!this._openTabs.includes(pageId)) return;
    this._activeTab = pageId;
    // Split tabs need fresh per-half data, so re-render rather than toggle.
    if (this._isSplitId(pageId)) {
      this.render();
      return;
    }
    // Update active class on tabs without a full re-render
    this.element.querySelectorAll('.browser-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.page === pageId));
    this._applyPageVisibility();
  }

  _applyPageVisibility() {
    const active  = this._activeTab;
    const isSplit = this._isSplitId(active);

    this.element.querySelectorAll('.page-scroll[data-page]').forEach(el => {
      const show = !isSplit && el.dataset.page === active;
      el.classList.toggle('active', show);
      if (this.isEditable) this._setControlsDisabled(el, !show);
    });

    const splitView = this.element.querySelector('.split-view');
    if (splitView) {
      splitView.classList.toggle('active', isSplit);
      if (this.isEditable) this._setControlsDisabled(splitView, !isSplit);
    }
  }

  /**
   * Disable/enable form controls inside a hidden/visible container so that
   * duplicate field names across pages and split variants don't clobber each
   * other on submit (only the visible container's controls participate).
   */
  _setControlsDisabled(container, disabled) {
    container?.querySelectorAll('input, select, textarea').forEach(el => {
      el.disabled = disabled;
    });
  }

  _togglePicker() {
    this.element.querySelector('.tab-picker')?.classList.toggle('hidden');
  }

  _closePicker() {
    this.element.querySelector('.tab-picker')?.classList.add('hidden');
    this._resetPendingSplit();
  }

  _bindTabDragDrop() {
    const tabBar = this.element.querySelector('.browser-tab-bar');
    if (!tabBar) return;
    let dragSrcPage = null;

    tabBar.querySelectorAll('.browser-tab[draggable]').forEach(tab => {
      tab.addEventListener('dragstart', e => {
        dragSrcPage = tab.dataset.page;
        this._dragPageId = tab.dataset.page;
        tab.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      tab.addEventListener('dragend', () => {
        tab.classList.remove('dragging');
        tabBar.querySelectorAll('.browser-tab').forEach(t => t.classList.remove('drag-over'));
      });

      tab.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        tabBar.querySelectorAll('.browser-tab').forEach(t => t.classList.remove('drag-over'));
        if (tab.dataset.page !== dragSrcPage) tab.classList.add('drag-over');
      });

      tab.addEventListener('drop', e => {
        e.preventDefault();
        const tgtPage = tab.dataset.page;
        if (!dragSrcPage || dragSrcPage === tgtPage) return;
        const srcIdx = this._openTabs.indexOf(dragSrcPage);
        const tgtIdx = this._openTabs.indexOf(tgtPage);
        if (srcIdx === -1 || tgtIdx === -1) return;
        this._openTabs.splice(srcIdx, 1);
        this._openTabs.splice(tgtIdx, 0, dragSrcPage);
        this._saveTabState();
        this.render();
      });
    });
  }

  /* -------------------------------------------- */
  /*  Split Tab Builder                            */
  /* -------------------------------------------- */

  _bindSplitBuilder() {
    // Picker entries become drag sources for the split drop zones.
    this.element.querySelectorAll('.picker-item').forEach(btn => {
      btn.setAttribute('draggable', 'true');
      btn.addEventListener('dragstart', e => {
        this._dragPageId = btn.dataset.openPage;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', this._dragPageId);
      });
    });

    // The two drop zones in the picker that compose a split tab.
    this.element.querySelectorAll('.split-zone').forEach(zone => {
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const pageId = this._dragPageId;
        // Only single pages can fill a zone; splits can't be nested.
        if (!pageId || this._isSplitId(pageId)) return;
        const side = zone.dataset.splitSide;
        this._pendingSplit[side] = pageId;
        this._fillZone(zone, pageId);
        if (this._pendingSplit.left && this._pendingSplit.right) {
          this._createSplitTab(this._pendingSplit.left, this._pendingSplit.right);
        }
      });
    });
  }

  _fillZone(zone, pageId) {
    zone.classList.add('filled');
    zone.innerHTML =
      `<span class="btab-icon btab-icon-${pageId}"></span>` +
      `<span class="split-zone-label">${this._labelOf(pageId)}</span>`;
  }

  _resetPendingSplit() {
    this._pendingSplit = { left: null, right: null };
    this.element?.querySelectorAll('.split-zone').forEach(z => {
      z.classList.remove('filled');
      z.innerHTML = '<span class="split-zone-hint">put the tab here…</span>';
    });
  }

  _createSplitTab(left, right) {
    const id = `${left}+${right}`;
    if (!this._openTabs.includes(id)) this._openTabs.push(id);
    this._activeTab = id;
    this._resetPendingSplit();
    this._closePicker();
    this._saveTabState();
    this.render();
  }

  /* -------------------------------------------- */
  /*  Split Divider (resize)                       */
  /* -------------------------------------------- */

  _bindSplitDivider() {
    const divider = this.element.querySelector('.split-divider');
    const view    = this.element.querySelector('.split-view');
    if (!divider || !view) return;

    const left  = view.querySelector('.split-pane-left');
    const right = view.querySelector('.split-pane-right');
    const id    = view.dataset.splitId;
    if (!left || !right || !id) return;

    let dragging = false;
    let lastRatio = null;

    const onMove = (e) => {
      if (!dragging) return;
      const rect = view.getBoundingClientRect();
      let ratio = (e.clientX - rect.left) / rect.width;
      ratio = Math.min(0.75, Math.max(0.25, ratio));
      lastRatio = ratio;
      left.style.flexGrow  = String(Math.round(ratio * 100));
      right.style.flexGrow = String(Math.round((1 - ratio) * 100));
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove('dragging');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (lastRatio != null) this._saveSplitRatio(id, lastRatio);
    };

    divider.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      divider.classList.add('dragging');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  /* -------------------------------------------- */
  /*  Combat Filter                                */
  /* -------------------------------------------- */

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
      row.classList.toggle('hidden', filter !== 'all' && row.dataset.filterType !== filter);
    });
    this.element.querySelectorAll('.combat-create-btn').forEach(btn => {
      btn.classList.toggle('hidden', filter === 'all' || btn.dataset.createFilter !== filter);
    });
  }

  /* -------------------------------------------- */
  /*  AP Pips                                      */
  /* -------------------------------------------- */

  _bindApPips() {
    if (!this.isEditable) return;
    this.element.querySelectorAll('.ap-pip[data-pip-index]').forEach(pip => {
      pip.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(pip.dataset.pipIndex, 10);
        this.actor.update({ 'system.resources.ap.value': idx + 1 });
      });
      pip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(pip.dataset.pipIndex, 10);
        this.actor.update({ 'system.resources.ap.value': idx });
      });
    });
  }

  /* -------------------------------------------- */
  /*  Context Menu                                 */
  /* -------------------------------------------- */

  _registerContextMenu() {
    const CM = foundry.applications.ux.ContextMenu.implementation;
    new CM(this.element, '[data-item-id]', [
      {
        name: game.i18n.localize('DC20AltSheet.ctx.addFavourite'),
        icon: '<i class="fas fa-star"></i>',
        condition: (el) => !isFavourite(this.actor, el?.dataset?.itemId),
        callback: async (el) => {
          await addFavourite(this.actor, el?.dataset?.itemId);
          this.render();
        },
      },
      {
        name: game.i18n.localize('DC20AltSheet.ctx.removeFavourite'),
        icon: '<i class="far fa-star"></i>',
        condition: (el) => isFavourite(this.actor, el?.dataset?.itemId),
        callback: async (el) => {
          await removeFavourite(this.actor, el?.dataset?.itemId);
          this.render();
        },
      },
      {
        name: game.i18n.localize('DC20AltSheet.ctx.editItem'),
        icon: '<i class="fas fa-pencil-alt"></i>',
        callback: (el) => this.actor.items.get(el?.dataset?.itemId)?.sheet?.render(true),
      },
      {
        name: game.i18n.localize('DC20AltSheet.ctx.deleteItem'),
        icon: '<i class="fas fa-trash"></i>',
        callback: async (el) => {
          const item = this.actor.items.get(el?.dataset?.itemId);
          if (!item) return;
          const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize('DC20AltSheet.deleteConfirm.title') },
            content: game.i18n.format('DC20AltSheet.deleteConfirm.content', { name: item.name }),
          });
          if (ok) item.delete();
        },
      },
    ], { jQuery: false });
  }

  /* -------------------------------------------- */
  /*  Static Action Handlers                       */
  /* -------------------------------------------- */

  static async _onRollAttribute(event, target) {
    const attrKey = target.closest('[data-attr]').dataset.attr;
    return this.actor.roll(attrKey, 'check');
  }

  static async _onRollSave(event, target) {
    const attrKey = target.closest('[data-attr]').dataset.attr;
    return this.actor.roll(attrKey, 'save');
  }

  static async _onRollSkill(event, target) {
    const skillKey = target.closest('[data-skill]').dataset.skill;
    return this.actor.roll(skillKey, 'check');
  }

  static async _onCreateItem(event, target) {
    const type = target.dataset.type ?? 'feature';
    const [item] = await this.actor.createEmbeddedDocuments('Item', [{
      name: game.i18n.format('DC20AltSheet.newItem', { type }), type,
    }]);
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
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    await recordItemUse(this.actor, itemId);
    return item.roll();
  }
}
