create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default '기타',
  custom_role text,
  church_name text,
  praise_team_name text,
  service_name text,
  share_practice_presence boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists praise_team_name text;

alter table public.profiles
add column if not exists share_practice_presence boolean not null default true;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null,
  memo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_user_role_idx
on public.team_members (user_id, role, name);

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
before update on public.team_members
for each row
execute function public.set_updated_at();

create table if not exists public.saved_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  youtube_url text,
  youtube_video_id text,
  original_key text,
  practice_key text,
  bpm integer,
  song_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saved_songs_user_title_unique_idx
on public.saved_songs (user_id, lower(title));

create index if not exists saved_songs_user_updated_idx
on public.saved_songs (user_id, updated_at desc);

drop trigger if exists saved_songs_set_updated_at on public.saved_songs;
create trigger saved_songs_set_updated_at
before update on public.saved_songs
for each row
execute function public.set_updated_at();

create table if not exists public.setlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  worship_date date,
  service_name text,
  description text,
  global_notes text,
  songs jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists setlists_user_updated_idx
on public.setlists (user_id, updated_at desc);

create index if not exists setlists_share_slug_idx
on public.setlists (share_slug)
where share_slug is not null;

drop trigger if exists setlists_set_updated_at on public.setlists;
create trigger setlists_set_updated_at
before update on public.setlists
for each row
execute function public.set_updated_at();

create table if not exists public.setlist_assignments (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_member_id uuid references public.team_members(id) on delete set null,
  member_name text not null,
  role text not null,
  memo text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists setlist_assignments_setlist_idx
on public.setlist_assignments (setlist_id, sort_order);

drop trigger if exists setlist_assignments_set_updated_at on public.setlist_assignments;
create trigger setlist_assignments_set_updated_at
before update on public.setlist_assignments
for each row
execute function public.set_updated_at();

create table if not exists public.shared_setlists (
  id uuid primary key default gen_random_uuid(),
  share_slug text not null unique,
  title text not null,
  setlist jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.practice_presence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  setlist_id text not null,
  song_id text not null,
  song_title text not null,
  display_name text not null,
  role text not null,
  church_name text not null,
  praise_team_name text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, setlist_id, song_id)
);

create index if not exists practice_presence_setlist_seen_idx
on public.practice_presence (setlist_id, last_seen_at desc);

create index if not exists practice_presence_team_seen_idx
on public.practice_presence (lower(church_name), lower(praise_team_name), last_seen_at desc);

drop trigger if exists practice_presence_set_updated_at on public.practice_presence;
create trigger practice_presence_set_updated_at
before update on public.practice_presence
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.team_members enable row level security;
alter table public.saved_songs enable row level security;
alter table public.setlists enable row level security;
alter table public.setlist_assignments enable row level security;
alter table public.shared_setlists enable row level security;
alter table public.practice_presence enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "team_members_select_own" on public.team_members;
create policy "team_members_select_own"
on public.team_members
for select
using (auth.uid() = user_id);

drop policy if exists "team_members_insert_own" on public.team_members;
create policy "team_members_insert_own"
on public.team_members
for insert
with check (auth.uid() = user_id);

drop policy if exists "team_members_update_own" on public.team_members;
create policy "team_members_update_own"
on public.team_members
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "team_members_delete_own" on public.team_members;
create policy "team_members_delete_own"
on public.team_members
for delete
using (auth.uid() = user_id);

drop policy if exists "saved_songs_select_own" on public.saved_songs;
create policy "saved_songs_select_own"
on public.saved_songs
for select
using (auth.uid() = user_id);

drop policy if exists "saved_songs_insert_own" on public.saved_songs;
create policy "saved_songs_insert_own"
on public.saved_songs
for insert
with check (auth.uid() = user_id);

drop policy if exists "saved_songs_update_own" on public.saved_songs;
create policy "saved_songs_update_own"
on public.saved_songs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "saved_songs_delete_own" on public.saved_songs;
create policy "saved_songs_delete_own"
on public.saved_songs
for delete
using (auth.uid() = user_id);

drop policy if exists "setlists_select_own_or_public" on public.setlists;
create policy "setlists_select_own_or_public"
on public.setlists
for select
using (auth.uid() = user_id or is_public = true);

drop policy if exists "setlists_insert_own" on public.setlists;
create policy "setlists_insert_own"
on public.setlists
for insert
with check (auth.uid() = user_id);

drop policy if exists "setlists_update_own" on public.setlists;
create policy "setlists_update_own"
on public.setlists
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "setlists_delete_own" on public.setlists;
create policy "setlists_delete_own"
on public.setlists
for delete
using (auth.uid() = user_id);

drop policy if exists "setlist_assignments_select_own_or_public_setlist" on public.setlist_assignments;
create policy "setlist_assignments_select_own_or_public_setlist"
on public.setlist_assignments
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.setlists
    where public.setlists.id = public.setlist_assignments.setlist_id
      and public.setlists.is_public = true
  )
);

drop policy if exists "setlist_assignments_insert_own" on public.setlist_assignments;
create policy "setlist_assignments_insert_own"
on public.setlist_assignments
for insert
with check (auth.uid() = user_id);

drop policy if exists "setlist_assignments_update_own" on public.setlist_assignments;
create policy "setlist_assignments_update_own"
on public.setlist_assignments
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "setlist_assignments_delete_own" on public.setlist_assignments;
create policy "setlist_assignments_delete_own"
on public.setlist_assignments
for delete
using (auth.uid() = user_id);

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

drop policy if exists "practice_presence_select_same_team" on public.practice_presence;
create policy "practice_presence_select_same_team"
on public.practice_presence
for select
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.profiles
    where public.profiles.id = auth.uid()
      and public.profiles.church_name is not null
      and public.profiles.praise_team_name is not null
      and lower(public.profiles.church_name) = lower(public.practice_presence.church_name)
      and lower(public.profiles.praise_team_name) = lower(public.practice_presence.praise_team_name)
  )
);

drop policy if exists "practice_presence_insert_own" on public.practice_presence;
create policy "practice_presence_insert_own"
on public.practice_presence
for insert
with check (auth.uid() = user_id);

drop policy if exists "practice_presence_update_own" on public.practice_presence;
create policy "practice_presence_update_own"
on public.practice_presence
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "practice_presence_delete_own" on public.practice_presence;
create policy "practice_presence_delete_own"
on public.practice_presence
for delete
using (auth.uid() = user_id);
