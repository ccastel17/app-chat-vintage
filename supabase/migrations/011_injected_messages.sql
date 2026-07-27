-- Permite al director escribir excepcionalmente en una conversación
-- linkeada, en nombre de uno de los dos actores reales. Para el otro
-- actor (y para quien mira el chat) es indistinguible de un mensaje
-- real — esta marca solo la ve el director en /control, para poder
-- diferenciar después qué fue orgánico y qué no.
alter table messages add column if not exists injected_by_director boolean not null default false;
