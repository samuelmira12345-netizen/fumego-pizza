/**
 * lib/gtag.ts
 *
 * Wrapper tipado para o Google Analytics 4 (gtag.js).
 *
 * Declara globalmente `window.gtag` e `window.dataLayer` para eliminar
 * os casts `(window as any).gtag` espalhados pelo código.
 *
 * O GA_ID é declarado no layout.tsx via next/script — esta lib apenas
 * encapsula as chamadas de evento do lado cliente.
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag: (command: 'config' | 'event' | 'js' | 'set', target: string | Date, params?: Record<string, unknown>) => void;
    dataLayer: unknown[];
  }
}

/**
 * Dispara um evento GA4.
 * No-op silencioso se o gtag não estiver carregado (SSR, bloqueador de anúncios, etc.).
 */
export function gtagEvent(eventName: string, params: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}
