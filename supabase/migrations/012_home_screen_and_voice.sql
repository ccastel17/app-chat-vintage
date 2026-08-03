-- Pantalla de inicio simulada: fondo persistido por dispositivo (como
-- rooms.avatar_url), para no tener que resubirlo cada vez que se activa
alter table rooms add column if not exists home_screen_bg_url text;

-- Bucket separado de avatars/chat-images, mismas policies públicas
insert into storage.buckets (id, name, public)
values ('home-screens', 'home-screens', true)
on conflict (id) do nothing;

create policy "public read home-screens" on storage.objects
  for select using (bucket_id = 'home-screens');

create policy "public upload home-screens" on storage.objects
  for insert with check (bucket_id = 'home-screens');

create policy "public update home-screens" on storage.objects
  for update using (bucket_id = 'home-screens');

-- Nota de voz simulada: sin audio real (ver src/shared/uploadImage.js /
-- criterio del proyecto de no usar audio), content queda '' y se renderiza
-- como burbuja de audio con una duración inventada
alter table messages add column if not exists is_voice boolean not null default false;
alter table messages add column if not exists voice_duration integer;
