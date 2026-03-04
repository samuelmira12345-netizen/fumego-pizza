import type { Metadata } from 'next';
import { Inter, Playfair_Display, Cinzel } from 'next/font/google';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        {/* Camada 3 — JS: bloqueia gesturestart/change (iOS), multi-touch e double-tap */}
        <ZoomBlocker />
        {children}
      </body>
    </html>
  );
}
