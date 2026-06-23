import { gate } from './_lib/auth.js'

const KNOWN_BRANDS = {
  starbucks: {
    brand: 'Starbucks',
    domain: 'starbucks.com',
    sourceUrl: 'https://www.starbucks.com/',
    colors: [
      { hex: '#00704A', name: 'Starbucks Green' },
      { hex: '#FFFFFF', name: 'White' },
      { hex: '#27251F', name: 'Black' },
    ],
    rules: 'Use Starbucks green as the primary brand color with white space and restrained black typography. Keep the system clean, welcoming, and coffee-led.',
  },
  nike: {
    brand: 'Nike',
    domain: 'nike.com',
    sourceUrl: 'https://www.nike.com/',
    colors: [
      { hex: '#111111', name: 'Nike Black' },
      { hex: '#FFFFFF', name: 'White' },
      { hex: '#F5F5F5', name: 'Light Neutral' },
    ],
    rules: 'Use bold black-and-white contrast, athletic minimalism, and confident motion-led compositions.',
  },
  apple: {
    brand: 'Apple',
    domain: 'apple.com',
    sourceUrl: 'https://www.apple.com/',
    colors: [
      { hex: '#000000', name: 'Black' },
      { hex: '#FFFFFF', name: 'White' },
      { hex: '#F5F5F7', name: 'Apple Light Gray' },
      { hex: '#0071E3', name: 'Apple Blue' },
    ],
    rules: 'Use generous whitespace, crisp product focus, neutral surfaces, and minimal copy.',
  },
  pepsi: {
    brand: 'Pepsi',
    domain: 'pepsi.com',
    sourceUrl: 'https://www.pepsi.com/',
    colors: [
      { hex: '#004B93', name: 'Pepsi Blue' },
      { hex: '#E32934', name: 'Pepsi Red' },
      { hex: '#FFFFFF', name: 'White' },
    ],
    rules: 'Use the Pepsi globe (blue/red/white) prominently, vibrant photography, energetic compositions, bold cropped typography. Maintain the classic Pepsi visual identity emphasizing refreshment, social moments, and contemporary culture.',
  },
  cocacola: {
    brand: 'Coca-Cola',
    domain: 'coca-cola.com',
    sourceUrl: 'https://www.coca-cola.com/',
    colors: [
      { hex: '#F40009', name: 'Coca-Cola Red' },
      { hex: '#FFFFFF', name: 'White' },
      { hex: '#000000', name: 'Black' },
    ],
    rules: 'Use the classic Coca-Cola red dominantly, Spencerian script logo, joyful social compositions, warm cinematic lighting.',
  },
  adidas: {
    brand: 'Adidas',
    domain: 'adidas.com',
    sourceUrl: 'https://www.adidas.com/',
    colors: [
      { hex: '#000000', name: 'Adidas Black' },
      { hex: '#FFFFFF', name: 'White' },
    ],
    rules: 'High-contrast black-and-white athletic compositions with bold typography and graphic three-stripe motifs.',
  },
  spotify: {
    brand: 'Spotify',
    domain: 'spotify.com',
    sourceUrl: 'https://www.spotify.com/',
    colors: [
      { hex: '#1DB954', name: 'Spotify Green' },
      { hex: '#000000', name: 'Black' },
      { hex: '#FFFFFF', name: 'White' },
    ],
    rules: 'Use Spotify green on black or white backgrounds, bold cropped portraiture, music-led energy, and minimal type.',
  },
};

// Common nicknames / variants → canonical KNOWN_BRANDS key. Lets "Coke" resolve
// to Coca-Cola instead of web-searching to the corporate site (which serves an
// off-brand logo + muted colors).
const BRAND_ALIASES = {
  coke: 'cocacola',
  cocacolacompany: 'cocacola',
  thecocacolacompany: 'cocacola',
  pepsico: 'pepsi',
};

