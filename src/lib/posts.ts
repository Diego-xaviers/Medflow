/**
 * Os textos do blog, em dados — sem CMS e sem banco.
 *
 * Um post é conteúdo que muda de mês em mês e precisa de alguém escrevendo;
 * não é dado de cliente. Então vive no código: entra junto com o deploy, é
 * versionado pelo git e não custa nem uma tabela nem uma consulta.
 *
 * Lista vazia esconde a seção na vitrine e faz `/blog` responder 404. Seção de
 * blog vazia é pior que seção nenhuma: dá a impressão de site abandonado.
 */

export interface Post {
  /** Pedaço final da URL: /blog/{slug}. Só minúsculas, números e hífen. */
  slug: string
  titulo: string
  /** Uma ou duas frases — é o que aparece no cartão da vitrine. */
  resumo: string
  /** AAAA-MM-DD. Ordena a listagem, da mais nova para a mais antiga. */
  data: string
  /** Quem escreveu, como deve ser creditado. */
  autor: string
  /**
   * O texto. Parágrafos separados por linha em branco; linha começando com
   * `## ` é subtítulo e com `- ` é item de lista. É o mínimo para um post
   * legível — markdown de verdade exigiria biblioteca e sanitização.
   */
  corpo: string
}

export const POSTS: Post[] = []

/** Da mais nova para a mais antiga. */
export const postsRecentes = (quantos = 3): Post[] =>
  [...POSTS].sort((a, b) => b.data.localeCompare(a.data)).slice(0, quantos)

export const buscarPost = (slug: string): Post | undefined =>
  POSTS.find((p) => p.slug === slug)
