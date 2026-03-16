/**
 * PageSkeleton.tsx
 *
 * Skeleton de carregamento da página principal (teste/page.tsx).
 * Reproduz a estrutura visual das seções para reduzir o CLS e
 * melhorar a percepção de performance enquanto os dados carregam.
 */

const S = {
  bg:     '#080600',
  card:   '#1C1500',
  border: '#2C1E00',
} as const;

/** Bloco com shimmer animado */
function Bone({ width = '100%', height = 16, radius = 10, style }: {
  width?: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

export default function PageSkeleton() {
  return (
    <div style={{ background: S.bg, minHeight: '100vh' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(8,6,0,0.96)',
        borderBottom: `1px solid ${S.border}`,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bone width={36} height={36} radius={8} />
          <Bone width={100} height={18} radius={6} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bone width={72} height={24} radius={12} />
          <Bone width={40} height={36} radius={10} />
        </div>
      </div>

      {/* ── Pizzas em Dupla — split card ──────────────────────────────── */}
      <section style={{ margin: '16px 16px 14px' }}>
        <Bone height={240} radius={20} />
      </section>

      {/* ── Combo card ────────────────────────────────────────────────── */}
      <section style={{ margin: '4px 16px 14px' }}>
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          background: S.card, border: `1px solid ${S.border}`,
        }}>
          <Bone height={195} radius={0} />
          <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Bone width="55%" height={14} />
            <Bone width="80%" height={22} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Bone width={80} height={26} />
              <Bone width={90} height={44} radius={13} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Especial card ─────────────────────────────────────────────── */}
      <section style={{ margin: '0 16px 20px' }}>
        <div style={{
          borderRadius: 20, overflow: 'hidden',
          background: S.card, border: `1px solid ${S.border}`,
        }}>
          <Bone height={180} radius={0} />
          <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Bone width="60%" height={20} />
            <Bone width="90%" height={13} />
            <Bone width="75%" height={13} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Bone width={80} height={26} />
              <Bone width={90} height={44} radius={13} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Seção de produtos ─────────────────────────────────────────── */}
      <section style={{ padding: '0 16px', marginBottom: 20 }}>
        <Bone width={140} height={11} radius={6} style={{ marginBottom: 14 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              borderRadius: 16, background: S.card,
              border: `1px solid ${S.border}`,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <Bone width={72} height={72} radius={12} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Bone width="70%" height={16} />
                <Bone width="90%" height={12} />
                <Bone width="40%" height={14} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bebidas ───────────────────────────────────────────────────── */}
      <section style={{ padding: '0 16px', marginBottom: 100 }}>
        <Bone width={80} height={11} radius={6} style={{ marginBottom: 14 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              borderRadius: 14, background: S.card,
              border: `1px solid ${S.border}`,
              padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Bone width={100} height={14} />
                <Bone width={60} height={11} />
              </div>
              <Bone width={56} height={20} />
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
