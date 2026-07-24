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
