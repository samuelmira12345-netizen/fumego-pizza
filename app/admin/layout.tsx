/**
 * Layout do painel admin.
 * O <script> inline aplica a classe admin-desktop no body de forma síncrona,
 * antes do primeiro paint — eliminando o FOUC (flash de layout mobile).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Executa antes do primeiro paint: sem este script, o CSS aplica
          max-width:480px até o useEffect rodar no cliente */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.body.classList.add('admin-desktop');`,
        }}
      />
      {children}
    </>
  );
}
