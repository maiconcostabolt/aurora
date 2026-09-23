-- AURORA V32 — fotos autenticadas para membros autorizados + resumo técnico público do QR.
-- Executar no Supabase de TESTE antes da validação da V32.
-- Não torna bucket/fotos públicos. Acesso continua autenticado e vinculado à empresa.

create or replace function public.aurora_can_view_project_evidence(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.aurora_projects p
    join public.aurora_company_members m
      on m.company_id = p.company_id
     and m.user_id = auth.uid()
     and lower(m.status) = 'active'
    join public.aurora_companies c
      on c.id = p.company_id
     and lower(c.status) = 'active'
    left join public.aurora_asset_member_permissions ap
      on ap.company_id = p.company_id
     and ap.user_id = auth.uid()
    where p.id = p_project_id
      and p.deleted_at is null
      and (
        p.created_by = auth.uid()
        or public.aurora_company_role_canonical(m.role) = 'COMPANY_ADMIN'
        or coalesce(ap.can_view_history,false) is true
      )
  );
$$;
revoke all on function public.aurora_can_view_project_evidence(uuid) from public, anon;
grant execute on function public.aurora_can_view_project_evidence(uuid) to authenticated;

-- Metadata das fotos: somente membro autorizado para o atendimento.
alter table public.aurora_project_evidence enable row level security;
drop policy if exists aurora_v32_evidence_member_select on public.aurora_project_evidence;
create policy aurora_v32_evidence_member_select
on public.aurora_project_evidence
for select
to authenticated
using (public.aurora_can_view_project_evidence(project_id));

-- Arquivo privado no Storage. Caminho canônico Aurora:
-- <company_id>/<project_id>/<evidence_id>/v1.<ext>
drop policy if exists aurora_v32_evidence_storage_member_select on storage.objects;
create policy aurora_v32_evidence_storage_member_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'aurora-project-evidence'
  and public.aurora_can_view_project_evidence(
    case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[2])::uuid
      else null::uuid
    end
  )
);

-- QR público: apenas resumo técnico seguro do último atendimento concluído.
-- Sem fotos, valores, contatos, endereço interno ou relatório completo.
drop function if exists public.aurora_asset_public_get(text);
create function public.aurora_asset_public_get(p_token text)
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
    nullif(trim(coalesce(s.latest_service_type, s.latest_title, '')), ''),
    nullif(trim(coalesce(s.latest_diagnostic->>'summary','')), ''),
    nullif(trim(coalesce(s.latest_diagnostic->>'conclusion','')), ''),
    nullif(trim(coalesce(s.latest_diagnostic->>'status', s.latest_approval->>'status','')), ''),
    nullif(trim(coalesce(s.latest_diagnostic->>'recommendation','')), ''),
    nullif(trim(coalesce(s.latest_approval->>'notes','')), ''),
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
      (array_agg(p.approval order by coalesce(p.updated_at,p.created_at) desc))[1] latest_approval
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
