'use client';

import {
  Palette, Loader2, Upload, Trash2, Store, Clock,
  X, Plus, Gift, Plug, RefreshCw,
} from 'lucide-react';
import { DAY_LABELS, DAY_ORDER } from '../../../lib/store-hours';

const C = {
  card:      '#ffffff',
  border:    '#E5E7EB',
  text:      '#111827',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  gold:      '#F2A800',
  success:   '#10B981',
  danger:    '#EF4444',
};

export default function SettingsTab({
  getSetting,
  updateSetting,
  getBusinessHours,
  updateDayHours,
  getSchedulingSlots,
  updateSchedulingSlots,
  uploadingLogo,
  handleLogoUpload,
  removeLogo,
  cwPartnerLoading,
  cwPartnerStatus,
  testCWPartner,
}: {
  getSetting: (key: string) => string;
  updateSetting: (key: string, value: string) => void;
  getBusinessHours: () => Record<string, any>;
  updateDayHours: (day: string, field: string, value: any) => void;
  getSchedulingSlots: () => any[];
  updateSchedulingSlots: (slots: any[]) => void;
  uploadingLogo: boolean;
  handleLogoUpload: (file: File) => void;
  removeLogo: () => void;
  cwPartnerLoading: boolean;
  cwPartnerStatus: any;
  testCWPartner: () => void;
}) {
  return (
    <div style={{ padding: '24px 32px', paddingBottom: 100, maxWidth: 720 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Logo */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <Palette size={16} color={C.gold} /> Logo da Pizzaria
          </h3>
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 12 }}>A logo aparece ao lado esquerdo do nome "FUMÊGO" no cabeçalho.</p>

          {getSetting('logo_url') && (
            <div style={{ marginBottom: 14, padding: 12, background: '#111827', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={getSetting('logo_url')} alt="Logo" style={{ height: parseInt(getSetting('logo_size') || '36'), objectFit: 'contain' }} />
              <span style={{ color: C.gold, fontWeight: 800, fontSize: 16, letterSpacing: 3 }}>FUMÊGO</span>
            </div>
          )}

          {getSetting('logo_url') && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: C.textMuted, fontSize: 13, display: 'block', marginBottom: 6 }}>
                Tamanho: <strong style={{ color: C.text }}>{getSetting('logo_size') || '36'}px</strong>
              </label>
              <input type="range" min="24" max="80" step="2" value={getSetting('logo_size') || '36'} onChange={e => updateSetting('logo_size', e.target.value)} style={{ width: '100%', accentColor: C.gold }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.gold, color: '#000', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: uploadingLogo ? 0.5 : 1 }}>
              {uploadingLogo
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                : <><Upload size={13} /> Enviar Logo</>}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files && e.target.files[0]) handleLogoUpload(e.target.files[0]); }} disabled={uploadingLogo} />
            </label>
            {getSetting('logo_url') && (
              <button onClick={removeLogo} style={{ padding: '8px 16px', background: '#F3F4F6', color: C.textMuted, border: '1px solid ' + C.border, borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={13} /> Remover Logo
              </button>
            )}
          </div>
        </div>

        {/* Loja */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <Store size={16} color={C.gold} /> Loja
          </h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <input type="checkbox" checked={getSetting('store_open') === 'true'} onChange={e => updateSetting('store_open', e.target.checked ? 'true' : 'false')} />
            <span style={{ color: C.text, fontSize: 14 }}>Loja aberta</span>
          </label>
          <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 14 }}>Desmarque para fechar imediatamente, independente do horário configurado.</p>
          <input className="input-field" placeholder="Tempo de entrega (ex: 40–60 min)" value={getSetting('delivery_time')} onChange={e => updateSetting('delivery_time', e.target.value)} style={{ marginBottom: 8, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
          <input className="input-field" placeholder="Taxa de entrega" type="number" step="0.01" value={getSetting('delivery_fee')} onChange={e => updateSetting('delivery_fee', e.target.value)} style={{ marginBottom: 16, background: '#F9FAFB', color: C.text, borderColor: C.border }} />

          <div style={{ height: 1, background: C.border, marginBottom: 14 }} />

          <h4 style={{ color: C.text, fontWeight: 700, marginBottom: 4, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} color={C.gold} /> Horário de Funcionamento
          </h4>
          <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 14 }}>A loja fecha automaticamente fora do horário. Horário de Brasília (UTC-3).</p>

          {DAY_ORDER.map(day => {
            const h = getBusinessHours()[day] || { enabled: true, open: '18:00', close: '23:00' };
            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90, cursor: 'pointer' }}>
                  <input type="checkbox" checked={h.enabled} onChange={e => updateDayHours(day, 'enabled', e.target.checked)} />
                  <span style={{ fontSize: 13, fontWeight: h.enabled ? 600 : 400, color: h.enabled ? C.text : C.textLight }}>{DAY_LABELS[day]}</span>
                </label>
                <input type="time" value={h.open} disabled={!h.enabled} onChange={e => updateDayHours(day, 'open', e.target.value)} style={{ flex: 1, background: '#F9FAFB', color: h.enabled ? C.text : C.textLight, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 8px', fontSize: 13, cursor: h.enabled ? 'pointer' : 'not-allowed' }} />
                <span style={{ color: C.textMuted, fontSize: 12 }}>às</span>
                <input type="time" value={h.close} disabled={!h.enabled} onChange={e => updateDayHours(day, 'close', e.target.value)} style={{ flex: 1, background: '#F9FAFB', color: h.enabled ? C.text : C.textLight, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 8px', fontSize: 13, cursor: h.enabled ? 'pointer' : 'not-allowed' }} />
              </div>
            );
          })}
        </div>

        {/* Instagram */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            Instagram
          </h3>
          <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 10 }}>Link exibido após o pedido ser confirmado.</p>
          <input className="input-field" placeholder="https://instagram.com/suaconta" value={getSetting('instagram_url')} onChange={e => updateSetting('instagram_url', e.target.value)} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
        </div>

        {/* Agendamento */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <Clock size={16} color={C.gold} /> Agendamento de Pedidos
          </h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <input type="checkbox" checked={getSetting('scheduling_enabled') === 'true'} onChange={e => updateSetting('scheduling_enabled', e.target.checked ? 'true' : 'false')} />
            <span style={{ color: C.text, fontSize: 14 }}>Ativar agendamento</span>
          </label>
          <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 14 }}>Permite que o cliente escolha data e hora na finalização do pedido.</p>

          {getSetting('scheduling_enabled') === 'true' && (
            <>
              <label style={{ color: C.textMuted, fontSize: 12, display: 'block', marginBottom: 4 }}>Máximo de dias antecipados</label>
              <input className="input-field" type="number" min="1" max="30" placeholder="Ex: 3" value={getSetting('scheduling_max_days') || '3'} onChange={e => updateSetting('scheduling_max_days', e.target.value)} style={{ marginBottom: 16, maxWidth: 120, background: '#F9FAFB', color: C.text, borderColor: C.border }} />
              <div style={{ height: 1, background: C.border, marginBottom: 14 }} />
              <h4 style={{ color: C.text, fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Horários e capacidade</h4>
              <p style={{ color: C.textMuted, fontSize: 11, marginBottom: 12 }}>Cada horário pode receber no máximo N pedidos simultâneos.</p>
              {getSchedulingSlots().map((slot, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input type="time" value={slot.time} onChange={e => { const slots = [...getSchedulingSlots()]; slots[i] = { ...slots[i], time: e.target.value }; updateSchedulingSlots(slots); }} style={{ flex: 1, background: '#F9FAFB', color: C.text, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 8px', fontSize: 13 }} />
                  <input type="number" min="1" max="99" value={slot.max_orders} onChange={e => { const slots = [...getSchedulingSlots()]; slots[i] = { ...slots[i], max_orders: parseInt(e.target.value) || 1 }; updateSchedulingSlots(slots); }} style={{ width: 60, background: '#F9FAFB', color: C.text, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 8px', fontSize: 13, textAlign: 'center' }} />
                  <span style={{ color: C.textMuted, fontSize: 11 }}>pedidos</span>
                  <button onClick={() => { const slots = getSchedulingSlots().filter((_: any, j: number) => j !== i); updateSchedulingSlots(slots); }} style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', padding: 4 }}><X size={14} /></button>
                </div>
              ))}
              <button onClick={() => { const slots = [...getSchedulingSlots(), { time: '12:00', max_orders: 3 }]; updateSchedulingSlots(slots); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(242,168,0,0.1)', color: C.gold, border: '1px solid rgba(242,168,0,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
                <Plus size={12} /> Adicionar horário
              </button>
            </>
          )}
        </div>

        {/* Fidelidade / Cashback */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ color: C.text, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <Gift size={16} color={C.gold} /> Fidelidade / Cashback
          </h3>
          <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 16 }}>Configure o programa de cashback para clientes cadastrados. O cashback é creditado após cada pedido confirmado e pode ser usado em compras futuras.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ color: C.textMuted, fontSize: 12, display: 'block', marginBottom: 4, fontWeight: 600 }}>% de Cashback por Pedido</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="input-field"
                  type="number" min="0" max="100" step="0.5"
                  placeholder="5"
                  value={getSetting('cashback_percent')}
                  onChange={e => updateSetting('cashback_percent', e.target.value)}
                  style={{ background: '#F9FAFB', color: C.text, borderColor: C.border, maxWidth: 100 }}
                />
                <span style={{ color: C.textMuted, fontSize: 13 }}>%</span>
              </div>
              <p style={{ color: C.textLight, fontSize: 11, marginTop: 4 }}>Percentual do valor do pedido que retorna como cashback.</p>
            </div>
            <div>
              <label style={{ color: C.textMuted, fontSize: 12, display: 'block', marginBottom: 4, fontWeight: 600 }}>% Máximo do Pedido Coberto</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="input-field"
                  type="number" min="0" max="100" step="5"
                  placeholder="50"
                  value={getSetting('cashback_max_percent')}
                  onChange={e => updateSetting('cashback_max_percent', e.target.value)}
                  style={{ background: '#F9FAFB', color: C.text, borderColor: C.border, maxWidth: 100 }}
                />
                <span style={{ color: C.textMuted, fontSize: 13 }}>%</span>
              </div>
              <p style={{ color: C.textLight, fontSize: 11, marginTop: 4 }}>Limite máximo do valor do pedido que pode ser pago com cashback.</p>
            </div>
          </div>

          {parseFloat(getSetting('cashback_percent') || '5') > 0 && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(242,168,0,0.08)', borderRadius: 8, border: '1px solid rgba(242,168,0,0.2)', fontSize: 12, color: '#92400E' }}>
              Exemplo: pedido de R$ 100 → cliente ganha R$ {parseFloat(getSetting('cashback_percent') || '5').toFixed(2)} em cashback e pode usar até R$ {parseFloat(getSetting('cashback_max_percent') || '50').toFixed(0)} em desconto num próximo pedido de R$ 100.
            </div>
          )}
        </div>

        {/* CardápioWeb Partner API */}
        <div style={{ background: C.card, borderRadius: 12, padding: 20, border: '1px solid ' + C.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ color: C.text, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <Plug size={16} color={C.gold} /> Integração CardápioWeb (Partner API)
            </h3>
            <button onClick={testCWPartner} disabled={cwPartnerLoading} style={{ padding: '6px 10px', background: '#F3F4F6', color: C.text, border: '1px solid ' + C.border, borderRadius: 8, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={11} style={cwPartnerLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              {cwPartnerLoading ? '...' : 'Testar Conexão'}
            </button>
          </div>
          <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 12 }}>Pedidos feitos no app são enviados automaticamente ao painel do CardápioWeb via Partner API.</p>

          <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 12, border: '1px solid ' + C.border }}>
            <p style={{ color: '#D97706', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Variáveis de ambiente necessárias no Vercel:</p>
            {[
              ['CW_BASE_URL',    'URL base da API'],
              ['CW_API_KEY',     'Token do estabelecimento — X-API-KEY'],
              ['CW_PARTNER_KEY', 'Token do integrador — X-PARTNER-KEY'],
              ['CW_DEFAULT_LAT', 'Latitude do estabelecimento'],
              ['CW_DEFAULT_LNG', 'Longitude do estabelecimento'],
            ].map(([k, desc]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <p style={{ color: C.gold, fontSize: 11, fontFamily: 'monospace', marginBottom: 2 }}>{k}</p>
                <p style={{ color: C.textMuted, fontSize: 10 }}>{desc}</p>
              </div>
            ))}
          </div>

          {!cwPartnerStatus && <p style={{ color: C.textLight, fontSize: 12, fontStyle: 'italic' }}>Clique em "Testar Conexão" para verificar o status.</p>}

          {cwPartnerStatus && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700, background: cwPartnerStatus.enabled && !cwPartnerStatus.error ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: cwPartnerStatus.enabled && !cwPartnerStatus.error ? C.success : C.danger, border: `1px solid ${cwPartnerStatus.enabled && !cwPartnerStatus.error ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  {cwPartnerStatus.enabled && !cwPartnerStatus.error ? '● Integração ativa' : '● Integração inativa'}
                </span>
              </div>
              {cwPartnerStatus.error && <p style={{ color: C.danger, fontSize: 12, marginBottom: 8, background: 'rgba(239,68,68,0.06)', padding: '8px 10px', borderRadius: 6 }}>{cwPartnerStatus.error}</p>}
              {cwPartnerStatus.payment_methods?.length > 0 && (
                <div>
                  <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Métodos de pagamento disponíveis:</p>
                  {cwPartnerStatus.payment_methods.map((m: any) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, padding: '5px 8px', background: '#F9FAFB', borderRadius: 6, border: '1px solid ' + C.border }}>
                      <span style={{ color: C.gold, fontSize: 10, fontFamily: 'monospace', minWidth: 28 }}>#{m.id}</span>
                      <span style={{ color: C.text, fontSize: 12 }}>{m.name}</span>
                      <span style={{ color: C.textLight, fontSize: 10, marginLeft: 'auto', fontFamily: 'monospace' }}>{m.kind}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
