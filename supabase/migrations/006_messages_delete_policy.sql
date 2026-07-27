-- Ejecutar en Supabase → SQL Editor (incremental)
--
-- `messages` nunca tuvo policy de delete. El panel /control/contacts
-- borra los mensajes de una conversación al eliminarla o desvincularla
-- (y lo promete en el confirm() al usuario) — sin esto, esa llamada
-- fallaba en silencio y los mensajes quedaban huérfanos.

create policy "public delete" on messages for delete using (true);
