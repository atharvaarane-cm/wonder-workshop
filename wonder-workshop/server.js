import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = 4200;

app.use(express.json({ limit: '20mb' }));

// ---------------------------------------------------------------
// Gemini setup. Mirrors api/chat.js + api/image-gemini.js so local
// dev behavior matches production. Keys come from .env.local at the
// project root (loaded via node --env-file-if-exists in bun run dev).
// ---------------------------------------------------------------

const TEXT_GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_IMAGE_API_KEY;
const IMAGE_GEMINI_KEY = process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY;
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';

function ensureGeminiKey(res, key = TEXT_GEMINI_KEY) {
  if (key) return true;
  res.status(500).json({
    error: 'Gemini API key not configured',
    hint: 'Add GEMINI_API_KEY (and optionally GEMINI_IMAGE_API_KEY) to .env.local at the repo root, then restart bun run dev.',
  });
  return false;
}

const genAI = TEXT_GEMINI_KEY ? new GoogleGenerativeAI(TEXT_GEMINI_KEY) : null;

// ---------------------------------------------------------------
// /api/chat — Gemini text generation (mirrors api/chat.js).
// Accepts the same { messages, tools?, stream } shape the client
// already sends, returns { message: { content } } so existing
// frontend code keeps working unchanged.
// ---------------------------------------------------------------

app.post('/api/chat', async (req, res) => {
  if (!ensureGeminiKey(res, TEXT_GEMINI_KEY)) return;

  const { messages = [], tools } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // System messages → instructionPart; convert assistant/user to
  // Gemini's role names. Gemini requires the first non-system message
  // be role: 'user'.
  const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content).filter(Boolean);
  const convo = messages.filter(m => m.role !== 'system');
  if (convo.length === 0) {
    return res.status(400).json({ error: 'At least one user/assistant message required' });
  }

  const history = convo.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const last = convo[convo.length - 1];

  const modelConfig = { model: TEXT_MODEL };
  if (systemMessages.length) {
    modelConfig.systemInstruction = systemMessages.join('\n\n');
  }
  if (Array.isArray(tools) && tools.length) {
    modelConfig.tools = [{ functionDeclarations: tools }];
  }

  try {
    const model = genAI.getGenerativeModel(modelConfig);
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(last.content);
    const response = result.response;
    const text = response.text();

    // Tool calls — surface in the same shape api/chat.js returns so
    // the client's applyChatToolCall handler works identically.
    const candidates = response.candidates || [];
    const actions = [];
    for (const c of candidates) {
      for (const part of c?.content?.parts || []) {
        if (part.functionCall) {
          actions.push({
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
          });
        }
      }
    }

    res.json({
      message: { content: text, role: 'assistant' },
      functionCalls: actions.map(a => ({ name: a.name, args: a.arguments })),
      actions,
    });
  } catch (err) {
    console.error('[local /api/chat] Gemini error:', err?.message || err);
    res.status(502).json({ error: 'Gemini call failed', detail: String(err?.message || err) });
  }
});

// ---------------------------------------------------------------
// /api/image-gemini — Nano Banana Pro image generation (mirrors
// api/image-gemini.js exactly). Returns a data: URL the client uses
// directly as <img src>.
// ---------------------------------------------------------------

const RATIO_MAP = {
  '16:9': '16:9', '9:16': '9:16', '1:1': '1:1',
  '4:5': '4:5', '5:4': '5:4', '4:3': '4:3', '3:4': '3:4',
  '2:1': '16:9', '21:9': '16:9',
};

app.post('/api/image-gemini', async (req, res) => {
  if (!ensureGeminiKey(res, IMAGE_GEMINI_KEY)) return;

  const { prompt, ratio = '1:1', referenceImages = [] } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt required' });
  }

  const aspectRatio = RATIO_MAP[ratio] || '1:1';
  const parts = [{ text: prompt }];

  for (const refUrl of referenceImages.slice(0, 4)) {
    try {
      let mimeType, base64;
      if (refUrl.startsWith('data:')) {
        const match = refUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) continue;
        mimeType = match[1];
        base64 = match[2];
      } else {
        const r = await fetch(refUrl);
        if (!r.ok) continue;
        mimeType = r.headers.get('content-type') || 'image/png';
        const buf = Buffer.from(await r.arrayBuffer());
        base64 = buf.toString('base64');
      }
      parts.push({ inlineData: { mimeType, data: base64 } });
    } catch {
      // Skip refs we can't load — better to generate without them
      // than to fail the whole request.
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio },
    },
  };

  // Key via header, not query string (parity with api/image-gemini.js).
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`;

  let geminiRes;
  try {
    geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': IMAGE_GEMINI_KEY },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Gemini fetch failed', detail: String(err?.message || err) });
  }

  const text = await geminiRes.text();
  let data;
  try { data = JSON.parse(text); } catch {
    return res.status(502).json({ error: 'Gemini returned non-JSON', detail: text.slice(0, 400) });
  }

  if (!geminiRes.ok) {
    return res.status(geminiRes.status).json({
      error: data?.error?.message || 'Gemini error',
      detail: data,
    });
  }

  const candidates = data?.candidates || [];
  let imagePart = null;
  let safetyText = null;
  for (const c of candidates) {
    for (const p of c?.content?.parts || []) {
      if (p.inlineData?.data && (p.inlineData.mimeType || '').startsWith('image/')) {
        imagePart = p.inlineData;
        break;
      }
      if (p.text) safetyText = p.text;
    }
    if (imagePart) break;
  }

  if (!imagePart) {
    return res.status(502).json({
      error: 'No image in Gemini response',
      detail: safetyText || JSON.stringify(data).slice(0, 400),
    });
  }

  const dataUrl = `data:${imagePart.mimeType};base64,${imagePart.data}`;
  res.json({ image: dataUrl });
});

// ---------------------------------------------------------------
// /api/image — Pollinations.ai (free fallback, no API key).
// Returns the URL directly — Pollinations takes 60–90s, which
// exceeds Vercel's serverless function timeout in production.
// Letting the browser load the URL itself sidesteps the timeout,
// and the client treats data.image as <img src> regardless of
// whether it's https: or data:.
// ---------------------------------------------------------------

app.post('/api/image', (req, res) => {
  const { prompt, width = 896, height = 512 } = req.body || {};
  if (!prompt) { res.status(400).json({ error: 'Prompt required' }); return; }

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&enhance=false&seed=${Date.now()}`;
  res.json({ image: url });
});

// ---------------------------------------------------------------
// /api/brand — brand-lookup mock with a small known-brands table
// plus a DuckDuckGo + color-extraction fallback. Unchanged from
// the original local dev server; the Vercel-side handler does the
// same thing with different known-brand seeds.
// ---------------------------------------------------------------

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
  if (TEXT_GEMINI_KEY || IMAGE_GEMINI_KEY) {
    console.log(`API server running at http://localhost:${PORT} (Gemini: ${TEXT_MODEL} + ${IMAGE_MODEL})`);
  } else {
    console.log(`API server running at http://localhost:${PORT} (no Gemini key — set GEMINI_API_KEY in .env.local)`);
  }
});
