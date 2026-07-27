-- Ejecutar en Supabase → SQL Editor (incremental)
--
-- `rooms` nunca tuvo policy de delete (a diferencia de conversations,
-- messages y skins). Hace falta para poder borrar dispositivos huérfanos
-- (ej. los slugs viejos que quedaron duplicados al migrar a slugs
-- prolijos) y en el futuro para un botón de "eliminar dispositivo" en la UI.

create policy "public delete" on rooms for delete using (true);
