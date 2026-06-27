import withPWA from 'next-pwa';

const nextConfig = {
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:9090/api/:path*',
      },
    ];
  },
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
      options: {
        cacheName: 'lesson-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
    {
      urlPattern: /^\/api\/quiz\/.*\/start/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'quiz-cache' },
    },
    {
      urlPattern: /^\/api\/progress\/dashboard/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'progress-cache' },
    },
  ],
})(nextConfig);
