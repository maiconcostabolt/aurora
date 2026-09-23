-- AURORA PWA V5.9 - serviços independentes por módulo.
-- Execute uma única vez no SQL Editor do Supabase antes de publicar a PWA.
begin;

alter table public.aurora_profiles
  add column if not exists selected_services_by_module jsonb not null default '{}'::jsonb;

update public.aurora_profiles
   set selected_services_by_module = jsonb_build_object(preferred_module, selected_services)
 where coalesce(preferred_module, '') <> ''
   and jsonb_typeof(selected_services) = 'array'
   and jsonb_array_length(selected_services) > 0
   and selected_services_by_module = '{}'::jsonb;

create or replace function public.aurora_update_my_onboarding(
  p_company text, p_full_name text, p_phone text,
  p_module_code text, p_selected_services jsonb
)
returns public.aurora_profiles
language plpgsql security definer set search_path=public
as $$
declare
  v_row public.aurora_profiles;
  v_services jsonb;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Sessão não autenticada.'; end if;
  v_code := trim(p_module_code);
  if nullif(trim(p_company),'') is null or nullif(trim(p_full_name),'') is null
     or nullif(trim(p_phone),'') is null then
    raise exception 'Empresa, responsável e telefone são obrigatórios.';
  end if;
  if not exists (select 1 from public.aurora_modules where module_code=v_code and enabled=true) then
    raise exception 'Módulo Aurora inválido.';
  end if;
  v_services := coalesce(p_selected_services,'[]'::jsonb);
  if jsonb_typeof(v_services) <> 'array' or jsonb_array_length(v_services)=0 then
    raise exception 'Selecione ao menos um serviço oferecido.';
  end if;
  update public.aurora_profiles
     set company_name=trim(p_company), full_name=trim(p_full_name), phone=trim(p_phone),
         preferred_module=v_code, selected_services=v_services,
         selected_services_by_module=coalesce(selected_services_by_module,'{}'::jsonb) || jsonb_build_object(v_code,v_services),
         updated_at=now()
   where user_id=auth.uid() returning * into v_row;
  if v_row.user_id is null then raise exception 'Perfil Aurora não encontrado.'; end if;
  return v_row;
end $$;

create or replace function public.aurora_update_my_module_services(
  p_module_code text, p_selected_services jsonb
)
returns public.aurora_profiles
language plpgsql security definer set search_path=public
as $$
declare
  v_row public.aurora_profiles;
  v_services jsonb := coalesce(p_selected_services,'[]'::jsonb);
  v_code text := trim(p_module_code);
begin
  if auth.uid() is null then raise exception 'Sessão não autenticada.'; end if;
  if jsonb_typeof(v_services) <> 'array' or jsonb_array_length(v_services)=0 then
    raise exception 'Selecione ao menos um serviço oferecido.';
  end if;
  if not exists (
    select 1 from public.aurora_user_modules
     where user_id=auth.uid() and module_code=v_code
       and access_status in ('trial','included')
       and (ends_at is null or ends_at >= now())
  ) then
    raise exception 'Este módulo não possui acesso ativo.';
  end if;
  update public.aurora_profiles
     set preferred_module=v_code, selected_services=v_services,
         selected_services_by_module=coalesce(selected_services_by_module,'{}'::jsonb) || jsonb_build_object(v_code,v_services),
         updated_at=now()
   where user_id=auth.uid() returning * into v_row;
  if v_row.user_id is null then raise exception 'Perfil Aurora não encontrado.'; end if;
  return v_row;
end $$;

revoke all on function public.aurora_update_my_onboarding(text,text,text,text,jsonb) from public,anon;
grant execute on function public.aurora_update_my_onboarding(text,text,text,text,jsonb) to authenticated;
revoke all on function public.aurora_update_my_module_services(text,jsonb) from public,anon;
grant execute on function public.aurora_update_my_module_services(text,jsonb) to authenticated;
commit;
