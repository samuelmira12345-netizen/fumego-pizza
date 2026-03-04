'use client';

import { useEffect } from 'react';

/**
 * Bloqueia zoom de pinça e duplo-toque em iOS/Android para que o app
 * se comporte como um app nativo.
 *
 * Estratégia multi-camada (necessária porque iOS ignora user-scalable=no):
 *   1. Meta viewport com maximum-scale=1 e user-scalable=no (layout.tsx)
 *   2. CSS touch-action: pan-x pan-y no html/body (layout.tsx)
 *   3. gesturestart / gesturechange → preventDefault (Safari iOS)
 *   4. touchstart com 2+ dedos → preventDefault (todos os browsers)
 *   5. wheel com ctrlKey → preventDefault (trackpad pinch no desktop)
 *   6. focusout em inputs → reseta scale do viewport suavemente (iOS teclado)
 *
 * O bloqueio NÃO afeta scroll manual, cliques, tap ou swipe de 1 dedo.
 */
export default function ZoomBlocker() {
  useEffect(() => {
    // ── Pinça iOS (gesturestart / gesturechange) ──────────────────────────
    function blockGesture(e: Event) {
      e.preventDefault();
    }

    // ── Multi-touch: 2+ dedos na tela → bloqueia ─────────────────────────
    function blockMultiTouch(e: TouchEvent) {
      if (e.touches.length >= 2) e.preventDefault();
    }

    // ── Duplo-toque (double-tap zoom) — track de last tap ─────────────────
    let lastTapTime = 0;
    function blockDoubleTap(e: TouchEvent) {
      const now = Date.now();
      const delta = now - lastTapTime;
      if (delta < 300 && delta > 0) {
        e.preventDefault();
      }
      lastTapTime = now;
    }

    // ── Pinch via trackpad/roda do mouse com Ctrl pressionado ─────────────
    function blockCtrlWheel(e: WheelEvent) {
      if (e.ctrlKey) e.preventDefault();
    }

    // ── Reset de zoom ao fechar o teclado virtual (iOS Safari) ────────────
    // Quando um input perde o foco, o iOS pode manter o zoom aplicado.
    // Forçamos o reset manipulando o meta viewport para que o iOS releia
    // a escala desejada e retorne suavemente ao zoom 1.
    function resetViewportZoom() {
      const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
      if (!meta) return;
      const original = meta.getAttribute('content') ?? '';
      // Força o iOS a reler o viewport adicionando initial-scale explícito
      meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content');
      // Restaura o conteúdo original após um frame para que a transição seja suave
      requestAnimationFrame(() => {
        setTimeout(() => meta.setAttribute('content', original), 80);
      });
    }

    function onInputFocusOut(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Aguarda o teclado começar a fechar antes de resetar
        setTimeout(resetViewportZoom, 150);
      }
    }

    const opts = { passive: false } as AddEventListenerOptions;

    document.addEventListener('gesturestart',  blockGesture,     opts);
    document.addEventListener('gesturechange', blockGesture,     opts);
    document.addEventListener('touchstart',    blockMultiTouch,  opts);
    document.addEventListener('touchstart',    blockDoubleTap,   opts);
    document.addEventListener('wheel',         blockCtrlWheel,   opts);
    // Captura na fase de captura (true) para pegar todos os inputs da página
    document.addEventListener('focusout',      onInputFocusOut,  true);

    return () => {
      document.removeEventListener('gesturestart',  blockGesture);
      document.removeEventListener('gesturechange', blockGesture);
      document.removeEventListener('touchstart',    blockMultiTouch);
      document.removeEventListener('touchstart',    blockDoubleTap);
      document.removeEventListener('wheel',         blockCtrlWheel);
      document.removeEventListener('focusout',      onInputFocusOut, true);
    };
  }, []);

  return null;
}
