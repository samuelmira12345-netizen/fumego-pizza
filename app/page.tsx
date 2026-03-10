export default function ComingSoonPage() {
  return (
    <>
      <style>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          48%       { opacity: 1; }
          50%       { opacity: 0.72; }
          52%       { opacity: 1; }
          92%       { opacity: 1; }
          94%       { opacity: 0.6; }
          96%       { opacity: 1; }
        }
        @keyframes glow-pulse {
          0%, 100% { filter: drop-shadow(0 0 28px rgba(242,168,0,0.45)); }
          50%       { filter: drop-shadow(0 0 48px rgba(242,168,0,0.75)); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080600',
          gap: 0,
        }}
      >
        {/* Flame icon as logo placeholder */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="72"
          height="72"
          viewBox="0 0 24 24"
          fill="#F2A800"
          style={{
            animation: 'glow-pulse 2.5s ease-in-out infinite',
            marginBottom: 20,
          }}
        >
          <path d="M12 2c0 0-5.5 5.3-5.5 10.5C6.5 16.1 9 19 12 19s5.5-2.9 5.5-6.5C17.5 7.3 12 2 12 2zm0 15c-1.9 0-3.5-1.7-3.5-4 0-2.5 2-5.5 3.5-7.6 1.5 2.1 3.5 5.1 3.5 7.6 0 2.3-1.6 4-3.5 4z" />
        </svg>

        {/* FUMÊGO logotype */}
        <p
          style={{
            fontFamily: 'var(--font-cinzel), Cinzel, Georgia, serif',
            fontWeight: 900,
            fontSize: 'clamp(2rem, 10vw, 3.75rem)',
            color: '#F2A800',
            letterSpacing: '0.28em',
            margin: 0,
            textShadow: '0 0 32px rgba(242,168,0,0.5)',
            animation: 'flicker 6s ease-in-out infinite',
            lineHeight: 1,
          }}
        >
          FUMÊGO
        </p>

        {/* Divider */}
        <div
          style={{
            width: 48,
            height: 1,
            background: 'linear-gradient(90deg, transparent, #F2A800, transparent)',
            margin: '18px 0',
            opacity: 0.6,
          }}
        />

        {/* "Em breve" tagline */}
        <p
          style={{
            fontFamily: 'var(--font-cinzel), Cinzel, Georgia, serif',
            fontWeight: 700,
            fontSize: 'clamp(0.65rem, 2.5vw, 0.85rem)',
            color: '#F2A800',
            letterSpacing: '0.45em',
            textTransform: 'uppercase',
            margin: 0,
            opacity: 0.7,
            animation: 'fade-up 1.2s ease-out both',
          }}
        >
          Em breve
        </p>
      </div>
    </>
  );
}
