import './globals.css';

export const metadata = {
  title: 'FUMÊGO - Pizza Clássica',
  description: 'As melhores pizzas clássicas. Peça agora!',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1A1A1A',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
