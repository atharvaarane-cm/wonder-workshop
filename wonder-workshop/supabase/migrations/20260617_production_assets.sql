-- Production Lab asset history ("My Generations"). Every image/video made in
-- production mode is saved here so it survives refresh and can be re-downloaded,
-- edited, or reused as an input. The file itself lives in the workshop-images
-- bucket; this row stores its URL + the prompt/settings that made it.
--
-- OWNER-SCOPED (unlike workshop_projects' flat-shared model): these are personal
-- generations, and this matches the Google-Docs/per-user direction we're moving to.
--
-- Run this in the Supabase SQL editor on the same project as workshop_projects.

create table if not exists public.production_assets (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('image', 'video')),
  url         text not null,                 -- public bucket URL of the file
  prompt      text,
  tool        text,                          -- 'image' | 'enhance' | 'video'
  settings    jsonb not null default '{}'::jsonb,  -- ratio / resolution / duration etc.
  created_at  timestamptz not null default now()
);

create index if not exists production_assets_owner_idx
  on public.production_assets (owner, created_at desc);

alter table public.production_assets enable row level security;

-- A user sees and manages only their own generations.
drop policy if exists "production_assets: own" on public.production_assets;
create policy "production_assets: own"
  on public.production_assets
  for all
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());
