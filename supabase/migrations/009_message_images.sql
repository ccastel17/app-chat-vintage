-- Fotos en los chats: mensajes con imagen además de (u opcional en vez de) texto
alter table messages add column if not exists image_url text;

-- Bucket separado del de avatars, mismas policies públicas
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

create policy "public read chat-images" on storage.objects
  for select using (bucket_id = 'chat-images');

create policy "public upload chat-images" on storage.objects
  for insert with check (bucket_id = 'chat-images');

create policy "public update chat-images" on storage.objects
  for update using (bucket_id = 'chat-images');
