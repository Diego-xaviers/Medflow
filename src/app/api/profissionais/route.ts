import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/tenant'
import { rota } from '@/lib/api'

/**
 * Quem atende pacientes no consultório.
 *
 * Existe separado de `/api/usuarios` porque aquela rota é do DONO (traz e-mail
 * e papel de todo mundo) e aqui a atendente também precisa ler, para conseguir
 * marcar consulta. O que sai é só o necessário para preencher um seletor.
 */
export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirSessao()
    // `?equipe=1` traz todo mundo ativo — usado para corrigir quem agendou,
    // que pode ser vendedora ou atendente, não só quem atende.
    const equipe = req.nextUrl.searchParams.get('equipe')

    return prisma.usuario.findMany({
      where: { consultorioId, ativo: true, ...(!equipe && { atendePacientes: true }) },
      select: { id: true, nome: true, fotoUrl: true },
      orderBy: { nome: 'asc' },
    })
  })
}
