create table if not exists public.shared_setlists (
  id uuid primary key default gen_random_uuid(),
  share_slug text not null unique,
  title text not null,
  setlist jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.shared_setlists enable row level security;

drop policy if exists "shared_setlists_select_public" on public.shared_setlists;
create policy "shared_setlists_select_public"
on public.shared_setlists
for select
using (true);

drop policy if exists "shared_setlists_insert_public" on public.shared_setlists;
create policy "shared_setlists_insert_public"
on public.shared_setlists
for insert
with check (true);
