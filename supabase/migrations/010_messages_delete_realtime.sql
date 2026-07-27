-- Para que el borrado de mensajes se refleje en vivo en /device y /control:
-- por default Postgres solo manda la primary key en el "old record" de un
-- delete, y el filtro por thread_id de los canales Realtime necesita ese
-- campo para decidir a quién le llega el evento.
alter table messages replica identity full;
