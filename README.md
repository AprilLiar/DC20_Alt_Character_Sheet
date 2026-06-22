# DC20 Alternative Character Sheet

An alternative character sheet module for the **DC20 RPG** system in **Foundry VTT v13**.

Designed around a warm parchment aesthetic with a focus on usability: a persistent resource strip, bookmark-style page navigation, and quality-of-life features like Favourites and Last Used tracking.

---

## Features

- **Parchment aesthetic** — Cinzel + Crimson Text fonts, warm aged-paper palette, ink-style borders
- **Persistent header** — AP pips + HP / Stamina / Mana always visible regardless of active page
- **5-page layout** — Core · Combat · Features · Inventory · Biography, switched via right-side bookmark tabs
- **Favourites** — Right-click any item to pin it to the Core page for quick access
- **Last 3 Used** — Automatically tracks the 3 most recently activated items
- **Combat Dashboard** — Resource bars, PD/AD badges, filterable action list (All / Weapons / Spells / Maneuvers / Features)
- **Conditions** — Only active conditions shown; Basic (glowing icon + stack count) and Advanced (Active Effects, passive + temporary)
- **Modular CSS** — All design tokens in `_variables.css`; swap `themes/parchment-warm.css` to change the entire look

---

## Installation

### Via Foundry Module Manager (recommended)

1. Open Foundry VTT → **Setup → Add-on Modules → Install Module**
2. Paste the manifest URL into the **Manifest URL** field:
   ```
   https://github.com/AprilLiar/DC20_Alt_Character_Sheet/releases/latest/download/module.json
   ```
3. Click **Install**

### Manual

Download the latest `dc20-alt-character-sheet.zip` from the [Releases](https://github.com/AprilLiar/DC20_Alt_Character_Sheet/releases) page and unzip it into your Foundry `Data/modules/` folder.

---

## Compatibility

| Software | Version |
|---|---|
| Foundry VTT | v13 (minimum v13) |
| DC20 RPG system | 0.9 – 0.10.x |

---

## Usage

### Switching to the sheet
Open a Character actor → click the sheet icon (top-right) → select **DC20 Alternative Sheet**.

### Favourites
Right-click any item anywhere on the sheet → **Add to Favourites**. Pinned items appear in the Favourites panel on the Core page. Right-click again to remove.

### Last 3 Used
Any time you use or roll an item, it automatically moves to the top of the Last Used list on the Core page. The list holds the 3 most recent items.

### Combat filter
On the Combat page, use the filter bar (**All / Weapons / Spells / Maneuvers / Features**) to narrow the action list.

---

## License

This module is provided for personal use. Art assets and fonts used are freely licensed:
- [Cinzel](https://fonts.google.com/specimen/Cinzel) & [Crimson Text](https://fonts.google.com/specimen/Crimson+Text) — SIL Open Font License
