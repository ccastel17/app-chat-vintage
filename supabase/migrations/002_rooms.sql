-- Ejecutar en Supabase → SQL Editor (incremental, no vuelvas a correr
-- supabase/schema.sql completo porque las policies de `messages` ya existen
-- y create policy no soporta "if not exists")

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
