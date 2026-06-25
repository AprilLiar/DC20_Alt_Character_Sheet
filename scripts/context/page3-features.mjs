const RESOURCE_KEYS = ['ap', 'stamina', 'mana', 'grit'];

export async function prepareFeatures(actor) {
  const typeGroups = new Map(); // featureType label → items[]

  for (const item of actor.items) {
    if (item.type !== 'feature') continue;
    const resources = item.system.costs?.resources ?? {};
    if (RESOURCE_KEYS.some(k => resources[k])) continue; // active features live on combat page

    const rawType  = item.system.featureType ?? '';
    const label    = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : 'Other';

    if (!typeGroups.has(label)) typeGroups.set(label, []);
    typeGroups.get(label).push({
      id:   item.id,
      name: item.name,
      img:  item.img,
    });
  }

  // Sort groups alphabetically; 'Other' always last
  const featureGroups = [...typeGroups.entries()]
    .sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    })
    .map(([label, items]) => ({ label, items }));

  return { featureGroups };
}
