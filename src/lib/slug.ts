import { prisma } from './prisma'

/** Transforma "Ótica Juara Centro" em "otica-juara-centro-a3f9". */
export async function gerarSlugUnico(nome: string): Promise<string> {
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  // O sufixo aleatório evita colisão entre óticas de mesmo nome e também
  // impede que alguém adivinhe o link de outro consultório.
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const sufixo = Math.random().toString(36).slice(2, 6)
    const slug = `${base}-${sufixo}`
    const existe = await prisma.consultorio.findUnique({ where: { slug }, select: { id: true } })
    if (!existe) return slug
  }
  throw new Error('Não foi possível gerar um slug único')
}
