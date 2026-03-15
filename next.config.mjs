// @ts-check
import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint is run separately via `npm run lint`; skipping here avoids
    // version-compatibility issues between next build and the local eslint version.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        // Permite apenas o domínio do Supabase Storage
        // Formato: <project-ref>.supabase.co
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Desabilita o wizard interativo
  silent: true,

  // Upload de source maps para o Sentry (só roda no CI/Vercel se SENTRY_AUTH_TOKEN estiver definido)
  org:       process.env.SENTRY_ORG,
  project:   process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Oculta source maps do bundle público
  hideSourceMaps: true,

  // Desabilita o logger do Sentry em produção (reduz tamanho do bundle)
  disableLogger: true,

  // Não injeta Sentry no cliente se a DSN não estiver configurada
  autoInstrumentServerFunctions: false,
});
