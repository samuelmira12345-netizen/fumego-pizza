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
};
module.exports = nextConfig;
