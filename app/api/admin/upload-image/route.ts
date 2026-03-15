import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { logger } from '../../../../lib/logger';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function verifyAdminToken(request: NextRequest): boolean {
  const auth   = request.headers.get('authorization') || '';
  const token  = auth.replace('Bearer ', '').trim();
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    return decoded.role === 'admin';
  } catch { return false; }
}

function detectMimeType(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return 'application/octet-stream';
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  return map[mime] || 'bin';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file   = formData.get('file');
    const prefix = formData.get('prefix') || 'upload';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
    }

    const arrayBuffer = await (file as File).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detectedMime = detectMimeType(bytes);

    if (!ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use: JPEG, PNG, WebP ou GIF.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes((file as File).type)) {
      return NextResponse.json({ error: 'Tipo de arquivo inválido.' }, { status: 400 });
    }

    if (bytes.length > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Tamanho máximo: 5 MB.' },
        { status: 400 }
      );
    }

    const ext = mimeToExt(detectedMime);
    const fileName = `${prefix}-${Date.now()}.${ext}`;

    const supabase = getSupabaseAdmin();
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

    const saveAs    = formData.get('saveAs');
    const productId = formData.get('productId');
    if (saveAs === 'product_image' && productId) {
      await supabase.from('products').update({ image_url: imageUrl }).eq('id', productId);
    } else if (saveAs === 'logo') {
      await supabase.from('settings').upsert({ key: 'logo_url', value: imageUrl }, { onConflict: 'key' });
    }

    return NextResponse.json({ url: imageUrl, fileName });
  } catch (e) {
    logger.error('Upload error', e as Error);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
