-- AURORA 09 — Central de mensagens entre cliente e administrador.
-- Execute uma única vez no SQL Editor do Supabase antes de publicar as versões novas.

create table if not exists public.aurora_support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('client','admin')),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_by_client_at timestamptz,
  read_by_admin_at timestamptz
);

create index if not exists aurora_support_messages_user_created_idx
  on public.aurora_support_messages(user_id, created_at);
create index if not exists aurora_support_messages_admin_unread_idx
  on public.aurora_support_messages(user_id, read_by_admin_at)
  where sender_role='client';

alter table public.aurora_support_messages enable row level security;

drop policy if exists aurora_support_select_own_or_admin on public.aurora_support_messages;
create policy aurora_support_select_own_or_admin
on public.aurora_support_messages for select to authenticated
using (user_id=auth.uid() or public.aurora_is_admin());

drop policy if exists aurora_support_insert_own_client on public.aurora_support_messages;
create policy aurora_support_insert_own_client
on public.aurora_support_messages for insert to authenticated
with check (user_id=auth.uid() and sender_role='client');

revoke all on public.aurora_support_messages from anon;
revoke insert,update,delete on public.aurora_support_messages from authenticated;
grant select on public.aurora_support_messages to authenticated;

create or replace function public.aurora_support_my_messages()
returns table(id uuid,sender_role text,body text,created_at timestamptz,read_at timestamptz)
language sql security definer set search_path=public as $$
  select m.id,m.sender_role,m.body,m.created_at,
         case when m.sender_role='admin' then m.read_by_client_at else m.read_by_admin_at end
  from public.aurora_support_messages m
  where m.user_id=auth.uid()
  order by m.created_at;
$$;

create or replace function public.aurora_support_send(p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 1 and 2000 then
    raise exception 'A mensagem deve possuir entre 1 e 2000 caracteres';
  end if;
  insert into public.aurora_support_messages(user_id,sender_role,body,read_by_client_at)
  values(auth.uid(),'client',trim(p_body),now()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.aurora_support_mark_client_read()
returns void language sql security definer set search_path=public as $$
  update public.aurora_support_messages
     set read_by_client_at=coalesce(read_by_client_at,now())
   where user_id=auth.uid() and sender_role='admin' and read_by_client_at is null;
$$;

create or replace function public.aurora_admin_support_summary()
returns table(user_id uuid,unread_count bigint,latest_at timestamptz,latest_preview text)
language plpgsql security definer set search_path=public as $$
begin
  if not public.aurora_is_admin() then raise exception 'Acesso administrativo não autorizado'; end if;
  return query
  select m.user_id,
         count(*) filter(where m.sender_role='client' and m.read_by_admin_at is null),
         max(m.created_at),
         (array_agg(m.body order by m.created_at desc))[1]
    from public.aurora_support_messages m
   group by m.user_id;
end $$;

create or replace function public.aurora_admin_support_messages(p_user_id uuid)
returns table(id uuid,sender_role text,body text,created_at timestamptz,read_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if not public.aurora_is_admin() then raise exception 'Acesso administrativo não autorizado'; end if;
  return query
  select m.id,m.sender_role,m.body,m.created_at,
         case when m.sender_role='admin' then m.read_by_client_at else m.read_by_admin_at end
    from public.aurora_support_messages m
   where m.user_id=p_user_id order by m.created_at;
end $$;

create or replace function public.aurora_admin_support_send(p_user_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.aurora_is_admin() then raise exception 'Acesso administrativo não autorizado'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 1 and 2000 then
    raise exception 'A mensagem deve possuir entre 1 e 2000 caracteres';
  end if;
  if not exists(select 1 from public.aurora_profiles where user_id=p_user_id and account_role='client') then
    raise exception 'Cliente não encontrado';
  end if;
  insert into public.aurora_support_messages(user_id,sender_role,body,read_by_admin_at)
  values(p_user_id,'admin',trim(p_body),now()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.aurora_admin_support_mark_read(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.aurora_is_admin() then raise exception 'Acesso administrativo não autorizado'; end if;
  update public.aurora_support_messages
     set read_by_admin_at=coalesce(read_by_admin_at,now())
   where user_id=p_user_id and sender_role='client' and read_by_admin_at is null;
end $$;

revoke execute on function public.aurora_support_my_messages() from public,anon;
revoke execute on function public.aurora_support_send(text) from public,anon;
revoke execute on function public.aurora_support_mark_client_read() from public,anon;
revoke execute on function public.aurora_admin_support_summary() from public,anon;
revoke execute on function public.aurora_admin_support_messages(uuid) from public,anon;
revoke execute on function public.aurora_admin_support_send(uuid,text) from public,anon;
revoke execute on function public.aurora_admin_support_mark_read(uuid) from public,anon;
grant execute on function public.aurora_support_my_messages() to authenticated;
grant execute on function public.aurora_support_send(text) to authenticated;
grant execute on function public.aurora_support_mark_client_read() to authenticated;
grant execute on function public.aurora_admin_support_summary() to authenticated;
grant execute on function public.aurora_admin_support_messages(uuid) to authenticated;
grant execute on function public.aurora_admin_support_send(uuid,text) to authenticated;
grant execute on function public.aurora_admin_support_mark_read(uuid) to authenticated;
