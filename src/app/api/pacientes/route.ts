import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { pacienteSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE', 'VENDEDORA')
    const busca = req.nextUrl.searchParams.get('busca')?.trim()

    return prisma.paciente.findMany({
      where: {
        consultorioId, // sempre — sem isto, vazaria dados de outro consultório
        ...(busca && {
          OR: [
            { nome: { contains: busca, mode: 'insensitive' } },
            { email: { contains: busca, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { nome: 'asc' },
    })
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO', 'ATENDENTE', 'VENDEDORA')
    const corpo = await req.json()
    const cadastroRapido = Boolean(corpo.cadastroRapido)
    const dados = pacienteSchema.parse(corpo)

    const paciente = await prisma.paciente.create({
      data: { ...dados, email: dados.email || null, consultorioId },
    })

    // Cadastro rápido: avisa todos os usuários ativos da clínica para
    // completarem a ficha antes da consulta.
    if (cadastroRapido) {
      const usuarios = await prisma.usuario.findMany({
        where: { consultorioId, ativo: true },
        select: { id: true },
      })
      await prisma.notificacao.createMany({
        data: usuarios.map((u) => ({
          usuarioId: u.id,
          consultorioId,
          tipo: 'EQUIPE',
          titulo: `Cadastro incompleto: ${paciente.nome}`,
          descricao: 'Nome e telefone registrados. Complete data de nascimento, CPF e demais dados para o prontuário.',
          link: `/pacientes?paciente=${paciente.id}`,
        })),
      })
    }

    return paciente
  })
}
