-- SUWAED / SAWAED: schema for Supabase (run in SQL Editor)
-- IMPORTANT: run this on a fresh Supabase project and review before production use.
create extension if not exists pgcrypto;

create table if not exists public.approved_seat_numbers (
  seat_number text primary key check (seat_number ~ '^[0-9]{6}$'),
  claimed_by uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  seat_number text not null unique check (seat_number ~ '^[0-9]{6}$'),
  role text not null default 'student' check (role in ('student','admin','team_leader')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id text primary key,
  name text not null check (char_length(name) between 2 and 80),
  sport text not null,
  format text not null check (format in ('groups','league','knockout')),
  status text not null default 'registration' check (status in ('registration','active','completed','cancelled')),
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (tournament_id, name),
  unique (tournament_id, id)
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null default 'player' check (membership_role in ('captain','player')),
  created_at timestamptz not null default now(),
  unique (team_id, student_id)
);

create table if not exists public.matches (
  id text primary key,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  round_name text not null,
  group_name text,
  team_a_id text references public.teams(id) on delete set null,
  team_b_id text references public.teams(id) on delete set null,
  score_a integer check (score_a is null or score_a >= 0),
  score_b integer check (score_b is null or score_b >= 0),
  winner_team_id text references public.teams(id) on delete set null,
  scheduled_at timestamptz,
  updated_at timestamptz not null default now(),
  check (team_a_id is null or team_b_id is null or team_a_id <> team_b_id)
);

create or replace function public.is_sawaed_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.approved = true); $$;

-- Signup eligibility check. This reveals only whether a seat number can be claimed.
create or replace function public.check_seat_available(p_seat_number text)
returns boolean language sql stable security definer set search_path = public
as $$
  select p_seat_number ~ '^[0-9]{6}$' and exists (
    select 1 from public.approved_seat_numbers s
    where s.seat_number = p_seat_number and s.claimed_by is null
  );
$$;
revoke all on function public.check_seat_available(text) from public;
grant execute on function public.check_seat_available(text) to anon, authenticated;

-- Claim an approved seat atomically while creating a profile. A seat can't be claimed twice.
create or replace function public.handle_new_sawaed_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_seat text; v_name text;
begin
  v_seat := coalesce(new.raw_user_meta_data->>'seat_number','');
  v_name := trim(coalesce(new.raw_user_meta_data->>'full_name',''));
  if v_seat !~ '^[0-9]{6}$' or v_name = '' then
    raise exception 'يرجى إدخال الاسم ورقم جلوس صحيح من 6 أرقام';
  end if;
  update public.approved_seat_numbers set claimed_by = new.id
    where seat_number = v_seat and claimed_by is null;
  if not found then raise exception 'رقم الجلوس غير معتمد أو مستخدم'; end if;
  insert into public.profiles(id, full_name, seat_number, role, approved)
    values(new.id, v_name, v_seat, 'student', false);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_sawaed on auth.users;
create trigger on_auth_user_created_sawaed after insert on auth.users
for each row execute procedure public.handle_new_sawaed_user();

create or replace function public.admin_import_seat_numbers(p_numbers text[])
returns integer language plpgsql security definer set search_path = public
as $$
declare v text; n integer := 0;
begin
  if not public.is_sawaed_admin() then raise exception 'غير مصرح'; end if;
  foreach v in array p_numbers loop
    v := trim(v);
    if v !~ '^[0-9]{6}$' then raise exception 'كل رقم جلوس يجب أن يتكون من 6 أرقام'; end if;
    insert into public.approved_seat_numbers(seat_number) values(v) on conflict(seat_number) do nothing;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.admin_import_seat_numbers(text[]) from public;
grant execute on function public.admin_import_seat_numbers(text[]) to authenticated;

alter table public.approved_seat_numbers enable row level security;
alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.matches enable row level security;

drop policy if exists "admins manage approved seats" on public.approved_seat_numbers;
create policy "admins manage approved seats" on public.approved_seat_numbers for all to authenticated
using (public.is_sawaed_admin()) with check (public.is_sawaed_admin());

drop policy if exists "read own profile or admin" on public.profiles;
create policy "read own profile or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_sawaed_admin());
drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles for update to authenticated
using (public.is_sawaed_admin()) with check (public.is_sawaed_admin());

