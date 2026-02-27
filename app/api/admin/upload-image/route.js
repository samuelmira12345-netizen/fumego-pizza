import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../../lib/supabase';

// MIME types permitidos para imagens
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function verifyAdminToken(request) {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const decoded = jwt.verify(token, secret);
    return decoded.role === 'admin';
  } catch { return false; }
}

export async function POST(request) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file   = formData.get('file');
    const prefix = formData.get('prefix') || 'upload'; // 'product-<id>' ou 'logo'

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
    }

    // Validar MIME type pelo conteúdo real do arquivo (bytes de assinatura)
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detectedMime = detectMimeType(bytes);

    if (!ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return NextResponse.json(
        { error: `Tipo de arquivo não permitido. Use: JPEG, PNG, WebP ou GIF.` },
        { status: 400 }
      );
    }

    // Validar também o MIME type declarado pelo browser (dupla verificação)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido.' },
        { status: 400 }
      );
    }

    // Validar tamanho
    if (bytes.length > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Tamanho máximo: 5 MB.' },
        { status: 400 }
      );
    }

    const ext = mimeToExt(detectedMime);
    const fileName = `${prefix}-${Date.now()}.${ext}`;

    const supabase = getSupabaseAdmin(); // Service role — bypassa RLS
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, bytes, {
        contentType: detectedMime,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // Opcional: salva a URL direto no banco para evitar round-trip extra no frontend
    const saveAs    = formData.get('saveAs');
    const productId = formData.get('productId');
    if (saveAs === 'product_image' && productId) {
      await supabase.from('products').update({ image_url: imageUrl }).eq('id', productId);
    } else if (saveAs === 'logo') {
      await supabase.from('settings').upsert({ key: 'logo_url', value: imageUrl }, { onConflict: 'key' });
    }

    return NextResponse.json({ url: imageUrl, fileName });
  } catch (e) {
    console.error('Upload error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * Detecta o MIME type real verificando os bytes de assinatura (magic numbers).
 * Impede que um arquivo malicioso seja renomeado com extensão de imagem.
 */
function detectMimeType(bytes) {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return 'application/octet-stream';
}

function mimeToExt(mime) {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  return map[mime] || 'bin';
}
