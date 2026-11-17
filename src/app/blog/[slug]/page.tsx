import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { POSTS, buscarPost } from '@/lib/posts'
import { data as formatarData } from '@/lib/formato'

/**
 * Um post do blog. Público, fora do matcher do middleware.
 *
 * Estático: `generateStaticParams` entrega as páginas prontas no build, que é
 * o que faz sentido para texto que só muda quando alguém edita o código.
 *
 * O corpo é renderizado com três regras (subtítulo, item de lista, parágrafo)
 * em vez de um markdown completo. Biblioteca de markdown aqui significaria
 * sanitizar HTML de terceiros numa página pública — risco sem retorno enquanto
 * quem escreve é a própria equipe.
 */

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = buscarPost(params.slug)
  if (!post) return { title: 'Post não encontrado — Medflow' }
  return {
    title: `${post.titulo} — Medflow`,
    description: post.resumo,
    openGraph: { title: post.titulo, description: post.resumo, type: 'article' },
  }
}

export default function PaginaPost({ params }: { params: { slug: string } }) {
  const post = buscarPost(params.slug)
  if (!post) notFound()

  return (
    <div className="min-h-screen bg-neutro-50 dark:bg-neutro-950">
      <article className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Link
          href="/#blog"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-neutro-400 hover:text-neutro-600 dark:hover:text-neutro-300"
        >
          <ArrowLeft size={14} strokeWidth={2.2} /> Voltar
        </Link>

        <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-apertado leading-[1.15] mt-6">
          {post.titulo}
        </h1>
        <p className="text-[12.5px] text-neutro-400 mt-3">
          {post.autor} · {formatarData(`${post.data}T12:00:00`)}
        </p>

        <div className="mt-8 space-y-4">
          {post.corpo.split('\n\n').map((bloco, i) => {
            const texto = bloco.trim()
            if (!texto) return null

            if (texto.startsWith('## ')) {
              return (
                <h2 key={i} className="text-[18px] font-semibold tracking-apertado pt-4">
                  {texto.slice(3)}
                </h2>
              )
            }

            if (texto.startsWith('- ')) {
              return (
                <ul key={i} className="space-y-1.5 pl-1">
                  {texto.split('\n').map((linha, j) => (
                    <li
                      key={j}
                      className="text-[14.5px] text-neutro-600 dark:text-neutro-300 leading-relaxed flex gap-2"
                    >
                      <span className="text-brand-600 shrink-0">·</span>
                      {linha.replace(/^- /, '')}
                    </li>
                  ))}
                </ul>
              )
            }

            return (
              <p key={i} className="text-[14.5px] text-neutro-600 dark:text-neutro-300 leading-relaxed">
                {texto}
              </p>
            )
          })}
        </div>
      </article>
    </div>
  )
}
