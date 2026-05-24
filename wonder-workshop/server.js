import express from 'express';
import chatHandler from './api/chat.js';
import imageGeminiHandler from './api/image-gemini.js';

const app = express();
const PORT = 4200;

app.use(express.json({ limit: '20mb' }));

// Gemini chat (same handler used by Vercel serverless function)
app.post('/api/chat', (req, res) => chatHandler(req, res));

// Gemini image generation (same handler used by Vercel serverless function)
app.post('/api/image-gemini', (req, res) => imageGeminiHandler(req, res));

// Image generation via Pollinations.ai (free, no API key).
// Return the URL directly — Pollinations takes 60–90s, which exceeds
// Vercel's serverless function timeout in production. Letting the browser
// load the URL itself sidesteps the timeout entirely, and the client uses
// data.image as <img src> regardless of whether it's an https: or data: URL.
app.post('/api/image', (req, res) => {
  const { prompt, width = 896, height = 512 } = req.body || {};
  if (!prompt) { res.status(400).json({ error: 'Prompt required' }); return; }

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&enhance=false&seed=${Date.now()}`;
  res.json({ image: url });
});

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
};

function normalizeBrandName(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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

app.post('/api/brand', async (req, res) => {
  const { brand = '' } = req.body || {};
  const key = normalizeBrandName(brand);
  if (!key) return res.status(400).json({ error: 'Brand is required' });

  const known = KNOWN_BRANDS[key];
  if (known) {
    res.json({ ...known, logoUrl: logoUrlForDomain(known.domain), lookup: 'known-brand' });
    return;
  }

  try {
    const resolved = await findBrandDomain(brand);
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
      lookup: resolved?.domain ? 'web-search' : 'none',
    });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
