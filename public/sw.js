/**
 * Service Worker — FUMÊGO Pizza
 *
 * Objetivo principal: habilitar instalação como PWA (home screen).
 * Não faz cache agressivo pois o cardápio e checkout precisam de dados em tempo real.
 *
 * Estratégia:
 * - Instala e ativa imediatamente (skipWaiting + clients.claim)
 * - Limpa caches de versões anteriores no activate
 * - Não intercepta fetch (nenhum cache de conteúdo dinâmico)
 */

const CACHE_NAME = 'fumego-v1';

self.addEventListener('install', () => {
  // Assume o controle imediatamente sem esperar o reload
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Não interceptamos fetch intencionalmente: o cardápio e o checkout
// dependem de dados ao vivo do Supabase e Mercado Pago.
// A instalação como PWA (standalone) não requer cache de navegação.
