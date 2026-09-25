-- LURIA Plantão / Casos Clínicos
-- Estrutura de conteúdo versionável + sessões por usuário.

create extension if not exists pgcrypto;

create table if not exists public.clinical_cases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  setting text not null default 'Sala de emergência',
  specialty text not null default 'Emergência',
  difficulty text not null default 'Intermediário',
  summary text not null,
  presentation jsonb not null default '{}'::jsonb,
  initial_vitals jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  deterioration jsonb not null default '[]'::jsonb,
  completion_rules jsonb not null default '{}'::jsonb,
  debrief jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinical_case_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.clinical_cases(id) on delete restrict,
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  elapsed_minutes integer not null default 0 check (elapsed_minutes >= 0),
  score numeric(6,2) not null default 0,
  state jsonb not null default '{}'::jsonb,
  action_log jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb
);

create index if not exists clinical_case_sessions_user_started_idx
  on public.clinical_case_sessions(user_id, started_at desc);

alter table public.clinical_cases enable row level security;
alter table public.clinical_case_sessions enable row level security;

drop policy if exists "clinical_cases_authenticated_read" on public.clinical_cases;
create policy "clinical_cases_authenticated_read"
  on public.clinical_cases
  for select to authenticated
  using (active = true);

drop policy if exists "clinical_case_sessions_select_own" on public.clinical_case_sessions;
create policy "clinical_case_sessions_select_own"
  on public.clinical_case_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "clinical_case_sessions_insert_own" on public.clinical_case_sessions;
create policy "clinical_case_sessions_insert_own"
  on public.clinical_case_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "clinical_case_sessions_update_own" on public.clinical_case_sessions;
create policy "clinical_case_sessions_update_own"
  on public.clinical_case_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.clinical_cases to authenticated;
grant select, insert, update on public.clinical_case_sessions to authenticated;
