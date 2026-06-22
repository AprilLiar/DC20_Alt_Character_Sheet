const SOURCE_ORDER = ['class', 'subclass', 'ancestry', 'background', 'other'];

export async function prepareFeatures(actor) {
  // Collect passive features (features without resource costs, or explicit passive flag)
  const groups = Object.fromEntries(SOURCE_ORDER.map(k => [k, []]));

  for (const item of actor.items) {
    if (item.type !== 'feature') continue;
    const costs = item.system.costs ?? {};
    const hasResourceCost = ['ap','stamina','mana','grit'].some(k => costs[k]);
    if (hasResourceCost) continue; // active features live on the combat page

    const origin = (item.system.featureOrigin ?? item.system.featureType ?? 'other').toLowerCase();
    const bucket = SOURCE_ORDER.includes(origin) ? origin : 'other';

    groups[bucket].push({
      id:          item.id,
      name:        item.name,
      img:         item.img,
      type:        item.type,
      featureType: item.system.featureType ?? '',
      description: item.system.description ?? '',
    });
  }

  return { featureGroups: groups, sourceOrder: SOURCE_ORDER };
}
