import { MODULE_ID }        from '../constants.mjs';
import { prepareHeader }    from '../context/prepareHeader.mjs';
import { prepareCore }      from '../context/page1-core.mjs';
import { prepareCombat }    from '../context/page2-combat.mjs';
import { prepareFeatures }  from '../context/page3-features.mjs';
import { prepareInventory } from '../context/page4-inventory.mjs';
import { prepareBiography }  from '../context/page5-biography.mjs';
import { prepareStatistics } from '../context/page6-statistics.mjs';
import { prepareConditions } from '../context/page-conditions.mjs';
import { resetLifetimeStats } from '../helpers/stats.mjs';
import { addFavourite, removeFavourite, isFavourite, recordItemUse } from '../helpers/tracking.mjs';

export class DC20AltCharacterSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {

  static DEFAULT_OPTIONS = {
    classes: ['dc20-alt-sheet'],
    window: { resizable: true },
    position: { width: 810, height: 980 },
    actions: {
      rollAttribute: DC20AltCharacterSheet._onRollAttribute,
      rollSave:      DC20AltCharacterSheet._onRollSave,
      rollSkill:     DC20AltCharacterSheet._onRollSkill,
      rollTrade:     DC20AltCharacterSheet._onRollTrade,
      rollLanguage:  DC20AltCharacterSheet._onRollLanguage,
      createItem:    DC20AltCharacterSheet._onCreateItem,
      editItem:      DC20AltCharacterSheet._onEditItem,
      deleteItem:    DC20AltCharacterSheet._onDeleteItem,
      toggleEquip:   DC20AltCharacterSheet._onToggleEquip,
      toggleAttune:  DC20AltCharacterSheet._onToggleAttune,
      useItem:       DC20AltCharacterSheet._onUseItem,
      resetStats:    DC20AltCharacterSheet._onResetStats,
      rollBasic:     DC20AltCharacterSheet._onRollBasic,
      rollCustom:    DC20AltCharacterSheet._onRollCustom,
      addCustomRoll: DC20AltCharacterSheet._onAddCustomRoll,
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
    'page-biography':   { template: `modules/${MODULE_ID}/templates/parts/page-biography.hbs`,   scrollable: ['.page-scroll'] },
    'page-statistics':  { template: `modules/${MODULE_ID}/templates/parts/page-statistics.hbs`,  scrollable: ['.page-scroll'] },
    'page-conditions':  { template: `modules/${MODULE_ID}/templates/parts/page-conditions.hbs`,  scrollable: ['.page-scroll'] },
    'page-split':       { template: `modules/${MODULE_ID}/templates/parts/page-split.hbs`,        scrollable: ['.split-pane'] },
  };

  /** All pages the user can open, in display order */
  static PAGE_DEFS = [
    { id: 'core',      label: 'Core Stats'  },
    { id: 'combat',    label: 'Combat'      },
    { id: 'features',  label: 'Features'    },
    { id: 'inventory', label: 'Inventory'   },
    { id: 'biography',   label: 'Info'        },
    { id: 'statistics',  label: 'Statistics'  },
    { id: 'conditions',  label: 'Conditions'  },
  ];

  /** Ordered list of currently-open tab page ids */
  _openTabs = [];
  /** Which page id is actively displayed (or null if none open) */
  _activeTab = null;
  /** Whether tab state has been loaded from actor flags */
  _tabsInitialized = false;
  /** Active combat filter */
  _combatFilter = 'all';
  /** Which Core-tab west sub-panel is shown ('skills' | 'trades') */
  _coreSkillTab = 'skills';
  /** Pending split-tab builder selection (left/right/bottom page ids) */
  _pendingSplit = { left: null, right: null, bottom: null };
  /** Orientation for the pending split ('vertical' or 'horizontal') */
  _splitOrientation = 'vertical';
  /** Page id currently being dragged (from a tab or the picker) */
  _dragPageId = null;
  /** Active list-reorder drag, or null. { listEl, id } */
  _reorderState = null;
  /** True when the next item-row click should be swallowed (popup just closed) */
  _popupSuppressNext = false;

  /* -------------------------------------------- */
  /*  Tab State Persistence                        */
  /* -------------------------------------------- */

  /** True when an id refers to a split tab ('+' = vertical, '~' = horizontal). */
  _isSplitId(id) {
    return typeof id === 'string' && (id.includes('+') || id.includes('~'));
  }

  /** Parse a split id into { parts, isHorizontal }. */
  _parseSplitId(id) {
    if (id.includes('~')) return { parts: id.split('~'), isHorizontal: true };
    return { parts: id.split('+'), isHorizontal: false };
  }

  /** Validate a tab id — a single known page, or a split of two or three known pages. */
  _isValidTabId(id, valid) {
    if (this._isSplitId(id)) {
      const { parts } = this._parseSplitId(id);
      return (parts.length === 2 || parts.length === 3) && parts.every(p => valid.has(p));
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

  /** Returns { lr, tb } ratio object (0.25–0.75) for a split tab, persisted per id. */
  _getSplitRatio(id) {
    const r = this.actor.flags?.[MODULE_ID]?.splitRatios?.[id];
    if (r && typeof r === 'object') {
      return {
        lr: Math.min(0.75, Math.max(0.25, r.lr ?? 0.5)),
        tb: Math.min(0.75, Math.max(0.25, r.tb ?? 0.5)),
      };
    }
    // Backwards compat: old scalar value stored for 2-pane tabs
    const lr = (typeof r === 'number') ? Math.min(0.75, Math.max(0.25, r)) : 0.5;
    return { lr, tb: 0.5 };
  }

  _saveSplitRatio(id, ratios) {
    const all = { ...(this.actor.flags?.[MODULE_ID]?.splitRatios ?? {}) };
    all[id] = { lr: ratios.lr ?? 0.5, tb: ratios.tb ?? 0.5 };
    this.actor.setFlag(MODULE_ID, 'splitRatios', all);
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
              const { parts, isHorizontal } = this._parseSplitId(id);
              const [leftId, rightId, bottomId] = parts;
              const sep = isHorizontal ? '⇕' : '|';
              if (bottomId) {
                return {
                  id, isSplit: true, is3Pane: true, leftId, rightId, bottomId,
                  label: `${this._labelOf(leftId)} ${sep} ${this._labelOf(rightId)} + ${this._labelOf(bottomId)}`,
                  active: id === this._activeTab,
                };
              }
              return {
                id, isSplit: true, is3Pane: false, leftId, rightId,
                label: `${this._labelOf(leftId)} ${sep} ${this._labelOf(rightId)}`,
                active: id === this._activeTab,
              };
            }
            return { id, isSplit: false, label: this._labelOf(id), active: id === this._activeTab };
          }),
          pageDefs: DC20AltCharacterSheet.PAGE_DEFS,
        });
      case 'page-core':      return Object.assign(context, await prepareCore(this.actor), { coreSkillTab: this._coreSkillTab });
      case 'page-combat':    return Object.assign(context, await prepareCombat(this.actor), { combatFilter: this._combatFilter });
      case 'page-features':  return Object.assign(context, await prepareFeatures(this.actor));
      case 'page-inventory': return Object.assign(context, await prepareInventory(this.actor));
      case 'page-biography':  return Object.assign(context, await prepareBiography(this.actor));
      case 'page-statistics': return Object.assign(context, await prepareStatistics(this.actor));
      case 'page-conditions': return Object.assign(context, prepareConditions(this.actor));
      case 'page-split':      return Object.assign(context, await this._prepareSplitContext());
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
      case 'biography':  return prepareBiography(this.actor);
      case 'statistics': return prepareStatistics(this.actor);
      case 'conditions': return prepareConditions(this.actor);
    }
    return {};
  }

  /** Builds context for the active split tab (or an empty container). */
  async _prepareSplitContext() {
    if (!this._isSplitId(this._activeTab)) return { split: null };

    const id = this._activeTab;
    const { parts, isHorizontal } = this._parseSplitId(id);
    const [left, right, bottom] = parts;
    const ratio = this._getSplitRatio(id);
    const common = {
      isEditable:   this.isEditable,
      moduleId:     MODULE_ID,
      actor:        this.actor,
      system:       this.actor.system,
      coreSkillTab: this._coreSkillTab,
    };

    if (bottom) {
      const [leftData, rightData, bottomData] = await Promise.all([
        this._preparePageData(left),
        this._preparePageData(right),
        this._preparePageData(bottom),
      ]);
      return {
        split: {
          id, left, right, bottom, isHorizontal: false,
          leftGrow:   Math.round(ratio.lr * 100),
          rightGrow:  Math.round((1 - ratio.lr) * 100),
          topGrow:    Math.round(ratio.tb * 100),
          bottomGrow: Math.round((1 - ratio.tb) * 100),
        },
        leftCtx:   { ...common, ...leftData },
        rightCtx:  { ...common, ...rightData },
        bottomCtx: { ...common, ...bottomData },
      };
    }

    const [leftData, rightData] = await Promise.all([
      this._preparePageData(left),
      this._preparePageData(right),
    ]);
    return {
      split: {
        id, left, right, isHorizontal,
        leftGrow:  Math.round((isHorizontal ? ratio.tb : ratio.lr) * 100),
        rightGrow: Math.round((1 - (isHorizontal ? ratio.tb : ratio.lr)) * 100),
      },
      leftCtx:  { ...common, ...leftData },
      rightCtx: { ...common, ...rightData },
    };
  }

  /* -------------------------------------------- */
  /*  Form Submission                               */
  /* -------------------------------------------- */

  _prepareSubmitData(event, form, formData) {
    // Duplicate field names (header + page, or split pane + hidden full page) can produce
    // arrays when FormDataExtended includes disabled elements. Resolve every array to a
    // scalar: prefer the value from whichever element triggered the change, else take last.
    for (const key of Object.keys(formData.object)) {
      const val = foundry.utils.getProperty(formData.object, key);
      if (!Array.isArray(val)) continue;
      const picked = (event?.target?.name === key && event.target.value !== undefined)
        ? event.target.value
        : val[val.length - 1] ?? '';
      foundry.utils.setProperty(formData.object, key, picked);
    }
    // Coerce number inputs to integers (array case already resolved above)
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
    this._bindCoreSkillTabs();
    this._bindApPips();
    this._bindResourceDropdown();
    this._bindSplitBuilder();
    this._bindSplitDivider();
    this._registerContextMenu();
    this._bindQuickSlots();
    this._bindListReorder();
    this._bindConditionToggles();
    this._bindConditionEffects();
    this._bindBiographyAutoSave();
    this._bindItemPopup();
    this._bindPortraitFit();
  }

  /**
   * Keep the Core portrait a centred square that shrinks to the largest size
   * fitting its zone, so it scales down as the window is resized.
   */
  _bindPortraitFit() {
    this._portraitRO?.disconnect();
    const zones = [...this.element.querySelectorAll('.core-portrait-zone')];
    if (!zones.length) { this._portraitRO = null; return; }

    const fit = (zone) => {
      const frame = zone.querySelector('.portrait-frame');
      if (!frame) return;
      const identity = zone.querySelector('.identity-block');
      const cs   = getComputedStyle(zone);
      const gap  = parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0;
      const padV = (parseFloat(cs.paddingTop)  || 0) + (parseFloat(cs.paddingBottom) || 0);
      const padH = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight)  || 0);
      const availH = zone.clientHeight - padV - (identity ? identity.offsetHeight + gap : 0);
      const availW = zone.clientWidth  - padH;
      const side   = Math.max(40, Math.floor(Math.min(availW, availH)));
      frame.style.width  = `${side}px`;
      frame.style.height = `${side}px`;
    };

    this._portraitRO = new ResizeObserver(() => zones.forEach(fit));
    zones.forEach(z => { this._portraitRO.observe(z); fit(z); });
  }

  _onClose(options) {
    this._portraitRO?.disconnect();
    this._portraitRO = null;
    super._onClose(options);
  }

  _bindBiographyAutoSave() {
    const bioEl = this.element.querySelector('.bio-editor');
    if (bioEl) {
      const save = foundry.utils.debounce(
        (v) => this.actor.setFlag(MODULE_ID, 'biography', v),
        500,
      );
      bioEl.addEventListener('input', () => save(bioEl.value));
    }
    const notesEl = this.element.querySelector('.campaign-notes-editor');
    if (notesEl) {
      const save = foundry.utils.debounce(
        (v) => this.actor.setFlag(MODULE_ID, 'campaignNotes', v),
        500,
      );
      notesEl.addEventListener('input', () => save(notesEl.value));
    }
  }

  /** Reuse a single popup element across re-renders so it stays above sheet content. */
  _ensurePopup() {
    let popup = this.element.querySelector('.item-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'item-popup hidden';
      popup.innerHTML =
        '<div class="item-popup-name"></div>' +
        '<div class="item-popup-desc"></div>';
      this.element.appendChild(popup);
    }
    return popup;
  }

  /** Open the shared read-only popup with a title + rich HTML body, anchored to an element. */
  _openPopup(name, descHtml, anchorEl) {
    if (this._popupSuppressNext) return;
    const popup = this._ensurePopup();
    popup.querySelector('.item-popup-name').textContent = name ?? '';
    popup.querySelector('.item-popup-desc').innerHTML = descHtml ?? '';

    // Show off-screen to measure actual rendered dimensions (respects CSS scale).
    popup.style.visibility = 'hidden';
    popup.style.left = '-9999px';
    popup.style.top  = '-9999px';
    popup.classList.remove('hidden');
    const W = popup.offsetWidth  || 290;
    const H = popup.offsetHeight || 320;

    // Position below the anchor, clamped to viewport.
    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left;
    let top  = rect.bottom + 4;
    if (left + W > window.innerWidth  - 8) left = window.innerWidth  - W - 8;
    if (top  + H > window.innerHeight - 8) top  = rect.top - H - 4;
    if (top < 8) top = 8;
    popup.style.left = `${Math.max(8, left)}px`;
    popup.style.top  = `${top}px`;
    popup.style.visibility = '';

    // Close when clicking outside the popup (capture phase fires before row handlers).
    const close = (e) => {
      if (popup.contains(e.target)) return; // click inside popup — allow scrolling/reading
      popup.classList.add('hidden');
      document.removeEventListener('click', close, true);
      // Suppress the row click handler that rides the same event.
      this._popupSuppressNext = true;
      Promise.resolve().then(() => { this._popupSuppressNext = false; });
    };
    document.addEventListener('click', close, true);
  }

  _bindItemPopup() {
    const SELECTORS = '.combat-action-row[data-item-id], .item-row[data-item-id], .qol-row[data-item-id], .sc-item-row[data-item-id]';
    this.element.querySelectorAll(SELECTORS).forEach(row => {
      row.addEventListener('click', (e) => {
        // Let buttons, inputs, selects, and images handle themselves normally.
        if (e.target.closest('button, select, input, img')) return;
        const item = this.actor.items.get(row.dataset.itemId);
        if (!item) return;
        const rawDesc = item.system?.description;
        const html = typeof rawDesc === 'string' ? rawDesc : (rawDesc?.value ?? '');
        this._openPopup(item.name, html, row);
      });
    });
  }

  /** Find an effect by id across the actor's own + item-transferred effects. */
  _findEffect(effectId) {
    const all = this.actor.allEffects ?? this.actor.effects ?? [];
    for (const e of all) if (e.id === effectId) return e;
    return null;
  }

  /** Conditions tab: left-click an Active Effect to read it, right-click to edit it. */
  _bindConditionEffects() {
    this.element.querySelectorAll('.effect-row[data-effect-id]').forEach(row => {
      const effectId = row.dataset.effectId;
      row.addEventListener('click', () => {
        const eff = this._findEffect(effectId);
        if (!eff) return;
        this._openPopup(eff.name, eff.description ?? '', row);
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._findEffect(effectId)?.sheet?.render(true);
      });
    });
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
      tab.addEventListener('mousedown', e => {
        if (e.button !== 1) return;
        e.preventDefault();
        this._closeTab(tab.dataset.page);
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

    // Support 2-pane vertical, 2-pane horizontal, and 3-pane containers
    const splitContainer = this.element.querySelector('.split-view')
      ?? this.element.querySelector('.split-view-h')
      ?? this.element.querySelector('.split-view-3');
    if (splitContainer) {
      splitContainer.classList.toggle('active', isSplit);
      if (this.isEditable) this._setControlsDisabled(splitContainer, !isSplit);
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

    // Orientation toggle (vertical / horizontal).
    this.element.querySelectorAll('.split-orient-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._splitOrientation = btn.dataset.orient;
        this.element.querySelectorAll('.split-orient-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.orient === this._splitOrientation));
        // Horizontal splits can't have a 3rd pane — hide bottom zone.
        const bottomWrap = this.element.querySelector('.split-bottom-wrap');
        if (bottomWrap) {
          if (this._splitOrientation === 'horizontal') {
            bottomWrap.classList.add('hidden');
            this._pendingSplit.bottom = null;
          } else {
            const { left, right } = this._pendingSplit;
            bottomWrap.classList.toggle('hidden', !(left && right));
          }
        }
      });
    });

    // Drop zones (left, right, and optional bottom).
    this.element.querySelectorAll('.split-zone').forEach(zone => {
      // Click on a filled zone to clear it.
      zone.addEventListener('click', () => {
        if (!zone.classList.contains('filled')) return;
        const side = zone.dataset.splitSide;
        this._pendingSplit[side] = null;
        zone.classList.remove('filled');
        const hint = side === 'bottom' ? 'optional bottom panel…' : 'drop a tab here…';
        zone.innerHTML = `<span class="split-zone-hint">${hint}</span>`;
        this._updateSplitBuilder();
      });
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
        this._updateSplitBuilder();
      });
    });

    // Create Split button — active once left+right are filled.
    const createBtn = this.element.querySelector('.split-create-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const { left, right, bottom } = this._pendingSplit;
        if (!left || !right) return;
        const horiz = this._splitOrientation === 'horizontal';
        this._createSplitTab(left, right, horiz ? null : (bottom || null), horiz);
      });
    }
  }

  /** Show/enable the bottom zone and create button once left+right are both filled. */
  _updateSplitBuilder() {
    const { left, right } = this._pendingSplit;
    const bothFilled = !!(left && right);
    this.element?.querySelector('.split-bottom-wrap')?.classList.toggle('hidden', !bothFilled);
    const createBtn = this.element?.querySelector('.split-create-btn');
    if (createBtn) createBtn.disabled = !bothFilled;
  }

  _fillZone(zone, pageId) {
    zone.classList.add('filled');
    zone.innerHTML =
      `<span class="btab-icon btab-icon-${pageId}"></span>` +
      `<span class="split-zone-label">${this._labelOf(pageId)}</span>`;
  }

  _resetPendingSplit() {
    this._pendingSplit = { left: null, right: null, bottom: null };
    this.element?.querySelectorAll('.split-zone').forEach(z => {
      z.classList.remove('filled');
      const hint = z.dataset.splitSide === 'bottom' ? 'optional bottom panel…' : 'put the tab here…';
      z.innerHTML = `<span class="split-zone-hint">${hint}</span>`;
    });
    this.element?.querySelector('.split-bottom-wrap')?.classList.add('hidden');
    const btn = this.element?.querySelector('.split-create-btn');
    if (btn) btn.disabled = true;
  }

  _createSplitTab(left, right, bottom = null, horizontal = false) {
    let id;
    if (bottom) id = `${left}+${right}+${bottom}`;
    else if (horizontal) id = `${left}~${right}`;
    else id = `${left}+${right}`;
    if (!this._openTabs.includes(id)) this._openTabs.push(id);
    this._activeTab = id;
    this._closePicker();
    this._saveTabState();
    this.render();
  }

  /* -------------------------------------------- */
  /*  Split Divider (resize)                       */
  /* -------------------------------------------- */

  _bindSplitDivider() {
    const view = this.element.querySelector('.split-view-3')
      ?? this.element.querySelector('.split-view-h')
      ?? this.element.querySelector('.split-view');
    if (!view) return;
    const id = view.dataset.splitId;
    if (!id) return;

    const ratio = this._getSplitRatio(id);
    let currentLr = ratio.lr;
    let currentTb = ratio.tb;

    // Vertical divider (left ↔ right) — exclude the horizontal divider from fallback match
    const vDiv = view.querySelector('.split-divider-v') ?? view.querySelector('.split-divider:not(.split-divider-h)');
    if (vDiv) {
      const paneL = view.querySelector('.split-pane-left');
      const paneR = view.querySelector('.split-pane-right');
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const rect = view.getBoundingClientRect();
        let r = (e.clientX - rect.left) / rect.width;
        r = Math.min(0.75, Math.max(0.25, r));
        currentLr = r;
        if (paneL) paneL.style.flexGrow = String(Math.round(r * 100));
        if (paneR) paneR.style.flexGrow = String(Math.round((1 - r) * 100));
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        vDiv.classList.remove('dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        this._saveSplitRatio(id, { lr: currentLr, tb: currentTb });
      };
      vDiv.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dragging = true;
        vDiv.classList.add('dragging');
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });
    }

    // Horizontal divider (top ↔ bottom) — 3-pane uses .split-row-top/.split-row-bottom;
    // 2-pane horizontal uses .split-pane-left (top) / .split-pane-right (bottom)
    const hDiv = view.querySelector('.split-divider-h');
    if (hDiv) {
      const topEl = view.querySelector('.split-row-top') ?? view.querySelector('.split-pane-left');
      const botEl = view.querySelector('.split-row-bottom') ?? view.querySelector('.split-pane-right');
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const rect = view.getBoundingClientRect();
        let r = (e.clientY - rect.top) / rect.height;
        r = Math.min(0.75, Math.max(0.25, r));
        currentTb = r;
        if (topEl) topEl.style.flexGrow = String(Math.round(r * 100));
        if (botEl) botEl.style.flexGrow = String(Math.round((1 - r) * 100));
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        hDiv.classList.remove('dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        this._saveSplitRatio(id, { lr: currentLr, tb: currentTb });
      };
      hDiv.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dragging = true;
        hDiv.classList.add('dragging');
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });
    }
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
    // Track active filter on the container so CSS can show/hide the type badge
    this.element.querySelectorAll('.combat-actions').forEach(el => {
      el.dataset.activeFilter = filter;
    });
  }

  /* -------------------------------------------- */
  /*  Header Resource Dropdown                      */
  /* -------------------------------------------- */

  _bindResourceDropdown() {
    const dd = this.element.querySelector('.hstrip-dd');
    if (!dd) return;
    const toggle = dd.querySelector('.hstrip-dd-toggle');
    const panel  = dd.querySelector('.hstrip-dd-panel');
    if (!toggle || !panel) return;

    const closePanel = () => {
      panel.classList.add('hidden');
      dd.classList.remove('open');
      document.removeEventListener('mousedown', onDoc, true);
    };
    const onDoc = (ev) => { if (!dd.contains(ev.target)) closePanel(); };

    toggle.addEventListener('click', (e) => {
      // Editing the collapsed bar inputs shouldn't toggle the panel.
      if (e.target.closest('input')) return;
      if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        dd.classList.add('open');
        document.addEventListener('mousedown', onDoc, true);
      } else {
        closePanel();
      }
    });

    // Pick which resource shows collapsed in the header.
    dd.querySelectorAll('.res-name[data-select-resource]').forEach(name => {
      name.addEventListener('click', (e) => {
        e.stopPropagation();
        this.actor.setFlag(MODULE_ID, 'headerResource', name.dataset.selectResource);
      });
    });

    // Create a new resource — a real DC20 custom resource so it can be used
    // everywhere (token bars, formulas, the system sheet). We keep the chosen
    // colour in a flag keyed by the resource's key.
    dd.querySelector('.res-create-btn')?.addEventListener('click', async () => {
      const name  = (dd.querySelector('.res-create-name')?.value || '').trim();
      if (!name) return;
      const color = dd.querySelector('.res-create-color')?.value || '#9988cc';
      const key   = foundry.utils.randomID(8);
      const colors = { ...(this.actor.flags?.[MODULE_ID]?.resourceColors ?? {}) };
      colors[key] = color;
      await this.actor.update({
        [`system.resources.custom.${key}`]: {
          name, img: '', value: 0, max: 0, maxFormula: '5', bonus: 0, reset: '',
        },
      });
      await this.actor.setFlag(MODULE_ID, 'resourceColors', colors);
    });

    // Right-click a resource we created to remove it (deletes the system
    // resource + its colour entry).
    dd.querySelectorAll('.res-row[data-res-custom-key]').forEach(row => {
      row.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = row.dataset.resCustomKey;
        const colors = { ...(this.actor.flags?.[MODULE_ID]?.resourceColors ?? {}) };
        delete colors[key];
        if (this.actor.flags?.[MODULE_ID]?.headerResource === `custom.${key}`) {
          await this.actor.setFlag(MODULE_ID, 'headerResource', 'health');
        }
        await this.actor.setFlag(MODULE_ID, 'resourceColors', colors);
        await this.actor.update({ [`system.resources.custom.-=${key}`]: null });
      });
    });
  }

  /* -------------------------------------------- */
  /*  Core Skills / Trades Sub-tabs                */
  /* -------------------------------------------- */

  _bindCoreSkillTabs() {
    this.element.querySelectorAll('.core-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._coreSkillTab = btn.dataset.coreSubtab;
        // Toggle every core panel on the sheet (handles split panes too).
        this.element.querySelectorAll('.core-subtab-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.coreSubtab === this._coreSkillTab));
        this.element.querySelectorAll('.core-subpanel').forEach(p =>
          p.classList.toggle('hidden', p.dataset.coreSubpanel !== this._coreSkillTab));
      });
    });
  }

  /* -------------------------------------------- */
  /*  Conditions (apply / remove)                  */
  /* -------------------------------------------- */

  /**
   * Left-click a condition cell to apply it (adds a stack for stackable
   * conditions); right-click to remove one stack. Delegates to the DC20
   * system's toggleStatusEffect so stacking/immunity rules are respected.
   */
  _bindConditionToggles() {
    if (!this.isEditable) return;
    this.element.querySelectorAll('.cond-cell[data-status-id]').forEach(cell => {
      const statusId = cell.dataset.statusId;
      cell.addEventListener('mousedown', e => {
        if (e.button !== 0 && e.button !== 2) return;
        e.preventDefault();
        this.actor.toggleStatusEffect(statusId, { active: e.button === 0 });
      });
      // Suppress the browser context menu so right-click can remove a stack.
      cell.addEventListener('contextmenu', e => e.preventDefault());
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
  /*  Quick Access Slots                           */
  /* -------------------------------------------- */

  _bindQuickSlots() {
    const el = this.element;

    // Skills — draggable to quick slots
    el.querySelectorAll('.skill-row[data-skill]').forEach(row => {
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', e => {
        const key   = row.dataset.skill;
        const label = row.querySelector('.skill-name')?.textContent?.trim() ?? key;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'skill', key, label, img: '' }));
      });
    });

    // Trades — draggable to quick slots
    el.querySelectorAll('.skill-row[data-trade], .sc-skill-row[data-trade]').forEach(row => {
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', e => {
        const key   = row.dataset.trade;
        const label = row.querySelector('.skill-name, .sc-skill-name')?.textContent?.trim() ?? key;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'trade', key, label, img: '' }));
      });
    });

    // Items (all types: weapons, spells, maneuvers, features, etc.) — draggable to quick slots
    el.querySelectorAll('.combat-action-row[data-item-id], .item-row[data-item-id], .qol-row[data-item-id], .sc-item-row[data-item-id]').forEach(row => {
      const itemId = row.dataset.itemId;
      const item   = this.actor.items.get(itemId);
      if (!item) return;
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'item', id: itemId, label: item.name, img: item.img }));
      });
    });

    // Basic check tiles — draggable to quick slots
    el.querySelectorAll('.roll-tile-basic[data-roll-key]').forEach(tile => {
      tile.addEventListener('dragstart', e => {
        const rollKey = tile.dataset.rollKey;
        const label   = tile.dataset.rollLabel ?? rollKey;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'roll', rollKey, label }));
      });
    });

    // Custom roll tiles — draggable to quick slots
    el.querySelectorAll('.roll-tile-custom[data-roll-id]').forEach(tile => {
      tile.addEventListener('dragstart', e => {
        const id    = tile.dataset.rollId;
        const label = tile.dataset.rollName ?? '';
        const bonus = Number(tile.dataset.rollBonus) || 0;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'customRoll', id, label, bonus }));
      });
    });

    // Quick slot drag-drop + click events
    el.querySelectorAll('.quick-slot[data-slot-index]').forEach(slot => {
      const idx = parseInt(slot.dataset.slotIndex, 10);

      slot.addEventListener('click', () => this._activateQuickSlot(idx));

      slot.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (slot.classList.contains('filled')) {
          this._clearQuickSlot(idx);
        } else {
          this._removeQuickSlot(idx);
        }
      });

      slot.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        slot.classList.add('drag-over');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', e => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        this._dropOnQuickSlot(idx, e.dataTransfer);
      });
    });

    el.querySelector('.qs-add-btn')?.addEventListener('click', () => this._addQuickSlot());
  }

  async _activateQuickSlot(idx) {
    const slot = (this.actor.flags?.[MODULE_ID]?.quickSlots ?? [])[idx];
    if (!slot) return;
    if (slot.type === 'item') {
      const item = this.actor.items.get(slot.id);
      if (item) return item.roll?.();
    } else if (slot.type === 'skill' || slot.type === 'trade' || slot.type === 'language') {
      return this.actor.roll?.(slot.id, 'check');
    } else if (slot.type === 'roll') {
      return this._rollBasicCheck(slot.rollKey, slot.label);
    } else if (slot.type === 'customRoll') {
      // Prefer the live definition (reflects edits); fall back to the stored snapshot.
      const live = this._getCustomRolls().find(r => r.id === slot.id);
      return this._rollCustomCheck(live?.name ?? slot.label, live?.bonus ?? slot.bonus);
    }
  }

  async _clearQuickSlot(idx) {
    const slots = [...(this.actor.flags?.[MODULE_ID]?.quickSlots ?? [])];
    if (idx < slots.length) slots[idx] = null;
    await this.actor.setFlag(MODULE_ID, 'quickSlots', slots);
    this.render();
  }

  async _removeQuickSlot(idx) {
    const slots = [...(this.actor.flags?.[MODULE_ID]?.quickSlots ?? [])];
    slots.splice(idx, 1);
    await this.actor.setFlag(MODULE_ID, 'quickSlots', slots);
    this.render();
  }

  async _addQuickSlot() {
    const slots = [...(this.actor.flags?.[MODULE_ID]?.quickSlots ?? [])];
    if (slots.length === 0) {
      // Re-init to 4 empty if slots were somehow cleared entirely
      slots.push(null, null, null, null);
    } else {
      slots.push(null);
    }
    await this.actor.setFlag(MODULE_ID, 'quickSlots', slots);
    this.render();
  }

  async _dropOnQuickSlot(idx, dataTransfer) {
    let data;
    try {
      const raw = dataTransfer.getData('application/json') || dataTransfer.getData('text/plain');
      data = JSON.parse(raw);
    } catch {
      return;
    }

    let entry = null;

    if (data.type === 'skill' || data.type === 'trade' || data.type === 'language') {
      const abbr = (data.label ?? data.key ?? '').slice(0, 3).toUpperCase();
      entry = { type: data.type, id: data.key, label: data.label, abbr, img: '' };
    } else if (data.type === 'roll') {
      const abbr = (data.label ?? '').slice(0, 3).toUpperCase();
      entry = { type: 'roll', rollKey: data.rollKey, label: data.label, abbr, img: '' };
    } else if (data.type === 'customRoll') {
      const abbr = (data.label ?? '').slice(0, 3).toUpperCase();
      entry = { type: 'customRoll', id: data.id, bonus: data.bonus, label: data.label, abbr, img: '' };
    } else if (data.type === 'item') {
      entry = { type: 'item', id: data.id, label: data.label, img: data.img ?? '', abbr: '' };
    } else if (data.type === 'Item') {
      // FoundryVTT native sidebar drag
      try {
        const item = await fromUuid(data.uuid ?? '');
        if (item && item.parent?.id === this.actor.id) {
          entry = { type: 'item', id: item.id, label: item.name, img: item.img ?? '', abbr: '' };
        }
      } catch { /* uuid not resolvable */ }
    }

    if (!entry) return;
    const slots = [...(this.actor.flags?.[MODULE_ID]?.quickSlots ?? [])];
    while (slots.length <= idx) slots.push(null);
    slots[idx] = entry;
    await this.actor.setFlag(MODULE_ID, 'quickSlots', slots);
    this.render();
  }

  /* -------------------------------------------- */
  /*  Manual List Reordering (drag to sort)        */
  /* -------------------------------------------- */

  /**
   * Make rows inside any [data-reorder-list] container drag-sortable.
   * Two persistence modes:
   *   - "flag": reorder a flag array of item ids (Favourites, Last Used).
   *   - "sort": reassign each item's Foundry `sort` field (Combat, Inventory, Features).
   * Coexists with quick-slot dragging — the drop target decides the behaviour.
   */
  _bindListReorder() {
    this.element.querySelectorAll('[data-reorder-list]').forEach(list => {
      const rows = [...list.children].filter(c => c.dataset && c.dataset.itemId);
      rows.forEach(row => {
        row.setAttribute('draggable', 'true');

        row.addEventListener('dragstart', () => {
          this._reorderState = { listEl: list, id: row.dataset.itemId };
          row.classList.add('reordering');
        });

        row.addEventListener('dragend', () => {
          row.classList.remove('reordering');
          rows.forEach(r => r.classList.remove('reorder-over'));
          this._reorderState = null;
        });

        row.addEventListener('dragover', e => {
          if (!this._reorderState || this._reorderState.listEl !== list) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          rows.forEach(r => r.classList.remove('reorder-over'));
          if (row.dataset.itemId !== this._reorderState.id) row.classList.add('reorder-over');
        });

        row.addEventListener('drop', e => {
          if (!this._reorderState || this._reorderState.listEl !== list) return;
          e.preventDefault();
          e.stopPropagation();
          const srcId = this._reorderState.id;
          const tgtId = row.dataset.itemId;
          row.classList.remove('reorder-over');
          if (srcId && tgtId && srcId !== tgtId) this._reorderList(list, srcId, tgtId);
        });
      });
    });
  }

  /** Compute the new id order for a list after moving srcId before tgtId, then persist. */
  async _reorderList(list, srcId, tgtId) {
    const ids = [...list.children].filter(c => c.dataset?.itemId).map(c => c.dataset.itemId);
    const from = ids.indexOf(srcId);
    if (from === -1) return;
    ids.splice(from, 1);
    const to = ids.indexOf(tgtId);
    if (to === -1) return;
    ids.splice(to, 0, srcId);

    if (list.dataset.reorderMode === 'flag') {
      const key = list.dataset.reorderKey;
      if (!key) return;
      // Preserve any stored ids that aren't currently displayed (e.g. unresolved items).
      const current = this.actor.getFlag(MODULE_ID, key) ?? [];
      const extras  = current.filter(id => !ids.includes(id));
      await this.actor.setFlag(MODULE_ID, key, [...ids, ...extras]);
      this.render();
    } else {
      // "sort" mode — reassign Foundry sort values; the item update re-renders the sheet.
      const density = CONST?.SORT_INTEGER_DENSITY ?? 100000;
      const updates = ids.map((id, i) => ({ _id: id, sort: (i + 1) * density }));
      await this.actor.updateEmbeddedDocuments('Item', updates);
    }
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

    // Custom roll tiles — edit / remove (basic tiles have no menu)
    new CM(this.element, '.roll-tile-custom[data-roll-id]', [
      {
        name: 'Edit',
        icon: '<i class="fas fa-pencil-alt"></i>',
        callback: (el) => this._editCustomRoll(el?.dataset?.rollId),
      },
      {
        name: 'Remove',
        icon: '<i class="fas fa-trash"></i>',
        callback: (el) => this._removeCustomRoll(el?.dataset?.rollId),
      },
    ], { jQuery: false, fixed: true });
  }

  /* -------------------------------------------- */
  /*  Roll Tiles (basic + custom)                  */
  /* -------------------------------------------- */

  /** Roll one of the fixed DC20 basic checks via the system's roll dialog. */
  _rollBasicCheck(key, label) {
    if (!key) return;
    // 'att' isn't in the system's label map, so pass an explicit label for the chat card.
    const options = label ? { customLabel: label } : {};
    return this.actor.roll(key, 'check', options);
  }

  /**
   * Roll a custom (name + flat bonus) check through the DC20 roll dialog.
   * We hand the dialog a pre-built details object with a customFormula so the
   * system still applies advantage/disadvantage to the d20.
   */
  _rollCustomCheck(name, bonus) {
    const b = Number(bonus) || 0;
    const formula = b === 0 ? 'd20' : (b > 0 ? `d20 + ${b}` : `d20 - ${Math.abs(b)}`);
    const label = name || 'Custom Roll';
    const details = {
      roll:          formula,
      customFormula: formula,
      label,
      rollTitle:     label,
      type:          'flat',
      against:       null,
      checkKey:      'flat',
      statuses:      [],
    };
    return this.actor.roll(null, 'check', {}, details);
  }

  _getCustomRolls() {
    return [...(this.actor.flags?.[MODULE_ID]?.customRolls ?? [])];
  }

  /** Dialog to capture a custom roll's name + bonus. Returns {name, bonus} or null. */
  async _promptCustomRoll(existing = null) {
    const nameVal  = (existing?.name ?? '').replaceAll('"', '&quot;');
    const bonusVal = existing?.bonus ?? 0;
    const content = `
      <div class="dc20-custom-roll-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${nameVal}" placeholder="e.g. Initiative (Adv)" autofocus>
        </div>
        <div class="form-group">
          <label>Bonus</label>
          <input type="number" name="bonus" value="${bonusVal}" step="1">
        </div>
      </div>`;
    const result = await foundry.applications.api.DialogV2.wait({
      window:  { title: existing ? 'Edit Custom Roll' : 'New Custom Roll' },
      content,
      rejectClose: false,
      buttons: [
        {
          action: 'save',
          label:  'Save',
          default: true,
          callback: (event, button) => {
            const form = button.form;
            return {
              name:  form.elements.name.value.trim(),
              bonus: Math.trunc(Number(form.elements.bonus.value) || 0),
            };
          },
        },
        { action: 'cancel', label: 'Cancel' },
      ],
    });
    if (!result || result === 'cancel' || !result.name) return null;
    return result;
  }

  async _editCustomRoll(id) {
    const rolls = this._getCustomRolls();
    const existing = rolls.find(r => r.id === id);
    if (!existing) return;
    const data = await this._promptCustomRoll(existing);
    if (!data) return;
    const updated = rolls.map(r => (r.id === id ? { ...r, name: data.name, bonus: data.bonus } : r));
    await this.actor.setFlag(MODULE_ID, 'customRolls', updated);
    this.render();
  }

  async _removeCustomRoll(id) {
    const rolls = this._getCustomRolls().filter(r => r.id !== id);
    await this.actor.setFlag(MODULE_ID, 'customRolls', rolls);
    this.render();
  }

  /* -------------------------------------------- */
  /*  Static Action Handlers                       */
  /* -------------------------------------------- */

  static async _onRollBasic(event, target) {
    return this._rollBasicCheck(target.dataset.rollKey, target.dataset.rollLabel);
  }

  static async _onRollCustom(event, target) {
    return this._rollCustomCheck(target.dataset.rollName, target.dataset.rollBonus);
  }

  static async _onAddCustomRoll() {
    const data = await this._promptCustomRoll();
    if (!data) return;
    const rolls = this._getCustomRolls();
    rolls.push({ id: foundry.utils.randomID(), name: data.name, bonus: data.bonus });
    await this.actor.setFlag(MODULE_ID, 'customRolls', rolls);
    this.render();
  }

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

  static async _onRollTrade(event, target) {
    const tradeKey = target.closest('[data-trade]').dataset.trade;
    return this.actor.roll(tradeKey, 'check');
  }

  static async _onRollLanguage(event, target) {
    const langKey = target.closest('[data-language]').dataset.language;
    return this.actor.roll(langKey, 'check');
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

  static async _onToggleAttune(event, target) {
    const item = this.actor.items.get(target.closest('[data-item-id]').dataset.itemId);
    if (!item) return;
    item.update({ 'system.statuses.attuned': !item.system.statuses?.attuned });
  }

  static async _onUseItem(event, target) {
    const itemId = target.closest('[data-item-id]').dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    await recordItemUse(this.actor, itemId);
    return item.roll();
  }

  static async _onResetStats() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window:  { title: 'Reset Lifetime Statistics' },
      content: 'Clear all lifetime statistics for this character? Session stats are unaffected.',
    });
    if (!ok) return;
    await resetLifetimeStats(this.actor);
    this.render();
  }

}
