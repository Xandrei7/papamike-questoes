-- ============================================================
-- SQL DE MIGRAÇÃO: ADIÇÃO DE STATUS E ROLE EM PREPARAÇÃO PARA 
-- GESTÃO AVANÇADA DE ACESSOS E PENDÊNCIAS
-- Execute este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- 1. Adicionar novas colunas na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text default 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text default 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requested_access_at timestamp with time zone default now();

-- 2. Migrar os usuários antigos (quem era is_validated=true vira 'approved')
UPDATE public.profiles 
SET status = 'approved', role = 'admin'
WHERE email = 'alexandregoncalvespmrr@gmail.com';

UPDATE public.profiles 
SET status = 'approved' 
WHERE is_validated = true AND status = 'pending';

-- O trigger existente `handle_new_user` passará a inserir status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, is_validated, status, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    false,
    'pending',
    'user'
  );
  RETURN new;
END;
$$;
