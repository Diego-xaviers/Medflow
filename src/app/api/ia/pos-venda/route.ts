import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirTela, ErroPlanoInsuficiente } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { temRecurso } from '@/lib/planos'
import { registrarAuditoria } from '@/lib/auditoria'
import {
  iaConfigurada,
  primeiroNome,
  sugerirContatos,
  TETO_POR_CHAMADA,
  type CandidatoContato,
} from '@/lib/ia'

/**
 * Pós-venda com IA: prioriza a fila de contatos e escreve as mensagens.
 *
 * A tela manda apenas `{ id, motivo }` de cada item. Nome e data NÃO vêm do
 * navegador — são relidos do banco aqui, com `consultorioId` em toda consulta.
 * Dois motivos, e os dois importam:
 *
 *   - isolamento: id de outro consultório não resolve e some da lista;
 *   - injeção: o nome vai dentro do prompt, e nome que veio do cliente é
 *     texto que o cliente escolheu. Vindo do banco, é o que a clínica
 *     cadastrou.
 *
 * Recurso do plano ULTRA (`iaPosVenda` em `planos.ts`). Quem não tem recebe
 * 402 com o nome do plano que abre, como qualquer outro recurso pago.
 */

const corpoSchema = z.object({
  itens: z
    .array(
      z.object({
        id: z.string().min(1),
        motivo: z.enum(['confirmacao', 'remarcar', 'receita', 'retorno', 'financeiro']),
      })
    )
    .min(1)
    .max(TETO_POR_CHAMADA),
})

/** Dias entre hoje e a data: negativo no passado, positivo no futuro. */
function emDias(data: Date): number {
  return Math.round((data.getTime() - Date.now()) / 86_400_000)
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    const { consultorioId, usuarioId, plano } = await exigirTela('/lembretes')

    if (!temRecurso(plano, 'iaPosVenda')) {
      throw new ErroPlanoInsuficiente(
        'O pós-venda com IA faz parte do plano Ultra. Veja em Cobrança como mudar de plano.'
      )
    }
    if (!iaConfigurada()) {
      throw new ErroDeNegocio('O pós-venda com IA ainda não foi ativado. Fale com o suporte.')
    }

    const { itens } = corpoSchema.parse(await req.json())
    const idsPor = (motivo: string) =>
      itens.filter((i) => i.motivo === motivo).map((i) => i.id)

    const idsConsulta = [...idsPor('confirmacao'), ...idsPor('remarcar')]
    const idsReceita = idsPor('receita')
    const idsPaciente = idsPor('retorno')
    const idsLancamento = idsPor('financeiro')

    const [consultas, receitas, pacientes, lancamentos, consultorio] = await Promise.all([
      idsConsulta.length
        ? prisma.consulta.findMany({
            where: { consultorioId, id: { in: idsConsulta } },
            select: { id: true, dataHora: true, paciente: { select: { nome: true } } },
          })
        : [],
      idsReceita.length
        ? prisma.receita.findMany({
            where: { consultorioId, id: { in: idsReceita } },
            select: { id: true, validadeAte: true, paciente: { select: { nome: true } } },
          })
        : [],
      idsPaciente.length
        ? prisma.paciente.findMany({
            where: { consultorioId, id: { in: idsPaciente } },
            select: {
              id: true,
              nome: true,
              consultas: { select: { dataHora: true }, orderBy: { dataHora: 'desc' }, take: 1 },
              prontuarios: { select: { dataExame: true }, orderBy: { dataExame: 'desc' }, take: 1 },
            },
          })
        : [],
      idsLancamento.length
        ? prisma.lancamento.findMany({
            where: { consultorioId, id: { in: idsLancamento } },
            select: { id: true, data: true, paciente: { select: { nome: true } } },
          })
        : [],
      prisma.consultorio.findUniqueOrThrow({
        where: { id: consultorioId },
        select: { nome: true },
      }),
    ])

    const porMotivo = new Map(itens.map((i) => [i.id, i.motivo]))
    const candidatos: CandidatoContato[] = []

    for (const c of consultas) {
      candidatos.push({
        id: c.id,
        motivo: (porMotivo.get(c.id) ?? 'confirmacao') as CandidatoContato['motivo'],
        primeiroNome: primeiroNome(c.paciente.nome),
        dias: emDias(c.dataHora),
      })
    }
    for (const r of receitas) {
      if (!r.validadeAte) continue
      candidatos.push({
        id: r.id,
        motivo: 'receita',
        primeiroNome: primeiroNome(r.paciente.nome),
        dias: emDias(r.validadeAte),
      })
    }
    for (const p of pacientes) {
      // O mais recente entre a última consulta e o último exame — mesma regra
      // da fila em `/api/lembretes`.
      const datas = [p.consultas[0]?.dataHora, p.prontuarios[0]?.dataExame].filter(
        Boolean
      ) as Date[]
      candidatos.push({
        id: p.id,
        motivo: 'retorno',
        primeiroNome: primeiroNome(p.nome),
        dias: datas.length ? emDias(new Date(Math.max(...datas.map((d) => d.getTime())))) : -400,
      })
    }
    for (const l of lancamentos) {
      candidatos.push({
        id: l.id,
        motivo: 'financeiro',
        primeiroNome: primeiroNome(l.paciente?.nome ?? 'cliente'),
        dias: emDias(l.data),
      })
    }

    if (candidatos.length === 0) {
      throw new ErroDeNegocio('Nenhum contato desta lista foi encontrado.')
    }

    const sugestoes = await sugerirContatos(candidatos, { clinica: consultorio.nome })

    // Fica na trilha porque é dado de paciente saindo para um terceiro: o
    // quanto, quando e por quem precisa ser auditável depois.
    registrarAuditoria({
      acao: 'EDITAR',
      entidade: 'PosVendaIA',
      entidadeId: consultorioId,
      detalhes: `Sugestões geradas para ${candidatos.length} contato(s)`,
      usuarioId,
      consultorioId,
    })

    return { sugestoes }
  })
}
