-- Server-side generation jobs. A "Create" (or "regenerate all") enqueues a job;
-- a Vercel cron worker claims it, generates the images in resumable batches
-- (writing them back into workshop_projects.data), and marks it done. Clients
-- subscribe via Realtime so the storyboard fills in even with the tab closed.
--
-- Run this in the Supabase SQL editor on the same project as workshop_projects.

create table if not exists public.generation_jobs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.workshop_projects(id) on delete cascade,
  owner       uuid references auth.users(id) on delete set null,
  -- pending → running → complete | error.  Worker flips pending→running on claim,
  -- back to pending between batches (so the next cron tick resumes), then complete.
  status      text not null default 'pending',
  -- the work list: [{ key, kind, ... , status:'pending'|'done'|'error', attempts }]
  -- kind ∈ talent_primary | talent_headshot | talent_fullbody | location | product | mood | frame
  slots       jsonb not null default '[]'::jsonb,
  done        int  not null default 0,
  total       int  not null default 0,
  error       text,
  -- set when a worker claims it; lets a later tick reclaim a job whose worker
  -- died mid-batch (claimed_at older than a few minutes + status 'running').
  claimed_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists generation_jobs_status_idx  on public.generation_jobs (status, updated_at);
create index if not exists generation_jobs_project_idx on public.generation_jobs (project_id);

-- keep updated_at fresh (reuses the function created by the workshop_projects migration)
drop trigger if exists generation_jobs_touch on public.generation_jobs;
create trigger generation_jobs_touch
  before update on public.generation_jobs
  for each row execute function public.workshop_touch_updated_at();

-- RLS: same flat-shared model as workshop_projects. Any CM user can enqueue /
-- read a job; the worker uses the service_role key (bypasses RLS).
alter table public.generation_jobs enable row level security;
drop policy if exists "generation_jobs: authenticated full access" on public.generation_jobs;
create policy "generation_jobs: authenticated full access"
  on public.generation_jobs
  for all
  to authenticated
  using (true)
  with check (true);

-- Realtime so the client can watch job + project progress live (idempotent).
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='generation_jobs') then
    alter publication supabase_realtime add table public.generation_jobs;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='workshop_projects') then
    alter publication supabase_realtime add table public.workshop_projects;
  end if;
end $$;
