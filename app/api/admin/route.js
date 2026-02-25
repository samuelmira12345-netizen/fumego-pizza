import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { password, action } = await request.json();
    if (action === 'auth') {
      const adminPwd = process.env.ADMIN_PASSWORD;
      if (!adminPwd) return NextResponse.json({ error: 'ADMIN_PASSWORD não configurado' }, { status: 500 });
      return NextResponse.json({ success: password === adminPwd });
    }
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
