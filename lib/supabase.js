import { createClient } from '@supabase/supabase-js';
import { checkEnv } from './env-check.js';

// Valida variáveis obrigatórias na inicialização (somente server-side)
if (typeof window === 'undefined') checkEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
