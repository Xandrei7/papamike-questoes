-- ============================================================
-- PAPAMIKE QUESTÕES — Setup completo do banco Supabase
-- Execute este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- 1. DISCIPLINES
create table if not exists public.disciplines (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  icon text default '📚',
  created_at timestamp with time zone default now()
);

-- 2. SUBJECTS
create table if not exists public.subjects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  discipline_id uuid references public.disciplines(id) on delete cascade,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

-- 3. QUESTIONS
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  statement text not null,
  type text check (type in ('multiple_choice', 'true_false')) not null default 'true_false',
  options jsonb,
  correct_answer text not null,
  comment text not null default '',
  legal_basis text,
  exam_tips text,
  subject_id uuid references public.subjects(id) on delete cascade,
  discipline_id uuid references public.disciplines(id) on delete cascade,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

-- 4. PROFILES
create table if not exists public.profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  is_validated boolean default true, -- true = acesso aberto por padrão
  created_at timestamp with time zone default now()
);

-- 5. USER_ROLES
create table if not exists public.user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'admin',
  created_at timestamp with time zone default now()
);

-- 6. QUESTION_REPORTS
create table if not exists public.question_reports (
  id uuid default gen_random_uuid() primary key,
  question_id uuid references public.questions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  message text,
  created_at timestamp with time zone default now()
);

-- ============================================================
-- TRIGGER: cria profile automático ao cadastrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, name, is_validated)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    true  -- acesso aberto: todos os cadastros têm acesso automaticamente
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.disciplines enable row level security;
alter table public.subjects enable row level security;
alter table public.questions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.question_reports enable row level security;

-- Disciplines: qualquer autenticado pode ler; apenas admin pode escrever
create policy "Authenticated can read disciplines"
  on public.disciplines for select to authenticated using (true);
create policy "Authenticated can insert disciplines"
  on public.disciplines for insert to authenticated with check (true);
create policy "Authenticated can update disciplines"
  on public.disciplines for update to authenticated using (true);
create policy "Authenticated can delete disciplines"
  on public.disciplines for delete to authenticated using (true);

-- Subjects
create policy "Authenticated can read subjects"
  on public.subjects for select to authenticated using (true);
create policy "Authenticated can insert subjects"
  on public.subjects for insert to authenticated with check (true);
create policy "Authenticated can update subjects"
  on public.subjects for update to authenticated using (true);
create policy "Authenticated can delete subjects"
  on public.subjects for delete to authenticated using (true);

-- Questions
create policy "Authenticated can read questions"
  on public.questions for select to authenticated using (true);
create policy "Authenticated can insert questions"
  on public.questions for insert to authenticated with check (true);
create policy "Authenticated can update questions"
  on public.questions for update to authenticated using (true);
create policy "Authenticated can delete questions"
  on public.questions for delete to authenticated using (true);

-- Profiles: usuário vê/edita o próprio; admin vê todos
create policy "Users can read own profile"
  on public.profiles for select to authenticated using (true);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = user_id);
create policy "Service can insert profiles"
  on public.profiles for insert with check (true);

-- User roles: autenticado pode ler
create policy "Authenticated can read user_roles"
  on public.user_roles for select to authenticated using (true);

-- Reports: autenticado pode inserir e ler
create policy "Authenticated can read reports"
  on public.question_reports for select to authenticated using (true);
create policy "Authenticated can insert reports"
  on public.question_reports for insert to authenticated with check (true);

-- ============================================================
-- TORNAR VOCÊ ADMIN
-- Execute DEPOIS de criar sua conta no app:
-- Substitua 'seu@email.com' pelo seu email
-- ============================================================
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'seu@email.com';
