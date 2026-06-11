-- Wonder Workshop — shared project storage on Portal's Supabase.
--
-- Flat shared workspace: any authenticated user (Portal already gates login to
-- the CM domains, so authenticated == a CM team member) can read and write every
-- project. Project state is a JSONB blob for v1 (mirrors the current localStorage
-- shape); generated/uploaded images live in the 'workshop-images' Storage bucket
-- and are referenced by URL inside the JSON.
--
-- Purely additive — creates new workshop_* objects only, never touches Portal's
-- existing tables. Mirrors Portal's RLS conventions (auth.uid() + to authenticated).

-- ── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.workshop_projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled',
  folder      text,
  data        jsonb not null default '{}'::jsonb,
  owner       uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.workshop_projects is
  'Wonder Workshop projects. data = full project state (JSONB); images offloaded to the workshop-images bucket.';

create index if not exists workshop_projects_updated_idx on public.workshop_projects (updated_at desc);
create index if not exists workshop_projects_folder_idx  on public.workshop_projects (folder);

-- keep updated_at fresh on every write
create or replace function public.workshop_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workshop_projects_touch on public.workshop_projects;
create trigger workshop_projects_touch
  before update on public.workshop_projects
  for each row execute function public.workshop_touch_updated_at();

-- ── Row-level security (flat shared workspace) ───────────────────────────────
alter table public.workshop_projects enable row level security;

-- Any authenticated user can do anything to any project; anon is excluded;
-- service_role bypasses RLS (used by Workshop's api/ serverless functions).
drop policy if exists "workshop_projects: authenticated full access" on public.workshop_projects;
create policy "workshop_projects: authenticated full access"
  on public.workshop_projects
  for all
  to authenticated
  using (true)
  with check (true);

-- ── Storage bucket for images ────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('workshop-images', 'workshop-images', true)
  on conflict (id) do nothing;

-- Authenticated users manage objects in the bucket; the bucket is public so the
-- app can render images by URL in <img> tags without a signed request.
drop policy if exists "workshop-images: authenticated write" on storage.objects;
create policy "workshop-images: authenticated write"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'workshop-images')
  with check (bucket_id = 'workshop-images');
