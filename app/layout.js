import './globals.css';

export const metadata = {
  title: 'FUMÊGO - Pizza Clássica',
  description: 'As melhores pizzas clássicas da cidade. Peça agora!',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#1A1A1A" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-fumego-black">
        {children}
      </body>
    </html>
  );
}
