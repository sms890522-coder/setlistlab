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

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  church_name text not null,
  team_name text not null,
  description text,
  invite_code text unique not null,
  invite_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists teams_invite_code_unique_idx
on public.teams (upper(invite_code));

create index if not exists teams_owner_updated_idx
on public.teams (owner_id, updated_at desc);

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  position text,
  status text not null default 'pending',
  requested_message text,
  approved_at timestamptz,
  rejected_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, user_id),
  constraint team_memberships_role_check check (role in ('owner', 'admin', 'member')),
  constraint team_memberships_status_check check (status in ('pending', 'approved', 'rejected', 'removed'))
);

create index if not exists team_memberships_user_status_idx
on public.team_memberships (user_id, status, updated_at desc);

create index if not exists team_memberships_team_status_idx
on public.team_memberships (team_id, status, role);

drop trigger if exists team_memberships_set_updated_at on public.team_memberships;
create trigger team_memberships_set_updated_at
before update on public.team_memberships
for each row
execute function public.set_updated_at();

create table if not exists public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  read_by uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

alter table public.team_chat_messages
add column if not exists read_by uuid[] not null default '{}'::uuid[];

alter table public.team_chat_messages
alter column read_by set default '{}'::uuid[];

update public.team_chat_messages
set read_by = '{}'::uuid[]
where read_by is null;

alter table public.team_chat_messages
alter column read_by set not null;

create index if not exists team_chat_messages_team_created_idx
on public.team_chat_messages (team_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'team_chat_messages'
     ) then
    alter publication supabase_realtime add table public.team_chat_messages;
  end if;
end $$;

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

alter table public.saved_songs
add column if not exists team_id uuid references public.teams(id) on delete set null;

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

alter table public.setlists
add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists setlists_user_updated_idx
on public.setlists (user_id, updated_at desc);

create index if not exists setlists_team_updated_idx
on public.setlists (team_id, updated_at desc)
where team_id is not null;

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
  team_id uuid references public.teams(id) on delete cascade,
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

alter table public.practice_presence
add column if not exists team_id uuid references public.teams(id) on delete cascade;

create index if not exists practice_presence_setlist_seen_idx
on public.practice_presence (setlist_id, last_seen_at desc);

drop index if exists public.practice_presence_team_seen_idx;

create index if not exists practice_presence_team_id_seen_idx
on public.practice_presence (team_id, last_seen_at desc)
where team_id is not null;

drop trigger if exists practice_presence_set_updated_at on public.practice_presence;
create trigger practice_presence_set_updated_at
before update on public.practice_presence
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.team_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_chat_messages enable row level security;
alter table public.saved_songs enable row level security;
alter table public.setlists enable row level security;
alter table public.setlist_assignments enable row level security;
alter table public.shared_setlists enable row level security;
alter table public.practice_presence enable row level security;

create or replace function public.is_team_approved_member(p_team_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.team_memberships
    where team_id = p_team_id
      and user_id = p_user_id
      and status = 'approved'
      and removed_at is null
  );
$$;

create or replace function public.is_team_admin(p_team_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.team_memberships
    where team_id = p_team_id
      and user_id = p_user_id
      and status = 'approved'
      and role in ('owner', 'admin')
      and removed_at is null
  );
$$;

