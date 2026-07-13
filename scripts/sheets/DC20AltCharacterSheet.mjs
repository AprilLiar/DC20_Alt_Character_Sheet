import { MODULE_ID }        from '../constants.mjs';
import { prepareHeader }    from '../context/prepareHeader.mjs';
import { prepareCore }      from '../context/page1-core.mjs';
import { prepareCombat }    from '../context/page2-combat.mjs';
import { prepareFeatures }  from '../context/page3-features.mjs';
import { prepareInventory } from '../context/page4-inventory.mjs';
import { prepareBiography }  from '../context/page5-biography.mjs';
import { prepareStatistics } from '../context/page6-statistics.mjs';
import { prepareConditions } from '../context/page-conditions.mjs';
import { prepareActivities } from '../context/page-activities.mjs';
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
      levelUp:       DC20AltCharacterSheet._onLevelUp,
      levelDown:     DC20AltCharacterSheet._onLevelDown,
      toggleEffect:  DC20AltCharacterSheet._onToggleEffect,
      rest:          DC20AltCharacterSheet._onRest,
      masteryUp:     DC20AltCharacterSheet._onMasteryUp,
      masteryDown:   DC20AltCharacterSheet._onMasteryDown,
      toggleExpertise: DC20AltCharacterSheet._onToggleExpertise,
      convertPoints: DC20AltCharacterSheet._onConvertPoints,
      xpApply:       DC20AltCharacterSheet._onXpApply,
      removeCharItem: DC20AltCharacterSheet._onRemoveCharItem,
      openCompendiumBrowser: DC20AltCharacterSheet._onOpenCompendiumBrowser,
      rollKnowledge:    DC20AltCharacterSheet._onRollKnowledge,
      useCampAction:    DC20AltCharacterSheet._onUseCampAction,
      deleteCampAction: DC20AltCharacterSheet._onDeleteCampAction,
      createCampAction: DC20AltCharacterSheet._onCreateCampAction,
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
    'page-activities':  { template: `modules/${MODULE_ID}/templates/parts/page-activities.hbs`,  scrollable: ['.page-scroll'] },
    'page-split':       { template: `modules/${MODULE_ID}/templates/parts/page-split.hbs`,        scrollable: ['.split-pane'] },
  };

  /** All pages the user can open, in display order */
  static PAGE_DEFS = [
    { id: 'core',       label: 'DC20AltSheet.tabs.core'       },
    { id: 'combat',     label: 'DC20AltSheet.tabs.combat'     },
    { id: 'features',   label: 'DC20AltSheet.tabs.features'   },
    { id: 'inventory',  label: 'DC20AltSheet.tabs.inventory'  },
    { id: 'biography',  label: 'DC20AltSheet.tabs.biography'  },
    { id: 'statistics', label: 'DC20AltSheet.tabs.statistics' },
    { id: 'conditions', label: 'DC20AltSheet.tabs.conditions' },
    { id: 'activities', label: 'DC20AltSheet.tabs.activities' },
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
  /** Pending split-tab builder selection (left/right/bottom/bottomRight page ids) */
  _pendingSplit = { left: null, right: null, bottom: null, bottomRight: null };
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

  /** Validate a tab id — a single known page, or a split of 2 to 4 known pages. */
  _isValidTabId(id, valid) {
    if (this._isSplitId(id)) {
      const { parts } = this._parseSplitId(id);
      return parts.length >= 2 && parts.length <= 4 && parts.every(p => valid.has(p));
    }
    return valid.has(id);
  }

  /** Human-readable label for a single page id. */
  _labelOf(id) {
    const key = DC20AltCharacterSheet.PAGE_DEFS.find(p => p.id === id)?.label ?? id;
    return game.i18n.localize(key);
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

  /** Returns { lr, tb, blr } ratio object (0.25–0.75) for a split tab, persisted per id. */
  _getSplitRatio(id) {
    const r = this.actor.flags?.[MODULE_ID]?.splitRatios?.[id];
    if (r && typeof r === 'object') {
      return {
        lr:  Math.min(0.75, Math.max(0.25, r.lr ?? 0.5)),
        tb:  Math.min(0.75, Math.max(0.25, r.tb ?? 0.5)),
        blr: Math.min(0.75, Math.max(0.25, r.blr ?? 0.5)),
      };
    }
    // Backwards compat: old scalar value stored for 2-pane tabs
    const lr = (typeof r === 'number') ? Math.min(0.75, Math.max(0.25, r)) : 0.5;
    return { lr, tb: 0.5, blr: 0.5 };
  }

  _saveSplitRatio(id, ratios) {
    const all = { ...(this.actor.flags?.[MODULE_ID]?.splitRatios ?? {}) };
    all[id] = { lr: ratios.lr ?? 0.5, tb: ratios.tb ?? 0.5, blr: ratios.blr ?? 0.5 };
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
              const [leftId, rightId, bottomId, bottomRightId] = parts;
              const sep = isHorizontal ? '⇕' : '|';
              if (bottomRightId) {
                return {
                  id, isSplit: true, is3Pane: false, is4Pane: true, leftId, rightId, bottomId, bottomRightId,
                  label: `${this._labelOf(leftId)} ${sep} ${this._labelOf(rightId)} + ${this._labelOf(bottomId)} + ${this._labelOf(bottomRightId)}`,
                  active: id === this._activeTab,
                };
              }
              if (bottomId) {
                return {
                  id, isSplit: true, is3Pane: true, is4Pane: false, leftId, rightId, bottomId,
                  label: `${this._labelOf(leftId)} ${sep} ${this._labelOf(rightId)} + ${this._labelOf(bottomId)}`,
                  active: id === this._activeTab,
                };
              }
              return {
                id, isSplit: true, is3Pane: false, is4Pane: false, leftId, rightId,
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
      case 'page-activities': return Object.assign(context, prepareActivities(this.actor));
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
      case 'activities': return prepareActivities(this.actor);
    }
    return {};
  }

  /** Builds context for the active split tab (or an empty container). */
  async _prepareSplitContext() {
    if (!this._isSplitId(this._activeTab)) return { split: null };

    const id = this._activeTab;
    const { parts, isHorizontal } = this._parseSplitId(id);
    const [left, right, bottom, bottomRight] = parts;
    const ratio = this._getSplitRatio(id);
    const common = {
      isEditable:   this.isEditable,
      moduleId:     MODULE_ID,
      actor:        this.actor,
      system:       this.actor.system,
      coreSkillTab: this._coreSkillTab,
    };

    // 4-pane and 3-pane splits always use the hardcoded grid layout —
    // isHorizontal is only meaningful for the plain 2-pane case below.
    if (bottomRight) {
      const [leftData, rightData, bottomData, bottomRightData] = await Promise.all([
        this._preparePageData(left),
        this._preparePageData(right),
        this._preparePageData(bottom),
        this._preparePageData(bottomRight),
      ]);
      return {
        split: {
          id, left, right, bottom, bottomRight, isHorizontal: false,
          leftGrow:        Math.round(ratio.lr * 100),
          rightGrow:       Math.round((1 - ratio.lr) * 100),
          topGrow:         Math.round(ratio.tb * 100),
          bottomGrow:      Math.round((1 - ratio.tb) * 100),
          bottomLeftGrow:  Math.round(ratio.blr * 100),
          bottomRightGrow: Math.round((1 - ratio.blr) * 100),
        },
        leftCtx:        { ...common, ...leftData },
        rightCtx:       { ...common, ...rightData },
        bottomCtx:      { ...common, ...bottomData },
        bottomRightCtx: { ...common, ...bottomRightData },
      };
    }

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

  /**
   * Foundry's built-in per-PART scroll restoration (the `scrollable` option
   * on each PARTS entry) sets scrollTop on the freshly-rendered element
   * immediately after swapping in new HTML — but every page/pane in this
   * sheet starts hidden (display: none) until _applyPageVisibility() (called
   * from _onRender, after Foundry's own restoration already ran) adds the
   * .active class that makes it visible. Setting scrollTop on a
   * display:none element is a silent no-op, so Foundry's restoration is
   * lost the instant it's attempted — every form change (which triggers a
   * full re-render) appeared to reset the view to the top. We save/restore
   * scroll positions ourselves instead, timed around our own visibility
   * toggle rather than Foundry's, keyed by the page id each scrollable
   * container is displaying (works for both single-page `.page-scroll` and
   * split `.split-pane` containers, which both carry a `data-page` attribute).
   */
  async _preRender(context, options) {
    await super._preRender(context, options);
    this._savedScroll = new Map();
    this.element?.querySelectorAll('.page-scroll[data-page], .split-pane[data-page]').forEach(el => {
      if (el.scrollTop) this._savedScroll.set(el.dataset.page, el.scrollTop);
    });
  }

  _restoreScroll() {
    if (!this._savedScroll?.size) return;
    this.element.querySelectorAll('.page-scroll[data-page], .split-pane[data-page]').forEach(el => {
      const saved = this._savedScroll.get(el.dataset.page);
      if (saved) el.scrollTop = saved;
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._bindBrowserTabs();
    this._bindCombatFilter();
    this._bindCoreSkillTabs();
    this._bindApPips();
    this._bindResourceDropdown();
    this._bindHealthResource();
    this._bindSplitBuilder();
    this._bindSplitDivider();
    this._registerContextMenu();
    this._bindQuickSlots();
    this._bindListReorder();
    this._bindConditionToggles();
    this._bindConditionEffects();
    this._bindActivities();
    this._bindCharSlots();
    this._bindCampActions();
    this._bindBiographyAutoSave();
    this._bindItemPopup();
    this._bindPortraitFit();
    this._restoreScroll();
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

  /** Enrich raw HTML so @UUID[…] references become clickable content links. */
  async _enrichHTML(html) {
    if (!html) return '';
    try {
      const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
      return await TE.enrichHTML(html, {
        secrets:    this.actor.isOwner,
        rollData:   this.actor.getRollData?.() ?? {},
        relativeTo: this.actor,
      });
    } catch (err) {
      console.error('DC20 Alt Sheet | enrichHTML failed', err);
      return html;
    }
  }

  /** Open the shared read-only popup with a title + rich HTML body, anchored to an element. */
  async _openPopup(name, descHtml, anchorEl) {
    if (this._popupSuppressNext) return;
    const popup = this._ensurePopup();
    popup.querySelector('.item-popup-name').textContent = name ?? '';
    // Enrich so @UUID links render as clickable buttons that open the document.
    popup.querySelector('.item-popup-desc').innerHTML = await this._enrichHTML(descHtml ?? '');

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
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // the enable/disable toggle handles itself
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

    // Support 2-pane vertical, 2-pane horizontal, 3-pane, and 4-pane containers
    const splitContainer = this.element.querySelector('.split-view')
      ?? this.element.querySelector('.split-view-h')
      ?? this.element.querySelector('.split-view-3')
      ?? this.element.querySelector('.split-view-4');
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

    // Orientation toggle (vertical / horizontal). Only meaningful for the
    // plain 2-pane case — once a 3rd/4th pane is added the layout is always
    // the hardcoded grid, so this toggle no longer needs to touch the
    // bottom zones at all.
    this.element.querySelectorAll('.split-orient-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._splitOrientation = btn.dataset.orient;
        this.element.querySelectorAll('.split-orient-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.orient === this._splitOrientation));
      });
    });

    // Drop zones (left, right, and optional bottom / bottomRight).
    this.element.querySelectorAll('.split-zone').forEach(zone => {
      // Click on a filled zone to clear it.
      zone.addEventListener('click', () => {
        if (!zone.classList.contains('filled')) return;
        const side = zone.dataset.splitSide;
        this._pendingSplit[side] = null;
        // Clearing the 3rd pane invalidates a 4th pane built on top of it.
        if (side === 'bottom') this._pendingSplit.bottomRight = null;
        this._resetZone(zone, side);
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
        const { left, right, bottom, bottomRight } = this._pendingSplit;
        if (!left || !right) return;
        this._createSplitTab(left, right, bottom, bottomRight);
      });
    }
  }

  /** Zone hint text by side, and the DOM reset shared by clear-click and full reset. */
  _splitZoneHint(side) {
    if (side === 'bottom') return game.i18n.localize('DC20AltSheet.nav.optionalBottom');
    if (side === 'bottomRight') return game.i18n.localize('DC20AltSheet.nav.optionalFourth');
    return game.i18n.localize('DC20AltSheet.nav.dropHere');
  }

  _resetZone(zone, side) {
    zone.classList.remove('filled');
    zone.innerHTML = `<span class="split-zone-hint">${this._splitZoneHint(side)}</span>`;
  }

  /**
   * Show/enable each zone tier once the one above it is filled: bottom
   * (3rd pane) once left+right are both filled, bottomRight (4th pane)
   * once bottom is also filled. The create button only needs left+right.
   */
  _updateSplitBuilder() {
    const { left, right, bottom } = this._pendingSplit;
    const bothFilled = !!(left && right);
    this.element?.querySelector('.split-bottom-wrap')?.classList.toggle('hidden', !bothFilled);
    this.element?.querySelector('.split-zone[data-split-side="bottomRight"]')?.classList.toggle('hidden', !bottom);
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
    this._pendingSplit = { left: null, right: null, bottom: null, bottomRight: null };
    this.element?.querySelectorAll('.split-zone').forEach(z => this._resetZone(z, z.dataset.splitSide));
    this.element?.querySelector('.split-bottom-wrap')?.classList.add('hidden');
    this.element?.querySelector('.split-zone[data-split-side="bottomRight"]')?.classList.add('hidden');
    const btn = this.element?.querySelector('.split-create-btn');
    if (btn) btn.disabled = true;
  }

  /**
   * Build a split-tab id from up to 4 pane assignments. 3- and 4-pane
   * splits always use the hardcoded grid layout (`+`-joined, isHorizontal
   * ignored downstream) — the vertical/horizontal orientation only applies
   * to the plain 2-pane case.
   */
  _createSplitTab(left, right, bottom = null, bottomRight = null) {
    let id;
    if (bottom && bottomRight) id = `${left}+${right}+${bottom}+${bottomRight}`;
    else if (bottom) id = `${left}+${right}+${bottom}`;
    else if (this._splitOrientation === 'horizontal') id = `${left}~${right}`;
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
    const view = this.element.querySelector('.split-view-4')
      ?? this.element.querySelector('.split-view-3')
      ?? this.element.querySelector('.split-view-h')
      ?? this.element.querySelector('.split-view');
    if (!view) return;
    const id = view.dataset.splitId;
    if (!id) return;

    const ratio = this._getSplitRatio(id);
    let currentLr  = ratio.lr;
    let currentTb  = ratio.tb;
    let currentBlr = ratio.blr;
    const save = () => this._saveSplitRatio(id, { lr: currentLr, tb: currentTb, blr: currentBlr });

    /** Bind one left↔right divider, driving two flex-grow panes and a ratio setter. */
    const bindVertical = (div, paneL, paneR, setRatio) => {
      if (!div) return;
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const rect = view.getBoundingClientRect();
        let r = (e.clientX - rect.left) / rect.width;
        r = Math.min(0.75, Math.max(0.25, r));
        setRatio(r);
        if (paneL) paneL.style.flexGrow = String(Math.round(r * 100));
        if (paneR) paneR.style.flexGrow = String(Math.round((1 - r) * 100));
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        div.classList.remove('dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        save();
      };
      div.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dragging = true;
        div.classList.add('dragging');
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });
    };

    // Top-row vertical divider (left ↔ right) — every split variant has one.
    // Exclude the bottom-row divider (4-pane only) from the fallback match.
    const vDivTop = view.querySelector('.split-divider-v:not(.split-divider-v-bottom)')
      ?? view.querySelector('.split-divider:not(.split-divider-h)');
    bindVertical(vDivTop, view.querySelector('.split-pane-left'), view.querySelector('.split-pane-right'),
      (r) => currentLr = r);

    // Bottom-row vertical divider (4-pane only: bottom-left ↔ bottom-right)
    bindVertical(view.querySelector('.split-divider-v-bottom'),
      view.querySelector('.split-pane-bottom-left'), view.querySelector('.split-pane-bottom-right'),
      (r) => currentBlr = r);

    // Horizontal divider (top row ↔ bottom row) — 3/4-pane use .split-row-top/.split-row-bottom;
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
        save();
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

  /**
   * Health's current-HP and temp-HP inputs (rendered once collapsed in the
   * header and once again per row in the resource dropdown) have no name=
   * attribute, so Foundry's generic submitOnChange form processing ignores
   * them. Instead we commit both together in one update, recomputing
   * system.resources.health.value (= current + temp) so it stays correct
   * for the DC20 system's own damage/heal code, which reads that field
   * directly rather than deriving it from current/temp.
   */
  _bindHealthResource() {
    if (!this.isEditable) return;
    const scopes = new Set();
    this.element.querySelectorAll('[data-health-field]').forEach(inp => {
      const scope = inp.closest('.hstrip-resource, .res-row');
      if (scope) scopes.add(scope);
    });
    scopes.forEach(scope => {
      const curInp  = scope.querySelector('[data-health-field="current"]');
      const tempInp = scope.querySelector('[data-health-field="temp"]');
      if (!curInp) return;
      const commit = () => {
        const current = Math.trunc(Number(curInp.value)) || 0;
        const temp    = tempInp ? Math.max(0, Math.trunc(Number(tempInp.value)) || 0) : 0;
        this.actor.update({
          'system.resources.health.current': current,
          'system.resources.health.temp':    temp,
          'system.resources.health.value':   current + temp,
        });
      };
      curInp.addEventListener('change', commit);
      tempInp?.addEventListener('change', commit);
    });
  }

  /* -------------------------------------------- */
  /*  Activities (XP toggle + bar edits)           */
  /* -------------------------------------------- */

  _bindActivities() {
    if (!this.isEditable) return;
    // Track-XP toggle
    this.element.querySelectorAll('.xp-toggle-input').forEach(box => {
      box.addEventListener('change', () => {
        this.actor.setFlag(MODULE_ID, 'trackXP', box.checked);
      });
    });
    // XP value / max edits
    this.element.querySelectorAll('.xp-input[data-xp-field]').forEach(inp => {
      inp.addEventListener('change', () => {
        const field = inp.dataset.xpField === 'max' ? 'xpMax' : 'xpValue';
        const val   = Math.max(0, Math.trunc(Number(inp.value) || 0));
        this.actor.setFlag(MODULE_ID, field, val);
      });
    });
  }

  /**
   * Enable drag-to-assign for character build slots (Ancestry / Background /
   * Class / Subclass). Accepts standard Foundry Item drops; validates that
   * the dragged item's type matches the slot, removes any existing item of
   * that type, then creates the new one so DC20's _onCreate advancement fires.
   */
  _bindCharSlots() {
    if (!this.isEditable) return;

    this.element.querySelectorAll('.char-slot[data-slot-type]').forEach(slot => {
      const slotType = slot.dataset.slotType;

      slot.addEventListener('dragover', e => {
        // Ignore tab-builder page drags (those carry a string pageId, not Item JSON)
        if (this._dragPageId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        slot.classList.add('drag-over');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));

      slot.addEventListener('drop', async e => {
        slot.classList.remove('drag-over');
        if (this._dragPageId) return;
        e.preventDefault();
        e.stopPropagation();

        let data;
        try {
          const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
          data = JSON.parse(raw);
        } catch { return; }

        if (data.type !== 'Item') return;

        let source;
        try { source = await fromUuid(data.uuid ?? ''); } catch { return; }
        if (!source) return;

        if (source.type !== slotType) {
          ui.notifications?.warn(game.i18n.format('DC20AltSheet.notify.slotTypeError', { type: slotType }));
          return;
        }

        // If already on this actor, do nothing (already assigned)
        if (source.parent?.id === this.actor.id) return;

        // Remove any existing item of this type so only one can occupy the slot
        const existing = this.actor.items.filter(i => i.type === slotType);
        for (const ex of existing) await ex.delete();

        // Create — DC20's _onCreate hook fires and opens the advancement dialog
        await Item.create(source.toObject(), { parent: this.actor });
      });
    });
  }

  /**
   * Enable drag-to-assign Feature items onto the Camp Actions widget.
   * Dropping a feature creates a new camp action entry referencing that item.
   */
  _bindCampActions() {
    if (!this.isEditable) return;
    this.element.querySelectorAll('.camp-actions-widget').forEach(widget => {
      widget.addEventListener('dragover', e => {
        if (this._dragPageId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        widget.classList.add('drag-over');
      });
      widget.addEventListener('dragleave', e => {
        if (!widget.contains(e.relatedTarget)) widget.classList.remove('drag-over');
      });
      widget.addEventListener('drop', async e => {
        widget.classList.remove('drag-over');
        if (this._dragPageId) return;
        e.preventDefault();
        e.stopPropagation();

        let data;
        try {
          const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
          data = JSON.parse(raw);
        } catch { return; }

        if (data.type !== 'Item') return;

        let source;
        try { source = await fromUuid(data.uuid ?? ''); } catch { return; }
        if (!source || source.type !== 'feature') return;

        const actions = [...(this.actor.flags?.[MODULE_ID]?.campActions ?? [])];
        const already = actions.some(a => a.itemId === source.id);
        if (already) { ui.notifications?.info(game.i18n.format('DC20AltSheet.notify.campAlready', { name: source.name })); return; }

        actions.push({
          id:          foundry.utils.randomID(),
          name:        source.name,
          description: source.system?.description?.value ?? source.system?.description ?? '',
          roll:        null,
          itemId:      source.parent?.id === this.actor.id ? source.id : null,
          img:         source.img ?? null,
        });
        await this.actor.setFlag(MODULE_ID, 'campActions', actions);
        this.render();
      });
    });
  }

  /** Dynamically import a module from the running DC20 system. */
  async _systemImport(relPath) {
    const p = `systems/dc20rpg/module/${relPath}`;
    // Candidate URLs, most-likely-cached first. Resolving `p` against
    // document.baseURI mirrors how the browser resolved the system's own
    // <script src="systems/…"> tag, so that candidate hits the already-loaded
    // module even on hosted setups with a route prefix.
    const candidates = [];
    try {
      const r = foundry.utils?.getRoute?.(p);
      if (r) candidates.push(new URL(r.includes('://') || r.startsWith('/') ? r : `/${r}`, document.baseURI).href);
    } catch { /* getRoute unavailable */ }
    try { candidates.push(new URL(p, document.baseURI).href); } catch { /* ignore */ }
    try { candidates.push(new URL(`/${p}`, window.location.origin).href); } catch { /* ignore */ }

    const attempts = [];
    console.debug(`DC20 Alt Sheet | _systemImport trying to load: ${relPath}`, { candidates });
    for (const url of [...new Set(candidates)]) {
      try {
        console.debug(`DC20 Alt Sheet | _systemImport attempting: ${url}`);
        const mod = await import(url);
        if (mod) {
          console.debug(`DC20 Alt Sheet | _systemImport succeeded: ${url}`);
          return mod;
        }
      } catch (err) { attempts.push(`${url} → ${err?.message ?? err}`); }
    }
    console.error(`DC20 Alt Sheet | failed to load system module "${relPath}". Attempts:\n${attempts.join('\n')}`);
    return null;
  }

  /**
   * DC20's own changeLevel resolves the class/ancestry/subclass/background
   * items to advance via actor.system.details.<type>.id — NOT the item id
   * passed into changeLevel(). If one of those stored references is stale
   * (points at a deleted/replaced item — e.g. after re-assigning a build
   * slot through drag-drop or the compendium browser, if something upstream
   * failed to update the reference), applyAdvancements silently skips that
   * category: no error, no thrown exception, but also no advancements
   * collected for it. The class level still increments (that write is
   * unconditional), so the whole thing *looks* like a successful level-up
   * that simply did nothing. Repair any such mismatch before calling into
   * the system's level-up code, so its own unmodified logic then resolves
   * correctly.
   */
  async _ensureCharacterReferences() {
    const actor = this.actor;
    const updates = {};
    for (const type of ['class', 'ancestry', 'subclass', 'background']) {
      const storedId = actor.system.details?.[type]?.id;
      const stored = storedId ? actor.items.get(storedId) : null;
      if (stored && stored.type === type) continue; // reference is valid

      const actual = actor.items.find(i => i.type === type);
      if (!actual || actual.id === storedId) continue; // nothing to heal

      console.warn(
        `DC20 Alt Sheet | system.details.${type}.id was stale ` +
        `(stored: ${storedId ?? '(none)'}, actual: ${actual.id} "${actual.name}") — repairing`
      );
      updates[`system.details.${type}.id`] = actual.id;
    }
    if (Object.keys(updates).length) {
      await actor.update(updates);
      console.debug('DC20 Alt Sheet | Repaired stale character-build references', updates);
    }
  }

  /**
   * Resolve the DC20 functions needed to drive a level change.
   *
   * The DC20 author confirmed there is no public/exposed level-up API, so we
   * import the system's own functions directly from the (unbundled) system
   * source. `changeLevel` lives in itemsOnActor.mjs and is the version-stable
   * entry point; `applyAdvancements` / `removeAdvancements` live in the
   * advancement subsystem and are used by our replicated fallback so we can
   * still open the "You Become Stronger" dialog if `changeLevel` is ever
   * renamed or moved.
   *
   * `clearOverridenScalingValue` moved in the system's Foundry-v14 update:
   * it used to live in a standalone helpers/items/scalingItems.mjs, but is
   * now defined and exported directly from itemsOnActor.mjs. We check the
   * new location first and fall back to the old module for older installs
   * (this module still declares compatibility down to dc20rpg 0.9).
   */
  async _getAdvancementApi() {
    const items = await this._systemImport('helpers/actors/itemsOnActor.mjs');
    let adv = null;
    if (typeof items?.applyAdvancements !== 'function') {
      // applyAdvancements is not exported from itemsOnActor — it's imported
      // there from the advancement subsystem. Pull it from its real home.
      adv = await this._systemImport('subsystems/character-progress/advancement/advancements.mjs');
    }
    let clearOverridenScalingValue = typeof items?.clearOverridenScalingValue === 'function'
      ? items.clearOverridenScalingValue
      : null;
    if (!clearOverridenScalingValue) {
      // Pre-v14 system versions exported this from a separate module.
      const scaling = await this._systemImport('helpers/items/scalingItems.mjs');
      clearOverridenScalingValue = typeof scaling?.clearOverridenScalingValue === 'function'
        ? scaling.clearOverridenScalingValue
        : null;
    }
    return {
      changeLevel:        typeof items?.changeLevel === 'function' ? items.changeLevel : null,
      applyAdvancements:  typeof adv?.applyAdvancements === 'function' ? adv.applyAdvancements : null,
      removeAdvancements: typeof adv?.removeAdvancements === 'function' ? adv.removeAdvancements : null,
      clearOverridenScalingValue,
    };
  }

  /**
   * Replicate the system's `changeLevel(up, itemId, actor)` using the imported
   * advancement functions. Mirrors the official flow: on level-up it calls
   * `applyAdvancements` (which opens the advancement dialog) with the *new*
   * level and then writes the class level; on level-down it removes the
   * current level's advancements first. Returns true if it ran, false if the
   * advancement functions could not be loaded.
   */
  async _replicateChangeLevel(up, classItem, api) {
    if (!api?.applyAdvancements) return false;
    const actor = this.actor;
    const details = actor.system.details ?? {};
    let currentLevel = Number(classItem.system?.level) || 0;
    const oldActorData = foundry.utils.deepClone(actor.system);

    const clazz    = actor.items.get(details.class?.id)    ?? classItem;
    const ancestry = actor.items.get(details.ancestry?.id) ?? null;
    const subclass = actor.items.get(details.subclass?.id) ?? null;

    if (up) {
      currentLevel = Math.min(currentLevel + 1, 20);
      // Not awaited on purpose — matches the system, which opens the dialog
      // and continues. The dialog persists the player's choices itself.
      api.applyAdvancements(actor, currentLevel, clazz, subclass, ancestry, null, oldActorData);
    } else {
      if (api.clearOverridenScalingValue) await api.clearOverridenScalingValue(clazz, currentLevel - 1);
      if (api.removeAdvancements)         await api.removeAdvancements(actor, currentLevel, clazz, subclass, ancestry);
      currentLevel = Math.max(currentLevel - 1, 0);
    }

    await classItem.update({ 'system.level': currentLevel });
    try { await game.settings.set('dc20rpg', 'suppressAdvancements', false); } catch { /* setting may not exist */ }
    return true;
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
    const CM = foundry.applications?.ux?.ContextMenu?.implementation ?? globalThis.ContextMenu;
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
        name: game.i18n.localize('DC20AltSheet.edit'),
        icon: '<i class="fas fa-pencil-alt"></i>',
        callback: (el) => this._editCustomRoll(el?.dataset?.rollId),
      },
      {
        name: game.i18n.localize('DC20AltSheet.remove'),
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
    const l = (k) => game.i18n.localize(k);
    const content = `
      <div class="dc20-custom-roll-form">
        <div class="form-group">
          <label>${l('DC20AltSheet.dialog.customRoll.name')}</label>
          <input type="text" name="name" value="${nameVal}" placeholder="${l('DC20AltSheet.dialog.customRoll.namePlaceholder')}" autofocus>
        </div>
        <div class="form-group">
          <label>${l('DC20AltSheet.dialog.customRoll.bonus')}</label>
          <input type="number" name="bonus" value="${bonusVal}" step="1">
        </div>
      </div>`;
    const result = await foundry.applications.api.DialogV2.wait({
      window:  { title: existing ? l('DC20AltSheet.dialog.customRoll.titleEdit') : l('DC20AltSheet.dialog.customRoll.titleNew') },
      content,
      rejectClose: false,
      buttons: [
        {
          action: 'save',
          label:  l('DC20AltSheet.dialog.save'),
          default: true,
          callback: (event, button) => {
            const form = button.form;
            return {
              name:  form.elements.name.value.trim(),
              bonus: Math.trunc(Number(form.elements.bonus.value) || 0),
            };
          },
        },
        { action: 'cancel', label: l('DC20AltSheet.dialog.cancel') },
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

  /** Launch the DC20 level-up flow on the character's class item. */
  static async _onLevelUp(event, target) {
    if (target?.disabled) return;
    console.debug('DC20 Alt Sheet | Level-up button clicked');
    await this._ensureCharacterReferences();

    // Resolve the class item: prefer the stored id, fall back to the actual
    // class item if that id is stale/missing.
    const storedId = this.actor.system.details?.class?.id;
    let classItem = storedId ? this.actor.items.get(storedId) : null;
    if (!classItem) classItem = this.actor.items.find(i => i.type === 'class');
    if (!classItem) {
      console.warn('DC20 Alt Sheet | No class item found');
      ui.notifications?.warn(game.i18n.localize('DC20AltSheet.notify.noClassLevelUp'));
      return;
    }

    const before = Number(classItem.system?.level) || 0;
    console.debug(`DC20 Alt Sheet | Class item found: ${classItem.name} (level ${before})`);

    if (before >= 20) {
      ui.notifications?.info(game.i18n.localize('DC20AltSheet.notify.maxLevel'));
      return;
    }

    const resetXp = async () => {
      if (this.actor.flags?.[MODULE_ID]?.trackXP) {
        await this.actor.setFlag(MODULE_ID, 'xpValue', 0);
      }
    };

    console.debug('DC20 Alt Sheet | Importing advancement functions from DC20 system…');
    const api = await this._getAdvancementApi();

    // Primary path — the system's own changeLevel entry point (version-stable).
    if (api.changeLevel) {
      console.debug('DC20 Alt Sheet | Using system changeLevel("true")');
      try {
        await api.changeLevel('true', classItem.id, this.actor);
        await resetXp();
        return;
      } catch (err) {
        console.error('DC20 Alt Sheet | changeLevel threw:', err);
        // The dialog opens before the level write, so a late throw isn't
        // necessarily failure — only bail if the level truly didn't move.
        const after = Number(this.actor.items.get(classItem.id)?.system?.level) || 0;
        if (after !== before) {
          console.warn(
            'DC20 Alt Sheet | Level changed despite an error above — the advancement dialog may not have ' +
            'opened correctly. This often means one of the class/ancestry/subclass/background items has a ' +
            'broken advancement macro (see the error for a DC20-side stack trace, e.g. from dc20rpg.mjs).'
          );
          await resetXp();
          return;
        }
      }
    }

    // Secondary path — replicate changeLevel using applyAdvancements pulled
    // from the advancement subsystem (in case changeLevel was moved/renamed).
    console.debug('DC20 Alt Sheet | Falling back to replicated changeLevel via applyAdvancements');
    try {
      if (await this._replicateChangeLevel(true, classItem, api)) {
        await resetXp();
        return;
      }
    } catch (err) {
      console.error('DC20 Alt Sheet | replicated changeLevel failed:', err);
      const after = Number(this.actor.items.get(classItem.id)?.system?.level) || 0;
      if (after !== before) { await resetXp(); return; }
    }

    // Last resort — the system advancement code could not be reached at all.
    // Raise the level so the button does something, but tell the user the
    // advancement dialog could not be opened (they may need to load the DC20
    // system's own sheet once, or check the console for the import errors).
    console.warn('DC20 Alt Sheet | Advancement code unreachable — raising level without dialog');
    try {
      await classItem.update({ 'system.level': before + 1 });
      await resetXp();
      ui.notifications?.warn(game.i18n.localize('DC20AltSheet.notify.levelUpFallback'));
    } catch (err) {
      console.error('DC20 Alt Sheet | level-up fallback failed', err);
      ui.notifications?.error(game.i18n.format('DC20AltSheet.notify.levelUpFailed', { error: err?.message ?? err }));
    }
  }

  /** Reduce the character's class level by 1 via DC20's changeLevel flow. */
  static async _onLevelDown(event, target) {
    await this._ensureCharacterReferences();
    const storedId = this.actor.system.details?.class?.id;
    let classItem = storedId ? this.actor.items.get(storedId) : null;
    if (!classItem) classItem = this.actor.items.find(i => i.type === 'class');
    if (!classItem) {
      ui.notifications?.warn(game.i18n.localize('DC20AltSheet.notify.noClassLevelDown'));
      return;
    }

    const before = Number(classItem.system?.level) || 0;
    if (before <= 0) {
      ui.notifications?.info(game.i18n.localize('DC20AltSheet.notify.minLevel'));
      return;
    }

    // The official sheet confirms before levelling down — advancements for
    // the current level get removed in the process.
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:  { title: game.i18n.localize('DC20AltSheet.dialog.levelDown.title') },
      content: game.i18n.localize('DC20AltSheet.dialog.levelDown.content'),
    });
    if (!confirmed) return;

    console.debug('DC20 Alt Sheet | Level-down confirmed');
    const api = await this._getAdvancementApi();

    // Primary — system changeLevel("false").
    if (api.changeLevel) {
      try {
        await api.changeLevel('false', classItem.id, this.actor);
        return;
      } catch (err) {
        console.error('DC20 Alt Sheet | changeLevel("false") threw:', err);
        const after = Number(this.actor.items.get(classItem.id)?.system?.level) || 0;
        if (after !== before) {
          console.warn(
            'DC20 Alt Sheet | Level changed despite an error above — possibly a broken advancement macro ' +
            'on the class/ancestry/subclass/background items.'
          );
          return;
        }
      }
    }

    // Secondary — replicated changeLevel via removeAdvancements.
    try {
      if (await this._replicateChangeLevel(false, classItem, api)) return;
    } catch (err) {
      console.error('DC20 Alt Sheet | replicated level-down failed:', err);
      const after = Number(this.actor.items.get(classItem.id)?.system?.level) || 0;
      if (after !== before) return;
    }

    // Last resort — decrement directly.
    console.warn('DC20 Alt Sheet | Advancement code unreachable — lowering level without cleanup');
    try {
      await classItem.update({ 'system.level': before - 1 });
    } catch (err) {
      console.error('DC20 Alt Sheet | level-down fallback failed', err);
      ui.notifications?.error(game.i18n.format('DC20AltSheet.notify.levelDownFailed', { error: err?.message ?? err }));
    }
  }

  /** Apply ± an amount of XP (read from the sibling .xp-amount input). */
  static async _onXpApply(event, target) {
    const sign = Number(target.dataset.xpSign) || 1;
    const amtInput = target.closest('.xp-apply')?.querySelector('.xp-amount');
    const amount = Math.max(0, Math.trunc(Number(amtInput?.value) || 0));
    if (amount === 0) return;

    const flags = this.actor.flags?.[MODULE_ID] ?? {};
    const max   = Number(flags.xpMax) || 100;
    const cur   = Number(flags.xpValue) || 0;
    const next  = Math.max(0, Math.min(max, cur + sign * amount));
    if (next === cur) return;
    await this.actor.setFlag(MODULE_ID, 'xpValue', next);
  }

  /**
   * Remove a character-build item (Ancestry / Background / Class / Subclass)
   * by calling item.delete(). DC20's _preDelete hook fires and handles
   * de-advancement automatically.
   */
  static async _onRemoveCharItem(event, target) {
    const itemId = target.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    item.delete();
  }

  /** Open DC20's own compendium browser, locked to one item type, for an empty char slot. */
  static async _onOpenCompendiumBrowser(event, target) {
    const slotType = target.closest('[data-slot-type]')?.dataset.slotType;
    if (slotType) this._openCharSlotBrowser(slotType);
  }

  /**
   * Dynamically import and open DC20's own item-browser dialog (the same one
   * used by the official sheet's "Add" buttons), locked to `slotType`.
   *
   * The browser's own "Add" button works by synthesizing a drop event and
   * calling `parentWindow._onDrop(event)` — the convention the official V1
   * actor sheet implements. Our sheet is ApplicationV2 and has no such
   * method, so we hand it a minimal shim that mirrors _bindCharSlots'
   * native drop handling: replace any existing item of this type, then
   * create the new one so DC20's own advancement hook fires normally.
   */
  async _openCharSlotBrowser(slotType) {
    const mod = await this._systemImport('dialogs/compendium-browser/item-browser.mjs');
    const createItemBrowser = mod?.createItemBrowser;
    if (typeof createItemBrowser !== 'function') {
      console.error('DC20 Alt Sheet | could not load the DC20 compendium browser (createItemBrowser not found)');
      ui.notifications?.error(game.i18n.localize('DC20AltSheet.notify.compendiumBrowserError'));
      return;
    }

    const actor = this.actor;
    const dropShim = {
      async _onDrop(event) {
        let data;
        try { data = JSON.parse(event.dataTransfer.getData('text/plain')); } catch { return; }
        if (data?.type !== 'Item' || !data.uuid) return;

        let source;
        try { source = await fromUuid(data.uuid); } catch { return; }
        if (!source || source.type !== slotType) return;
        if (source.parent?.id === actor.id) return;

        const existing = actor.items.filter(i => i.type === slotType);
        for (const ex of existing) await ex.delete();
        await Item.create(source.toObject(), { parent: actor });
      },
    };

    createItemBrowser(slotType, true, dropShim);
  }

  /** Roll a skill / trade / language from the Activities knowledge list. */
  static async _onRollKnowledge(event, target) {
    const key = target.dataset.skillKey;
    if (!key) return;
    return this.actor.roll(key, 'check');
  }

  /** Post a camp-activity announcement to chat. */
  static async _onUseCampAction(event, target) {
    const id = target.dataset.campActionId;
    const actions = this.actor.flags?.[MODULE_ID]?.campActions ?? [];
    const action = actions.find(a => a.id === id);
    if (!action) return;

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const content = `<p><strong>${this.actor.name}</strong> is doing <em>"${action.name}"</em> during their Camp Activities.</p>` +
      (action.description ? `<p style="font-size:0.9em;opacity:0.8;">${action.description}</p>` : '');
    await ChatMessage.create({ speaker, content });

    if (action.roll) {
      try { await new Roll(action.roll).toMessage({ speaker, flavor: action.name }); } catch { /* ignore bad formula */ }
    }
  }

  /** Remove a camp action from the actor flags. */
  static async _onDeleteCampAction(event, target) {
    const id = target.dataset.campActionId;
    const actions = (this.actor.flags?.[MODULE_ID]?.campActions ?? []).filter(a => a.id !== id);
    await this.actor.setFlag(MODULE_ID, 'campActions', actions);
    this.render();
  }

  /** Open a dialog to create a new camp action. */
  static async _onCreateCampAction(event, target) {
    const l = (k) => game.i18n.localize(k);
    const content = `
      <div class="dc20-custom-roll-form">
        <div class="form-group">
          <label>${l('DC20AltSheet.dialog.campAction.name')}</label>
          <input type="text" name="name" placeholder="${l('DC20AltSheet.dialog.campAction.namePlaceholder')}" autofocus>
        </div>
        <div class="form-group">
          <label>${l('DC20AltSheet.dialog.campAction.description')}</label>
          <textarea name="description" rows="3" placeholder="${l('DC20AltSheet.dialog.campAction.descPlaceholder')}" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
        <div class="form-group">
          <label>${l('DC20AltSheet.dialog.campAction.roll')} <span style="opacity:.6;font-size:.9em;">${l('DC20AltSheet.dialog.campAction.rollOptional')}</span></label>
          <input type="text" name="roll" placeholder="${l('DC20AltSheet.dialog.campAction.rollPlaceholder')}">
        </div>
      </div>`;
    const result = await foundry.applications.api.DialogV2.wait({
      window:  { title: l('DC20AltSheet.dialog.campAction.title') },
      content,
      rejectClose: false,
      buttons: [
        {
          action: 'save',
          label:  l('DC20AltSheet.dialog.create'),
          default: true,
          callback: (event, button) => {
            const form = button.form;
            return {
              name:        form.elements.name.value.trim(),
              description: form.elements.description.value.trim(),
              roll:        form.elements.roll.value.trim() || null,
            };
          },
        },
        { action: 'cancel', label: l('DC20AltSheet.dialog.cancel') },
      ],
    });
    if (!result || result === 'cancel' || !result.name) return;

    const actions = [...(this.actor.flags?.[MODULE_ID]?.campActions ?? [])];
    actions.push({ id: foundry.utils.randomID(), ...result, itemId: null, img: null });
    await this.actor.setFlag(MODULE_ID, 'campActions', actions);
    this.render();
  }

  /** Open the DC20 rest dialog preselected to a rest type. */
  static async _onRest(event, target) {
    const type = target.dataset.restType || 'long';
    // The system exposes RestDialog globally (window.DC20.dialog) — use that
    // directly so it's the same instance the official sheet uses.
    const RestDialog = globalThis.DC20?.dialog?.RestDialog
      ?? (await this._systemImport('dialogs/rest.mjs'))?.RestDialog;
    if (!RestDialog) {
      ui.notifications?.error(game.i18n.localize('DC20AltSheet.notify.restError'));
      return;
    }
    RestDialog.open(this.actor, { preselected: type });
  }

  /** Adjust the tracked XP value by a delta, clamped to [0, max]. */
  static async _onXpAdjust(event, target) {
    const delta = Number(target.dataset.xpDelta) || 0;
    const flags = this.actor.flags?.[MODULE_ID] ?? {};
    const max   = Number(flags.xpMax) || 100;
    const cur   = Number(flags.xpValue) || 0;
    const next  = Math.max(0, Math.min(max, cur + delta));
    if (next === cur) return;
    await this.actor.setFlag(MODULE_ID, 'xpValue', next);
  }

  /* ── Skill / Trade / Language manager (delegates to the system) ── */
  static async _onMasteryUp(event, target) {
    const { skillType, skillKey } = target.dataset;
    return this.actor.skillAndLanguage?.[skillType]?.[skillKey]?.masteryUp?.();
  }

  static async _onMasteryDown(event, target) {
    const { skillType, skillKey } = target.dataset;
    return this.actor.skillAndLanguage?.[skillType]?.[skillKey]?.masteryDown?.();
  }

  static async _onToggleExpertise(event, target) {
    if (target.disabled) return;
    const { skillType, skillKey } = target.dataset;
    return this.actor.skillAndLanguage?.[skillType]?.[skillKey]?.expertiseToggle?.();
  }

  static async _onConvertPoints(event, target) {
    const { from, to, op, rate } = target.dataset;
    return this.actor.skillAndLanguage?.convertPoints?.(from, to, op, rate);
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
      window:  { title: game.i18n.localize('DC20AltSheet.dialog.resetStats.title') },
      content: game.i18n.localize('DC20AltSheet.dialog.resetStats.content'),
    });
    if (!ok) return;
    await resetLifetimeStats(this.actor);
    this.render();
  }

  /** Enable / disable an Active Effect from the Conditions tab. */
  static async _onToggleEffect(event, target) {
    event.stopPropagation();
    event.preventDefault();
    const effectId = target.closest('[data-effect-id]')?.dataset.effectId;
    const effect = this._findEffect(effectId);
    if (!effect) return;
    // Update the effect; FoundryV2's update hook will re-render the sheet automatically
    await effect.update({ disabled: !effect.disabled });
  }

}
