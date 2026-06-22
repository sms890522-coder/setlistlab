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

update public.team_memberships
set role = 'member'
where role is null or role not in ('owner', 'admin', 'member');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_memberships_role_check'
      and conrelid = 'public.team_memberships'::regclass
  ) then
    alter table public.team_memberships
    add constraint team_memberships_role_check
    check (role in ('owner', 'admin', 'member'));
  end if;
end;
$$;

insert into public.team_memberships (
  team_id,
  user_id,
  role,
  position,
  status,
  approved_at
)
select
  teams.id,
  teams.owner_id,
  'owner',
  '찬양인도자',
  'approved',
  now()
from public.teams teams
where not exists (
  select 1
  from public.team_memberships memberships
  where memberships.team_id = teams.id
    and memberships.user_id = teams.owner_id
);

update public.team_memberships memberships
set
  role = 'member',
  updated_at = now()
from public.teams teams
where memberships.team_id = teams.id
  and memberships.role = 'owner'
  and memberships.user_id <> teams.owner_id;

update public.team_memberships memberships
set
  role = 'owner',
  status = 'approved',
  approved_at = coalesce(memberships.approved_at, now()),
  rejected_at = null,
  removed_at = null,
  updated_at = now()
from public.teams teams
where memberships.team_id = teams.id
  and memberships.user_id = teams.owner_id;

create unique index if not exists team_memberships_one_owner_per_team_idx
on public.team_memberships (team_id)
where role = 'owner' and status = 'approved' and removed_at is null;

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

create table if not exists public.team_direct_threads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_direct_threads_different_users_check check (user_a_id <> user_b_id)
);

create unique index if not exists team_direct_threads_team_pair_unique_idx
on public.team_direct_threads (
  team_id,
  least(user_a_id, user_b_id),
  greatest(user_a_id, user_b_id)
);

create index if not exists team_direct_threads_team_idx
on public.team_direct_threads (team_id);

create index if not exists team_direct_threads_user_a_idx
on public.team_direct_threads (user_a_id);

create index if not exists team_direct_threads_user_b_idx
on public.team_direct_threads (user_b_id);

create index if not exists team_direct_threads_last_message_idx
on public.team_direct_threads (last_message_at desc);

drop trigger if exists team_direct_threads_set_updated_at on public.team_direct_threads;
create trigger team_direct_threads_set_updated_at
before update on public.team_direct_threads
for each row
execute function public.set_updated_at();

create or replace function public.protect_team_direct_thread_update()
returns trigger
language plpgsql
as $$
begin
  if old.team_id <> new.team_id
     or old.user_a_id <> new.user_a_id
     or old.user_b_id <> new.user_b_id
     or old.created_by is distinct from new.created_by
     or old.created_at <> new.created_at then
    raise exception '1:1 대화방 참여자 정보는 변경할 수 없습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists team_direct_threads_protect_update on public.team_direct_threads;
create trigger team_direct_threads_protect_update
before update on public.team_direct_threads
for each row
execute function public.protect_team_direct_thread_update();

create table if not exists public.team_direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.team_direct_threads(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  read_by uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

alter table public.team_direct_messages
add column if not exists read_by uuid[] not null default '{}'::uuid[];

alter table public.team_direct_messages
alter column read_by set default '{}'::uuid[];

update public.team_direct_messages
set read_by = '{}'::uuid[]
where read_by is null;

alter table public.team_direct_messages
alter column read_by set not null;

create index if not exists team_direct_messages_thread_created_idx
on public.team_direct_messages (thread_id, created_at);

create index if not exists team_direct_messages_team_created_idx
on public.team_direct_messages (team_id, created_at);

create table if not exists public.team_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  type text not null default 'notice',
  title text not null,
  content text not null,
  is_pinned boolean not null default false,
  notify_members boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_posts_type_check check (type in ('notice', 'free', 'rehearsal', 'resource'))
);

create index if not exists team_posts_team_created_idx
on public.team_posts (team_id, created_at desc);

create index if not exists team_posts_team_pinned_created_idx
on public.team_posts (team_id, is_pinned desc, created_at desc);

drop trigger if exists team_posts_set_updated_at on public.team_posts;
create trigger team_posts_set_updated_at
before update on public.team_posts
for each row
execute function public.set_updated_at();

