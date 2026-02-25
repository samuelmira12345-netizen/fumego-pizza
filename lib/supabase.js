import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e Anon Key são obrigatórios. Verifique o .env.local');
}

// Cliente público (para o frontend)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin (para API routes - usa service role key)
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY é obrigatório para operações admin');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
