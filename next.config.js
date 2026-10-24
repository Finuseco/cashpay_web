/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's.rfi.fr',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.cashpay-all.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'app.cashpay-all.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Fichiers ajoutés dans /public après le build (images/audios du chat, MonPays…) : servis par
  // /api/uploads grâce à une réécriture « fallback » (appliquée seulement si le fichier n'est pas connu de Next).
  async rewrites() {
    return {
      fallback: [
        { source: '/images/:path*', destination: '/api/uploads/images/:path*' },
        { source: '/uploads/:path*', destination: '/api/uploads/uploads/:path*' },
      ],
    };
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

module.exports = nextConfig;
