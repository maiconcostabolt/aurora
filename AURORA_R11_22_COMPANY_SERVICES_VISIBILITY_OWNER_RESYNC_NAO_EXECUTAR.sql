-- AURORA R11.22 — NÃO EXECUTAR AUTOMATICAMENTE
-- Serviços empresariais canônicos + ocultação administrativa não destrutiva
-- + republicação do mesmo projeto pelo owner.

begin;

alter table public.aurora_companies
  add column if not exists services_by_module jsonb not null default '{}'::jsonb;

create table if not exists public.aurora_company_project_hidden (
  company_id uuid not null references public.aurora_companies(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.aurora_projects(id) on delete cascade,
  hidden_row_version bigint not null,
  hidden_at timestamptz not null default now(),
  primary key (admin_user_id, project_id)
);

alter table public.aurora_company_project_hidden enable row level security;
revoke all on table public.aurora_company_project_hidden from public, anon, authenticated;

create or replace function public.aurora_get_my_company_services()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_company uuid; v_services jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select m.company_id into v_company from public.aurora_company_members m
   where m.user_id=auth.uid() and lower(m.status)='active' limit 1;
  if v_company is null then return '{}'::jsonb; end if;
  select coalesce(c.services_by_module,'{}'::jsonb) into v_services
    from public.aurora_companies c where c.id=v_company;
  return coalesce(v_services,'{}'::jsonb);
end $$;

create or replace function public.aurora_update_my_module_services(p_module_code text,p_selected_services jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_company uuid; v_role text; v_code text:=btrim(coalesce(p_module_code,'')); v_services jsonb; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_code='' or jsonb_typeof(p_selected_services)<>'array' or jsonb_array_length(p_selected_services)=0 then
    raise exception 'AURORA_INVALID_SERVICE_SELECTION';
  end if;
  select m.company_id,public.aurora_company_role_canonical(m.role)
    into v_company,v_role from public.aurora_company_members m
   where m.user_id=auth.uid() and lower(m.status)='active' limit 1;
  select jsonb_agg(distinct to_jsonb(btrim(value))) into v_services
    from jsonb_array_elements_text(p_selected_services) s(value) where btrim(value)<>'';
  v_services:=coalesce(v_services,'[]'::jsonb);
  if v_company is not null then
    if v_role<>'COMPANY_ADMIN' then raise exception 'AURORA_COMPANY_ADMIN_REQUIRED'; end if;
    update public.aurora_companies set services_by_module=coalesce(services_by_module,'{}'::jsonb)||jsonb_build_object(v_code,v_services),updated_at=now()
     where id=v_company returning services_by_module into v_result;
    return jsonb_build_object('ok',true,'company_id',v_company,'services_by_module',v_result,'selected_services',v_services);
  end if;
  update public.aurora_profiles set preferred_module=v_code,selected_services=v_services,
    selected_services_by_module=coalesce(selected_services_by_module,'{}'::jsonb)||jsonb_build_object(v_code,v_services),updated_at=now()
   where user_id=auth.uid();
  return jsonb_build_object('ok',true,'individual',true,'selected_services',v_services);
end $$;

create or replace function public.aurora_company_hide_projects(p_project_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_company uuid; v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select m.company_id into v_company from public.aurora_company_members m
   where m.user_id=auth.uid() and lower(m.status)='active'
     and public.aurora_company_role_canonical(m.role)='COMPANY_ADMIN' limit 1;
  if v_company is null then raise exception 'AURORA_GESTAO_FORBIDDEN'; end if;
  if exists(select 1 from unnest(p_project_ids) x left join public.aurora_projects p on p.id=x and p.company_id=v_company and p.deleted_at is null
            where p.id is null or p.created_by=auth.uid()) then raise exception 'AURORA_GESTAO_HIDE_FORBIDDEN'; end if;
  insert into public.aurora_company_project_hidden(company_id,admin_user_id,project_id,hidden_row_version,hidden_at)
  select v_company,auth.uid(),p.id,p.row_version,now() from public.aurora_projects p where p.id=any(p_project_ids) and p.company_id=v_company and p.deleted_at is null
  on conflict(admin_user_id,project_id) do update set hidden_row_version=excluded.hidden_row_version,hidden_at=excluded.hidden_at;
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',true,'hidden',v_count);
end $$;

create or replace function public.aurora_company_list_hidden_projects()
returns table(project_id uuid,hidden_row_version bigint,hidden_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select h.project_id,h.hidden_row_version,h.hidden_at from public.aurora_company_project_hidden h
  join public.aurora_projects p on p.id=h.project_id and p.deleted_at is null and p.row_version<=h.hidden_row_version
  join public.aurora_company_members m on m.company_id=h.company_id and m.user_id=auth.uid() and lower(m.status)='active'
  where h.admin_user_id=auth.uid() and public.aurora_company_role_canonical(m.role)='COMPANY_ADMIN'
$$;

create or replace function public.aurora_owner_save_project(p_project_id uuid,p_expected_version bigint,p_patch jsonb)
returns public.aurora_projects language plpgsql security definer set search_path=public,pg_temp as $$
declare v_saved public.aurora_projects;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'AURORA_INVALID_PATCH'; end if;
  update public.aurora_projects p set
    legacy_case_id=case when p_patch?'legacy_case_id' then nullif(btrim(p_patch->>'legacy_case_id'),'') else p.legacy_case_id end,
    title=case when p_patch?'title' then coalesce(nullif(btrim(p_patch->>'title'),''),p.title) else p.title end,
    status=case when p_patch?'status' then p_patch->>'status' else p.status end,
    service_profile=case when p_patch?'service_profile' then p_patch->>'service_profile' else p.service_profile end,
    service_type=case when p_patch?'service_type' then p_patch->>'service_type' else p.service_type end,
    customer=case when p_patch?'customer' then coalesce(p_patch->'customer','{}'::jsonb) else p.customer end,
    asset=case when p_patch?'asset' then coalesce(p_patch->'asset','{}'::jsonb) else p.asset end,
    intake=case when p_patch?'intake' then coalesce(p_patch->'intake','{}'::jsonb) else p.intake end,
    custom_fields=case when p_patch?'custom_fields' then coalesce(p_patch->'custom_fields','{}'::jsonb) else p.custom_fields end,
    diagnostic=case when p_patch?'diagnostic' then coalesce(p_patch->'diagnostic','{}'::jsonb) else p.diagnostic end,
    approval=case when p_patch?'approval' then coalesce(p_patch->'approval','{}'::jsonb) else p.approval end,
    workflow_state=case when p_patch?'workflow_state' then coalesce(p_patch->'workflow_state','{}'::jsonb) else p.workflow_state end,
    source_schema_version=case when p_patch?'source_schema_version' then (p_patch->>'source_schema_version')::integer else p.source_schema_version end,
    deleted_at=null,row_version=p.row_version+1,updated_by=auth.uid(),updated_at=now()
  where p.id=p_project_id and p.row_version=p_expected_version and p.created_by=auth.uid()
  returning p.* into v_saved;
  if not found then raise exception 'AURORA_VERSION_CONFLICT_OR_NOT_OWNER'; end if;
  return v_saved;
end $$;

revoke all on function public.aurora_get_my_company_services() from public,anon;
revoke all on function public.aurora_update_my_module_services(text,jsonb) from public,anon;
revoke all on function public.aurora_company_hide_projects(uuid[]) from public,anon;
revoke all on function public.aurora_company_list_hidden_projects() from public,anon;
revoke all on function public.aurora_owner_save_project(uuid,bigint,jsonb) from public,anon;
grant execute on function public.aurora_get_my_company_services() to authenticated;
grant execute on function public.aurora_update_my_module_services(text,jsonb) to authenticated;
grant execute on function public.aurora_company_hide_projects(uuid[]) to authenticated;
grant execute on function public.aurora_company_list_hidden_projects() to authenticated;
grant execute on function public.aurora_owner_save_project(uuid,bigint,jsonb) to authenticated;

commit;
