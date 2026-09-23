-- AURORA V33 TESTE — somente mapeamento semântico do resumo público do QR.
-- Não altera fotos, Home, convites, Aurora AI ou demais relatórios.

create or replace function public.aurora_asset_public_get(p_token text)
returns table(
  code text,
  name text,
  asset_type text,
  status text,
  company_name text,
  last_inspection_at timestamptz,
  inspection_count bigint,
  last_inspection_status text,
  next_inspection_at timestamptz,
  service_executed text,
  finding_summary text,
  work_performed text,
  current_condition text,
  recommendation text,
  next_action text,
  executor_company text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    a.code,
    a.name,
    a.asset_type,
    a.status,
    c.name,
    s.last_inspection_at,
    coalesce(s.inspection_count,0),
    case when coalesce(s.inspection_count,0)>0 then 'Concluída' else null end,
    null::timestamptz,
    nullif(trim(coalesce(
      s.latest_workflow_state #>> '{service,title}',
      s.latest_workflow_state #>> '{full_case,service,title}',
      s.latest_title,
      s.latest_service_type,
      ''
    )), ''),
    nullif(trim(coalesce(
      s.latest_workflow_state #>> '{full_case,intake,initial_condition}',
      s.latest_diagnostic->>'finding_summary',
      s.latest_diagnostic->>'summary',
      ''
    )), ''),
    nullif(trim(coalesce(
      s.latest_approval->>'work_performed',
      s.latest_approval->>'notes',
      s.latest_diagnostic->>'work_performed',
      s.latest_diagnostic->>'conclusion',
      ''
    )), ''),
    nullif(trim(coalesce(
      s.latest_diagnostic->>'current_condition',
      s.latest_workflow_state #>> '{full_case,diagnostic,current_condition}',
      s.latest_workflow_state #>> '{full_case,asset,current_condition}',
      ''
    )), ''),
    nullif(trim(coalesce(
      s.latest_diagnostic->>'recommendation',
      s.latest_workflow_state #>> '{full_case,diagnostic,recommendation}',
      ''
    )), ''),
    nullif(trim(coalesce(
      s.latest_diagnostic->>'next_action',
      s.latest_diagnostic->>'next_maintenance',
      s.latest_workflow_state #>> '{full_case,diagnostic,next_action}',
      s.latest_workflow_state #>> '{full_case,diagnostic,next_maintenance}',
      s.latest_approval->>'next_action',
      ''
    )), ''),
    c.name
  from public.aurora_assets a
  join public.aurora_companies c on c.id=a.company_id
  left join lateral (
    select
      count(*)::bigint inspection_count,
      max(p.updated_at) last_inspection_at,
      (array_agg(p.service_type order by coalesce(p.updated_at,p.created_at) desc))[1] latest_service_type,
      (array_agg(p.title order by coalesce(p.updated_at,p.created_at) desc))[1] latest_title,
      (array_agg(p.diagnostic order by coalesce(p.updated_at,p.created_at) desc))[1] latest_diagnostic,
      (array_agg(p.approval order by coalesce(p.updated_at,p.created_at) desc))[1] latest_approval,
      (array_agg(p.workflow_state order by coalesce(p.updated_at,p.created_at) desc))[1] latest_workflow_state
    from public.aurora_projects p
    where p.company_id=a.company_id
      and p.deleted_at is null
      and lower(coalesce(p.status,'')) in ('completed','concluído','concluido')
      and (
        nullif(lower(trim(p.asset->>'asset_registry_id')),'')=lower(a.client_key)
        or nullif(lower(trim(p.asset->>'code')),'')=lower(a.code)
        or nullif(lower(trim(p.asset->>'tag')),'')=lower(a.code)
      )
  ) s on true
  where a.public_token=p_token
    and a.status<>'deleted'
    and lower(c.status)='active'
  limit 1;
$$;

revoke all on function public.aurora_asset_public_get(text) from public;
grant execute on function public.aurora_asset_public_get(text) to anon, authenticated;
notify pgrst, 'reload schema';
