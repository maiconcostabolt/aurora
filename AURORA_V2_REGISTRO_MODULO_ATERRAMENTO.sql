-- AURORA V2 — registro idempotente do módulo independente Aterramento e Equipotencialização
insert into public.aurora_modules (module_code,title,icon,description,enabled,sort_order)
values ('grounding_equipotentialization','Aterramento e Equipotencialização','⏚','Inspeções, aferições e documentação técnica de sistemas de aterramento e equipotencialização.',true,87)
on conflict (module_code) do update set
  title=excluded.title, icon=excluded.icon, description=excluded.description,
  enabled=true, sort_order=excluded.sort_order;
