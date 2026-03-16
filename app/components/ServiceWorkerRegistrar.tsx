'use client';

import { useEffect } from 'react';

/**
 * Registra o Service Worker para habilitar a instalação como PWA.
 * Componente client-only; não renderiza nada no DOM.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // Falha silenciosa — a ausência do SW não quebra nenhuma funcionalidade
        });
    }
  }, []);

  return null;
}
