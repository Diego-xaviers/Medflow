import { NextRequest } from 'next/server'
import { rota, ErroDeNegocio } from '@/lib/api'
import { cadastroSchema } from '@/lib/schemas'
import { criarConsultorioComDono } from '@/lib/consultorio'
import { tentativaPermitida, registrarTentativa } from '@/lib/rateLimit'
import { registrarAuditoria } from '@/lib/auditoria'
import { PRECO_TABELA } from '@/lib/planos'

/**
 * Cadastro feito pela própria pessoa, sem login e sem administrador.
 *
 * É a única rota que CRIA um tenant sem ninguém autenticado, então é a única
 * que precisa se defender de volume: o resto do sistema é protegido por
 * `exigirSessao()`, e aqui não há sessão nenhuma para exigir.
 *
 * O freio reaproveita o contador do login (`tentativaLogin`) de propósito:
 * é a mesma pergunta — quantas vezes este IP tentou criar credencial nos
 * últimos 15 minutos — e uma tabela separada só para isto teria que ser
 * limpa, monitorada e lembrada por quem mexesse no outro freio depois.
 *
 * A conta nasce sem fatura, e `situacaoDaConta` só bloqueia com fatura
 * vencida além da carência — então a pessoa entra e usa o sistema na hora.
 * A primeira cobrança é gerada quando o administrador define a mensalidade
 * (veja `src/lib/asaas.ts`): o plano escolhido aqui é o que ela ENXERGA, não
 * o que ela paga, e essas duas coisas vivem separadas no Medflow inteiro.
 */
export async function POST(req: NextRequest) {
  return rota(async () => {
    const dados = cadastroSchema.parse(await req.json())

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconhecido'
    const email = dados.emailDono.toLowerCase().trim()

    if (!(await tentativaPermitida(email, ip))) {
      throw new ErroDeNegocio('Muitas tentativas. Tente novamente em alguns minutos.')
    }

    const consultorio = await criarConsultorioComDono({
      ...dados,
      // Preço de tabela do plano escolhido: é o que destrava a assinatura na
      // tela de Cobrança sem precisar de administrador no meio.
      valorMensalidade: PRECO_TABELA[dados.plano],
    })

    // Conta no freio só depois de criar: tentativa que morreu na validação do
    // Zod não é tentativa de criar credencial, e contá-la deixaria alguém
    // trancado por ter errado o próprio e-mail duas vezes.
    await registrarTentativa(email, ip)

    // O aceite dos termos precisa ficar registrado em algum lugar para valer
    // alguma coisa. A trilha de auditoria é esse lugar: tem IP, data e quem.
    registrarAuditoria({
      acao: 'CADASTRO_PUBLICO',
      entidade: 'Consultorio',
      entidadeId: consultorio.id,
      detalhes: `Plano ${dados.plano}; termos aceitos por ${email}`,
      ip,
      consultorioId: consultorio.id,
    })

    // Devolve só o que a tela precisa para logar em seguida: o objeto do
    // Prisma traz o consultório inteiro, e nada disso é da conta do browser.
    return { ok: true }
  })
}
