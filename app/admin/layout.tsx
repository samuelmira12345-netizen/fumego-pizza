import { headers } from 'next/headers';

/**
 * Layout do painel admin.
 * O <script> inline aplica a classe admin-desktop no body de forma síncrona,
 * antes do primeiro paint — eliminando o FOUC (flash de layout mobile).
 *
 * O nonce é obrigatório para que o CSP (strict-dynamic) permita o script inline.
 * Sem o nonce o script seria bloqueado e o painel abriria em modo mobile.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Lê o nonce injetado pelo middleware — mesmo padrão do RootLayout
  const nonce = headers().get('x-nonce') ?? undefined;

  return (
    <>
      {/* Executa antes do primeiro paint: sem este script, o CSS aplica
          max-width:480px até o useEffect rodar no cliente */}
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `document.body.classList.add('admin-desktop');`,
        }}
      />
      {children}
    </>
  );
}
