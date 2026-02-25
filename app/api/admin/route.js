import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { password, action } = body;

    if (action === 'auth') {
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (!adminPassword) {
        return NextResponse.json(
          { error: 'ADMIN_PASSWORD não configurado no .env' },
          { status: 500 }
        );
      }

      if (password === adminPassword) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ success: false, error: 'Senha incorreta' }, { status: 401 });
      }
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
