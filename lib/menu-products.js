function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchByAliases(product, aliases = []) {
  const slug = normalizeText(product?.slug);
  const name = normalizeText(product?.name);
  return aliases.some((alias) => {
    const key = normalizeText(alias);
    return slug === key || slug.includes(key) || name.includes(key);
  });
}

export function resolveMenuProducts(products = []) {
  const list = Array.isArray(products) ? products : [];
  const pick = (aliases, used) => list.find((p) => !used.has(String(p.id)) && matchByAliases(p, aliases));

  const used = new Set();
  const calabresa = pick(['calabresa'], used);
  if (calabresa) used.add(String(calabresa.id));

  const marguerita = pick(['marguerita', 'margherita', 'margarita'], used);
  if (marguerita) used.add(String(marguerita.id));

  const combo = pick(['combo-classico', 'combo classico'], used);
  if (combo) used.add(String(combo.id));

  const especial = pick(['especial-do-mes', 'especial do mes', 'capricho'], used);
  if (especial) used.add(String(especial.id));

  const remaining = list.filter((p) => !used.has(String(p.id)));

  return { calabresa, marguerita, combo, especial, remaining };
}
