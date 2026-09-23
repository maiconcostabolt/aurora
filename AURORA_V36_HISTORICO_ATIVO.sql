-- Aurora V36 — histórico do ativo: nome do executor no card.
-- A função mantém a mesma autorização: ADMIN ou membro com can_view_history.
create or replace function public.aurora_asset_history_list(p_asset_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_asset public.aurora_assets%rowtype; v_allowed boolean:=false; v_result jsonb;
begin
 if v_uid is null then raise exception 'AURORA_AUTH_REQUIRED'; end if;
 select * into v_asset from public.aurora_assets where id=p_asset_id and status<>'deleted';
 if v_asset.id is null then raise exception 'AURORA_ASSET_NOT_FOUND'; end if;
 select exists(select 1 from public.aurora_company_members m join public.aurora_companies c on c.id=m.company_id and lower(c.status)='active' left join public.aurora_asset_member_permissions ap on ap.company_id=m.company_id and ap.user_id=m.user_id where m.user_id=v_uid and m.company_id=v_asset.company_id and lower(m.status)='active' and (public.aurora_company_role_canonical(m.role)='COMPANY_ADMIN' or ap.can_view_history is true)) into v_allowed;
 if not v_allowed then raise exception 'AURORA_ASSET_HISTORY_FORBIDDEN'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('project_id',p.id,'legacy_case_id',p.legacy_case_id,'title',p.title,'status',p.status,'service_profile',p.service_profile,'service_type',p.service_type,'customer',p.customer,'asset',p.asset,'created_by',p.created_by,'creator_name',coalesce(nullif(trim(pr.professional_name),''),nullif(trim(pr.full_name),''),'Usuário'),'created_at',p.created_at,'updated_at',p.updated_at) order by coalesce(p.updated_at,p.created_at) desc),'[]'::jsonb) into v_result from public.aurora_projects p left join public.aurora_profiles pr on pr.user_id=p.created_by where p.company_id=v_asset.company_id and p.deleted_at is null and lower(coalesce(p.status,'')) in ('completed','concluído','concluido') and (nullif(lower(trim(p.asset->>'asset_registry_id')),'')=lower(v_asset.client_key) or nullif(lower(trim(p.asset->>'code')),'')=lower(v_asset.code) or nullif(lower(trim(p.asset->>'tag')),'')=lower(v_asset.code));
 return v_result;
end;$$;
revoke all on function public.aurora_asset_history_list(uuid) from public,anon;
grant execute on function public.aurora_asset_history_list(uuid) to authenticated;
