// Cloud persistence for Production Lab generations ("My Generations" / History).
// Uploads the file to the workshop-images bucket and records a row in
// production_assets (owner-scoped). All helpers are no-ops returning empty when
// Supabase isn't configured, so local/dev never breaks.

import { supabase, hasSupabase, WORKSHOP_BUCKET } from "./supabaseClient.js";

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return { blob: new Blob([arr], { type: mime }), mime };
}

// Save one generation. Accepts either a data URL (images) or a Blob (video).
// Returns the inserted row, or null when cloud isn't available.
export async function saveProductionAsset({ kind, dataUrl, blob, mime, prompt, tool, settings }) {
  if (!hasSupabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  const owner = auth?.user?.id;
  if (!owner) throw new Error("Not signed in");

  let uploadBlob, contentType;
  if (dataUrl) { const r = dataUrlToBlob(dataUrl); uploadBlob = r.blob; contentType = r.mime; }
  else { uploadBlob = blob; contentType = mime || blob?.type || "application/octet-stream"; }

  const ext = (contentType.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");
  const path = `production/${owner}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(WORKSHOP_BUCKET).upload(path, uploadBlob, {
    contentType, upsert: false,
  });
  if (upErr) throw upErr;
  const url = supabase.storage.from(WORKSHOP_BUCKET).getPublicUrl(path).data.publicUrl;

  const { data, error } = await supabase
    .from("production_assets")
    .insert({ owner, kind, url, prompt: prompt || null, tool: tool || null, settings: settings || {} })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listProductionAssets() {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("production_assets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data || [];
}

export async function deleteProductionAsset(id) {
  if (!hasSupabase) return;
  const { error } = await supabase.from("production_assets").delete().eq("id", id);
  if (error) throw error;
}

// Force a download of a (possibly cross-origin) bucket URL — fetch to a blob so
// the download attribute is honored instead of opening in a new tab.
export async function downloadUrl(url, name) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(obj);
  } catch {
    window.open(url, "_blank"); // fallback
  }
}
