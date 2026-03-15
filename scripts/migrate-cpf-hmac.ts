/**
 * scripts/migrate-cpf-hmac.ts
 *
 * Migra todos os hashes HMAC de CPF do banco de dados para a nova chave CPF_HMAC_KEY.
 *
 * Contexto:
 *   Antes: hashCpf() usava HMAC-SHA256(CPF_ENCRYPTION_KEY, cpf)  (chave raw)
 *   Depois: hashCpf() usa  HMAC-SHA256(CPF_HMAC_KEY, cpf)         (chave dedicada)
 *
 * O que o script faz:
 *   1. Lê todos os usuários com CPF criptografado na coluna users.cpf
 *   2. Descriptografa cada CPF com AES-256-GCM (chave = SHA256(CPF_ENCRYPTION_KEY))
 *   3. Calcula o hash antigo (HMAC com CPF_ENCRYPTION_KEY raw) e o novo (HMAC com CPF_HMAC_KEY)
 *   4. Atualiza coupon_usage.cpf e orders.customer_cpf onde o hash antigo bater
 *
 * Como executar (uma única vez, antes de fazer deploy do novo código):
 *   CPF_ENCRYPTION_KEY=<valor_atual> \
 *   CPF_HMAC_KEY=<nova_chave_hex32> \
 *   SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
 *   npx ts-node --project tsconfig.json scripts/migrate-cpf-hmac.ts
 */

import { createHmac, createDecipheriv, createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

function getAesKey(): Buffer {
  const raw = process.env.CPF_ENCRYPTION_KEY;
  if (!raw) throw new Error('CPF_ENCRYPTION_KEY não configurada');
  return createHash('sha256').update(raw).digest();
}

function decryptCpf(stored: string): string | null {
  if (!stored.includes(':')) return null;
  const parts = stored.split(':');
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, encHex] = parts;
  try {
    const key = getAesKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const encData = Buffer.from(encHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encData).toString('utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

function oldHmac(cpf: string): string {
  const secret = process.env.CPF_ENCRYPTION_KEY!;
  return createHmac('sha256', secret).update(cpf).digest('hex');
}

function newHmac(cpf: string): string {
  const secret = process.env.CPF_HMAC_KEY!;
  return createHmac('sha256', secret).update(cpf).digest('hex');
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  }
  if (!process.env.CPF_ENCRYPTION_KEY) throw new Error('CPF_ENCRYPTION_KEY não configurada');
  if (!process.env.CPF_HMAC_KEY) throw new Error('CPF_HMAC_KEY não configurada');

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  console.log('Lendo usuários com CPF...');
  const { data: users, error } = await supabase
    .from('users')
    .select('id, cpf')
    .not('cpf', 'is', null);

  if (error) throw error;
  if (!users || users.length === 0) {
    console.log('Nenhum usuário com CPF encontrado. Nada a migrar.');
    return;
  }

  console.log(`Encontrados ${users.length} usuário(s) com CPF.`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    const cpf = decryptCpf(user.cpf as string);
    if (!cpf) {
      console.warn(`  [SKIP] user ${user.id} — não foi possível descriptografar o CPF`);
      skipped++;
      continue;
    }

    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) {
      console.warn(`  [SKIP] user ${user.id} — CPF descriptografado inválido`);
      skipped++;
      continue;
    }

    const oldHash = oldHmac(clean);
    const newHash = newHmac(clean);

    if (oldHash === newHash) {
      console.log(`  [==] user ${user.id} — hashes já iguais (CPF_HMAC_KEY == CPF_ENCRYPTION_KEY?)`);
      skipped++;
      continue;
    }

    // Atualiza coupon_usage
    const { error: couponErr, count: couponCount } = await supabase
      .from('coupon_usage')
      .update({ cpf: newHash })
      .eq('cpf', oldHash);

    if (couponErr) {
      console.error(`  [ERR] coupon_usage user ${user.id}:`, couponErr.message);
      errors++;
    } else {
      console.log(`  [OK] coupon_usage: ${couponCount ?? '?'} linha(s) atualizada(s) para user ${user.id}`);
    }

    // Atualiza orders
    const { error: ordersErr, count: ordersCount } = await supabase
      .from('orders')
      .update({ customer_cpf: newHash })
      .eq('customer_cpf', oldHash);

    if (ordersErr) {
      console.error(`  [ERR] orders user ${user.id}:`, ordersErr.message);
      errors++;
    } else {
      console.log(`  [OK] orders: ${ordersCount ?? '?'} linha(s) atualizada(s) para user ${user.id}`);
    }

    updated++;
  }

  console.log('\n── Resumo ──────────────────────────');
  console.log(`Atualizados: ${updated} usuário(s)`);
  console.log(`Ignorados:   ${skipped}`);
  console.log(`Erros:       ${errors}`);
  console.log('Migração concluída.');
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