create table if not exists public.team_post_reads (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists team_post_reads_post_idx
on public.team_post_reads (post_id);

create index if not exists team_post_reads_user_idx
on public.team_post_reads (user_id);

create table if not exists public.team_calendar_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  setlist_id uuid references public.setlists(id) on delete set null,
  title text not null,
  event_type text not null default 'worship',
  event_date date not null,
  start_time time,
  gathering_time time,
  location text,
  memo text,
  recurring_group_id uuid,
  recurring_rule text,
  recurring_index integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_calendar_events_type_check check (event_type in ('worship', 'practice', 'event', 'etc'))
);

alter table public.team_calendar_events
add column if not exists recurring_group_id uuid;

alter table public.team_calendar_events
add column if not exists recurring_rule text;

alter table public.team_calendar_events
add column if not exists recurring_index integer;

create index if not exists team_calendar_events_team_date_idx
on public.team_calendar_events (team_id, event_date);

create index if not exists team_calendar_events_team_date_desc_idx
on public.team_calendar_events (team_id, event_date desc);

create index if not exists team_calendar_events_recurring_group_idx
on public.team_calendar_events (recurring_group_id);

create index if not exists team_calendar_events_team_recurring_group_idx
on public.team_calendar_events (team_id, recurring_group_id);

drop trigger if exists team_calendar_events_set_updated_at on public.team_calendar_events;
create trigger team_calendar_events_set_updated_at
before update on public.team_calendar_events
for each row
execute function public.set_updated_at();

create table if not exists public.team_event_availability (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.team_calendar_events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'unknown',
  memo text,
  available_roles text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id),
  constraint team_event_availability_status_check check (status in ('available', 'unavailable', 'maybe', 'unknown'))
);

create index if not exists team_event_availability_event_idx
on public.team_event_availability (event_id);

create index if not exists team_event_availability_team_user_idx
on public.team_event_availability (team_id, user_id);

create index if not exists team_event_availability_status_idx
on public.team_event_availability (status);

drop trigger if exists team_event_availability_set_updated_at on public.team_event_availability;
create trigger team_event_availability_set_updated_at
before update on public.team_event_availability
for each row
execute function public.set_updated_at();

create or replace function public.protect_team_direct_message_update()
returns trigger
language plpgsql
as $$
begin
  if old.thread_id <> new.thread_id
     or old.team_id <> new.team_id
     or old.sender_id <> new.sender_id
     or old.message <> new.message
     or old.created_at <> new.created_at then
    raise exception '1:1 메시지는 읽음 상태만 변경할 수 있습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists team_direct_messages_protect_update on public.team_direct_messages;
create trigger team_direct_messages_protect_update
before update on public.team_direct_messages
for each row
execute function public.protect_team_direct_message_update();

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

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'team_direct_threads'
     ) then
    alter publication supabase_realtime add table public.team_direct_threads;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'team_direct_messages'
     ) then
    alter publication supabase_realtime add table public.team_direct_messages;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'team_posts'
     ) then
    alter publication supabase_realtime add table public.team_posts;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'team_calendar_events'
     ) then
    alter publication supabase_realtime add table public.team_calendar_events;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'team_event_availability'
     ) then
    alter publication supabase_realtime add table public.team_event_availability;
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
  status text not null default 'draft',
  published_at timestamptz,
  notification_sent_at timestamptz,
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.setlists
add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.setlists
add column if not exists status text not null default 'draft';

alter table public.setlists
add column if not exists published_at timestamptz;

alter table public.setlists
add column if not exists notification_sent_at timestamptz;

alter table public.setlists
drop constraint if exists setlists_status_check;

alter table public.setlists
add constraint setlists_status_check check (status in ('draft', 'published'));

update public.setlists
set
  status = 'published',
  published_at = coalesce(published_at, created_at),
  notification_sent_at = coalesce(notification_sent_at, created_at)
where status = 'draft'
  and (
    is_public = true
    or team_id is not null
    or coalesce(jsonb_array_length(case when jsonb_typeof(songs) = 'array' then songs else '[]'::jsonb end), 0) > 0
  );

create index if not exists setlists_user_updated_idx
on public.setlists (user_id, updated_at desc);

create index if not exists setlists_team_updated_idx
on public.setlists (team_id, updated_at desc)
where team_id is not null;

create index if not exists setlists_team_status_updated_idx
on public.setlists (team_id, status, updated_at desc)
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

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (
    type in (
      'team_chat_message',
      'team_calendar_event_created',
      'team_calendar_event_updated',
      'team_calendar_availability_reminder',
      'team_calendar_recurring_events_created',
      'team_notice_created',
      'team_notice_updated',
      'team_setlist_created',
      'team_invite_requested',
      'team_invite_approved',
      'team_deputy_assigned',
      'team_deputy_removed',
      'team_leadership_transferred'
    )
  )
);

