-- Aurora V26 — histórico de equipamento compartilhado pela empresa.
-- Aplicado no projeto de testes em 13/09/2026.

create or replace function public.aurora_asset_history_list(p_asset_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_asset public.aurora_assets%rowtype;
  v_allowed boolean := false;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'AURORA_AUTH_REQUIRED'; end if;

  select * into v_asset
  from public.aurora_assets
  where id = p_asset_id and status <> 'deleted';
  if v_asset.id is null then raise exception 'AURORA_ASSET_NOT_FOUND'; end if;

  select exists (
    select 1
    from public.aurora_company_members m
    join public.aurora_companies c on c.id = m.company_id and lower(c.status) = 'active'
    left join public.aurora_asset_member_permissions ap
      on ap.company_id = m.company_id and ap.user_id = m.user_id
    where m.user_id = v_uid
      and m.company_id = v_asset.company_id
      and lower(m.status) = 'active'
      and (
        public.aurora_company_role_canonical(m.role) = 'COMPANY_ADMIN'
        or ap.can_view_history is true
      )
  ) into v_allowed;
  if not v_allowed then raise exception 'AURORA_ASSET_HISTORY_FORBIDDEN'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'project_id', p.id,
    'legacy_case_id', p.legacy_case_id,
    'title', p.title,
    'status', p.status,
    'service_profile', p.service_profile,
    'service_type', p.service_type,
    'customer', p.customer,
    'asset', p.asset,
    'created_by', p.created_by,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) order by coalesce(p.updated_at, p.created_at) desc), '[]'::jsonb)
  into v_result
  from public.aurora_projects p
  where p.company_id = v_asset.company_id
    and p.deleted_at is null
    and lower(coalesce(p.status, '')) in ('completed', 'concluído', 'concluido')
    and (
      nullif(lower(trim(p.asset->>'asset_registry_id')), '') = lower(v_asset.client_key)
      or nullif(lower(trim(p.asset->>'code')), '') = lower(v_asset.code)
      or nullif(lower(trim(p.asset->>'tag')), '') = lower(v_asset.code)
    );
  return v_result;
end;
$$;

create or replace function public.aurora_asset_history_project_get(
  p_asset_id uuid,
  p_project_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_asset public.aurora_assets%rowtype;
  v_allowed boolean := false;
  v_project public.aurora_projects%rowtype;
  v_records jsonb;
begin
  if v_uid is null then raise exception 'AURORA_AUTH_REQUIRED'; end if;

  select * into v_asset from public.aurora_assets where id = p_asset_id and status <> 'deleted';
  if v_asset.id is null then raise exception 'AURORA_ASSET_NOT_FOUND'; end if;

  select exists (
    select 1
    from public.aurora_company_members m
    join public.aurora_companies c on c.id = m.company_id and lower(c.status) = 'active'
    left join public.aurora_asset_member_permissions ap
      on ap.company_id = m.company_id and ap.user_id = m.user_id
    where m.user_id = v_uid
      and m.company_id = v_asset.company_id
      and lower(m.status) = 'active'
      and (
        public.aurora_company_role_canonical(m.role) = 'COMPANY_ADMIN'
        or ap.can_view_history is true
      )
  ) into v_allowed;
  if not v_allowed then raise exception 'AURORA_ASSET_HISTORY_FORBIDDEN'; end if;

  select * into v_project
  from public.aurora_projects p
  where p.id = p_project_id
    and p.company_id = v_asset.company_id
    and p.deleted_at is null
    and (
      nullif(lower(trim(p.asset->>'asset_registry_id')), '') = lower(v_asset.client_key)
      or nullif(lower(trim(p.asset->>'code')), '') = lower(v_asset.code)
      or nullif(lower(trim(p.asset->>'tag')), '') = lower(v_asset.code)
    );
  if v_project.id is null then raise exception 'AURORA_ASSET_HISTORY_PROJECT_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.position), '[]'::jsonb)
  into v_records
  from public.aurora_project_records r
  where r.project_id = v_project.id and r.deleted_at is null;

  return jsonb_build_object('project', to_jsonb(v_project), 'records', v_records);
end;
$$;

revoke all on function public.aurora_asset_history_list(uuid) from public, anon;
revoke all on function public.aurora_asset_history_project_get(uuid, uuid) from public, anon;
grant execute on function public.aurora_asset_history_list(uuid) to authenticated;
grant execute on function public.aurora_asset_history_project_get(uuid, uuid) to authenticated;
