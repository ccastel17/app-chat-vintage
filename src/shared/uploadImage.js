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
