import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship built ESM in dist/; nothing needs transpiling.
  poweredByHeader: false,
};

export default nextConfig;
