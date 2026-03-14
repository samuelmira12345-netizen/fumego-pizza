'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Clock, ArrowLeft, TrendingUp } from 'lucide-react';

const GOLD   = '#F2A800';
const BG     = '#080600';
const CARD   = '#1C1500';
const BORDER = '#2C1E00';
const MUTED  = '#7A6040';
const GREEN  = '#48BB78';

interface StoredUser {
  id: string;
}

interface CashbackTransaction {
  id: string;
  expires_at: string;
  remaining: number;
  amount: number;
}

function fmt(n: number): string { return Number(n).toFixed(2).replace('.', ','); }

function daysLeft(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function WalletPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<CashbackTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('fumego_user');
    if (!userData) { router.push('/login'); return; }
    const u: StoredUser = JSON.parse(userData);
    setUser(u);

    fetch(`/api/cashback/balance?user_id=${u.id}`)
      .then(r => r.json())
      .then(data => {
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: MUTED }}>Carregando carteira...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
        position: 'sticky', top: 0, background: BG, zIndex: 10,
      }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 18, fontWeight: 700, color: GOLD }}>
          Minha Carteira
        </h1>
      </header>

      <div style={{ padding: '20px 16px 60px', maxWidth: 480, margin: '0 auto' }}>

        {/* Saldo Total */}
        <div style={{
          background: `linear-gradient(135deg, #2A1A00, #1C1000)`,
          border: `1px solid ${GOLD}44`, borderRadius: 20, padding: 24, marginBottom: 20,
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Wallet size={32} color={GOLD} />
          </div>
          <p style={{ fontSize: 12, color: MUTED, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
            Saldo Disponível
          </p>
          <p style={{ fontSize: 40, fontWeight: 900, color: GOLD, lineHeight: 1 }}>
            R$ {fmt(balance)}
          </p>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
            Válido como desconto em pedidos futuros · Limite de uso: 50% por pedido
          </p>
        </div>

        {/* Créditos ativos */}
        {transactions.length > 0 ? (
          <div>
            <h2 style={{ fontSize: 12, color: MUTED, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
              Créditos Ativos
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {transactions.map(tx => {
                const days = daysLeft(tx.expires_at);
                const urgent = days <= 7;
                return (
                  <div key={tx.id} style={{
                    background: CARD, border: `1px solid ${urgent ? '#8B2020' : BORDER}`,
                    borderRadius: 14, padding: '14px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <TrendingUp size={18} color={GREEN} />
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>R$ {fmt(tx.remaining)}</p>
                        <p style={{ fontSize: 11, color: urgent ? '#E04040' : MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} />
                          {days === 0 ? 'Expira hoje!' : `Expira em ${days} dia${days !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                    {tx.amount !== tx.remaining && (
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 11, color: MUTED }}>Original</p>
                        <p style={{ fontSize: 12, color: MUTED }}>R$ {fmt(tx.amount)}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`,
          }}>
            <Wallet size={36} color={MUTED} style={{ marginBottom: 12 }} />
            <p style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Nenhum cashback disponível</p>
            <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
              Faça um pedido e ganhe cashback automático para usar na próxima compra!
            </p>
          </div>
        )}

        <button className="btn-primary" onClick={() => router.push('/teste')} style={{ marginTop: 24 }}>
          Fazer um Pedido
        </button>
      </div>
    </div>
  );
}
