const RESOURCE_KEYS = ['ap', 'stamina', 'mana', 'grit'];

export async function prepareFeatures(actor) {
  const typeGroups = new Map(); // featureType label → items[]
  const activeItems = [];

  const items = [...actor.items].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  for (const item of items) {
    if (item.type !== 'feature') continue;
    const resources = item.system.costs?.resources ?? {};
    const isActive  = RESOURCE_KEYS.some(k => resources[k]);

    if (isActive) {
      activeItems.push({ id: item.id, name: item.name, img: item.img });
      continue;
    }

    const rawType  = item.system.featureType ?? '';
    const label    = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : 'Other';

    if (!typeGroups.has(label)) typeGroups.set(label, []);
    typeGroups.get(label).push({
      id:   item.id,
      name: item.name,
      img:  item.img,
    });
  }

  // Sort passive groups alphabetically; 'Other' always last
  const passiveGroups = [...typeGroups.entries()]
    .sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    })
    .map(([label, items]) => ({ label, items }));

  const featureGroups = [
    ...(activeItems.length ? [{ label: 'Active Features', items: activeItems }] : []),
    ...passiveGroups,
  ];

  return { featureGroups };
}
