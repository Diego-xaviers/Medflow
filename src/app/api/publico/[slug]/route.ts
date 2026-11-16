import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rota, ErroDeNegocio } from '@/lib/api'
import { diasAtendidos, resumoExpediente } from '@/lib/agenda'
import { temRecurso, type PlanoNome } from '@/lib/planos'

type Params = { params: { slug: string } }

/**
 * Dados públicos do consultório. Repare no `select`: só sai daqui o que a
 * página de agendamento precisa mostrar. Id de paciente, financeiro e
 * qualquer coisa interna nunca são expostos nesta rota sem login.
 *
 * Os profissionais saem com id — é o que o paciente escolhe e o que volta no
 * agendamento. É um id de agenda pública, não uma credencial: sozinho ele não
 * abre nada, porque toda rota autenticada continua exigindo sessão.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  return rota(async () => {
    const consultorio = await prisma.consultorio.findFirst({
      where: { slug: params.slug, ativo: true },
      select: {
        plano: true,
        nome: true,
        telefone: true,
        endereco: true,
        duracaoConsultaMin: true,
        fusoHorario: true,
        blocosExpediente: { select: { diaSemana: true, inicioMin: true, fimMin: true } },
        usuarios: {
          where: { ativo: true, OR: [{ papel: 'VENDEDORA' }, { atendePacientes: true }] },
          select: {
            id: true,
            nome: true,
            papel: true,
            fotoUrl: true,
            atendePacientes: true,
          },
          orderBy: { nome: 'asc' },
        },
      },
    })
    if (!consultorio) throw new ErroDeNegocio('Link de agendamento inválido')

    // Agendamento público é recurso do PRO. Lê o plano do BANCO porque aqui
    // não existe sessão — é página aberta. E devolve a mesma mensagem de link
    // inválido de propósito: quem está de fora não precisa saber que a clínica
    // existe e está num plano menor.
    if (!temRecurso(consultorio.plano as PlanoNome, 'agendamentoPublico')) {
      throw new ErroDeNegocio('Link de agendamento inválido')
    }

    return {
      nome: consultorio.nome,
      telefone: consultorio.telefone,
      endereco: consultorio.endereco,
      duracaoConsultaMin: consultorio.duracaoConsultaMin,
      diasAtendimento: diasAtendidos(consultorio),
      resumoExpediente: resumoExpediente(consultorio),
      profissionais: consultorio.usuarios
        .filter((u) => u.atendePacientes)
        .map((u) => ({ id: u.id, nome: u.nome, fotoUrl: u.fotoUrl })),
      vendedoras: consultorio.usuarios
        .filter((u) => u.papel === 'VENDEDORA')
        .map((u) => u.nome),
    }
  })
}
