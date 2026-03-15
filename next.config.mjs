// @ts-check
import { withSentryConfig } from '@sentry/nextjs';

const securityHeaders = [
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    // unsafe-inline is required by Next.js inline scripts; unsafe-eval by some Next.js internals.
    // Tighten per-route with nonce-based CSP if stricter policy is needed in the future.
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://sentry.io https://*.sentry.io https://brasilapi.com.br https://nominatim.openstreetmap.org https://*.upstash.io",
      "frame-ancestors 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
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
