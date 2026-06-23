// Background generation worker core. Claims one pending job, generates a
// time-boxed batch of its image slots (using the SAME prompt builders as the
// client, via genPrompts), uploads each to the images bucket, writes the URLs
// back into the project, updates the job, and leaves it 'pending' if slots
// remain (the next cron tick resumes) or 'complete' when done.
//
// Talks to Supabase over REST + Storage with the SERVICE-ROLE key (it's a cron,
// not a logged-in user, so it must bypass RLS). No Supabase SDK dependency.
//
// runWorkerOnce() is exported pure-ish so it can be driven by the cron route
// AND a local test harness against the real table.

import { createHash } from 'node:crypto';
import { generateGeminiImage } from './geminiImage.js';
import {
  talentPrompt, talentHeadshotPrompt, talentFullBodyPrompt,
  locationPrompt, productPrompt, moodPrompt, framePrompt,
} from '../../client/src/v2/genPrompts.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'workshop-images';
// Stay safely under the function's maxDuration; the next cron tick resumes.
const BATCH_BUDGET_MS = Number(process.env.GEN_WORKER_BUDGET_MS) || 240000;

function rest(path, { method = 'GET', body, prefer } = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function restJson(path, opts) {
  const r = await rest(path, opts);
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// Upload a data: URL to the public bucket, content-addressed by sha1 so re-saves
// don't duplicate. Returns the public URL.
async function uploadToBucket(projectId, dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('not a data url');
  const mime = m[1];
  const bytes = Buffer.from(m[2], 'base64');
  const hash = createHash('sha1').update(bytes).digest('hex');
  const ext = (mime.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
  const path = `projects/${projectId}/${hash}.${ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': mime, 'x-upsert': 'true' },
    body: bytes,
  });
  if (!r.ok) {
    const t = await r.text();
    if (!/exists|duplicate/i.test(t)) throw new Error(`bucket upload ${r.status}: ${t.slice(0, 160)}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ── slot → prompt / ref / write-back, by kind ───────────────────────────────
const byId = (arr, id) => (arr || []).find(x => x && x.id === id);

function slotPrompt(slot, data) {
  const t = byId(data.talent, slot.assetId);
  switch (slot.kind) {
    case 'talent_primary':  return talentPrompt(t || {});
    case 'talent_headshot': return talentHeadshotPrompt(t || {}, slot.view);
    case 'talent_fullbody': return talentFullBodyPrompt(t || {}, slot.view);
    case 'location':        return locationPrompt(byId(data.locations, slot.assetId) || {});
    case 'product':         return productPrompt(byId(data.products, slot.assetId) || {});
    case 'mood':            return moodPrompt(slot.caption || byId(data.moodBoard, slot.assetId)?.caption || '');
    case 'frame': {
      const f = byId(data.frames, slot.assetId);
      return f ? framePrompt(f, data.talent, data.products) : '';
    }
    default: return '';
  }
}

function slotRatio(slot, data) {
  if (slot.kind === 'talent_fullbody') return '3:4';
  if (slot.kind === 'location' || slot.kind === 'frame') return data.meta?.aspect || '16:9';
  return '1:1';
}

function slotRefs(slot, data) {
  const primaryRef = t => t?.headshot || t?.headshots?.front;
  if (slot.kind === 'talent_headshot' || slot.kind === 'talent_fullbody') {
    const u = primaryRef(byId(data.talent, slot.assetId));
    return u ? [u] : [];
  }
  if (slot.kind === 'frame') {
    const f = byId(data.frames, slot.assetId);
    if (!f) return [];
    const refs = [];
    for (const tid of (f.talentIds || [])) { const u = primaryRef(byId(data.talent, tid)); if (u) refs.push(u); }
    const loc = byId(data.locations, f.locationId);
    const lu = loc?.generatedImage || loc?.referenceImage; if (lu) refs.push(lu);
    for (const pid of (f.productIds || [])) { const u = byId(data.products, pid)?.referenceImage; if (u && !refs.includes(u)) refs.push(u); }
    return refs.slice(0, 4);
  }
  return [];
}

// Apply a generated url into the (latest) project data, by slot kind. Mutates+returns.
function applyResult(data, slot, url) {
  const t = byId(data.talent, slot.assetId);
  switch (slot.kind) {
    case 'talent_primary':  if (t) { t.headshot = url; t.headshots = { ...(t.headshots || {}), front: url }; t.generationStatus = 'complete'; } break;
    case 'talent_headshot': if (t) t.headshots = { ...(t.headshots || {}), [slot.view]: url }; break;
    case 'talent_fullbody': if (t) t.fullBody = { ...(t.fullBody || {}), [slot.view]: url }; break;
    case 'location':        { const l = byId(data.locations, slot.assetId); if (l) { l.generatedImage = url; l.generationStatus = 'complete'; } break; }
    case 'product':         { const p = byId(data.products, slot.assetId); if (p) { p.referenceImage = url; p.generationStatus = 'complete'; } break; }
    case 'mood':            { const mItem = byId(data.moodBoard, slot.assetId); if (mItem) { mItem.image = url; mItem.generationStatus = 'complete'; } break; }
    case 'frame':           { const f = byId(data.frames, slot.assetId); if (f) { f.uploadedImage = url; f.imageStatus = 'uploaded'; f.imageBrief = f.brief || ''; } break; }
  }
  return data;
}

// Claim one pending job atomically. The job sits 'pending' between batches, so
// a partially-done job is naturally re-claimed on the next tick. (Reclaiming a
// job whose worker died MID-batch — stuck 'running' — is a follow-up.)
async function claimJob() {
  const candidates = await restJson(`generation_jobs?status=eq.pending&order=updated_at.asc&limit=1&select=id`);
  if (!candidates?.length) return null;
  const id = candidates[0].id;
  // Atomic: only succeeds if it's still pending (guards against a parallel tick).
  const claimed = await restJson(
    `generation_jobs?id=eq.${id}&status=eq.pending`,
    { method: 'PATCH', body: { status: 'running', claimed_at: new Date().toISOString() }, prefer: 'return=representation' },
  );
  return claimed?.[0] || null; // null = another tick claimed it first
}

export async function runWorkerOnce() {
  if (!SUPABASE_URL || !SERVICE_KEY) return { ok: false, reason: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' };
  const job = await claimJob();
  if (!job) return { ok: true, claimed: false };

  const slots = Array.isArray(job.slots) ? job.slots : [];
  const deadline = Date.now() + BATCH_BUDGET_MS;
  let generated = 0, failed = 0;

  // Load project once; we re-read just before writing so we don't clobber edits.
  let proj = await restJson(`workshop_projects?id=eq.${job.project_id}&select=data&limit=1`);
  let data = proj?.[0]?.data;
  if (!data) {
    await restJson(`generation_jobs?id=eq.${job.id}`, { method: 'PATCH', body: { status: 'error', error: 'project not found' } });
    return { ok: false, reason: 'project not found' };
  }

  for (const slot of slots) {
    if (slot.status === 'done') continue;
    if (Date.now() >= deadline) break; // out of time — resume next tick
    try {
      const prompt = slotPrompt(slot, data);
      if (!prompt) { slot.status = 'error'; slot.error = 'no prompt'; failed++; continue; }
      const dataUrl = await generateGeminiImage({ prompt, ratio: slotRatio(slot, data), referenceImages: slotRefs(slot, data), timeoutMs: 90000 });
      const publicUrl = await uploadToBucket(job.project_id, dataUrl);
      slot.url = publicUrl;
      applyResult(data, slot, publicUrl); // keep in-memory data current for later slots' refs
      slot.status = 'done';
      generated++;
    } catch (e) {
      slot.attempts = (slot.attempts || 0) + 1;
      // Retry transient/rate-limit on a later tick; give up after a few.
      slot.status = slot.attempts >= 3 ? 'error' : 'pending';
      slot.error = String(e?.message || e).slice(0, 200);
      failed++;
    }
  }

  // Write back onto the LATEST project data: overlay ONLY the image fields we
  // generated this batch, so a concurrent text edit by a user isn't clobbered.
  const latest = await restJson(`workshop_projects?id=eq.${job.project_id}&select=data&limit=1`);
  const target = latest?.[0]?.data || data;
  for (const slot of slots) {
    if (slot.status === 'done' && slot.url) applyResult(target, slot, slot.url);
  }
  await restJson(`workshop_projects?id=eq.${job.project_id}`, { method: 'PATCH', body: { data: target } });

  const remaining = slots.filter(s => s.status !== 'done' && s.status !== 'error').length;
  const done = slots.filter(s => s.status === 'done').length;
  const anyLeft = slots.some(s => s.status === 'pending');
  await restJson(`generation_jobs?id=eq.${job.id}`, {
    method: 'PATCH',
    body: { slots, done, total: slots.length, status: anyLeft ? 'pending' : 'complete', claimed_at: anyLeft ? null : new Date().toISOString() },
  });

  return { ok: true, claimed: true, jobId: job.id, generated, failed, remaining, status: anyLeft ? 'pending' : 'complete' };
}