function normalizeBrandName(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Resolve to a KNOWN_BRANDS key space-insensitively ("Coca-Cola" → "cocacola")
// and via aliases ("Coke" → "cocacola"). Returns null if not a known brand.
function resolveKnownKey(brand) {
  const despaced = normalizeBrandName(brand).replace(/\s+/g, '');
  if (!despaced) return null;
  const canonical = BRAND_ALIASES[despaced] || despaced;
  return KNOWN_BRANDS[canonical] ? canonical : null;
}

function logoUrlForDomain(domain) {
  return domain ? `https://logo.clearbit.com/${domain}` : null;
}

function isLikelyBrandDomain(url, brand) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const cleanBrand = normalizeBrandName(brand).replace(/\s+/g, '');
    return cleanBrand && host.replace(/[^a-z0-9]/g, '').includes(cleanBrand);
  } catch {
    return false;
  }
}

async function findBrandDomain(brand) {
  const query = encodeURIComponent(`${brand} official website`);
  const url = `https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url, { headers: { 'User-Agent': 'WonderWorkshop/1.0' } });
  if (!response.ok) return null;

  const data = await response.json();
  const candidates = [
    data.AbstractURL,
    data.OfficialWebsite,
    ...(data.RelatedTopics || []).flatMap(item => item.FirstURL ? [item.FirstURL] : (item.Topics || []).map(t => t.FirstURL).filter(Boolean)),
  ].filter(Boolean);

  const match = candidates.find(candidate => isLikelyBrandDomain(candidate, brand)) || candidates[0];
  if (!match) return null;

  try {
    const parsed = new URL(match);
    return { domain: parsed.hostname.replace(/^www\./, ''), sourceUrl: parsed.origin };
  } catch {
    return null;
  }
}

function colorName(hex) {
  const value = hex.toUpperCase();
  const names = {
    '#000000': 'Black',
    '#FFFFFF': 'White',
    '#F5F5F5': 'Light Neutral',
    '#F5F5F7': 'Light Gray',
  };
  return names[value] || 'Brand color';
}

async function extractSiteColors(sourceUrl) {
  if (!sourceUrl) return [];
  try {
    const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'WonderWorkshop/1.0' } });
    if (!response.ok) return [];
    const html = await response.text();
    const counts = new Map();
    const matches = html.match(/#[0-9a-fA-F]{6}\b/g) || [];
    for (const raw of matches) {
      const hex = raw.toUpperCase();
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const contrast = Math.max(r, g, b) - Math.min(r, g, b);
      if (contrast < 18 && r > 25 && r < 235) continue;
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hex]) => ({ hex, name: colorName(hex) }));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await gate(req, res))) return; // auth gate (no-op until cloud env is set)

  const { brand = '' } = req.body || {};
  const key = normalizeBrandName(brand);
  if (!key) return res.status(400).json({ error: 'Brand is required' });

  const canonicalKey = resolveKnownKey(brand);
  const known = canonicalKey ? KNOWN_BRANDS[canonicalKey] : null;
  if (known) {
    res.json({ ...known, logoUrl: logoUrlForDomain(known.domain), lookup: 'known-brand' });
    return;
  }

  try {
    let resolved = await findBrandDomain(brand);
    let lookup = resolved?.domain ? 'web-search' : null;
    // Heuristic fallback — if DuckDuckGo didn't return a domain,
    // guess `{key}.com`. Clearbit's logo API serves a real logo for
    // most major brands at that URL; a 404 is harmless (the <img>
    // just fails to load and the panel shows the upload placeholder).
    if (!resolved?.domain) {
      const guessKey = key.replace(/\s+/g, '');
      if (guessKey) {
        resolved = { domain: `${guessKey}.com`, sourceUrl: `https://${guessKey}.com/` };
        lookup = 'guess';
      }
    }
    const colors = await extractSiteColors(resolved?.sourceUrl);
    res.json({
      brand,
      domain: resolved?.domain ?? '',
      sourceUrl: resolved?.sourceUrl ?? '',
      logoUrl: logoUrlForDomain(resolved?.domain),
      colors,
      rules: resolved?.domain
        ? `Use colors and logo references from ${resolved.domain}. Keep the generated layout aligned to the brand's existing visual system.`
        : '',
      lookup: lookup || 'none',
    });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
}
