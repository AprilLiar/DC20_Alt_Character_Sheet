export function registerHandlebarsHelpers() {
  Handlebars.registerHelper('percent', (value, max) => {
    if (!max || max === 0) return 0;
    return Math.clamp(Math.round((value / max) * 100), 0, 100);
  });

  Handlebars.registerHelper('signedNum', (value) => {
    const n = Number(value) || 0;
    return n >= 0 ? `+${n}` : `${n}`;
  });

  Handlebars.registerHelper('abs', (value) => Math.abs(Number(value) || 0));

  Handlebars.registerHelper('times', (n, options) => {
    let result = '';
    for (let i = 0; i < n; i++) result += options.fn(i);
    return result;
  });

  Handlebars.registerHelper('lte', (a, b) => Number(a) <= Number(b));
  Handlebars.registerHelper('lt', (a, b) => Number(a) < Number(b));
  Handlebars.registerHelper('gte', (a, b) => Number(a) >= Number(b));
  Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b));
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('ne', (a, b) => a !== b);
  Handlebars.registerHelper('and', (a, b) => a && b);
  Handlebars.registerHelper('or', (a, b) => a || b);
  Handlebars.registerHelper('not', (a) => !a);

  Handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper('sub', (a, b) => Number(a) - Number(b));

  Handlebars.registerHelper('profDots', (level, max = 2) => {
    const dots = [];
    for (let i = 0; i < max; i++) {
      dots.push(`<span class="prof-dot ${i < level ? 'filled' : ''}"></span>`);
    }
    return new Handlebars.SafeString(dots.join(''));
  });

  Handlebars.registerHelper('apPips', (current, max = 4) => {
    const pips = [];
    for (let i = 0; i < max; i++) {
      pips.push(`<span class="ap-pip ${i < current ? 'filled' : ''}" data-pip-index="${i}"></span>`);
    }
    return new Handlebars.SafeString(pips.join(''));
  });

  Handlebars.registerHelper('itemCost', (costs) => {
    if (!costs) return new Handlebars.SafeString('');
    const DEFS = [
      { key: 'ap',      icon: 'fas fa-bolt',       cls: 'cost-ap'  },
      { key: 'stamina', icon: 'fas fa-fist-raised', cls: 'cost-sta' },
      { key: 'mana',    icon: 'fas fa-fire',        cls: 'cost-mna' },
      { key: 'grit',    icon: 'fas fa-shield-alt',  cls: 'cost-grt' },
      { key: 'health',  icon: 'fas fa-heart',       cls: 'cost-hp'  },
    ];
    const parts = DEFS
      .filter(d => costs[d.key])
      .map(d => `<span class="cost-badge ${d.cls}"><i class="${d.icon}"></i>${costs[d.key]}</span>`);
    return new Handlebars.SafeString(parts.join(''));
  });
}
