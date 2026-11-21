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
  // A vitrine embute `/demo` num iframe para a pessoa navegar no sistema
  // antes de pagar. Por isso 'self' nos dois: a página pode embutir filho do
  // mesmo site, e páginas do mesmo site podem nos embutir. Continua barrado
  // ser embutido por QUALQUER outro domínio, que é o ataque real aqui
  // (clickjacking de terceiro em cima do sistema logado).
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig = {
  async redirects() {
    return ['/lembretes', '/app/lembretes', '/demo/lembretes'].map(source => ({
      source, destination: source.startsWith('/demo/') ? '/demo/conversas' : '/app/conversas', permanent: false,
    }))
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // SAMEORIGIN, e não DENY, pelo mesmo motivo do `frame-ancestors`
          // acima: a vitrine embute `/demo`. Navegador antigo que ignora CSP
          // ainda fica protegido contra enquadramento por outro domínio.
          { key: 'X-Frame-Options',          value: 'SAMEORIGIN' },
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
