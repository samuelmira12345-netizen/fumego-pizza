import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Captura 10% das transações de performance (ajuste conforme uso)
  tracesSampleRate: 0.1,

  // Replay de sessão só quando há erro (0% em amostragem normal)
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],

  // Ignora erros de extensões de browser e cancelamentos de fetch
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'AbortError',
  ],
});
