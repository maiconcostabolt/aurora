-- AURORA R61 — QR/ativo permanente para conta Individual.
-- Mantém o modelo empresarial existente e adiciona propriedade individual por auth.uid().

alter table public.aurora_assets
  add column if not exists owner_user_id uuid;

alter table public.aurora_assets
  alter column company_id drop not null;

create unique index if not exists aurora_assets_owner_user_client_key_uidx
  on public.aurora_assets(owner_user_id, client_key)
  where company_id is null and owner_user_id is not null;

create index if not exists aurora_assets_owner_user_idx
  on public.aurora_assets(owner_user_id)
  where owner_user_id is not null;

create or replace function public.aurora_asset_upsert(
  p_client_key text,
  p_code text,
  p_name text,
  p_asset_type text,
  p_status text default 'active',
  p_unit text default null,
  p_sector text default null,
  p_internal_location text default null,
  p_notes text default null,
  p_module_code text default 'electrical',
  p_service_code text default 'panel'
)
returns public.aurora_assets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_role text;
  v_can_create boolean := false;
  v_can_edit boolean := false;
  v_existing public.aurora_assets%rowtype;
  v_row public.aurora_assets;
begin
  if v_uid is null then raise exception 'AURORA_AUTH_REQUIRED'; end if;

  select m.company_id, public.aurora_company_role_canonical(m.role)
    into v_company, v_role
  from public.aurora_company_members m
  join public.aurora_companies c on c.id = m.company_id
  where m.user_id = v_uid
    and lower(m.status) = 'active'
    and lower(c.status) = 'active'
  order by m.created_at desc
  limit 1;

  if nullif(trim(p_client_key),'') is null
     or nullif(trim(p_code),'') is null
     or nullif(trim(p_name),'') is null
     or nullif(trim(p_asset_type),'') is null then
    raise exception 'AURORA_ASSET_FIELDS_REQUIRED';
  end if;

  if v_company is null then
    -- Conta Individual: o próprio usuário autenticado é a autoridade do ativo.
    v_can_create := true;
    v_can_edit := true;

    select * into v_existing
    from public.aurora_assets
    where company_id is null
      and owner_user_id = v_uid
      and client_key = trim(p_client_key)
    limit 1;
  else
    if v_role = 'COMPANY_ADMIN' then
      v_can_create := true;
      v_can_edit := true;
    else
      select coalesce(ap.can_create,false), coalesce(ap.can_edit,false)
        into v_can_create, v_can_edit
      from public.aurora_asset_member_permissions ap
      where ap.company_id = v_company and ap.user_id = v_uid;
    end if;

    select * into v_existing
    from public.aurora_assets
    where company_id = v_company and client_key = trim(p_client_key)
    limit 1;
  end if;

  if v_existing.id is null and not v_can_create then
    raise exception 'AURORA_ASSET_CREATE_FORBIDDEN';
  end if;
  if v_existing.id is not null and not v_can_edit then
    raise exception 'AURORA_ASSET_EDIT_FORBIDDEN';
  end if;

  if v_existing.id is not null then
    update public.aurora_assets set
      module_code = coalesce(nullif(trim(p_module_code),''),'electrical'),
      service_code = coalesce(nullif(trim(p_service_code),''),'panel'),
      code = trim(p_code),
      name = trim(p_name),
      asset_type = trim(p_asset_type),
      status = case when p_status in ('active','maintenance','inactive') then p_status else 'active' end,
      unit = nullif(trim(p_unit),''),
      sector = nullif(trim(p_sector),''),
      internal_location = nullif(trim(p_internal_location),''),
      notes = nullif(trim(p_notes),''),
      updated_by = v_uid,
      updated_at = now()
    where id = v_existing.id
    returning * into v_row;
    return v_row;
  end if;

  insert into public.aurora_assets(
    company_id, owner_user_id, client_key, module_code, service_code, code, name,
    asset_type, status, unit, sector, internal_location, notes,
    created_by, updated_by
  ) values (
    v_company, case when v_company is null then v_uid else null end,
    trim(p_client_key), coalesce(nullif(trim(p_module_code),''),'electrical'),
    coalesce(nullif(trim(p_service_code),''),'panel'), trim(p_code), trim(p_name),
    trim(p_asset_type), case when p_status in ('active','maintenance','inactive') then p_status else 'active' end,
    nullif(trim(p_unit),''), nullif(trim(p_sector),''), nullif(trim(p_internal_location),''),
    nullif(trim(p_notes),''), v_uid, v_uid
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.aurora_asset_upsert(text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.aurora_asset_upsert(text,text,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.aurora_asset_public_get_v2(p_token text)
returns table(
  code text,
  name text,
  asset_type text,
  status text,
  company_name text,
  customer_name text,
  last_inspection_at timestamptz,
  inspection_count bigint,
  last_inspection_status text,
  next_inspection_at timestamptz,
  inspection_objective text,
  inspection_responsible text,
  inspection_condition text,
  diagnostic_summary text,
  recommendation text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
select a.code,a.name,a.asset_type,a.status,
 coalesce(nullif(trim(c.name),''),nullif(trim(pr.professional_name),''),nullif(trim(pr.full_name),''),'Usuário Aurora'),
 nullif(trim(coalesce(s.latest_workflow_state #>> '{full_case,customer,name}',s.latest_title,'')),''),
 s.last_inspection_at,coalesce(s.inspection_count,0),
 case when coalesce(s.inspection_count,0)>0 then coalesce(nullif(trim(s.latest_approval->>'status'),''),'Concluída') else null end,
 null::timestamptz,
 nullif(trim(coalesce(s.latest_workflow_state #>> '{full_case,intake,reason}',s.latest_workflow_state #>> '{intake,reason}','')),''),
 nullif(trim(coalesce(s.latest_workflow_state #>> '{full_case,intake,responsible}',s.latest_workflow_state #>> '{intake,responsible}','')),''),
 nullif(trim(coalesce(s.latest_workflow_state #>> '{full_case,intake,service_condition}',s.latest_workflow_state #>> '{intake,service_condition}',s.latest_workflow_state #>> '{full_case,intake,initial_condition}','')),''),
 nullif(trim(coalesce(s.latest_diagnostic->>'summary',s.latest_diagnostic->>'finding_summary','')),''),
 nullif(trim(coalesce(s.latest_diagnostic->>'recommendation','')),'')
from public.aurora_assets a
left join public.aurora_companies c on c.id=a.company_id
left join public.aurora_profiles pr on pr.user_id=a.owner_user_id
left join lateral (
 select count(*)::bigint inspection_count,
 max(coalesce(case when (p.workflow_state #>> '{full_case,intake,inspection_date}') ~ '^\\d{4}-\\d{2}-\\d{2}$' then ((p.workflow_state #>> '{full_case,intake,inspection_date}')::date)::timestamptz end,p.updated_at,p.created_at)) last_inspection_at,
 (array_agg(p.diagnostic order by coalesce(p.updated_at,p.created_at) desc))[1] latest_diagnostic,
 (array_agg(p.approval order by coalesce(p.updated_at,p.created_at) desc))[1] latest_approval,
 (array_agg(p.workflow_state order by coalesce(p.updated_at,p.created_at) desc))[1] latest_workflow_state,
 (array_agg(p.title order by coalesce(p.updated_at,p.created_at) desc))[1] latest_title
 from public.aurora_projects p
 where (
   (a.company_id is not null and p.company_id=a.company_id)
   or
   (a.company_id is null and a.owner_user_id is not null and p.company_id is null and p.created_by=a.owner_user_id)
 )
 and p.deleted_at is null
 and lower(coalesce(p.status,'')) in ('completed','concluído','concluido')
 and (nullif(lower(trim(p.asset->>'asset_registry_id')),'')=lower(a.client_key)
 or nullif(lower(trim(p.asset->>'code')),'')=lower(a.code)
 or nullif(lower(trim(p.asset->>'tag')),'')=lower(a.code)
 or nullif(lower(trim(p.asset->>'identification')),'')=lower(a.name)
 or nullif(lower(trim(p.asset->>'identification')),'')=lower(a.code))
) s on true
where a.public_token=p_token
  and a.status<>'deleted'
  and (a.company_id is null or lower(c.status)='active')
limit 1;
$$;

revoke all on function public.aurora_asset_public_get_v2(text) from public;
grant execute on function public.aurora_asset_public_get_v2(text) to anon, authenticated;

notify pgrst, 'reload schema';
