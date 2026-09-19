declare module 'next-pwa' {
  import { NextConfig } from 'next';
  function withPWA(config: Record<string, unknown>): (nextConfig: NextConfig) => NextConfig;
  export default withPWA;
}
