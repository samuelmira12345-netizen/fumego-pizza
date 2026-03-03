'use client';

import { useCallback, useRef } from 'react';

/**
 * Hook reutilizável de scroll guiado entre passos.
 *
 * Após uma ação do usuário (selecionar opção, preencher campo, etc.),
 * rola suavemente até o próximo passo lógico da interface.
 *
 * Características:
 * - Animação smooth (não causa desorientação)
 * - Delay configurável antes de iniciar (padrão: 300ms — deixa o usuário
 *   ver o feedback visual da seleção antes da tela se mover)
 * - Não bloqueia rolagem manual: o usuário pode interromper a qualquer momento
 * - Funciona tanto em scroll de janela quanto dentro de containers com overflow
 *
 * @param delay - Milissegundos antes de iniciar o scroll (padrão: 300)
 *
 * @example
 * // Em um componente de página (scroll de janela):
 * const scrollToStep = useScrollToStep();
 * <input onBlur={e => { if (e.target.value) scrollToStep('section-pagamento'); }} />
 *
 * @example
 * // Dentro de um modal com overflow (passa a ref do container):
 * const scrollToStep = useScrollToStep();
 * const containerRef = useRef<HTMLDivElement>(null);
 * scrollToStep('modal-bebidas', containerRef.current);
 */
export function useScrollToStep(delay = 300) {
  // Referência ao timer para permitir cancelamento caso uma nova ação
  // seja executada antes do delay expirar (evita scrolls em cascata)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToStep = useCallback(
    (targetId: string, container?: HTMLElement | null) => {
      // Cancela scroll pendente se o usuário agir antes do delay
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const target = document.getElementById(targetId);
        if (!target) return;

        if (container) {
          // Scroll dentro de um container com overflow:auto/scroll (ex: modal)
          // Calcula o offset do alvo em relação ao container
          const containerRect = container.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const newScrollTop =
            container.scrollTop + (targetRect.top - containerRect.top) - 16;
          container.scrollTo({ top: Math.max(0, newScrollTop), behavior: 'smooth' });
        } else {
          // Scroll na janela — deixa 16px de respiro acima do alvo
          const y =
            target.getBoundingClientRect().top + window.scrollY - 16;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }
      }, delay);
    },
    [delay]
  );

  return scrollToStep;
}
