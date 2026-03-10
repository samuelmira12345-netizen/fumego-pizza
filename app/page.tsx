export default function ComingSoonPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-cinzel), Cinzel, Georgia, serif',
          fontWeight: 900,
          fontSize: 'clamp(2rem, 8vw, 5rem)',
          color: '#C8A96E',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          margin: 0,
          textAlign: 'center',
          padding: '0 1rem',
        }}
      >
        FUMEGO EM BREVE...
      </h1>
    </div>
  );
}
