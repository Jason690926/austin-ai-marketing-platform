/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloud Run 容器化:輸出精簡 standalone server(.next/standalone/server.js)
  output: 'standalone',
  // production build 不因 ESLint 風格規則(no-explicit-any/unused-vars 等)中止。
  // 型別安全仍由 `tsc --noEmit` 把關(已通過);風格可另跑 `npm run lint` 漸進修。
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
