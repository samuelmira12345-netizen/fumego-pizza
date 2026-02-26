import './globals.css';

export const metadata = {
  title: 'FUMÊGO Pizza',
  description: 'As melhores pizzas artesanais',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
