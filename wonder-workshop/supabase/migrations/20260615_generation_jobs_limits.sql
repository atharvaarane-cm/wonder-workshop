-- Cost/abuse guardrail for server-side generation.
--
-- The worker runs UNATTENDED and spends Gemini budget, so we cap two things at
-- the database level (can't be bypassed by a crafted client / raw insert):
--   1. max_slots — the number of images a single job may request.
--   2. max_active — how many jobs one user may have in flight at once.
--
-- Enforced by a BEFORE INSERT trigger (the service-role worker only UPDATEs
-- existing jobs, so it is unaffected). Tune the two limits in the function body.
--
-- Run this in the Supabase SQL editor on the same project as generation_jobs.

create or replace function public.generation_jobs_enforce_limits()
returns trigger
language plpgsql
as $$
declare
  max_slots    int := 250;   -- biggest single job we'll generate server-side
  max_active   int := 2;     -- concurrent in-flight jobs per user
  active_count int;
begin
  if new.total > max_slots then
    raise exception 'generation job too large: % slots (max %)', new.total, max_slots
      using errcode = 'check_violation';
  end if;

  -- Per-user cap only applies when we know the owner. Counts this user's jobs
  -- that aren't finished (pending = queued/between-batches, running = claimed).
  if new.owner is not null then
    select count(*) into active_count
      from public.generation_jobs
      where owner = new.owner
        and status in ('pending', 'running');
    if active_count >= max_active then
      raise exception 'too many active generation jobs for user (max %)', max_active
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists generation_jobs_limits on public.generation_jobs;
create trigger generation_jobs_limits
  before insert on public.generation_jobs
  for each row execute function public.generation_jobs_enforce_limits();

-- Speeds up the per-user active-job count above.
create index if not exists generation_jobs_owner_status_idx
  on public.generation_jobs (owner, status);
