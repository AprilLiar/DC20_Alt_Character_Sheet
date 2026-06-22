export async function prepareInventory(actor) {
  const system = actor.system;
  const groups = { weapons: [], equipment: [], consumables: [], loot: [] };

  for (const item of actor.items) {
    const base = {
      id:       item.id,
      name:     item.name,
      img:      item.img,
      type:     item.type,
      quantity: item.system.quantity ?? 1,
      weight:   item.system.weight ?? 0,
      equipped: item.system.statuses?.equipped ?? false,
      rarity:   item.system.rarity ?? '',
    };
    switch (item.type) {
      case 'weapon':     groups.weapons.push({ ...base, weaponType: item.system.weaponType ?? '', rangeType: item.system.attackFormula?.rangeType ?? '' }); break;
      case 'equipment':  groups.equipment.push({ ...base, equipmentType: item.system.equipmentType ?? '' }); break;
      case 'consumable': groups.consumables.push({ ...base, consumableType: item.system.consumableType ?? '' }); break;
      case 'loot':       groups.loot.push(base); break;
    }
  }

  return {
    itemGroups: groups,
    currency:   system.currency ?? { pp: 0, gp: 0, sp: 0, cp: 0 },
    equipmentSlots: system.equipmentSlots ?? {},
  };
}
