import express from 'express';
import { request as httpRequest } from 'http';

const app = express();
const PORT = 4200;

app.use(express.json({ limit: '20mb' }));

function proxyTo(hostname, port, path, body, res) {
  const data = JSON.stringify(body);
  const req = httpRequest(
    { hostname, port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
    (upstream) => {
      res.status(upstream.statusCode);
      res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/json');
      upstream.pipe(res);
    }
  );
  req.on('error', () => {
    if (!res.headersSent) res.status(503).json({ error: 'Service unavailable' });
  });
  req.write(data);
  req.end();
}

// Ollama chat proxy
app.post('/api/chat', (req, res) => {
  proxyTo('127.0.0.1', 11434, '/api/chat', req.body, res);
});

// Image generation via Pollinations.ai (free, no API key)
app.post('/api/image', async (req, res) => {
  const { prompt, width = 896, height = 512 } = req.body;

  try {
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&enhance=true&seed=${Date.now()}`;

    const imgRes = await fetch(url);
    if (!imgRes.ok) { res.status(imgRes.status).json({ error: 'Image generation failed' }); return; }

    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64')
    res.json({ image: `data:image/jpeg;base64,${base64}` });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
