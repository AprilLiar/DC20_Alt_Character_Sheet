export function registerHandlebarsHelpers() {
  Handlebars.registerHelper('percent', (value, max) => {
    if (!max || max === 0) return 0;
    return Math.clamped(Math.round((value / max) * 100), 0, 100);
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
      pips.push(`<span class="ap-pip ${i < current ? 'filled' : ''}"></span>`);
    }
    return new Handlebars.SafeString(pips.join(''));
  });

  Handlebars.registerHelper('itemCost', (costs) => {
    if (!costs) return '';
    const parts = [];
    if (costs.ap) parts.push(`${costs.ap}AP`);
    if (costs.stamina) parts.push(`${costs.stamina}STA`);
    if (costs.mana) parts.push(`${costs.mana}MNA`);
    if (costs.grit) parts.push(`${costs.grit}GRT`);
    if (costs.health) parts.push(`${costs.health}HP`);
    return parts.join(' ');
  });
}
