-- AURORA PWA V5.7 - demonstração automática, única e independente por módulo.
-- Execute uma única vez no SQL Editor do Supabase antes de publicar a PWA.

begin;

-- A conta geral deixa de possuir prazo. Somente bloqueios administrativos
-- impedem o login; licenças e demonstrações são controladas por módulo.
create or replace function public.aurora_my_access()
returns table(user_id uuid,email text,full_name text,access_status text,
 trial_started_at timestamptz,trial_ends_at timestamptz,days_remaining integer,allowed boolean)
language plpgsql security definer set search_path=public as $$
begin
  update public.aurora_profiles p
     set last_access_at=now(),updated_at=now()
   where p.user_id=auth.uid();

  return query
  select p.user_id,p.email,p.full_name,
    case
      when lower(coalesce(p.access_status,'active')) in
        ('blocked','bloqueado','disabled','suspended','inactive','excluido','excluído') then 'blocked'
      else 'active'
    end,
    null::timestamptz,null::timestamptz,
    0,
    (p.account_role='admin' or lower(coalesce(p.access_status,'active')) not in
      ('blocked','bloqueado','disabled','suspended','inactive','excluido','excluído'))
  from public.aurora_profiles p
  where p.user_id=auth.uid();
end $$;

-- O registro permanente em aurora_user_modules é a prova de que o teste já
-- foi utilizado. Registros expirados ou bloqueados nunca são recriados.
create or replace function public.aurora_start_module_trial(p_module_code text)
returns public.aurora_user_modules
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.aurora_user_modules;
  v_account_status text;
begin
  if auth.uid() is null then
    raise exception 'Sessão não autenticada.';
  end if;

  select lower(coalesce(access_status,'active')) into v_account_status
  from public.aurora_profiles
  where user_id=auth.uid();

  if not found then
    raise exception 'Perfil Aurora não encontrado.';
  end if;
  if v_account_status in ('blocked','bloqueado','disabled','suspended','inactive','excluido','excluído') then
    raise exception 'Esta conta está bloqueada.';
  end if;
  if not exists (
    select 1 from public.aurora_modules
    where module_code=p_module_code and enabled=true
  ) then
    raise exception 'Módulo Aurora inválido.';
  end if;

  insert into public.aurora_user_modules (
    user_id,module_code,access_status,source,starts_at,ends_at,granted_by
  ) values (
    auth.uid(),p_module_code,'trial','self_service_trial',now(),now()+interval '7 days',auth.uid()
  )
  on conflict (user_id,module_code) do nothing
  returning * into v_row;

  if v_row.id is null then
    raise exception 'A demonstração deste módulo já foi utilizada nesta conta.';
  end if;

  return v_row;
end $$;

-- Normaliza a leitura sem apagar o histórico: demonstrações vencidas aparecem
-- como expiradas mesmo que a linha ainda conserve access_status='trial'.
create or replace function public.aurora_my_modules()
returns table (
  module_code text,title text,icon text,description text,access_status text,
  source text,starts_at timestamptz,ends_at timestamptz,granted_at timestamptz,can_access boolean
)
language sql stable security definer set search_path=public as $$
  select m.module_code,m.title,m.icon,m.description,
    case
      when um.access_status='trial' and um.ends_at<=now() then 'expired'
      else coalesce(um.access_status,'available')
    end,
    coalesce(um.source,'catalog'),um.starts_at,um.ends_at,um.granted_at,
    coalesce(
      um.access_status in ('included','trial')
      and um.starts_at<=now()
      and (um.ends_at is null or um.ends_at>now()),false
    )
  from public.aurora_modules m
  left join public.aurora_user_modules um
    on um.module_code=m.module_code and um.user_id=auth.uid()
  where m.enabled=true
  order by m.sort_order,m.title;
$$;

revoke all on function public.aurora_start_module_trial(text) from public,anon;
grant execute on function public.aurora_start_module_trial(text) to authenticated;
revoke all on function public.aurora_my_modules() from public,anon;
grant execute on function public.aurora_my_modules() to authenticated;

commit;
