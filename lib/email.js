/**
 * lib/email.js — Envio de e-mails transacionais via Resend.
 *
 * Configurar nas variáveis de ambiente:
 *   RESEND_API_KEY  — chave da API Resend (re_xxxxxxxx)
 *   EMAIL_FROM      — remetente verificado (ex: "FUMÊGO Pizza <noreply@seudominio.com.br>")
 *   NEXT_PUBLIC_APP_URL — URL base do app (ex: https://fumego.com.br)
 */

const RESEND_API = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY ou EMAIL_FROM não configurados — e-mail não enviado');
    return { ok: false, error: 'E-mail não configurado' };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[email] Erro Resend:', data);
      return { ok: false, error: data.message || 'Erro ao enviar e-mail' };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error('[email] Exceção:', e);
    return { ok: false, error: e.message };
  }
}

export async function sendVerificationEmail(to, name, verifyUrl) {
  return sendEmail({
    to,
    subject: 'FUMÊGO — Confirme seu e-mail',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#1A1A1A;color:#fff;padding:32px;border-radius:12px;">
        <h1 style="font-family:Georgia,serif;color:#D4A528;margin-bottom:8px;">FUMÊGO Pizza</h1>
        <p style="color:#ccc;">Olá, ${name}! Confirme seu endereço de e-mail para ativar sua conta.</p>
        <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#D4A528;color:#000;font-weight:bold;text-decoration:none;border-radius:8px;">
          Confirmar E-mail
        </a>
        <p style="color:#666;font-size:12px;">Link válido por 24 horas. Se você não se cadastrou, ignore este e-mail.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to, name, resetUrl) {
  return sendEmail({
    to,
    subject: 'FUMÊGO — Redefinição de senha',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#1A1A1A;color:#fff;padding:32px;border-radius:12px;">
        <h1 style="font-family:Georgia,serif;color:#D4A528;margin-bottom:8px;">FUMÊGO Pizza</h1>
        <p style="color:#ccc;">Olá, ${name}! Recebemos um pedido de redefinição de senha.</p>
        <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#D4A528;color:#000;font-weight:bold;text-decoration:none;border-radius:8px;">
          Redefinir Senha
        </a>
        <p style="color:#666;font-size:12px;">Link válido por 1 hora. Se você não solicitou a troca, ignore este e-mail.</p>
      </div>
    `,
  });
}

export async function sendOrderConfirmationEmail(to, name, orderNumber, total, items, estimatedTime) {
  const itemsHtml = items.map(i =>
    `<tr>
      <td style="padding:6px 0;color:#ccc;">${i.product_name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}</td>
      <td style="padding:6px 0;color:#D4A528;text-align:right;">R$ ${Number(i.total_price).toFixed(2).replace('.', ',')}</td>
    </tr>`
  ).join('');

  return sendEmail({
    to,
    subject: `FUMÊGO — Pedido #${orderNumber} confirmado!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#1A1A1A;color:#fff;padding:32px;border-radius:12px;">
        <h1 style="font-family:Georgia,serif;color:#D4A528;margin-bottom:4px;">FUMÊGO Pizza</h1>
        <h2 style="color:#fff;font-size:18px;margin-bottom:24px;">Pedido #${orderNumber} confirmado!</h2>
        <p style="color:#ccc;margin-bottom:24px;">Olá, ${name}! Seu pedido está sendo preparado com carinho. 🍕</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          ${itemsHtml}
          <tr style="border-top:1px solid #444;">
            <td style="padding:10px 0;color:#fff;font-weight:bold;">Total</td>
            <td style="padding:10px 0;color:#D4A528;font-weight:bold;text-align:right;font-size:18px;">
              R$ ${Number(total).toFixed(2).replace('.', ',')}
            </td>
          </tr>
        </table>
        ${estimatedTime ? `<p style="color:#888;font-size:13px;">⏱️ Previsão de entrega: ${estimatedTime}</p>` : ''}
        <p style="color:#666;font-size:12px;margin-top:24px;">Obrigado por escolher a FUMÊGO!</p>
      </div>
    `,
  });
}
