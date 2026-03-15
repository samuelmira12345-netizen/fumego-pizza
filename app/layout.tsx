import type { Metadata } from 'next';
import { Inter, Playfair_Display, Cinzel } from 'next/font/google';
import Script from 'next/script';
import { headers } from 'next/headers';
import './globals.css';
import ZoomBlocker from './components/ZoomBlocker';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['700', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FUMÊGO Pizza',
  description: 'As melhores pizzas artesanais',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lê o nonce injetado pelo middleware (x-nonce) para aplicar nos <Script> inline.
  // Isso elimina 'unsafe-inline' do script-src do CSP.
  const nonce = headers().get('x-nonce') ?? undefined;
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${playfair.variable} ${cinzel.variable}`}
      style={{ touchAction: 'pan-x pan-y' }}
    >
      <head>
        {/*
          Camada 1 — meta viewport:
          • maximum-scale=1.0  → limita o zoom máximo a 1× (honrado pela maioria dos browsers)
          • user-scalable=no   → instrução padrão (iOS Safari ≥10 ignora por acessibilidade,
                                 mas mantemos como sinal de intenção para outros browsers)
          • interactive-widget=resizes-content → evita recálculo de viewport ao abrir teclado
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content"
        />
        {/* Camada 2 — CSS: desabilita todos os gestos de zoom via pointer/touch */}
        <style>{`
          html, body {
            touch-action: pan-x pan-y;
            -ms-touch-action: pan-x pan-y;
            overflow-x: hidden;
          }
        `}</style>
      </head>
      <body style={{ touchAction: 'pan-x pan-y' }}>
        {/* Google Analytics 4 — deve ficar no body, não no head (restrição do next/script) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-M77EHCL2XP"
          strategy="afterInteractive"
          nonce={nonce}
        />
        <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-M77EHCL2XP');
        `}</Script>
        {/* Camada 3 — JS: bloqueia gesturestart/change (iOS), multi-touch e double-tap */}
        <ZoomBlocker />
        {children}
      </body>
    </html>
  );
}
