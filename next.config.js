/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production'

// CSP conservador mas compatível com Next.js App Router.
// unsafe-eval apenas em dev (hot reload); unsafe-inline é necessário para os
// estilos injetados pelo Next e para o framer-motion.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.vercel-insights.com wss:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          // HSTS: força HTTPS por 2 anos. Só faz sentido em produção — em dev
          // o browser ficaria preso em HTTPS mesmo sem certificado local.
          ...(isDev ? [] : [
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          ]),
          { key: 'Content-Security-Policy',  value: csp },
        ],
      },
    ]
  },
}
module.exports = nextConfig
