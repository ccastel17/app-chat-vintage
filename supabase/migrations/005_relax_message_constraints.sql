-- Ejecutar en Supabase → SQL Editor (incremental)
--
-- La tabla `messages` original tenía room_id/sender/direction como NOT
-- NULL (de antes de introducir conversations + thread_id). El código
-- nuevo ya no manda esas columnas en cada insert (o manda direction=null
-- en threads 'linked', donde no aplica) — sin este fix, cada insert
-- fallaba silenciosamente por violar esas restricciones.

alter table messages alter column room_id drop not null;
alter table messages alter column sender drop not null;
alter table messages alter column direction drop not null;
alter table messages alter column direction drop default;
