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
 *   6. "allow-then-lock" no meta viewport ao fechar o teclado virtual
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
    // O iOS ignora mudanças no meta viewport quando o valor não muda.
    // O truque "allow-then-lock": primeiro LIBERAR o zoom (maximum-scale=5)
    // para que o iOS aceite a instrução, depois IMEDIATAMENTE TRAVAR em 1.
    // Isso força o iOS a reler e aplicar a escala desejada.
    let resetScheduled = false;

    function resetViewportZoom() {
      resetScheduled = false;
      const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
      if (!meta) return;

      // Passo 1: liberar o zoom — iOS precisa ver que é permitido mudar
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes',
      );

      // Passo 2: no próximo frame, travar novamente em scale=1
      requestAnimationFrame(() => {
        meta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content',
        );
      });
    }

    function scheduleReset(delay: number) {
      if (resetScheduled) return;
      resetScheduled = true;
      setTimeout(resetViewportZoom, delay);
    }

    // Método primário: focusout em inputs
    function onInputFocusOut(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Aguarda a animação do teclado terminar (~300-400ms no iOS)
        scheduleReset(400);
      }
    }

    // Método secundário: visualViewport resize detecta fechamento do teclado
    // com mais precisão do que apenas o focusout
    let kbOpen = false;
    function onVVResize() {
      const vv = window.visualViewport;
      if (!vv) return;
      // Teclado aberto → altura da viewport visual < 75% da janela
      const nowKbOpen = vv.height < window.innerHeight * 0.75;
      if (kbOpen && !nowKbOpen) {
        // Teclado acabou de fechar — aguarda mais um pouco para o scale
        // terminar de ser ajustado pelo sistema antes de forçar o reset
        scheduleReset(200);
      }
      kbOpen = nowKbOpen;
    }

    const opts = { passive: false } as AddEventListenerOptions;

    document.addEventListener('gesturestart',  blockGesture,    opts);
    document.addEventListener('gesturechange', blockGesture,    opts);
    document.addEventListener('touchstart',    blockMultiTouch, opts);
    document.addEventListener('touchstart',    blockDoubleTap,  opts);
    document.addEventListener('wheel',         blockCtrlWheel,  opts);
    document.addEventListener('focusout',      onInputFocusOut, true);
    window.visualViewport?.addEventListener('resize', onVVResize);

    return () => {
      document.removeEventListener('gesturestart',  blockGesture);
      document.removeEventListener('gesturechange', blockGesture);
      document.removeEventListener('touchstart',    blockMultiTouch);
      document.removeEventListener('touchstart',    blockDoubleTap);
      document.removeEventListener('wheel',         blockCtrlWheel);
      document.removeEventListener('focusout',      onInputFocusOut, true);
      window.visualViewport?.removeEventListener('resize', onVVResize);
    };
  }, []);

  return null;
}
