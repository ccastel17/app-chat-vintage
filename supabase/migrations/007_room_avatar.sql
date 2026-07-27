-- Ejecutar en Supabase → SQL Editor (incremental)
--
-- Foto del actor (persona), a nivel dispositivo — antes solo existía
-- avatar por conversación (contacto simulado o cómo lo ve el otro lado de
-- un link). Sirve como valor por default al crear un nuevo link con otro
-- actor (cada lado lo puede sobreescribir después desde /control/contacts).

alter table rooms add column if not exists avatar_url text;
