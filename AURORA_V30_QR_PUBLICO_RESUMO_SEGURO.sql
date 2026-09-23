-- Aurora V30 — ficha pública segura do ativo.
-- Não retorna endereço interno, observações, fotos ou conteúdo dos relatórios.
drop function if exists public.aurora_asset_public_get(text);
create function public.aurora_asset_public_get(p_token text)
returns table(code text,name text,asset_type text,status text,company_name text,last_inspection_at timestamptz,inspection_count bigint,last_inspection_status text,next_inspection_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.code,a.name,a.asset_type,a.status,c.name,s.last_inspection_at,coalesce(s.inspection_count,0),
    case when coalesce(s.inspection_count,0)>0 then 'Concluída' else null end,
    null::timestamptz
  from public.aurora_assets a
  join public.aurora_companies c on c.id=a.company_id
  left join lateral (
    select count(*)::bigint inspection_count,max(p.updated_at) last_inspection_at
    from public.aurora_projects p
    where p.company_id=a.company_id and p.deleted_at is null and lower(p.status)='completed'
      and (nullif(lower(trim(p.asset->>'asset_registry_id')),'')=lower(a.client_key)
        or nullif(lower(trim(p.asset->>'code')),'')=lower(a.code)
        or nullif(lower(trim(p.asset->>'tag')),'')=lower(a.code))
  ) s on true
  where a.public_token=p_token and a.status<>'deleted' and lower(c.status)='active'
  limit 1;
$$;
revoke all on function public.aurora_asset_public_get(text) from public;
grant execute on function public.aurora_asset_public_get(text) to anon, authenticated;
