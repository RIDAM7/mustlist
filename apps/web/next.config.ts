import path from 'node:path';
import type { NextConfig } from 'next';
import { BASE_PATH } from '@mustlist/schema/constants';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  // Served at https://ridamagrawal.com/library. Every route and asset starts with /library.
  basePath: BASE_PATH,
  cacheComponents: true,
  partialPrefetching: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@mustlist/schema', '@mustlist/build'],
  // Pages are prerendered, but unknown URLs still read dist/ at request time.
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
  outputFileTracingIncludes: { '/*': ['../../dist/**/*'] },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    // /library/<topic>/<stack>.md -> the raw-markdown route handler.
    // basePath is added to both sides automatically. `\\.` is a literal dot.
    return [
      {
        source: '/:topic([a-z0-9-]+)/:stack([a-z0-9-]+)\\.md',
        destination: '/api/raw/:topic/:stack',
      },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
