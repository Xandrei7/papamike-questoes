-- ============================================================
-- EXECUTE ESTE SQL NO SUPABASE PARA O AUTO-ADMIN FUNCIONAR
-- Permite que o primeiro usuário logado vire admin automaticamente
-- ============================================================

-- Remove policy antiga se existir
drop policy if exists "Allow first admin setup" on public.user_roles;

-- Nova policy: só permite insert se não existir nenhum admin ainda
-- E só pode inserir o próprio user_id (segurança)
create policy "Allow first admin setup"
  on public.user_roles for insert to authenticated
  with check (
    not exists (select 1 from public.user_roles where role = 'admin')
    and auth.uid() = user_id
  );
