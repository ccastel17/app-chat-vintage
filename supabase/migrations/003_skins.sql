-- Ejecutar en Supabase → SQL Editor (incremental)

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

-- Avatar del contacto simulado (identidad del actor, no del skin)
alter table rooms add column if not exists avatar_url text;

-- 3 skins base para arrancar
insert into skins (name, mode, bg, bubble_incoming_bg, bubble_outgoing_bg, tick_color, tick_seen_color, font_family, font_size)
values
  ('WhatsApp oscuro', 'dark', '#0b0f14', '#1f242b', '#2f6fed', '#9aa4af', '#7cd0ff', 'system', 'md'),
  ('iMessage claro', 'light', '#f2f2f7', '#e9e9eb', '#007aff', '#8e8e93', '#0a84ff', 'system', 'md'),
  ('Vintage', 'dark', '#2b241c', '#4a3f30', '#c9a35c', '#a08b6a', '#e9c97a', 'mono', 'md')
on conflict (name) do nothing;

-- Activar "WhatsApp oscuro" (el look que ya tenía la app) por default
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