-- Only approved users can see tournament data. Only admins can create/change it.
drop policy if exists "approved students read tournaments" on public.tournaments;
create policy "approved students read tournaments" on public.tournaments for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.approved=true) or public.is_sawaed_admin());
drop policy if exists "admins manage tournaments" on public.tournaments;
create policy "admins manage tournaments" on public.tournaments for all to authenticated
using (public.is_sawaed_admin()) with check (public.is_sawaed_admin());

drop policy if exists "approved users read teams" on public.teams;
create policy "approved users read teams" on public.teams for select to authenticated
using (public.is_sawaed_admin() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.approved=true));
drop policy if exists "admins manage teams" on public.teams;
create policy "admins manage teams" on public.teams for all to authenticated
using (public.is_sawaed_admin()) with check (public.is_sawaed_admin());

drop policy if exists "approved users read matches" on public.matches;
create policy "approved users read matches" on public.matches for select to authenticated
using (public.is_sawaed_admin() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.approved=true));
drop policy if exists "admins manage matches" on public.matches;
create policy "admins manage matches" on public.matches for all to authenticated
using (public.is_sawaed_admin()) with check (public.is_sawaed_admin());

drop policy if exists "members read team memberships" on public.team_members;
create policy "members read team memberships" on public.team_members for select to authenticated
using (student_id = auth.uid() or public.is_sawaed_admin() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.approved=true));
drop policy if exists "admins manage team memberships" on public.team_members;
create policy "admins manage team memberships" on public.team_members for all to authenticated
using (public.is_sawaed_admin()) with check (public.is_sawaed_admin());

-- NOTE: After creating your own account, promote its profile to admin using its UUID:
-- update public.profiles set role='admin', approved=true where id='AUTH_USER_UUID';

-- === صلاحيات المشرفين المختارين وإدارة بيانات الفرق ===
-- نفّذ هذا الجزء بعد المخطط السابق لتحديث الصلاحيات في مشروع موجود.
create or replace function public.is_sawaed_manager()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.approved = true
      and p.role in ('admin','team_leader')
  );
$$;

create table if not exists public.team_catalog (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  sport text not null default '',
  club text not null default '',
  players jsonb not null default '[]'::jsonb,
  details text not null default '',
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.team_catalog enable row level security;

drop policy if exists "approved read team catalog" on public.team_catalog;
create policy "approved read team catalog" on public.team_catalog for select to authenticated
using (public.is_sawaed_manager() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.approved=true));
drop policy if exists "managers manage team catalog" on public.team_catalog;
create policy "managers manage team catalog" on public.team_catalog for all to authenticated
using (public.is_sawaed_manager()) with check (public.is_sawaed_manager());

-- Keep the top-level admin as the only account that can grant/revoke manager permissions.
-- Recreate competition policies so selected team_leader accounts can fully manage tournaments.
drop policy if exists "admins manage tournaments" on public.tournaments;
create policy "managers manage tournaments" on public.tournaments for all to authenticated
using (public.is_sawaed_manager()) with check (public.is_sawaed_manager());
drop policy if exists "admins manage teams" on public.teams;
create policy "managers manage teams" on public.teams for all to authenticated
using (public.is_sawaed_manager()) with check (public.is_sawaed_manager());
drop policy if exists "admins manage matches" on public.matches;
create policy "managers manage matches" on public.matches for all to authenticated
using (public.is_sawaed_manager()) with check (public.is_sawaed_manager());
drop policy if exists "admins manage team memberships" on public.team_members;
create policy "managers manage team memberships" on public.team_members for all to authenticated
using (public.is_sawaed_manager()) with check (public.is_sawaed_manager());

-- Keep approved-seat management restricted to the primary admin, not delegated managers.
drop policy if exists "admins manage approved seats" on public.approved_seat_numbers;
create policy "admins manage approved seats" on public.approved_seat_numbers for all to authenticated
using (public.is_sawaed_admin()) with check (public.is_sawaed_admin());


