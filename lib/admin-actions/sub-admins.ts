import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SupabaseClient } from '@supabase/supabase-js';

export interface SubAdmin {
  id: string;
  username: string;
  role: 'master' | 'sub';
  allowed_tabs: string[] | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

/** Retorna lista de sub-admins (sem password_hash). Apenas para master. */
export async function handleListSubAdmins(supabase: SupabaseClient): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, username, role, allowed_tabs, is_active, created_at, last_login_at')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subAdmins: data ?? [] });
}

/** Cria um novo sub-admin. Apenas para master. */
export async function handleCreateSubAdmin(
  supabase: SupabaseClient,
  data: Record<string, unknown>
): Promise<NextResponse> {
  const { username, password, allowedTabs } = data as {
    username: string;
    password: string;
    allowedTabs: string[];
  };

  if (!username || !password) {
    return NextResponse.json({ error: 'username e password são obrigatórios' }, { status: 400 });
  }

  if (username.trim().toLowerCase() === 'master') {
    return NextResponse.json({ error: 'Username "master" é reservado' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data: created, error } = await supabase
    .from('admin_users')
    .insert({
      username: username.trim(),
      password_hash: passwordHash,
      role: 'sub',
      allowed_tabs: allowedTabs ?? [],
      is_active: true,
    })
    .select('id, username, role, allowed_tabs, is_active, created_at, last_login_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username já existe' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subAdmin: created });
}

/** Atualiza abas e/ou senha de um sub-admin. Apenas para master. */
export async function handleUpdateSubAdmin(
  supabase: SupabaseClient,
  data: Record<string, unknown>
): Promise<NextResponse> {
  const { id, allowedTabs, password } = data as {
    id: string;
    allowedTabs?: string[];
    password?: string;
  };

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (allowedTabs !== undefined) updates.allowed_tabs = allowedTabs;
  if (password) updates.password_hash = await bcrypt.hash(password, 12);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('admin_users')
    .update(updates)
    .eq('id', id)
    .select('id, username, role, allowed_tabs, is_active, created_at, last_login_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subAdmin: updated });
}

/** Desativa (soft delete) um sub-admin. Apenas para master. */
export async function handleDeactivateSubAdmin(
  supabase: SupabaseClient,
  data: Record<string, unknown>
): Promise<NextResponse> {
  const { id } = data as { id: string };

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const { error } = await supabase
    .from('admin_users')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** Reativa um sub-admin desativado. Apenas para master. */
export async function handleReactivateSubAdmin(
  supabase: SupabaseClient,
  data: Record<string, unknown>
): Promise<NextResponse> {
  const { id } = data as { id: string };

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const { error } = await supabase
    .from('admin_users')
    .update({ is_active: true })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