create or replace function public.mark_team_chat_messages_read(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not public.is_team_approved_member(p_team_id, auth.uid()) then
    raise exception '이 팀 채팅에 접근할 권한이 없습니다.';
  end if;

  update public.team_chat_messages
  set read_by = array_append(read_by, auth.uid())
  where team_id = p_team_id
    and not (auth.uid() = any(read_by));
end;
$$;

create or replace function public.find_team_by_invite_code(p_invite_code text)
returns table (
  id uuid,
  church_name text,
  team_name text,
  description text,
  invite_enabled boolean,
  my_status text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    teams.id,
    teams.church_name,
    teams.team_name,
    teams.description,
    teams.invite_enabled,
    memberships.status as my_status
  from public.teams
  left join public.team_memberships memberships
    on memberships.team_id = teams.id
    and memberships.user_id = auth.uid()
  where upper(teams.invite_code) = upper(trim(p_invite_code))
  limit 1;
$$;

create or replace function public.request_join_team(
  p_invite_code text,
  p_requested_message text default null,
  p_position text default null
)
returns public.team_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams;
  v_existing public.team_memberships;
  v_membership public.team_memberships;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into v_team
  from public.teams
  where upper(invite_code) = upper(trim(p_invite_code))
  limit 1;

  if v_team.id is null then
    raise exception '초대코드를 찾을 수 없습니다.';
  end if;

  if not v_team.invite_enabled then
    raise exception '현재 비활성화된 초대코드입니다.';
  end if;

  select *
  into v_existing
  from public.team_memberships
  where team_id = v_team.id
    and user_id = auth.uid()
  limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'approved' then
      raise exception '이미 팀원으로 승인된 팀입니다.';
    end if;

    if v_existing.status = 'pending' then
      raise exception '이미 이 팀에 참여 요청을 보냈습니다.';
    end if;

    update public.team_memberships
    set
      status = 'pending',
      role = 'member',
      position = nullif(trim(coalesce(p_position, '')), ''),
      requested_message = nullif(trim(coalesce(p_requested_message, '')), ''),
      approved_at = null,
      rejected_at = null,
      removed_at = null,
      updated_at = now()
    where id = v_existing.id
    returning * into v_membership;

    return v_membership;
  end if;

  insert into public.team_memberships (
    team_id,
    user_id,
    role,
    position,
    status,
    requested_message
  )
  values (
    v_team.id,
    auth.uid(),
    'member',
    nullif(trim(coalesce(p_position, '')), ''),
    'pending',
    nullif(trim(coalesce(p_requested_message, '')), '')
  )
  returning * into v_membership;

  return v_membership;
end;
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (
  auth.uid() = id
  or exists (
    select 1
    from public.team_memberships mine
    join public.team_memberships theirs
      on theirs.team_id = mine.team_id
    where mine.user_id = auth.uid()
      and mine.status = 'approved'
      and (
        mine.role in ('owner', 'admin')
        or theirs.status = 'approved'
      )
      and theirs.user_id = public.profiles.id
  )
);

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

drop policy if exists "teams_select_member_or_owner" on public.teams;
create policy "teams_select_member_or_owner"
on public.teams
for select
using (
  auth.uid() = owner_id
  or public.is_team_approved_member(id, auth.uid())
  or exists (
    select 1
    from public.team_memberships
    where public.team_memberships.team_id = public.teams.id
      and public.team_memberships.user_id = auth.uid()
      and public.team_memberships.status in ('pending', 'rejected', 'removed')
  )
);

drop policy if exists "teams_insert_own" on public.teams;
create policy "teams_insert_own"
on public.teams
for insert
with check (auth.uid() = owner_id);

drop policy if exists "teams_update_admin" on public.teams;
create policy "teams_update_admin"
on public.teams
for update
using (public.is_team_admin(id, auth.uid()))
with check (public.is_team_admin(id, auth.uid()));

drop policy if exists "teams_delete_owner" on public.teams;
create policy "teams_delete_owner"
on public.teams
for delete
using (auth.uid() = owner_id);

drop policy if exists "team_memberships_select_team" on public.team_memberships;
create policy "team_memberships_select_team"
on public.team_memberships
for select
using (
  auth.uid() = user_id
  or public.is_team_admin(team_id, auth.uid())
  or (
    status = 'approved'
    and public.is_team_approved_member(team_id, auth.uid())
  )
);

drop policy if exists "team_memberships_insert_self_or_owner" on public.team_memberships;
create policy "team_memberships_insert_self_or_owner"
on public.team_memberships
for insert
with check (
  auth.uid() = user_id
  and (
    status = 'pending'
    or (
      status = 'approved'
      and role = 'owner'
      and exists (
        select 1
        from public.teams
        where public.teams.id = team_id
          and public.teams.owner_id = auth.uid()
      )
    )
  )
);

drop policy if exists "team_memberships_update_admin_or_self_leave" on public.team_memberships;
create policy "team_memberships_update_admin_or_self_leave"
on public.team_memberships
for update
using (
  public.is_team_admin(team_id, auth.uid())
  or auth.uid() = user_id
)
with check (
  public.is_team_admin(team_id, auth.uid())
  or (
    auth.uid() = user_id
    and user_id = auth.uid()
    and role = 'member'
    and status in ('pending', 'removed')
  )
);

drop policy if exists "team_chat_messages_select_member" on public.team_chat_messages;
create policy "team_chat_messages_select_member"
on public.team_chat_messages
for select
using (public.is_team_approved_member(team_id, auth.uid()));

drop policy if exists "team_chat_messages_insert_member" on public.team_chat_messages;
create policy "team_chat_messages_insert_member"
on public.team_chat_messages
for insert
with check (
  auth.uid() = user_id
  and public.is_team_approved_member(team_id, auth.uid())
);

drop policy if exists "team_chat_messages_delete_author_or_admin" on public.team_chat_messages;
create policy "team_chat_messages_delete_author_or_admin"
on public.team_chat_messages
for delete
using (
  auth.uid() = user_id
  or public.is_team_admin(team_id, auth.uid())
);

drop policy if exists "saved_songs_select_own" on public.saved_songs;
create policy "saved_songs_select_own"
on public.saved_songs
for select
using (
  (team_id is null and auth.uid() = user_id)
  or (team_id is not null and public.is_team_approved_member(team_id, auth.uid()))
);

drop policy if exists "saved_songs_insert_own" on public.saved_songs;
create policy "saved_songs_insert_own"
on public.saved_songs
for insert
with check (
  auth.uid() = user_id
  and (
    team_id is null
    or public.is_team_approved_member(team_id, auth.uid())
  )
);

drop policy if exists "saved_songs_update_own" on public.saved_songs;
create policy "saved_songs_update_own"
on public.saved_songs
for update
using (
  auth.uid() = user_id
  or (team_id is not null and public.is_team_admin(team_id, auth.uid()))
)
with check (
  auth.uid() = user_id
  or (team_id is not null and public.is_team_admin(team_id, auth.uid()))
);

drop policy if exists "saved_songs_delete_own" on public.saved_songs;
create policy "saved_songs_delete_own"
on public.saved_songs
for delete
using (
  auth.uid() = user_id
  or (team_id is not null and public.is_team_admin(team_id, auth.uid()))
);

drop policy if exists "setlists_select_own_or_public" on public.setlists;
create policy "setlists_select_own_or_public"
on public.setlists
for select
using (
  is_public = true
  or (team_id is null and auth.uid() = user_id)
  or (team_id is not null and public.is_team_approved_member(team_id, auth.uid()))
);

drop policy if exists "setlists_insert_own" on public.setlists;
create policy "setlists_insert_own"
on public.setlists
for insert
with check (
  auth.uid() = user_id
  and (
    team_id is null
    or public.is_team_approved_member(team_id, auth.uid())
  )
);

drop policy if exists "setlists_update_own" on public.setlists;
create policy "setlists_update_own"
on public.setlists
for update
using (
  auth.uid() = user_id
  or (team_id is not null and public.is_team_admin(team_id, auth.uid()))
)
with check (
  auth.uid() = user_id
  or (team_id is not null and public.is_team_admin(team_id, auth.uid()))
);

drop policy if exists "setlists_delete_own" on public.setlists;
create policy "setlists_delete_own"
on public.setlists
for delete
using (
  auth.uid() = user_id
  or (team_id is not null and public.is_team_admin(team_id, auth.uid()))
);

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
      and (
        public.setlists.is_public = true
        or public.setlists.user_id = auth.uid()
        or (
          public.setlists.team_id is not null
          and public.is_team_approved_member(public.setlists.team_id, auth.uid())
        )
      )
  )
);

