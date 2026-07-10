import withPWA from 'next-pwa';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9090';

const nextConfig = {
  rewrites: async () => [
    { source: '/api/:path*', destination: `${API_BASE}/api/:path*` }
  ],
  // Allow images from any https source (school logos etc)
  images: {
    remotePatterns: [{ protocol: 'https' as const, hostname: '**' as const }]
  }
};

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^\/api\/content\/.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'lesson-cache', expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 3600 } }
    },
    {
      urlPattern: /^\/api\/quiz\/.*\/start/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'quiz-cache', expiration: { maxEntries: 50 } }
    },
    {
      urlPattern: /^\/api\/progress\/.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'progress-cache', expiration: { maxEntries: 20 } }
    },
    {
      urlPattern: /^\/api\/notifications.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'notif-cache', expiration: { maxEntries: 20 } }
    }
  ]
})(nextConfig);

