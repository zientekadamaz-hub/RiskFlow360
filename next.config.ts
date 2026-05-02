import type { NextConfig } from 'next'

/**
 * Optional basePath support.
 *
 * If you deploy the app under a sub-path (e.g. https://domain.com/riskflow/),
 * set NEXT_PUBLIC_BASE_PATH=/riskflow (no trailing slash).
 *
 * Local dev can keep it empty.
 */
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

function normalizeBasePath(v: string) {
  const trimmed = v.trim()
  if (!trimmed) return ''
  // ensure leading slash
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  // remove trailing slash
  return withLeading.length > 1 ? withLeading.replace(/\/+$/, '') : withLeading
}

const basePath = normalizeBasePath(rawBasePath)

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/actions',
        destination: '/projects',
        permanent: false,
      },
      {
        source: '/reports',
        destination: '/projects',
        permanent: false,
      },
      {
        source: '/reports/progress',
        destination: '/projects',
        permanent: false,
      },
    ]
  },
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath,
      }
    : {}),
}

export default nextConfig
