-- ── Strength Log: cloud sync schema ───────────────────────────────────────
-- Paste this whole file into your Supabase project's SQL Editor and click Run.
-- It creates the table the app syncs to, and locks it down so each device's
-- anonymous user can only see and edit ITS OWN sets (Row Level Security).

create table if not exists public.entries (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  exercise    text not null,
  sets        integer not null default 0,
  reps        integer not null default 0,
  weight      numeric not null default 0,
  created_at  timestamptz not null default now()
);

-- Fast lookups of "my rows, newest first".
create index if not exists entries_user_created_idx
  on public.entries (user_id, created_at desc);

-- Row Level Security: without this, anyone could read everyone's data.
alter table public.entries enable row level security;

-- One policy per action so a user only touches rows where user_id = themselves.
create policy "read own sets"   on public.entries
  for select using  (auth.uid() = user_id);
create policy "insert own sets" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "update own sets" on public.entries
  for update using  (auth.uid() = user_id);
create policy "delete own sets" on public.entries
  for delete using  (auth.uid() = user_id);
