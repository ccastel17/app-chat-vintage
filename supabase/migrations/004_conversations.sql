-- Ejecutar en Supabase → SQL Editor (incremental)
--
-- Introduce "conversaciones": un dispositivo (room) pasa a poder tener
-- varias conversaciones en su lista de chats, cada una:
--   - 'simulated': contacto inventado, el director escribe ambos lados
--   - 'linked': apunta a otro dispositivo real (otro actor). Los mensajes
--     de esa conversación son reales entre los dos actores, el director
--     solo puede verla (no escribir ahí).
--
-- Los mensajes ya no se agrupan por room_id sino por thread_id: en una
-- conversación 'linked', dos filas de `conversations` (una por lado)
-- comparten el mismo thread_id, así ambos actores ven los mismos mensajes.

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms(room_id) on delete cascade,
  kind text not null default 'simulated' check (kind in ('simulated', 'linked')),
  contact_name text not null default 'Contacto',
  avatar_url text,
  contact_status text not null default 'en línea',
  linked_room_id text references rooms(room_id) on delete cascade,
  thread_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table conversations enable row level security;

create policy "public read" on conversations for select using (true);
create policy "public insert" on conversations for insert with check (true);
create policy "public update" on conversations for update using (true);
create policy "public delete" on conversations for delete using (true);

alter publication supabase_realtime add table conversations;

-- Migrar cada room existente a una conversación "simulada" con su
-- identidad actual (contact_name/avatar_url/contact_status vivían en
-- `rooms`, ahora viven acá porque un dispositivo puede tener varias).
insert into conversations (room_id, kind, contact_name, avatar_url, contact_status, thread_id)
select room_id, 'simulated', contact_name, avatar_url, contact_status, gen_random_uuid()
from rooms
where not exists (select 1 from conversations c where c.room_id = rooms.room_id);

-- Nuevas columnas en messages: thread_id (reemplaza a room_id como clave
-- de agrupación) y sender_room_id (quién escribió de verdad — solo se usa
-- en conversaciones 'linked', donde "entrante/saliente" depende de quién
-- lo mira y no puede ser un valor fijo).
alter table messages add column if not exists thread_id uuid;
alter table messages add column if not exists sender_room_id text;

create index if not exists messages_thread_id_created_at_idx
  on messages (thread_id, created_at);

update messages m
set
  thread_id = c.thread_id,
  sender_room_id = case when m.direction = 'outgoing' then m.room_id else null end
from conversations c
where c.room_id = m.room_id and c.kind = 'simulated' and m.thread_id is null;

-- Nota: messages.room_id y rooms.contact_name/avatar_url/contact_status
-- quedan en la tabla sin usarse (no se borran para no arriesgar datos),
-- pero el código a partir de ahora solo lee/escribe vía conversations y
-- thread_id.
