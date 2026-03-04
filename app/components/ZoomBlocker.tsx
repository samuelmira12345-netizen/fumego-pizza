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

    const opts = { passive: false } as AddEventListenerOptions;

    document.addEventListener('gesturestart',  blockGesture,     opts);
    document.addEventListener('gesturechange', blockGesture,     opts);
    document.addEventListener('touchstart',    blockMultiTouch,  opts);
    document.addEventListener('touchstart',    blockDoubleTap,   opts);
    document.addEventListener('wheel',         blockCtrlWheel,   opts);

    return () => {
      document.removeEventListener('gesturestart',  blockGesture);
      document.removeEventListener('gesturechange', blockGesture);
      document.removeEventListener('touchstart',    blockMultiTouch);
      document.removeEventListener('touchstart',    blockDoubleTap);
      document.removeEventListener('wheel',         blockCtrlWheel);
    };
  }, []);

  return null;
}
