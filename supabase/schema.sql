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
