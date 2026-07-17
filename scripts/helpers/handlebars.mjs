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

  // Joins all string arguments (the final Handlebars options arg is dropped).
  // Used to build dynamic partial names, e.g. {{> (concat "dc20-split-" id)}}
  Handlebars.registerHelper('concat', (...args) => {
    args.pop();
    return args.join('');
  });

  // First three characters of a string — used for compact split-tab skill lists.
  Handlebars.registerHelper('abbr3', (s) => String(s ?? '').slice(0, 3));

  Handlebars.registerHelper('profDots', (level, max = 2) => {
    const dots = [];
    for (let i = 0; i < max; i++) {
      dots.push(`<span class="prof-dot ${i < level ? 'filled' : ''}"></span>`);
    }
    return new Handlebars.SafeString(dots.join(''));
  });

  // DC20's own purple/grey AP-cube SVGs (systems/dc20rpg/images/sheet/header/
  // ap-{full,empty}.svg — used by the base system's token HUD AP bar) are
  // plain static image assets, so — unlike the system's bundled .mjs files,
  // which don't exist as individually fetchable files in an installed
  // package — they're safe to reference directly by path, the same way
  // condition icons already pull system-owned image files.
  const AP_CUBE_FULL  = 'systems/dc20rpg/images/sheet/header/ap-full.svg';
  const AP_CUBE_EMPTY = 'systems/dc20rpg/images/sheet/header/ap-empty.svg';

  Handlebars.registerHelper('apPips', (current, max = 4) => {
    const pips = [];
    for (let i = 0; i < max; i++) {
      const filled = i < current;
      const src = filled ? AP_CUBE_FULL : AP_CUBE_EMPTY;
      pips.push(`<img class="ap-pip${filled ? ' filled' : ''}" data-pip-index="${i}" src="${src}" alt="AP">`);
    }
    return new Handlebars.SafeString(pips.join(''));
  });

  Handlebars.registerHelper('itemCost', (costs) => {
    if (!costs) return new Handlebars.SafeString('');
    const DEFS = [
      { key: 'ap',      img: AP_CUBE_FULL,          cls: 'cost-ap'  },
      { key: 'stamina', icon: 'fas fa-fist-raised', cls: 'cost-sta' },
      { key: 'mana',    icon: 'fas fa-fire',        cls: 'cost-mna' },
      { key: 'grit',    icon: 'fas fa-shield-alt',  cls: 'cost-grt' },
      { key: 'health',  icon: 'fas fa-heart',       cls: 'cost-hp'  },
    ];
    const parts = DEFS
      .filter(d => costs[d.key])
      .map(d => {
        const iconHtml = d.img
          ? `<img class="cost-badge-icon" src="${d.img}" alt="">`
          : `<i class="${d.icon}"></i>`;
        return `<span class="cost-badge ${d.cls}">${iconHtml}${costs[d.key]}</span>`;
      });
    return new Handlebars.SafeString(parts.join(''));
  });
}
