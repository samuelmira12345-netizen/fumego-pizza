/**
 * POST /api/admin/migrate-cpf-hmac
 *
 * Rota temporária de migração — re-hasheia coupon_usage.cpf e orders.customer_cpf
 * do HMAC antigo (chave = CPF_ENCRYPTION_KEY raw) para o HMAC novo (chave = CPF_HMAC_KEY).
 *
 * REMOVA ESTA ROTA APÓS EXECUTAR A MIGRAÇÃO COM SUCESSO.
 *
 * Acesso restrito a administradores master via cookie/header de sessão admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createHmac, createDecipheriv, createHash } from 'crypto';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { logger } from '../../../../lib/logger';

function verifyAdminMaster(request: NextRequest): boolean {
  try {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) return false;

    const cookieToken = request.cookies.get('admin_session')?.value;
    const authHeader  = request.headers.get('authorization') || '';
    const headerToken = authHeader.replace('Bearer ', '').trim();
    const token       = cookieToken || headerToken;
    if (!token) return false;

    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    return decoded.role === 'master';
  } catch {
    return false;
  }
}

function getAesKey(): Buffer {
  const raw = process.env.CPF_ENCRYPTION_KEY;
  if (!raw) throw new Error('CPF_ENCRYPTION_KEY não configurada');
  return createHash('sha256').update(raw).digest();
}

function decryptCpfLocal(stored: string): string | null {
  if (!stored.includes(':')) return null;
  const parts = stored.split(':');
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, encHex] = parts;
  try {
    const key     = getAesKey();
    const iv      = Buffer.from(ivHex, 'hex');
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminMaster(request)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  if (!process.env.CPF_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'CPF_ENCRYPTION_KEY não configurada' }, { status: 500 });
  }
  if (!process.env.CPF_HMAC_KEY) {
    return NextResponse.json({ error: 'CPF_HMAC_KEY não configurada — adicione no Vercel antes de executar' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const log: string[] = [];
  let updated = 0;
  let skipped = 0;
  let errors  = 0;

  try {
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, cpf')
      .not('cpf', 'is', null);

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'Nenhum usuário com CPF. Nada a migrar.', log });
    }

    log.push(`Encontrados ${users.length} usuário(s) com CPF.`);

    for (const user of users) {
      const cpf = decryptCpfLocal(user.cpf as string);
      if (!cpf) {
        log.push(`[SKIP] user ${user.id} — CPF não descriptografável`);
        skipped++;
        continue;
      }

      const clean = cpf.replace(/\D/g, '');
      if (clean.length !== 11) {
        log.push(`[SKIP] user ${user.id} — CPF inválido após decrypt`);
        skipped++;
        continue;
      }

      const oldHash = oldHmac(clean);
      const newHash = newHmac(clean);

      if (oldHash === newHash) {
        log.push(`[==] user ${user.id} — hashes já iguais, ignorado`);
        skipped++;
        continue;
      }

      // coupon_usage
      const { error: couponErr } = await supabase
        .from('coupon_usage')
        .update({ cpf: newHash })
        .eq('cpf', oldHash);

      if (couponErr) {
        log.push(`[ERR] coupon_usage user ${user.id}: ${couponErr.message}`);
        errors++;
      }

      // orders
      const { error: ordersErr } = await supabase
        .from('orders')
        .update({ customer_cpf: newHash })
        .eq('customer_cpf', oldHash);

      if (ordersErr) {
        log.push(`[ERR] orders user ${user.id}: ${ordersErr.message}`);
        errors++;
      }

      if (!couponErr && !ordersErr) {
        log.push(`[OK] user ${user.id} — hash atualizado`);
        updated++;
      }
    }

    logger.info('[migrate-cpf-hmac] Migração concluída', { updated, skipped, errors });

    return NextResponse.json({
      message: 'Migração concluída',
      summary: { updated, skipped, errors },
      log,
    });
  } catch (e) {
    logger.error('[migrate-cpf-hmac] Erro fatal', { error: (e as Error).message });
    return NextResponse.json({ error: (e as Error).message, log }, { status: 500 });
  }
}
