/** @type {import('next').NextConfig} */
const nextConfig = {
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

  // Open Delivery: o padrão define o path GET /v1/events:polling com dois-pontos.
  // Next.js não suporta dois-pontos em nomes de diretórios, então usamos um rewrite.
  async rewrites() {
    return [
      {
        source:      '/api/open-delivery/v1/events\\:polling',
        destination: '/api/open-delivery/v1/events-polling',
      },
    ];
  },
};
module.exports = nextConfig;
