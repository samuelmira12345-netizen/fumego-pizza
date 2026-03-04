'use client';

import { useEffect } from 'react';

/**
 * Bloqueia zoom de pinça e duplo-toque em iOS/Android para que o app
 * se comporte como um app nativo.
 *
 * Estratégia multi-camada:
 *   1. CSS font-size: 16px em todos os inputs (globals.css) — PRINCIPAL.
 *      iOS só dá auto-zoom em inputs com font-size < 16px.
 *   2. Meta viewport maximum-scale=1, user-scalable=no (layout.tsx).
 *   3. gesturestart / gesturechange → preventDefault (pinça Safari iOS).
 *   4. touchstart com 2+ dedos → preventDefault.
 *   5. wheel+ctrlKey → preventDefault (pinch trackpad desktop).
 *   6. Fallback JS: se o zoom acontecer mesmo assim, detecta via
 *      visualViewport e força reset com "allow → lock" no meta viewport.
 */
export default function ZoomBlocker() {
  useEffect(() => {
    // ── Pinça iOS ─────────────────────────────────────────────────────────
    function blockGesture(e: Event) { e.preventDefault(); }

    // ── Multi-touch ───────────────────────────────────────────────────────
    function blockMultiTouch(e: TouchEvent) {
      if (e.touches.length >= 2) e.preventDefault();
    }

    // ── Duplo-toque ───────────────────────────────────────────────────────
    let lastTap = 0;
    function blockDoubleTap(e: TouchEvent) {
      const now = Date.now();
      if (now - lastTap < 300 && now - lastTap > 0) e.preventDefault();
      lastTap = now;
    }

    // ── Ctrl+Wheel (trackpad pinch) ───────────────────────────────────────
    function blockCtrlWheel(e: WheelEvent) {
      if (e.ctrlKey) e.preventDefault();
    }

    // ── Reset de zoom (fallback JS) ───────────────────────────────────────
    // Usado apenas quando o CSS não for suficiente (inputs de terceiros,
    // font-size inline, etc.). Aplica o truque "allow → lock":
    // primeiro libera o zoom para o iOS aceitar a mudança, depois
    // imediatamente trava em scale=1.
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    function resetViewportZoom() {
      resetTimer = null;
      const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
      if (!meta) return;

      // Libera → iOS aceita a instrução seguinte
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes',
      );

      requestAnimationFrame(() => {
        // Trava em scale=1
        meta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content',
        );
      });
    }

    function scheduleReset(ms: number) {
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(resetViewportZoom, ms);
    }

    // ── Detecção via visualViewport ───────────────────────────────────────
    // Quando o teclado abre, visualViewport.height diminui.
    // Quando o teclado fecha, visualViewport.height aumenta de volta.
    // Se havia zoom aplicado (scale > 1.01), dispara o reset.
    const vv = window.visualViewport;
    let prevVVHeight = vv?.height ?? window.innerHeight;

    function onVVResize() {
      if (!vv) return;
      const currentHeight = vv.height;
      const heightDiff = currentHeight - prevVVHeight;
      prevVVHeight = currentHeight;

      // Altura aumentou significativamente → teclado fechou
      if (heightDiff > 80) {
        // Se ainda há zoom aplicado, reseta
        if (vv.scale > 1.01) {
          scheduleReset(150);
        }
      }
    }

    // ── Fallback via focusout ─────────────────────────────────────────────
    // Detecta quando o usuário sai de um campo de texto. Aguarda tempo
    // suficiente para a animação do teclado terminar (~500ms no iOS).
    function onInputFocusOut(e: FocusEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        scheduleReset(500);
      }
    }

    const opts = { passive: false } as AddEventListenerOptions;

    document.addEventListener('gesturestart',  blockGesture,    opts);
    document.addEventListener('gesturechange', blockGesture,    opts);
    document.addEventListener('touchstart',    blockMultiTouch, opts);
    document.addEventListener('touchstart',    blockDoubleTap,  opts);
    document.addEventListener('wheel',         blockCtrlWheel,  opts);
    document.addEventListener('focusout',      onInputFocusOut, true);
    vv?.addEventListener('resize', onVVResize);

    return () => {
      if (resetTimer) clearTimeout(resetTimer);
      document.removeEventListener('gesturestart',  blockGesture);
      document.removeEventListener('gesturechange', blockGesture);
      document.removeEventListener('touchstart',    blockMultiTouch);
      document.removeEventListener('touchstart',    blockDoubleTap);
      document.removeEventListener('wheel',         blockCtrlWheel);
      document.removeEventListener('focusout',      onInputFocusOut, true);
      vv?.removeEventListener('resize', onVVResize);
    };
  }, []);

  return null;
}
