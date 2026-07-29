// Cliente único de Supabase, compartido por /device y /control.
// La publishable key está pensada para exponerse en el navegador (no es
// secreta) siempre que las tablas tengan RLS, que es el caso de `messages`
// (ver supabase/schema.sql).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://otpjpbcfhroxywytjtsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Oz703WRArHyIUzceVTS6Hw_ii1dkUPJ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Canal de presencia global: cada /device/[roomId] se anuncia acá al
// abrirse, y /control lo escucha para armar la lista de dispositivos sin
// necesidad de una tabla aparte.
export const DEVICES_PRESENCE_CHANNEL = "presence:devices";

// Canal por dispositivo (no por thread) para el banner de notificación
// simulada — tanto /device (lista) como /device/chat (cualquier chat que
// tengan abierto) lo escuchan, porque una notificación puede ser de una
// conversación distinta a la que están mirando en ese momento.
export function notificationsChannelName(roomId) {
  return `notifications:${roomId}`;
}
