-- Ejecutar en Supabase → SQL Editor
-- Tabla principal de mensajes simulados, ver modelo de datos en CLAUDE.md

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  sender text not null,
  content text not null,
  status text not null default 'enviado' check (status in ('enviado', 'entregado', 'visto')),
  direction text not null default 'incoming' check (direction in ('incoming', 'outgoing')),
  created_at timestamptz not null default now()
);

create index if not exists messages_room_id_created_at_idx
  on messages (room_id, created_at);

-- RLS: la app no tiene autenticación de usuarios (solo el equipo de rodaje
-- accede al panel de control y a los links de /device/[roomId]), así que se
-- habilita acceso público de lectura/escritura protegido por la key
-- publishable. El room_id actúa como código de acceso informal.
alter table messages enable row level security;

create policy "public read" on messages
  for select using (true);

create policy "public insert" on messages
  for insert with check (true);

create policy "public update" on messages
  for update using (true);

-- Habilitar Realtime (postgres_changes) para esta tabla
alter publication supabase_realtime add table messages;

-- Metadata de cada "dispositivo"/conversación: cómo se llama el contacto
-- simulado que ve el actor, y cómo lo identifica el director en /control.
-- No reemplaza Presence (que sigue indicando online/offline en vivo) —
-- rooms es solo el nombre, se puede crear antes o después de que el actor
-- abra el link.
create table if not exists rooms (
  room_id text primary key,
  label text not null,
  contact_name text not null default 'Contacto',
  contact_status text not null default 'en línea',
  created_at timestamptz not null default now()
);

alter table rooms enable row level security;

create policy "public read" on rooms
  for select using (true);

create policy "public insert" on rooms
  for insert with check (true);

create policy "public update" on rooms
  for update using (true);

alter publication supabase_realtime add table rooms;