-- === المباريات المضافة من المدير/المشرف (صفحة المباريات + آخر الأحداث) ===
create table if not exists public.fixtures (
  id text primary key,
  sport text not null,
  team_a text not null check (char_length(team_a) between 1 and 40),
  team_b text not null check (char_length(team_b) between 1 and 40),
  scheduled_at timestamptz not null,
  venue text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.fixtures enable row level security;
drop policy if exists "everyone reads fixtures" on public.fixtures;
create policy "everyone reads fixtures" on public.fixtures for select to anon, authenticated using (true);
drop policy if exists "managers manage fixtures" on public.fixtures;
create policy "managers manage fixtures" on public.fixtures for all to authenticated
using (public.is_sawaed_manager()) with check (public.is_sawaed_manager());


-- === ترتيب الفرق (يتحكم به المدير والمشرفون) ===
create table if not exists public.team_standings (
  id text primary key,
  sport text not null,
  name text not null check (char_length(name) between 1 and 40),
  points integer not null default 0 check (points between 0 and 9999),
  pos integer not null default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (sport, name)
);
alter table public.team_standings enable row level security;
drop policy if exists "everyone reads standings" on public.team_standings;
create policy "everyone reads standings" on public.team_standings for select to anon, authenticated using (true);
drop policy if exists "managers manage standings" on public.team_standings;
create policy "managers manage standings" on public.team_standings for all to authenticated
using (public.is_sawaed_manager()) with check (public.is_sawaed_manager());


-- === شعار الفريق (صورة مصغّرة تُحفظ كنص base64 داخل الجدول، لا حاجة لإعداد Storage) ===
alter table public.team_catalog add column if not exists logo text not null default '';
alter table public.team_catalog drop constraint if exists team_catalog_logo_check;
alter table public.team_catalog add constraint team_catalog_logo_check
  check (logo = '' or (logo like 'data:image/%' and char_length(logo) <= 300000));


-- =========================================================
-- سواعد: هدافون وصنّاع أهداف، حالة المباريات، اعتماد تلقائي
-- =========================================================
create table if not exists public.match_scorers (
  id text primary key,
  match_id text not null references public.matches(id) on delete cascade,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  team_id text references public.teams(id) on delete set null,
  player_name text not null check (char_length(player_name) between 1 and 40),
  event_type text not null check (event_type in ('goal','assist')),
  minute integer check (minute is null or minute between 0 and 130),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists match_scorers_tournament_idx on public.match_scorers(tournament_id);
create index if not exists match_scorers_match_idx on public.match_scorers(match_id);
alter table public.match_scorers enable row level security;
drop policy if exists "approved users read match scorers" on public.match_scorers;
create policy "approved users read match scorers" on public.match_scorers for select to authenticated
using (public.is_sawaed_manager() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.approved=true));
drop policy if exists "managers manage match scorers" on public.match_scorers;
create policy "managers manage match scorers" on public.match_scorers for all to authenticated
using (public.is_sawaed_manager()) with check (public.is_sawaed_manager());

alter table public.fixtures add column if not exists status text not null default 'upcoming';
alter table public.fixtures drop constraint if exists fixtures_status_check;
alter table public.fixtures add constraint fixtures_status_check check (status in ('upcoming','live','finished'));

create or replace function public.handle_new_sawaed_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_seat text; v_name text;
begin
  v_seat := coalesce(new.raw_user_meta_data->>'seat_number','');
  v_name := trim(coalesce(new.raw_user_meta_data->>'full_name',''));
  if v_seat !~ '^[0-9]{6}$' or v_name = '' then
    raise exception 'يرجى إدخال الاسم ورقم جلوس صحيح من 6 أرقام';
  end if;
  update public.approved_seat_numbers set claimed_by = new.id
    where seat_number = v_seat and claimed_by is null;
  if not found then raise exception 'رقم الجلوس غير معتمد أو مستخدم'; end if;
  insert into public.profiles(id, full_name, seat_number, role, approved)
    values(new.id, v_name, v_seat, 'student', true);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_sawaed on auth.users;
create trigger on_auth_user_created_sawaed after insert on auth.users
for each row execute procedure public.handle_new_sawaed_user();

update public.profiles p set approved = true
where p.approved = false
and exists (select 1 from auth.users u where u.id = p.id and u.email_confirmed_at is not null);



-- مسجلو أهداف المباريات العامة
create table if not exists public.fixture_scorers (
  id text primary key,
  fixture_id text not null references public.fixtures(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 1 and 50),
  team_side text not null check (team_side in ('a','b')),
  minute integer check (minute is null or minute between 0 and 130),
  created_at timestamptz not null default now()
);
create index if not exists fixture_scorers_fixture_idx on public.fixture_scorers(fixture_id);
alter table public.fixture_scorers enable row level security;
drop policy if exists "everyone reads fixture scorers" on public.fixture_scorers;
create policy "everyone reads fixture scorers" on public.fixture_scorers for select to anon, authenticated using (true);
drop policy if exists "managers manage fixture scorers" on public.fixture_scorers;
create policy "managers manage fixture scorers" on public.fixture_scorers for all to authenticated
using (public.is_sawaed_manager()) with check (public.is_sawaed_manager());
