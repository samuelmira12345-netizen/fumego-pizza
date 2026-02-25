'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [auth, setAuth] = useState(false);
  const [pwd, setPwd] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [uploading, setUploading] = useState({});

  useEffect(() => {
    if (localStorage.getItem('fumego_admin')) { setAuth(true); loadAll(); }
  }, []);

  async function handleAuth(e) {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd, action: 'auth' }) });
      const d = await r.json();
      if (d.success) { setAuth(true); localStorage.setItem('fumego_admin', 'true'); loadAll(); }
      else setAuthErr('Senha incorreta');
    } catch (e) { setAuthErr('Erro de conexão'); }
  }

  async function loadAll() {
    const [pR, dR, oR, sR] = await Promise.all([
      supabase.from('products').select('*').order('display_order'),
      supabase.from('drinks').select('*').order('display_order'),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('settings').select('*'),
    ]);
    if (pR.data) setProducts(pR.data);
    if (dR.data) setDrinks(dR.data);
    if (oR.data) setOrders(oR.data);
    if (sR.data) { const s = {}; sR.data.forEach(i => { s[i.key] = i.value; }); setSettings(s); }
  }

  function toggleProduct(id) { setProducts(p => p.map(x => x.id === id ? { ...x, is_active: !x.is_active } : x)); setHasChanges(true); }
  function toggleDrink(id) { setDrinks(p => p.map(x => x.id === id ? { ...x, is_active: !x.is_active } : x)); setHasChanges(true); }
  function updateProduct(id, field, val) { setProducts(p => p.map(x => x.id === id ? { ...x, [field]: val } : x)); setHasChanges(true); }
  function updateDrinkPrice(id, val) { setDrinks(p => p.map(x => x.id === id ? { ...x, price: parseFloat(val) || 0 } : x)); setHasChanges(true); }
  function updateSetting(k, v) { setSettings(p => ({ ...p, [k]: v })); setHasChanges(true); }

  // ===== UPLOAD DE IMAGEM =====
  async function handleImageUpload(productId, file) {
    if (!file) return;
    setUploading(p => ({ ...p, [productId]: true }));
    try {
      const ext = file.name.split('.').pop();
      const fileName = `product-${productId}-${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // Atualizar produto localmente
      setProducts(p => p.map(x => x.id === productId ? { ...x, image_url: publicUrl } : x));

      // Salvar no banco imediatamente
      await supabase.from('products').update({ image_url: publicUrl }).eq('id', productId);

      setSaveMsg('✅ Imagem enviada!');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e) {
      console.error('Upload error:', e);
      alert('Erro ao enviar imagem. Verifique se o bucket "product-images" existe no Supabase.');
    } finally {
      setUploading(p => ({ ...p, [productId]: false }));
    }
  }

  async function handleSaveAll() {
    setSaving(true); setSaveMsg('');
    try {
      for (const p of products) {
        await supabase.from('products').update({ is_active: p.is_active, price: p.price, description: p.description }).eq('id', p.id);
      }
      for (const d of drinks) {
        await supabase.from('drinks').update({ is_active: d.is_active, price: d.price }).eq('id', d.id);
      }
      for (const [k, v] of Object.entries(settings)) {
        await supabase.from('settings').upsert({ key: k, value: String(v), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
      setSaveMsg('✅ Salvo!'); setHasChanges(false);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg('❌ Erro ao salvar'); console.error(e);
    } finally { setSaving(false); }
  }

  async function updateOrderStatus(id, status) {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setOrders(p => p.map(o => o.id === id ? { ...o, status } : o));
  }

  // ===== LOGIN =====
  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ maxWidth: 340, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48 }}>🔐</div>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 'bold', color: '#D4A528', marginTop: 12 }}>Admin FUMÊGO</h1>
          </div>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input className="input-field" type="password" placeholder="Senha admin" value={pwd} onChange={e => setPwd(e.target.value)} />
            {authErr && <p style={{ color: '#E53E3E', fontSize: 13 }}>{authErr}</p>}
            <button className="btn-primary">Entrar</button>
          </form>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', marginTop: 12, display: 'block', margin: '12px auto 0' }}>← Voltar</button>
        </div>
      </div>
    );
  }

  // ===== PAINEL =====
  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', paddingBottom: 80 }}>
      {/* Header */}
      <header className="header">
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 'bold', color: '#D4A528' }}>🔐 Admin FUMÊGO</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }}>Cardápio</button>
          <button onClick={() => { localStorage.removeItem('fumego_admin'); setAuth(false); }} style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer' }}>Sair</button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto' }}>
        {[{ k: 'products', l: '🍕 Produtos' }, { k: 'drinks', l: '🥤 Bebidas' }, { k: 'orders', l: '📦 Pedidos' }, { k: 'settings', l: '⚙️ Config' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', border: 'none', transition: 'all 0.2s',
              background: tab === t.k ? '#D4A528' : '#2D2D2D', color: tab === t.k ? '#1A1A1A' : '#999',
            }}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* PRODUTOS */}
        {tab === 'products' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#D4A528' }}>Produtos</h2>
            {products.map(p => (
              <div key={p.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 14, border: '1px solid #444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 'bold', color: '#fff', fontSize: 15 }}>{p.name}</span>
                    {p.is_special && <span style={{ fontSize: 10, background: 'rgba(212,165,40,0.2)', color: '#D4A528', padding: '2px 8px', borderRadius: 4 }}>Especial</span>}
                  </div>
                  <button onClick={() => toggleProduct(p.id)} className={`admin-toggle ${p.is_active ? 'active' : ''}`} />
                </div>

                {/* Upload de imagem */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Foto do produto:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '1px solid #555' }} />
                    ) : (
                      <div style={{ width: 60, height: 60, borderRadius: 8, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
                    )}
                    <label style={{
                      padding: '6px 14px', background: '#444', color: '#ddd', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #666',
                    }}>
                      {uploading[p.id] ? '⏳ Enviando...' : '📤 Enviar foto'}
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => handleImageUpload(p.id, e.target.files[0])} disabled={uploading[p.id]} />
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Preço (R$)</label>
                    <input className="input-field" type="number" step="0.01" value={p.price} onChange={e => updateProduct(p.id, 'price', parseFloat(e.target.value) || 0)} style={{ fontSize: 14, padding: '8px 10px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Descrição</label>
                    <input className="input-field" value={p.description || ''} onChange={e => updateProduct(p.id, 'description', e.target.value)} style={{ fontSize: 14, padding: '8px 10px' }} />
                  </div>
                </div>
                <p style={{ marginTop: 6, fontSize: 11, color: p.is_active ? '#48BB78' : '#E53E3E' }}>
                  {p.is_active ? '🟢 Ativo no cardápio' : '🔴 Oculto do cardápio'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* BEBIDAS */}
        {tab === 'drinks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#D4A528' }}>Bebidas</h2>
            {drinks.map(d => (
              <div key={d.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 14, border: '1px solid #444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 'bold', color: '#fff' }}>{d.name} ({d.size})</span>
                  <button onClick={() => toggleDrink(d.id)} className={`admin-toggle ${d.is_active ? 'active' : ''}`} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Preço (R$)</label>
                  <input className="input-field" type="number" step="0.01" value={d.price} onChange={e => updateDrinkPrice(d.id, e.target.value)} style={{ fontSize: 14, padding: '8px 10px' }} />
                </div>
                <p style={{ marginTop: 6, fontSize: 11, color: d.is_active ? '#48BB78' : '#E53E3E' }}>{d.is_active ? '🟢 Ativo' : '🔴 Oculto'}</p>
              </div>
            ))}
          </div>
        )}

        {/* PEDIDOS */}
        {tab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#D4A528' }}>Pedidos</h2>
              <button onClick={loadAll} style={{ background: 'none', border: 'none', color: '#D4A528', fontSize: 12, cursor: 'pointer' }}>🔄 Atualizar</button>
            </div>
            {orders.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>Nenhum pedido</p>
            ) : orders.map(o => (
              <div key={o.id} style={{ background: '#2D2D2D', borderRadius: 12, padding: 14, border: '1px solid #444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 'bold', color: '#fff' }}>Pedido #{o.order_number}</span>
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 12,
                    background: o.status === 'pending' ? '#7c6e2f33' : o.status === 'confirmed' ? '#2d6a4f33' : o.status === 'preparing' ? '#9c4a1e33' : o.status === 'delivering' ? '#553c9a33' : o.status === 'delivered' ? '#22543d33' : '#742a2a33',
                    color: o.status === 'pending' ? '#F6E05E' : o.status === 'confirmed' ? '#68D391' : o.status === 'preparing' ? '#F6AD55' : o.status === 'delivering' ? '#B794F4' : o.status === 'delivered' ? '#48BB78' : '#FC8181',
                  }}>
                    {o.status === 'pending' ? '⏳ Pendente' : o.status === 'confirmed' ? '✅ Confirmado' : o.status === 'preparing' ? '👨‍🍳 Preparando' : o.status === 'delivering' ? '🛵 Saiu' : o.status === 'delivered' ? '📦 Entregue' : '❌ Cancelado'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>
                  <p>👤 {o.customer_name} • 📱 {o.customer_phone}</p>
                  <p>📍 {o.delivery_street}, {o.delivery_number} - {o.delivery_neighborhood}</p>
                  <p>💰 R$ {Number(o.total).toFixed(2).replace('.', ',')} • PIX: {o.payment_status === 'approved' ? '✅ Pago' : '⏳ Aguardando'}</p>
                  {o.observations && <p style={{ color: '#888', fontStyle: 'italic' }}>Obs: {o.observations}</p>}
                  <p style={{ fontSize: 11, color: '#666' }}>{new Date(o.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {['confirmed', 'preparing', 'delivering', 'delivered', 'cancelled'].map(s => (
                    <button key={s} onClick={() => updateOrderStatus(o.id, s)}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s',
                        background: o.status === s ? '#D4A528' : 'transparent',
                        color: o.status === s ? '#1A1A1A' : '#888',
                        border: o.status === s ? 'none' : '1px solid #555',
                      }}>
                      {s === 'confirmed' ? 'Confirmar' : s === 'preparing' ? 'Preparando' : s === 'delivering' ? 'Saiu' : s === 'delivered' ? 'Entregue' : 'Cancelar'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CONFIG */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#D4A528' }}>Configurações</h2>

            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 14, border: '1px solid #444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 'bold', color: '#fff' }}>Loja Aberta</p>
                  <p style={{ fontSize: 11, color: '#888' }}>Fechada = clientes não pedem</p>
                </div>
                <button onClick={() => updateSetting('store_open', settings.store_open === 'true' ? 'false' : 'true')}
                  className={`admin-toggle ${settings.store_open === 'true' ? 'active' : ''}`} />
              </div>
            </div>

            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 14, border: '1px solid #444', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontWeight: 'bold', color: '#fff' }}>Entrega</p>
              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Taxa (R$)</label>
                <input className="input-field" type="number" step="0.01" value={settings.delivery_fee || '0'} onChange={e => updateSetting('delivery_fee', e.target.value)} style={{ fontSize: 14, padding: '8px 10px' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Tempo</label>
                <input className="input-field" value={settings.delivery_time || '40-60 min'} onChange={e => updateSetting('delivery_time', e.target.value)} style={{ fontSize: 14, padding: '8px 10px' }} />
              </div>
            </div>

            <div style={{ background: '#2D2D2D', borderRadius: 12, padding: 14, border: '1px solid #444', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontWeight: 'bold', color: '#fff' }}>⭐ Especial do Mês</p>
              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Nome do sabor</label>
                <input className="input-field" value={settings.special_flavor_name || ''} onChange={e => updateSetting('special_flavor_name', e.target.value)} placeholder="Ex: Quatro Queijos" style={{ fontSize: 14, padding: '8px 10px' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Descrição</label>
                <textarea className="input-field" rows="2" value={settings.special_flavor_description || ''} onChange={e => updateSetting('special_flavor_description', e.target.value)} style={{ resize: 'none', fontSize: 14, padding: '8px 10px' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== BOTÃO SALVAR FIXO ===== */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '12px 16px',
        background: 'rgba(26,26,26,0.97)', borderTop: '2px solid #D4A528',
        backdropFilter: 'blur(10px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            {saveMsg && <p style={{ fontSize: 13, color: saveMsg.includes('✅') ? '#48BB78' : '#E53E3E' }}>{saveMsg}</p>}
            {hasChanges && !saveMsg && <p style={{ fontSize: 13, color: '#F6E05E' }}>⚠️ Alterações não salvas</p>}
          </div>
          <button onClick={handleSaveAll} disabled={saving}
            className="btn-primary" style={{ width: 'auto', padding: '12px 24px' }}>
            {saving ? '⏳ Salvando...' : '💾 Salvar Tudo'}
          </button>
        </div>
      </div>
    </div>
  );
}