drop policy if exists "setlist_assignments_insert_own" on public.setlist_assignments;
create policy "setlist_assignments_insert_own"
on public.setlist_assignments
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.setlists
    where public.setlists.id = public.setlist_assignments.setlist_id
      and (
        public.setlists.user_id = auth.uid()
        or (
          public.setlists.team_id is not null
          and public.is_team_admin(public.setlists.team_id, auth.uid())
        )
      )
  )
);

drop policy if exists "setlist_assignments_update_own" on public.setlist_assignments;
create policy "setlist_assignments_update_own"
on public.setlist_assignments
for update
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.setlists
    where public.setlists.id = public.setlist_assignments.setlist_id
      and public.setlists.team_id is not null
      and public.is_team_admin(public.setlists.team_id, auth.uid())
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.setlists
    where public.setlists.id = public.setlist_assignments.setlist_id
      and public.setlists.team_id is not null
      and public.is_team_admin(public.setlists.team_id, auth.uid())
  )
);

drop policy if exists "setlist_assignments_delete_own" on public.setlist_assignments;
create policy "setlist_assignments_delete_own"
on public.setlist_assignments
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.setlists
    where public.setlists.id = public.setlist_assignments.setlist_id
      and public.setlists.team_id is not null
      and public.is_team_admin(public.setlists.team_id, auth.uid())
  )
);

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
drop policy if exists "practice_presence_select_team_id" on public.practice_presence;
create policy "practice_presence_select_team_id"
on public.practice_presence
for select
using (
  auth.uid() is not null
  and (
    auth.uid() = public.practice_presence.user_id
    or (
      public.practice_presence.team_id is not null
      and public.is_team_approved_member(public.practice_presence.team_id, auth.uid())
    )
    or exists (
      select 1
      from public.setlists
      where public.setlists.id::text = public.practice_presence.setlist_id
        and (
          public.setlists.user_id = auth.uid()
          or (
            public.setlists.team_id is not null
            and public.is_team_approved_member(public.setlists.team_id, auth.uid())
          )
        )
    )
  )
);

drop policy if exists "practice_presence_insert_own" on public.practice_presence;
create policy "practice_presence_insert_own"
on public.practice_presence
for insert
with check (
  auth.uid() = user_id
  and (
    team_id is null
    or public.is_team_approved_member(team_id, auth.uid())
  )
);

drop policy if exists "practice_presence_update_own" on public.practice_presence;
create policy "practice_presence_update_own"
on public.practice_presence
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    team_id is null
    or public.is_team_approved_member(team_id, auth.uid())
  )
);

drop policy if exists "practice_presence_delete_own" on public.practice_presence;
create policy "practice_presence_delete_own"
on public.practice_presence
for delete
using (auth.uid() = user_id);
