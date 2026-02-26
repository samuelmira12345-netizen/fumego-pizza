'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState('products');
  const [data, setData] = useState({ products: [], drinks: [], coupons: [], settings: [], orders: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploadingId, setUploadingId] = useState(null);

  async function handleLogin() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'get_data' }),
      });
      const d = await res.json();
      if (d.error) { alert(d.error); return; }
      setData(d);
      setAuthenticated(true);
    } catch (e) { alert('Erro de conexão'); }
    finally { setLoading(false); }
  }

  async function saveAll() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password, action: 'save_all',
          data: { products: data.products, drinks: data.drinks, settings: data.settings },
        }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ Erro: ' + d.error); return; }
      setMsg('✅ Salvo com sucesso!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('❌ Erro ao salvar'); }
    finally { setSaving(false); }
  }

  function updateProduct(idx, field, value) {
    setData(prev => {
      const p = [...prev.products];
      p[idx] = { ...p[idx], [field]: value };
      return { ...prev, products: p };
    });
  }

  function updateDrink(idx, field, value) {
    setData(prev => {
      const d = [...prev.drinks];
      d[idx] = { ...d[idx], [field]: value };
      return { ...prev, drinks: d };
    });
  }

  function updateSetting(key, value) {
    setData(prev => {
      const s = [...prev.settings];
      const idx = s.findIndex(i => i.key === key);
      if (idx >= 0) s[idx] = { ...s[idx], value };
      else s.push({ key, value });
      return { ...prev, settings: s };
    });
  }

  function getSetting(key) {
    return data.settings.find(s => s.key === key)?.value || '';
  }

  // ===== UPLOAD DE FOTO - CORRIGIDO =====
  async function handleImageUpload(productIdx, file) {
    const product = data.products[productIdx];
    if (!file || !product) return;

    setUploadingId(product.id);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const fileName = `product-${product.id}-${Date.now()}.${ext}`;

      // Upload para Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert(`Erro no upload: ${uploadError.message}\n\nVerifique se o bucket 'product-images' existe no Supabase Storage.`);
        return;
      }

      // Pegar URL pública
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      // ATUALIZAR NO BANCO DIRETAMENTE (sem depender do botão Salvar)
      const { error: dbError } = await supabase
        .from('products')
        .update({ image_url: imageUrl })
        .eq('id', product.id);

      if (dbError) {
        console.error('DB update error:', dbError);
        alert(`Foto enviada mas erro ao salvar URL no banco: ${dbError.message}`);
        return;
      }

      // Atualizar estado local
      updateProduct(productIdx, 'image_url', imageUrl);
      alert('✅ Foto enviada e salva com sucesso!');
    } catch (e) {
      console.error('Upload exception:', e);
      alert('Erro ao enviar foto: ' + e.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function updateOrderStatus(orderId, field, value) {
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'update_order', data: { id: orderId, [field]: value } }),
      });
      setData(prev => ({
        ...prev,
        orders: prev.orders.map(o => o.id === orderId ? { ...o, [field]: value } : o),
      }));
    } catch (e) { alert('Erro ao atualizar'); }
  }

  // LOGIN
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🔥</div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 'bold', color: '#D4A528', margin: '12px 0' }}>Admin FUMÊGO</h1>
          <input className="input-field" type="password" placeholder="Senha do admin" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ marginBottom: 12 }} />
          <button className="btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A' }}>
      {/* Header */}
      <header style={{ background: '#1A1A1A', padding: '12px 16px', borderBottom: '1px solid #333', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 18, fontWeight: 'bold', color: '#D4A528' }}>🔥 Admin FUMÊGO</h1>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #333', overflowX: 'auto' }}>
        {['products', 'drinks', 'settings', 'orders'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 16px', background: tab === t ? '#D4A528' : 'transparent', color: tab === t ? '#000' : '#888',
              border: 'none', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t === 'products' ? '🍕 Produtos' : t === 'drinks' ? '🥤 Bebidas' : t === 'settings' ? '⚙️ Config' : '📦 Pedidos'}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px', paddingBottom: 80 }}>
        {/* PRODUTOS */}
        {tab === 'products' && data.products.map((p, idx) => (
          <div key={p.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', fontSize: 16 }}>{p.name}</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={p.is_active} onChange={e => updateProduct(idx, 'is_active', e.target.checked)} />
                <span style={{ fontSize: 12, color: p.is_active ? '#48BB78' : '#E53E3E' }}>{p.is_active ? 'Ativo' : 'Inativo'}</span>
              </label>
            </div>

            {/* Foto atual */}
            {p.image_url && (
              <div style={{ marginBottom: 10 }}>
                <img src={p.image_url} alt={p.name} style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />
              </div>
            )}

            {/* Upload de foto */}
            <div style={{ marginBottom: 10 }}>
              <label style={{
                display: 'inline-block', padding: '8px 16px', background: '#444', color: '#fff', borderRadius: 8,
                fontSize: 13, cursor: 'pointer', opacity: uploadingId === p.id ? 0.5 : 1,
              }}>
                {uploadingId === p.id ? '⏳ Enviando...' : '📤 Enviar foto'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) handleImageUpload(idx, e.target.files[0]); }}
                  disabled={uploadingId === p.id} />
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input className="input-field" placeholder="Descrição" value={p.description || ''}
                onChange={e => updateProduct(idx, 'description', e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="input-field" placeholder="Preço" type="number" step="0.01" value={p.price || ''}
                  onChange={e => updateProduct(idx, 'price', e.target.value)} />
                <input className="input-field" placeholder="Ordem" type="number" value={p.sort_order || ''}
                  onChange={e => updateProduct(idx, 'sort_order', parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        ))}

        {/* BEBIDAS */}
        {tab === 'drinks' && data.drinks.map((d, idx) => (
          <div key={d.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold' }}>{d.name} {d.size}</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={d.is_active} onChange={e => updateDrink(idx, 'is_active', e.target.checked)} />
                <span style={{ fontSize: 12, color: d.is_active ? '#48BB78' : '#E53E3E' }}>{d.is_active ? 'Ativo' : 'Inativo'}</span>
              </label>
            </div>
            <input className="input-field" placeholder="Preço" type="number" step="0.01" value={d.price || ''}
              onChange={e => updateDrink(idx, 'price', e.target.value)} />
          </div>
        ))}

        {/* CONFIG */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, border: '1px solid #444' }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 10 }}>Loja</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <input type="checkbox" checked={getSetting('store_open') === 'true'}
                  onChange={e => updateSetting('store_open', e.target.checked ? 'true' : 'false')} />
                <span style={{ color: '#fff', fontSize: 14 }}>Loja aberta</span>
              </label>
              <input className="input-field" placeholder="Tempo de entrega (ex: 40-60 min)" value={getSetting('delivery_time')}
                onChange={e => updateSetting('delivery_time', e.target.value)} style={{ marginBottom: 8 }} />
              <input className="input-field" placeholder="Taxa de entrega" type="number" step="0.01" value={getSetting('delivery_fee')}
                onChange={e => updateSetting('delivery_fee', e.target.value)} />
            </div>
            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, border: '1px solid #444' }}>
              <h3 style={{ color: '#D4A528', fontWeight: 'bold', marginBottom: 10 }}>Especial do Mês</h3>
              <input className="input-field" placeholder="Nome do sabor especial" value={getSetting('special_flavor_name')}
                onChange={e => updateSetting('special_flavor_name', e.target.value)} style={{ marginBottom: 8 }} />
              <textarea className="input-field" placeholder="Descrição do sabor especial" value={getSetting('special_flavor_description')}
                onChange={e => updateSetting('special_flavor_description', e.target.value)} rows="3" style={{ resize: 'none' }} />
            </div>
          </div>
        )}

        {/* PEDIDOS */}
        {tab === 'orders' && data.orders.map(o => (
          <div key={o.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#D4A528', fontWeight: 'bold' }}>#{o.order_number}</span>
              <span style={{ color: '#888', fontSize: 12 }}>{new Date(o.created_at).toLocaleString('pt-BR')}</span>
            </div>
            <p style={{ color: '#fff', fontSize: 14 }}>{o.customer_name} - {o.customer_phone}</p>
            <p style={{ color: '#aaa', fontSize: 12 }}>{o.delivery_street}, {o.delivery_number} - {o.delivery_neighborhood}</p>
            <p style={{ color: '#D4A528', fontWeight: 'bold', marginTop: 6 }}>R$ {Number(o.total).toFixed(2).replace('.', ',')}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <select value={o.status} onChange={e => updateOrderStatus(o.id, 'status', e.target.value)}
                style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                <option value="pending">Pendente</option>
                <option value="confirmed">Confirmado</option>
                <option value="preparing">Preparando</option>
                <option value="delivering">Entregando</option>
                <option value="delivered">Entregue</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <select value={o.payment_status} onChange={e => updateOrderStatus(o.id, 'payment_status', e.target.value)}
                style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                <option value="pending">Pag. Pendente</option>
                <option value="approved">Pag. Aprovado</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* BOTÃO SALVAR FIXO */}
      {tab !== 'orders' && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '12px 16px', background: '#2D2D2D', borderTop: '2px solid #D4A528', zIndex: 40 }}>
          {msg && <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 6, color: msg.includes('✅') ? '#48BB78' : '#E53E3E' }}>{msg}</p>}
          <button className="btn-primary" onClick={saveAll} disabled={saving}>
            {saving ? '⏳ Salvando...' : '💾 Salvar Tudo'}
          </button>
        </div>
      )}
    </div>
  );
}
