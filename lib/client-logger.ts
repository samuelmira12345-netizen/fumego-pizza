/**
 * Logger seguro para componentes client-side.
 *
 * Em produção, suprime todos os logs para não vazar detalhes internos
 * no console do browser. Em desenvolvimento, exibe normalmente.
 */

const isDev = process.env.NODE_ENV !== 'production';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function clientError(msgOrErr: unknown, extra?: unknown): void {
  if (!isDev) return;
  if (extra !== undefined) {
    // eslint-disable-next-line no-console
    console.error(msgOrErr, extra);
  } else {
    // eslint-disable-next-line no-console
    console.error(msgOrErr);
  }
}