create index if not exists notifications_user_created_idx
on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
on public.notifications (user_id, created_at desc)
where read_at is null;

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check check (
  type in (
    'team_chat_message',
    'team_direct_message',
    'team_calendar_event_created',
    'team_calendar_event_updated',
    'team_calendar_availability_reminder',
    'team_calendar_recurring_events_created',
    'team_notice_created',
    'team_notice_updated',
    'team_setlist_created',
    'team_invite_requested',
    'team_invite_approved',
    'team_deputy_assigned',
    'team_deputy_removed',
    'team_leadership_transferred'
  )
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
on public.push_subscriptions (user_id, updated_at desc);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

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
alter table public.team_direct_threads enable row level security;
alter table public.team_direct_messages enable row level security;
alter table public.team_posts enable row level security;
alter table public.team_post_reads enable row level security;
alter table public.team_calendar_events enable row level security;
alter table public.team_event_availability enable row level security;
alter table public.saved_songs enable row level security;
alter table public.setlists enable row level security;
alter table public.setlist_assignments enable row level security;
alter table public.shared_setlists enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
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

create or replace function public.is_team_owner(p_team_id uuid, p_user_id uuid default auth.uid())
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
      and role = 'owner'
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

create or replace function public.create_team_chat_message_notifications(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.team_chat_messages;
  v_sender_name text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into v_message
  from public.team_chat_messages
  where id = p_message_id;

  if v_message.id is null then
    raise exception '채팅 메시지를 찾을 수 없습니다.';
  end if;

  if v_message.user_id <> auth.uid() then
    raise exception '본인이 보낸 채팅만 알림을 만들 수 있습니다.';
  end if;

  if not public.is_team_approved_member(v_message.team_id, auth.uid()) then
    raise exception '이 팀 채팅에 접근할 권한이 없습니다.';
  end if;

  select nullif(trim(display_name), '')
  into v_sender_name
  from public.profiles
  where id = auth.uid();

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  select
    memberships.user_id,
    v_message.team_id,
    'team_chat_message',
    '새 팀 채팅 메시지',
    left(coalesce(v_sender_name, '팀원') || ': ' || v_message.message, 180),
    '/teams/' || v_message.team_id::text || '/chat'
  from public.team_memberships memberships
  where memberships.team_id = v_message.team_id
    and memberships.status = 'approved'
    and memberships.removed_at is null
    and memberships.user_id <> auth.uid();
end;
$$;

drop function if exists public.create_team_post_notifications(uuid, text);

create function public.create_team_post_notifications(
  p_post_id uuid,
  p_event_type text default 'team_notice_created'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.team_posts;
  v_notification_title text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_event_type not in ('team_notice_created', 'team_notice_updated') then
    raise exception '지원하지 않는 공지 알림 타입입니다.';
  end if;

  select *
  into v_post
  from public.team_posts
  where id = p_post_id;

  if v_post.id is null then
    raise exception '공지사항을 찾을 수 없습니다.';
  end if;

  if not public.is_team_admin(v_post.team_id, auth.uid()) then
    raise exception '이 작업을 수행할 권한이 없습니다.';
  end if;

  if p_event_type = 'team_notice_created' and not v_post.notify_members then
    return false;
  end if;

  v_notification_title := case
    when p_event_type = 'team_notice_updated' then '팀 공지사항이 수정되었습니다'
    else '새 팀 공지사항이 등록되었습니다'
  end;

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  select
    memberships.user_id,
    v_post.team_id,
    p_event_type,
    v_notification_title,
    v_post.title,
    '/teams/' || v_post.team_id::text || '/posts/' || v_post.id::text
  from public.team_memberships memberships
  where memberships.team_id = v_post.team_id
    and memberships.status = 'approved'
    and memberships.removed_at is null
    and memberships.user_id <> auth.uid();

  return true;
end;
$$;

drop function if exists public.create_team_calendar_event_notifications(uuid, text);

create function public.create_team_calendar_event_notifications(
  p_event_id uuid,
  p_event_type text default 'team_calendar_event_created'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.team_calendar_events;
  v_notification_title text;
  v_body text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_event_type not in ('team_calendar_event_created', 'team_calendar_event_updated') then
    raise exception '지원하지 않는 일정 알림 타입입니다.';
  end if;

  select *
  into v_event
  from public.team_calendar_events
  where id = p_event_id;

  if v_event.id is null then
    raise exception '팀 일정을 찾을 수 없습니다.';
  end if;

  if not public.is_team_admin(v_event.team_id, auth.uid()) then
    raise exception '이 작업을 수행할 권한이 없습니다.';
  end if;

  v_notification_title := case
    when p_event_type = 'team_calendar_event_updated' then '팀 일정이 수정되었습니다'
    else '새 팀 일정이 등록되었습니다'
  end;
  v_body := v_event.title || ' · ' || v_event.event_date::text;

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  select
    memberships.user_id,
    v_event.team_id,
    p_event_type,
    v_notification_title,
    v_body,
    '/teams/' || v_event.team_id::text || '/calendar/' || v_event.id::text
  from public.team_memberships memberships
  where memberships.team_id = v_event.team_id
    and memberships.status = 'approved'
    and memberships.removed_at is null
    and memberships.user_id <> auth.uid();

  return true;
end;
$$;

drop function if exists public.create_team_calendar_recurring_events_notifications(uuid);

create function public.create_team_calendar_recurring_events_notifications(p_recurring_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_event public.team_calendar_events;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into v_first_event
  from public.team_calendar_events
  where recurring_group_id = p_recurring_group_id
  order by recurring_index nulls last, event_date asc
  limit 1;

  if v_first_event.id is null then
    raise exception '반복 일정을 찾을 수 없습니다.';
  end if;

  if not public.is_team_admin(v_first_event.team_id, auth.uid()) then
    raise exception '이 작업을 수행할 권한이 없습니다.';
  end if;

  select count(*)
  into v_count
  from public.team_calendar_events
  where recurring_group_id = p_recurring_group_id
    and team_id = v_first_event.team_id;

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  select
    memberships.user_id,
    v_first_event.team_id,
    'team_calendar_recurring_events_created',
    '팀 반복 일정이 등록되었습니다',
    v_first_event.title || ' 일정이 ' || v_count::text || '개 등록되었습니다.',
    '/teams/' || v_first_event.team_id::text || '/calendar'
  from public.team_memberships memberships
  where memberships.team_id = v_first_event.team_id
    and memberships.status = 'approved'
    and memberships.removed_at is null
    and memberships.user_id <> auth.uid();

  return true;
end;
$$;

drop function if exists public.create_team_calendar_availability_reminder_notifications(uuid);

create function public.create_team_calendar_availability_reminder_notifications(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.team_calendar_events;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into v_event
  from public.team_calendar_events
  where id = p_event_id;

  if v_event.id is null then
    raise exception '팀 일정을 찾을 수 없습니다.';
  end if;

  if not public.is_team_admin(v_event.team_id, auth.uid()) then
    raise exception '이 작업을 수행할 권한이 없습니다.';
  end if;

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  select
    memberships.user_id,
    v_event.team_id,
    'team_calendar_availability_reminder',
    '가능 여부를 확인해 주세요',
    v_event.title || ' 일정에 참여 가능 여부를 체크해 주세요.',
    '/teams/' || v_event.team_id::text || '/calendar/' || v_event.id::text
  from public.team_memberships memberships
  where memberships.team_id = v_event.team_id
    and memberships.status = 'approved'
    and memberships.removed_at is null
    and memberships.user_id <> auth.uid()
    and not exists (
      select 1
      from public.team_event_availability availability
      where availability.event_id = v_event.id
        and availability.user_id = memberships.user_id
        and availability.status <> 'unknown'
    );

  return true;
end;
$$;

create or replace function public.get_or_create_team_direct_thread(
  p_team_id uuid,
  p_other_user_id uuid
)
returns public.team_direct_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_user_a_id uuid;
  v_user_b_id uuid;
  v_thread public.team_direct_threads;
begin
  if v_current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_other_user_id is null then
    raise exception '대화할 팀원이 필요합니다.';
  end if;

  if v_current_user_id = p_other_user_id then
    raise exception '자기 자신과는 1:1 대화를 만들 수 없습니다.';
  end if;

  if not public.is_team_approved_member(p_team_id, v_current_user_id) then
    raise exception '이 팀에 접근할 권한이 없습니다.';
  end if;

  if not public.is_team_approved_member(p_team_id, p_other_user_id) then
    raise exception '승인된 팀원과만 1:1 대화를 시작할 수 있습니다.';
  end if;

  if v_current_user_id < p_other_user_id then
    v_user_a_id := v_current_user_id;
    v_user_b_id := p_other_user_id;
  else
    v_user_a_id := p_other_user_id;
    v_user_b_id := v_current_user_id;
  end if;

  select *
  into v_thread
  from public.team_direct_threads
  where team_id = p_team_id
    and user_a_id = v_user_a_id
    and user_b_id = v_user_b_id
  limit 1;

  if v_thread.id is not null then
    return v_thread;
  end if;

  begin
    insert into public.team_direct_threads (
      team_id,
      user_a_id,
      user_b_id,
      created_by
    )
    values (
      p_team_id,
      v_user_a_id,
      v_user_b_id,
      v_current_user_id
    )
    returning * into v_thread;
  exception
    when unique_violation then
      select *
      into v_thread
      from public.team_direct_threads
      where team_id = p_team_id
        and user_a_id = v_user_a_id
        and user_b_id = v_user_b_id
      limit 1;
  end;

  return v_thread;
end;
$$;

create or replace function public.mark_team_direct_messages_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.team_direct_threads;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into v_thread
  from public.team_direct_threads
  where id = p_thread_id;

  if v_thread.id is null then
    raise exception '1:1 대화방을 찾을 수 없습니다.';
  end if;

  if auth.uid() not in (v_thread.user_a_id, v_thread.user_b_id) then
    raise exception '이 1:1 대화에 접근할 권한이 없습니다.';
  end if;

  if not public.is_team_approved_member(v_thread.team_id, auth.uid()) then
    raise exception '이 팀에 접근할 권한이 없습니다.';
  end if;

  update public.team_direct_messages
  set read_by = array_append(read_by, auth.uid())
  where thread_id = p_thread_id
    and not (auth.uid() = any(read_by));
end;
$$;

drop function if exists public.create_team_setlist_created_notifications(uuid);

create function public.create_team_setlist_created_notifications(p_setlist_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setlist public.setlists;
  v_body text;
  v_sent_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into v_setlist
  from public.setlists
  where id = p_setlist_id
  for update;

  if v_setlist.id is null then
    raise exception '콘티를 찾을 수 없습니다.';
  end if;

  if v_setlist.team_id is null then
    return false;
  end if;

  if v_setlist.user_id <> auth.uid() and not public.is_team_admin(v_setlist.team_id, auth.uid()) then
    raise exception '이 작업을 수행할 권한이 없습니다.';
  end if;

  if v_setlist.status <> 'published' or v_setlist.notification_sent_at is not null then
    return false;
  end if;

  if nullif(trim(v_setlist.title), '') is null
     and v_setlist.worship_date is null
     and coalesce(jsonb_array_length(case when jsonb_typeof(v_setlist.songs) = 'array' then v_setlist.songs else '[]'::jsonb end), 0) = 0 then
    return false;
  end if;

  v_body := coalesce(nullif(trim(v_setlist.title), ''), '제목 없는 콘티');
  if v_setlist.worship_date is not null then
    v_body := v_body || ' · ' || v_setlist.worship_date::text;
  end if;
  v_body := v_body || ' 콘티가 공유되었습니다.';

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  select
    memberships.user_id,
    v_setlist.team_id,
    'team_setlist_created',
    '새 팀 콘티가 공유되었습니다',
    v_body,
    '/setlists/' || v_setlist.id::text
  from public.team_memberships memberships
  where memberships.team_id = v_setlist.team_id
    and memberships.status = 'approved'
    and memberships.removed_at is null
    and memberships.user_id <> auth.uid();

  update public.setlists
  set
    published_at = coalesce(published_at, v_sent_at),
    notification_sent_at = v_sent_at,
    updated_at = v_sent_at
  where id = v_setlist.id;

  return true;
end;
$$;

create or replace function public.create_team_invite_approved_notification(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.team_memberships;
  v_team public.teams;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into v_membership
  from public.team_memberships
  where id = p_membership_id;

  if v_membership.id is null then
    raise exception '팀 참여 정보를 찾을 수 없습니다.';
  end if;

  if not public.is_team_owner(v_membership.team_id, auth.uid()) then
    raise exception '이 작업을 수행할 권한이 없습니다.';
  end if;

  if v_membership.status <> 'approved' then
    return;
  end if;

  select *
  into v_team
  from public.teams
  where id = v_membership.team_id;

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  values (
    v_membership.user_id,
    v_membership.team_id,
    'team_invite_approved',
    '팀 참여가 승인되었습니다',
    coalesce(v_team.church_name, '') || case when v_team.team_name is not null then ' · ' || v_team.team_name else '' end,
    '/teams/' || v_membership.team_id::text
  );
end;
$$;

create or replace function public.set_team_member_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role text
)
returns public.team_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.team_memberships;
  v_team public.teams;
  v_previous_role text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception '부리더 또는 팀원 권한만 지정할 수 있습니다.';
  end if;

  if not public.is_team_owner(p_team_id, auth.uid()) then
    raise exception '리더만 팀원 권한을 변경할 수 있습니다.';
  end if;

  select *
  into v_membership
  from public.team_memberships
  where team_id = p_team_id
    and user_id = p_user_id
    and status = 'approved'
    and removed_at is null
  for update;

  if v_membership.id is null then
    raise exception '승인된 팀원을 찾을 수 없습니다.';
  end if;

  if v_membership.role = 'owner' then
    raise exception '리더 권한은 리더 양도 기능으로만 변경할 수 있습니다.';
  end if;

  v_previous_role := v_membership.role;

  update public.team_memberships
  set
    role = p_role,
    updated_at = now()
  where id = v_membership.id
  returning * into v_membership;

  if v_previous_role is distinct from p_role then
    select *
    into v_team
    from public.teams
    where id = p_team_id;

    insert into public.notifications (
      user_id,
      team_id,
      type,
      title,
      body,
      link_url
    )
    values (
      p_user_id,
      p_team_id,
      case when p_role = 'admin' then 'team_deputy_assigned' else 'team_deputy_removed' end,
      case when p_role = 'admin' then '부리더로 지정되었습니다' else '부리더 권한이 해제되었습니다' end,
      coalesce(v_team.church_name, '') || case when v_team.team_name is not null then ' · ' || v_team.team_name else '' end,
      '/teams/' || p_team_id::text
    );
  end if;

  return v_membership;
end;
$$;

create or replace function public.transfer_team_ownership(
  p_team_id uuid,
  p_new_owner_id uuid
)
returns public.team_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_owner_id uuid := auth.uid();
  v_new_owner public.team_memberships;
  v_team public.teams;
  v_new_owner_name text;
begin
  if v_old_owner_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if v_old_owner_id = p_new_owner_id then
    raise exception '자기 자신에게 리더 권한을 양도할 수 없습니다.';
  end if;

  if not public.is_team_owner(p_team_id, v_old_owner_id) then
    raise exception '리더만 리더 권한을 양도할 수 있습니다.';
  end if;

  select *
  into v_new_owner
  from public.team_memberships
  where team_id = p_team_id
    and user_id = p_new_owner_id
    and status = 'approved'
    and removed_at is null
  for update;

  if v_new_owner.id is null then
    raise exception '승인된 팀원에게만 리더 권한을 양도할 수 있습니다.';
  end if;

  select *
  into v_team
  from public.teams
  where id = p_team_id
  for update;

  update public.team_memberships
  set
    role = 'member',
    updated_at = now()
  where team_id = p_team_id
    and role = 'owner'
    and removed_at is null;

  update public.team_memberships
  set
    role = 'owner',
    status = 'approved',
    approved_at = coalesce(approved_at, now()),
    rejected_at = null,
    removed_at = null,
    updated_at = now()
  where id = v_new_owner.id
  returning * into v_new_owner;

  update public.teams
  set
    owner_id = p_new_owner_id,
    updated_at = now()
  where id = p_team_id;

  select nullif(trim(display_name), '')
  into v_new_owner_name
  from public.profiles
  where id = p_new_owner_id;

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  values (
    p_new_owner_id,
    p_team_id,
    'team_leadership_transferred',
    '팀 리더 권한을 받았습니다',
    coalesce(v_team.church_name, '') || case when v_team.team_name is not null then ' · ' || v_team.team_name else '' end,
    '/teams/' || p_team_id::text
  );

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  select
    memberships.user_id,
    p_team_id,
    'team_leadership_transferred',
    '팀 리더가 변경되었습니다',
    coalesce(v_new_owner_name, '새 리더') || '님이 ' || coalesce(v_team.team_name, '팀') || '의 새 리더가 되었습니다.',
    '/teams/' || p_team_id::text
  from public.team_memberships memberships
  where memberships.team_id = p_team_id
    and memberships.status = 'approved'
    and memberships.removed_at is null
    and memberships.user_id not in (v_old_owner_id, p_new_owner_id);

  return v_new_owner;
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

    insert into public.notifications (
      user_id,
      team_id,
      type,
      title,
      body,
      link_url
    )
    select
      memberships.user_id,
      v_team.id,
      'team_invite_requested',
      '새로운 팀 참여 요청이 있습니다',
      coalesce(nullif(trim(p_position), ''), '팀원') || ' 참여 요청',
      '/teams/' || v_team.id::text
    from public.team_memberships memberships
    where memberships.team_id = v_team.id
      and memberships.status = 'approved'
      and memberships.role = 'owner'
      and memberships.removed_at is null
      and memberships.user_id <> auth.uid();

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

  insert into public.notifications (
    user_id,
    team_id,
    type,
    title,
    body,
    link_url
  )
  select
    memberships.user_id,
    v_team.id,
    'team_invite_requested',
    '새로운 팀 참여 요청이 있습니다',
    coalesce(nullif(trim(p_position), ''), '팀원') || ' 참여 요청',
    '/teams/' || v_team.id::text
  from public.team_memberships memberships
  where memberships.team_id = v_team.id
    and memberships.status = 'approved'
    and memberships.role = 'owner'
    and memberships.removed_at is null
    and memberships.user_id <> auth.uid();

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
using (public.is_team_owner(id, auth.uid()))
with check (public.is_team_owner(id, auth.uid()));

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
  or public.is_team_owner(team_id, auth.uid())
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
  public.is_team_owner(team_id, auth.uid())
  or auth.uid() = user_id
)
with check (
  public.is_team_owner(team_id, auth.uid())
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

drop policy if exists "team_direct_threads_select_participant" on public.team_direct_threads;
create policy "team_direct_threads_select_participant"
on public.team_direct_threads
for select
using (
  auth.uid() in (user_a_id, user_b_id)
  and public.is_team_approved_member(team_id, auth.uid())
);

drop policy if exists "team_direct_threads_insert_participant" on public.team_direct_threads;
create policy "team_direct_threads_insert_participant"
on public.team_direct_threads
for insert
with check (
  auth.uid() = created_by
  and auth.uid() in (user_a_id, user_b_id)
  and user_a_id <> user_b_id
  and public.is_team_approved_member(team_id, user_a_id)
  and public.is_team_approved_member(team_id, user_b_id)
);

drop policy if exists "team_direct_threads_update_participant" on public.team_direct_threads;
create policy "team_direct_threads_update_participant"
on public.team_direct_threads
for update
using (
  auth.uid() in (user_a_id, user_b_id)
  and public.is_team_approved_member(team_id, auth.uid())
)
with check (
  auth.uid() in (user_a_id, user_b_id)
  and public.is_team_approved_member(team_id, auth.uid())
);

drop policy if exists "team_direct_threads_delete_admin" on public.team_direct_threads;
create policy "team_direct_threads_delete_admin"
on public.team_direct_threads
for delete
using (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_direct_messages_select_participant" on public.team_direct_messages;
create policy "team_direct_messages_select_participant"
on public.team_direct_messages
for select
using (
  public.is_team_approved_member(team_id, auth.uid())
  and exists (
    select 1
    from public.team_direct_threads threads
    where threads.id = public.team_direct_messages.thread_id
      and threads.team_id = public.team_direct_messages.team_id
      and auth.uid() in (threads.user_a_id, threads.user_b_id)
  )
);

drop policy if exists "team_direct_messages_insert_participant" on public.team_direct_messages;
create policy "team_direct_messages_insert_participant"
on public.team_direct_messages
for insert
with check (
  auth.uid() = sender_id
  and public.is_team_approved_member(team_id, auth.uid())
  and exists (
    select 1
    from public.team_direct_threads threads
    where threads.id = thread_id
      and threads.team_id = team_id
      and auth.uid() in (threads.user_a_id, threads.user_b_id)
  )
);

drop policy if exists "team_direct_messages_update_read_participant" on public.team_direct_messages;
create policy "team_direct_messages_update_read_participant"
on public.team_direct_messages
for update
using (
  public.is_team_approved_member(team_id, auth.uid())
  and exists (
    select 1
    from public.team_direct_threads threads
    where threads.id = public.team_direct_messages.thread_id
      and threads.team_id = public.team_direct_messages.team_id
      and auth.uid() in (threads.user_a_id, threads.user_b_id)
  )
)
with check (
  public.is_team_approved_member(team_id, auth.uid())
  and exists (
    select 1
    from public.team_direct_threads threads
    where threads.id = public.team_direct_messages.thread_id
      and threads.team_id = public.team_direct_messages.team_id
      and auth.uid() in (threads.user_a_id, threads.user_b_id)
  )
);

drop policy if exists "team_direct_messages_delete_admin" on public.team_direct_messages;
create policy "team_direct_messages_delete_admin"
on public.team_direct_messages
for delete
using (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_posts_select_member" on public.team_posts;
create policy "team_posts_select_member"
on public.team_posts
for select
using (public.is_team_approved_member(team_id, auth.uid()));

drop policy if exists "team_posts_insert_admin" on public.team_posts;
create policy "team_posts_insert_admin"
on public.team_posts
for insert
with check (
  auth.uid() = author_id
  and public.is_team_admin(team_id, auth.uid())
);

drop policy if exists "team_posts_update_admin" on public.team_posts;
create policy "team_posts_update_admin"
on public.team_posts
for update
using (public.is_team_admin(team_id, auth.uid()))
with check (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_posts_delete_admin" on public.team_posts;
create policy "team_posts_delete_admin"
on public.team_posts
for delete
using (public.is_team_owner(team_id, auth.uid()));

drop policy if exists "team_post_reads_select_self_or_admin" on public.team_post_reads;
create policy "team_post_reads_select_self_or_admin"
on public.team_post_reads
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.team_posts posts
    where posts.id = public.team_post_reads.post_id
      and public.is_team_admin(posts.team_id, auth.uid())
  )
);

drop policy if exists "team_post_reads_insert_self_member" on public.team_post_reads;
create policy "team_post_reads_insert_self_member"
on public.team_post_reads
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.team_posts posts
    where posts.id = public.team_post_reads.post_id
      and public.is_team_approved_member(posts.team_id, auth.uid())
  )
);

drop policy if exists "team_post_reads_update_self" on public.team_post_reads;
create policy "team_post_reads_update_self"
on public.team_post_reads
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "team_post_reads_delete_admin" on public.team_post_reads;
create policy "team_post_reads_delete_admin"
on public.team_post_reads
for delete
using (
  exists (
    select 1
    from public.team_posts posts
    where posts.id = public.team_post_reads.post_id
      and public.is_team_admin(posts.team_id, auth.uid())
  )
);

drop policy if exists "team_calendar_events_select_member" on public.team_calendar_events;
create policy "team_calendar_events_select_member"
on public.team_calendar_events
for select
using (public.is_team_approved_member(team_id, auth.uid()));

drop policy if exists "team_calendar_events_insert_admin" on public.team_calendar_events;
create policy "team_calendar_events_insert_admin"
on public.team_calendar_events
for insert
with check (
  auth.uid() = created_by
  and public.is_team_admin(team_id, auth.uid())
);

drop policy if exists "team_calendar_events_update_admin" on public.team_calendar_events;
create policy "team_calendar_events_update_admin"
on public.team_calendar_events
for update
using (public.is_team_admin(team_id, auth.uid()))
with check (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_calendar_events_delete_admin" on public.team_calendar_events;
create policy "team_calendar_events_delete_admin"
on public.team_calendar_events
for delete
using (public.is_team_owner(team_id, auth.uid()));

drop policy if exists "team_event_availability_select_member" on public.team_event_availability;
create policy "team_event_availability_select_member"
on public.team_event_availability
for select
using (public.is_team_approved_member(team_id, auth.uid()));

drop policy if exists "team_event_availability_insert_self" on public.team_event_availability;
create policy "team_event_availability_insert_self"
on public.team_event_availability
for insert
with check (
  auth.uid() = user_id
  and public.is_team_approved_member(team_id, auth.uid())
  and exists (
    select 1
    from public.team_calendar_events events
    where events.id = public.team_event_availability.event_id
      and events.team_id = public.team_event_availability.team_id
  )
);

drop policy if exists "team_event_availability_update_self" on public.team_event_availability;
create policy "team_event_availability_update_self"
on public.team_event_availability
for update
using (
  auth.uid() = user_id
  and public.is_team_approved_member(team_id, auth.uid())
)
with check (
  auth.uid() = user_id
  and public.is_team_approved_member(team_id, auth.uid())
);

drop policy if exists "team_event_availability_delete_self" on public.team_event_availability;
create policy "team_event_availability_delete_self"
on public.team_event_availability
for delete
using (
  auth.uid() = user_id
  and public.is_team_approved_member(team_id, auth.uid())
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
  or (
    team_id is not null
    and public.is_team_approved_member(team_id, auth.uid())
    and (
      status = 'published'
      or auth.uid() = user_id
      or public.is_team_admin(team_id, auth.uid())
    )
  )
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
          and (
            public.setlists.status = 'published'
            or public.setlists.user_id = auth.uid()
            or public.is_team_admin(public.setlists.team_id, auth.uid())
          )
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

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
using (auth.uid() = user_id);

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
on public.notifications
for insert
with check (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
on public.push_subscriptions
for insert
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
on public.push_subscriptions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
on public.push_subscriptions
for delete
using (auth.uid() = user_id);

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
