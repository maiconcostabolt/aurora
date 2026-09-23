-- AURORA V5.6 - sincroniza Minha empresa com o cadastro exibido no Admin.
-- Execute uma única vez no SQL Editor do Supabase antes de publicar a PWA V5.6.

create or replace function public.aurora_update_my_profile(
  p_company text,
  p_full_name text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida';
  end if;

  if nullif(trim(p_company), '') is null
     or nullif(trim(p_full_name), '') is null
     or nullif(trim(p_phone), '') is null then
    raise exception 'Empresa, responsável e telefone são obrigatórios';
  end if;

  update public.aurora_profiles
     set company=trim(p_company),
         full_name=trim(p_full_name),
         phone=trim(p_phone),
         updated_at=now()
   where user_id=auth.uid();

  if not found then
    raise exception 'Perfil da conta não encontrado';
  end if;
end
$$;

revoke execute on function public.aurora_update_my_profile(text,text,text) from public,anon;
grant execute on function public.aurora_update_my_profile(text,text,text) to authenticated;
