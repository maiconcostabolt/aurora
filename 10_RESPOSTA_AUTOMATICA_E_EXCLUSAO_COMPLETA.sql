-- AURORA 10 — Resposta automática e exclusão completa do usuário.
-- Execute uma única vez depois do arquivo 09_CENTRAL_DE_MENSAGENS.sql.

alter table public.aurora_support_messages
  add column if not exists is_automatic boolean not null default false;

create or replace function public.aurora_support_auto_reply()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_last_human_admin timestamptz;
begin
  if new.sender_role <> 'client' then return new; end if;

  select max(created_at) into v_last_human_admin
    from public.aurora_support_messages
   where user_id=new.user_id and sender_role='admin' and not is_automatic;

  -- Uma conversa atendida nos últimos 30 minutos não recebe mensagem automática.
  if v_last_human_admin is not null and v_last_human_admin >= now()-interval '30 minutes' then
    return new;
  end if;

  -- Não repete a confirmação enquanto o administrador ainda não respondeu.
  if exists(
    select 1 from public.aurora_support_messages
     where user_id=new.user_id and sender_role='admin' and is_automatic
       and created_at > coalesce(v_last_human_admin,'epoch'::timestamptz)
  ) then return new; end if;

  insert into public.aurora_support_messages
    (user_id,sender_role,body,is_automatic,read_by_admin_at)
  values
    (new.user_id,'admin',
     'Mensagem recebida! A Aurora agradece seu contato. Assim que possível, nossa equipe responderá por aqui.',
     true,now());
  return new;
end $$;

drop trigger if exists aurora_support_auto_reply_after_client_message
  on public.aurora_support_messages;
create trigger aurora_support_auto_reply_after_client_message
after insert on public.aurora_support_messages
for each row execute function public.aurora_support_auto_reply();

revoke all on function public.aurora_support_auto_reply() from public,anon,authenticated;

-- Atualiza as consultas para identificar claramente a resposta automática.
drop function if exists public.aurora_support_my_messages();
create function public.aurora_support_my_messages()
returns table(id uuid,sender_role text,body text,created_at timestamptz,read_at timestamptz,is_automatic boolean)
language sql security definer set search_path=public as $$
  select m.id,m.sender_role,m.body,m.created_at,
         case when m.sender_role='admin' then m.read_by_client_at else m.read_by_admin_at end,
         m.is_automatic
    from public.aurora_support_messages m
   where m.user_id=auth.uid() order by m.created_at;
$$;

drop function if exists public.aurora_admin_support_messages(uuid);
create function public.aurora_admin_support_messages(p_user_id uuid)
returns table(id uuid,sender_role text,body text,created_at timestamptz,read_at timestamptz,is_automatic boolean)
language plpgsql security definer set search_path=public as $$
begin
  if not public.aurora_is_admin() then raise exception 'Acesso administrativo não autorizado'; end if;
  return query
  select m.id,m.sender_role,m.body,m.created_at,
         case when m.sender_role='admin' then m.read_by_client_at else m.read_by_admin_at end,
         m.is_automatic
    from public.aurora_support_messages m
   where m.user_id=p_user_id order by m.created_at;
end $$;

revoke execute on function public.aurora_support_my_messages() from public,anon;
revoke execute on function public.aurora_admin_support_messages(uuid) from public,anon;
grant execute on function public.aurora_support_my_messages() to authenticated;
grant execute on function public.aurora_admin_support_messages(uuid) to authenticated;

-- Limpeza definitiva, inclusive em tabelas antigas que não tenham CASCADE.
create or replace function public.aurora_cleanup_deleted_auth_user()
returns trigger language plpgsql security definer set search_path=public,auth as $$
begin
  delete from public.aurora_support_messages where user_id=old.id;
  delete from public.aurora_user_modules where user_id=old.id;
  delete from public.aurora_project_records
   where created_by=old.id
      or project_id in (select id from public.aurora_projects where created_by=old.id);
  delete from public.aurora_projects where created_by=old.id;
  delete from public.aurora_profiles where user_id=old.id;
  return old;
end $$;

revoke all on function public.aurora_cleanup_deleted_auth_user() from public,anon,authenticated;
drop trigger if exists aurora_cleanup_before_auth_user_delete on auth.users;
create trigger aurora_cleanup_before_auth_user_delete
before delete on auth.users for each row
execute function public.aurora_cleanup_deleted_auth_user();
