import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rota, ErroDeNegocio } from '@/lib/api'
import { agendamentoPublicoSchema } from '@/lib/schemas'
import { dentroDoExpediente } from '@/lib/agenda'
import { exigirSemAusencia } from '@/lib/ausencias'
import { notificar, equipeDoConsultorio } from '@/lib/notificacoes'
import { dataHora as fmtDataHora } from '@/lib/formato'
import { temRecurso, type PlanoNome } from '@/lib/planos'

type Params = { params: { slug: string } }

/**
 * Cria o agendamento vindo do link público. Como não há login aqui, o
 * consultório é resolvido SOMENTE pelo slug da URL — nada vem do corpo
 * da requisição que possa apontar para outro consultório.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const dados = agendamentoPublicoSchema.parse(await req.json())

    const consultorio = await prisma.consultorio.findFirst({
      where: { slug: params.slug, ativo: true },
      select: {
        id: true,
        plano: true,
        nome: true,
        duracaoConsultaMin: true,
        fusoHorario: true,
        blocosExpediente: { select: { diaSemana: true, inicioMin: true, fimMin: true } },
      },
    })
    if (!consultorio) throw new ErroDeNegocio('Link de agendamento inválido')

    // A vitrine já barra pelo plano, mas esta é a rota que ESCREVE — e rota
    // que escreve não confia na tela. Sem isto, um POST direto criaria
    // paciente e consulta num consultório que não paga pelo recurso.
    if (!temRecurso(consultorio.plano as PlanoNome, 'agendamentoPublico')) {
      throw new ErroDeNegocio('Link de agendamento inválido')
    }

    // O profissional escolhido tem que ser deste consultório e atender
    // pacientes. Sem esta checagem, um id de outro consultório coloraria
    // a consulta na agenda de quem não deveria.
    const profissional = await prisma.usuario.findFirst({
      where: {
        id: dados.profissionalId,
        consultorioId: consultorio.id,
        ativo: true,
        atendePacientes: true,
      },
      select: { id: true, nome: true },
    })
    if (!profissional) throw new ErroDeNegocio('Profissional indisponível')

    if (dados.dataHora < new Date()) {
      throw new ErroDeNegocio('Esse horário já passou')
    }
    // Revalidamos no servidor: a lista de horários da tela é só a vitrine,
    // quem decide o que é horário válido é esta checagem.
    if (!dentroDoExpediente(consultorio, dados.dataHora)) {
      throw new ErroDeNegocio('Horário fora do período de atendimento')
    }
    await exigirSemAusencia(consultorio.id, profissional.id, dados.dataHora, consultorio.duracaoConsultaMin)

    // Cria paciente e consulta juntos. Se a consulta falhar (por exemplo,
    // alguém pegou o horário no meio do caminho), o paciente não fica
    // órfão no banco — a transação desfaz tudo.
    try {
      const consulta = await prisma.$transaction(async (tx) => {
        const paciente = await tx.paciente.create({
          data: {
            nome: dados.nome.trim(),
            telefone: dados.telefone.trim(),
            origemContato: 'Link público',
            consultorioId: consultorio.id,
          },
        })

        return tx.consulta.create({
          data: {
            pacienteId: paciente.id,
            profissionalId: profissional.id,
            dataHora: dados.dataHora,
            status: 'AGENDADA',
            telefoneContato: dados.telefone.trim(),
            vendedoraResponsavel: dados.vendedoraResponsavel || null,
            origemPublica: true,
            consultorioId: consultorio.id,
          },
        })
      })

      await notificar({
        usuarioIds: await equipeDoConsultorio(consultorio.id),
        consultorioId: consultorio.id,
        tipo: 'AGENDAMENTO',
        titulo: `Novo agendamento online — ${dados.nome.trim()}`,
        descricao: `${fmtDataHora(consulta.dataHora)} com ${profissional.nome}`,
        link: '/agenda',
      })

      return {
        mensagem: 'Agendamento confirmado',
        dataHora: consulta.dataHora,
        profissional: profissional.nome,
      }
    } catch (erro: any) {
      // P2002 = violação da unique [consultorioId, profissionalId, dataHora]:
      // duas pessoas clicaram no mesmo horário quase ao mesmo tempo. O banco
      // é quem garante que só uma passa.
      if (erro?.code === 'P2002') {
        throw new ErroDeNegocio('Esse horário acabou de ser preenchido. Escolha outro.')
      }
      throw erro
    }
  })
}
