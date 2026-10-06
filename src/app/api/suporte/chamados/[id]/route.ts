import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { ErroSemPermissao } from '@/lib/tenant'
import { responder } from '@/lib/agenteSuporte'
import { notificar, superAdmins } from '@/lib/notificacoes'

type Params = { params: { id: string } }

const mensagemSchema = z.object({
  texto: z.string().min(1, 'Escreva a mensagem').max(4000),
})

const ajusteSchema = z.object({
  escalar: z.boolean().optional(),
  resolver: z.boolean().optional(),
  reabrir: z.boolean().optional(),
})

/**
 * Carrega o chamado garantindo que quem pede tem direito a ele.
 *
 * São dois donos legítimos da conversa: quem abriu e o SUPER_ADMIN, que é o
 * atendente humano. Qualquer outra pessoa — inclusive o dono do mesmo
 * consultório — recebe 403: chamado é conversa individual, não mural.
 */
async function carregar(id: string) {
  const { usuarioId, papel } = await exigirUsuario()

  const chamado = await prisma.chamado.findUnique({
    where: { id },
    include: {
      mensagens: { orderBy: { criadoEm: 'asc' } },
      usuario: { select: { id: true, nome: true, email: true } },
      consultorio: { select: { id: true, nome: true } },
    },
  })
  if (!chamado) throw new ErroDeNegocio('Chamado não encontrado')

  const ehDonoDaConversa = chamado.usuarioId === usuarioId
  const ehSuporte = papel === 'SUPER_ADMIN'
  if (!ehDonoDaConversa && !ehSuporte) throw new ErroSemPermissao()

  return { chamado, usuarioId, ehSuporte }
}

export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { chamado } = await carregar(params.id)
    return chamado
  })
}

/** Nova mensagem na conversa. */
export async function POST(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { chamado, ehSuporte } = await carregar(params.id)
    const { texto } = mensagemSchema.parse(await req.json())

    if (chamado.status === 'RESOLVIDO') {
      throw new ErroDeNegocio('Este chamado já foi encerrado. Abra um novo para continuar.')
    }

    await prisma.mensagemChamado.create({
      data: { chamadoId: chamado.id, autor: ehSuporte ? 'SUPORTE' : 'USUARIO', texto },
    })

    if (ehSuporte) {
      // Resposta humana: avisa quem abriu o chamado.
      await prisma.chamado.update({
        where: { id: chamado.id },
        data: { status: 'EM_ATENDIMENTO' },
      })
      await notificar({
        usuarioIds: [chamado.usuarioId],
        consultorioId: chamado.consultorioId,
        tipo: 'CHAMADO',
        titulo: 'Resposta do suporte',
        descricao: texto.length > 90 ? `${texto.slice(0, 90)}…` : texto,
        link: '/suporte',
      })
    } else if (!chamado.escalado) {
      // Ainda com o agente: ele responde na hora, na mesma requisição.
      const doAgente = responder(texto)
      await prisma.mensagemChamado.create({
        data: { chamadoId: chamado.id, autor: 'AGENTE', texto: doAgente.texto },
      })
    } else {
      // Já é humano do outro lado: avisa quem atende que chegou mensagem.
      await notificar({
        usuarioIds: await superAdmins(),
        consultorioId: null,
        tipo: 'CHAMADO',
        titulo: `Nova mensagem — ${chamado.consultorio.nome}`,
        descricao: texto.length > 90 ? `${texto.slice(0, 90)}…` : texto,
        link: '/suporte',
      })
    }

    return prisma.chamado.findUnique({
      where: { id: chamado.id },
      include: { mensagens: { orderBy: { criadoEm: 'asc' } } },
    })
  })
}

/** Escalar para atendimento humano, ou encerrar. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { chamado, ehSuporte } = await carregar(params.id)
    const dados = ajusteSchema.parse(await req.json())

    if (dados.resolver) {
      await prisma.chamado.update({
        where: { id: chamado.id },
        data: { status: 'RESOLVIDO' },
      })
      if (ehSuporte) {
        await notificar({
          usuarioIds: [chamado.usuarioId],
          consultorioId: chamado.consultorioId,
          tipo: 'CHAMADO',
          titulo: 'Seu chamado foi encerrado',
          descricao: chamado.assunto,
          link: '/suporte',
        })
      }
    }

    if (dados.reabrir && chamado.status === 'RESOLVIDO') {
      await prisma.chamado.update({
        where: { id: chamado.id },
        data: { status: 'ABERTO' },
      })
    }

    if (dados.escalar && !chamado.escalado) {
      await prisma.chamado.update({
        where: { id: chamado.id },
        data: { escalado: true, status: 'ABERTO' },
      })
      await prisma.mensagemChamado.create({
        data: {
          chamadoId: chamado.id,
          autor: 'AGENTE',
          texto:
            'Pronto — passei sua conversa para atendimento humano. Todo o histórico acima foi junto, então não precisa repetir nada. Você recebe um aviso aqui assim que houver resposta.',
        },
      })
      await notificar({
        usuarioIds: await superAdmins(),
        consultorioId: null,
        tipo: 'CHAMADO',
        titulo: `Chamado aberto — ${chamado.consultorio.nome}`,
        descricao: `${chamado.usuario.nome}: ${chamado.assunto}`,
        link: '/suporte',
      })
    }

    return prisma.chamado.findUnique({
      where: { id: chamado.id },
      include: { mensagens: { orderBy: { criadoEm: 'asc' } } },
    })
  })
}
