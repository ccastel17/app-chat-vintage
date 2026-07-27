-- Ejecutar en Supabase → SQL Editor (proyecto nuevo, desde cero)
-- Para un proyecto que ya tiene datos, correr los archivos de
-- supabase/migrations/ en orden en vez de este archivo.

-- Identidad de cada dispositivo físico/teléfono (independiente de con
-- quién "conversa" — eso vive en `conversations`). `label` es el nombre
-- interno que usa el director en /control.
create table if not exists rooms (
  room_id text primary key,
  label text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table rooms enable row level security;

create policy "public read" on rooms for select using (true);
create policy "public insert" on rooms for insert with check (true);
create policy "public update" on rooms for update using (true);
create policy "public delete" on rooms for delete using (true);

alter publication supabase_realtime add table rooms;

-- Cada fila es una entrada en la lista de chats de un dispositivo:
--   - 'simulated': contacto inventado, el director escribe ambos lados
--   - 'linked': apunta a otro room real (linked_room_id). Los mensajes son
--     reales entre los dos actores; el director solo puede ver, no escribir.
-- Una conversación 'linked' existe como DOS filas (una por lado) que
-- comparten thread_id — así ambos actores ven los mismos mensajes.
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

-- Mensajes: agrupados por thread_id (no por room), porque un thread
-- 'linked' es compartido por dos rooms. `sender_room_id` identifica quién
-- escribió de verdad — se usa en threads 'linked', donde entrante/saliente
-- depende de quién lo mira (no puede ser un valor fijo). En threads
-- 'simulated' se usa `direction`, que el director define explícitamente.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  sender_room_id text,
  content text not null,
  status text not null default 'enviado' check (status in ('enviado', 'entregado', 'visto')),
  direction text check (direction in ('incoming', 'outgoing')),
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_id_created_at_idx
  on messages (thread_id, created_at);

alter table messages enable row level security;

create policy "public read" on messages for select using (true);
create policy "public insert" on messages for insert with check (true);
create policy "public update" on messages for update using (true);
create policy "public delete" on messages for delete using (true);

alter publication supabase_realtime add table messages;

-- Skins: paletas/tipografías reutilizables entre rodajes. Uno solo está
-- "activo" a la vez (app_settings.active_skin_id) y aplica a todos los
-- dispositivos del rodaje actual.
create table if not exists skins (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  mode text not null default 'dark' check (mode in ('light', 'dark')),
  bg text not null,
  bubble_incoming_bg text not null,
  bubble_outgoing_bg text not null,
  tick_color text not null,
  tick_seen_color text not null,
  font_family text not null default 'system' check (font_family in ('system', 'rounded', 'mono')),
  font_size text not null default 'md' check (font_size in ('sm', 'md', 'lg')),
  created_at timestamptz not null default now()
);

alter table skins enable row level security;

create policy "public read" on skins for select using (true);
create policy "public insert" on skins for insert with check (true);
create policy "public update" on skins for update using (true);
create policy "public delete" on skins for delete using (true);

alter publication supabase_realtime add table skins;

-- Fila única con la config global del rodaje actual
create table if not exists app_settings (
  id int primary key default 1,
  active_skin_id uuid references skins(id),
  constraint app_settings_singleton check (id = 1)
);

alter table app_settings enable row level security;

create policy "public read" on app_settings for select using (true);
create policy "public insert" on app_settings for insert with check (true);
create policy "public update" on app_settings for update using (true);

alter publication supabase_realtime add table app_settings;

-- 3 skins base para arrancar
insert into skins (name, mode, bg, bubble_incoming_bg, bubble_outgoing_bg, tick_color, tick_seen_color, font_family, font_size)
values
  ('WhatsApp oscuro', 'dark', '#0b0f14', '#1f242b', '#2f6fed', '#9aa4af', '#7cd0ff', 'system', 'md'),
  ('iMessage claro', 'light', '#f2f2f7', '#e9e9eb', '#007aff', '#8e8e93', '#0a84ff', 'system', 'md'),
  ('Vintage', 'dark', '#2b241c', '#4a3f30', '#c9a35c', '#a08b6a', '#e9c97a', 'mono', 'md')
on conflict (name) do nothing;

insert into app_settings (id, active_skin_id)
select 1, id from skins where name = 'WhatsApp oscuro'
on conflict (id) do update set active_skin_id = excluded.active_skin_id;

-- Storage bucket público para fotos de avatar
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "public read avatars" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "public upload avatars" on storage.objects
  for insert with check (bucket_id = 'avatars');

create policy "public update avatars" on storage.objects
  for update using (bucket_id = 'avatars');
