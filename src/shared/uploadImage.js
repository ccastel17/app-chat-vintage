// Subida de fotos enviadas dentro de un chat (bucket separado del de
// avatars: estas son adjuntos de mensajes, no fotos de perfil).
export async function uploadChatImage(supabase, threadId, file) {
  const ext = file.name.split(".").pop();
  const path = `${threadId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("chat-images").upload(path, file);
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
  return data.publicUrl;
}

// Fondo de la pantalla de inicio simulada — se persiste por dispositivo
// (rooms.home_screen_bg_url), igual que el avatar del actor, para no
// tener que resubirlo cada vez que el director la activa.
export async function uploadHomeScreenBackground(supabase, roomId, file) {
  const ext = file.name.split(".").pop();
  const path = `room-${roomId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("home-screens").upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("home-screens").getPublicUrl(path);
  return data.publicUrl;
}
