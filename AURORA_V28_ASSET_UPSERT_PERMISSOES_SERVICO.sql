-- Aurora V28 — cadastro/edição de ativo conforme permissão empresarial.

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

  if v_company is null then raise exception 'AURORA_COMPANY_REQUIRED'; end if;
  if nullif(trim(p_client_key),'') is null
     or nullif(trim(p_code),'') is null
     or nullif(trim(p_name),'') is null
     or nullif(trim(p_asset_type),'') is null then
    raise exception 'AURORA_ASSET_FIELDS_REQUIRED';
  end if;

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

  if v_existing.id is null and not v_can_create then
    raise exception 'AURORA_ASSET_CREATE_FORBIDDEN';
  end if;
  if v_existing.id is not null and not v_can_edit then
    raise exception 'AURORA_ASSET_EDIT_FORBIDDEN';
  end if;

  insert into public.aurora_assets(
    company_id, client_key, module_code, service_code, code, name,
    asset_type, status, unit, sector, internal_location, notes,
    created_by, updated_by
  ) values (
    v_company, trim(p_client_key), coalesce(nullif(trim(p_module_code),''),'electrical'),
    coalesce(nullif(trim(p_service_code),''),'panel'), trim(p_code), trim(p_name),
    trim(p_asset_type), case when p_status in ('active','maintenance','inactive') then p_status else 'active' end,
    nullif(trim(p_unit),''), nullif(trim(p_sector),''), nullif(trim(p_internal_location),''),
    nullif(trim(p_notes),''), v_uid, v_uid
  )
  on conflict (company_id, client_key) do update set
    module_code = excluded.module_code,
    service_code = excluded.service_code,
    code = excluded.code,
    name = excluded.name,
    asset_type = excluded.asset_type,
    status = excluded.status,
    unit = excluded.unit,
    sector = excluded.sector,
    internal_location = excluded.internal_location,
    notes = excluded.notes,
    updated_by = v_uid,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.aurora_asset_upsert(text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.aurora_asset_upsert(text,text,text,text,text,text,text,text,text,text,text) to authenticated;
