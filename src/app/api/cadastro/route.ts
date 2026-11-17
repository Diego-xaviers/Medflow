import { NextRequest } from 'next/server'
import { rota, ErroDeNegocio } from '@/lib/api'
import { cadastroSchema } from '@/lib/schemas'
import { criarConsultorioComDono } from '@/lib/consultorio'
import { tentativaPermitida, registrarTentativa } from '@/lib/rateLimit'
import { registrarAuditoria } from '@/lib/auditoria'
import { PRECO_TABELA } from '@/lib/planos'
import { asaasConfigurado } from '@/lib/asaas'
import { WHATSAPP_CONTATO, temWhatsApp } from '@/lib/contato'

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
 * A conta nasce TRANCADA (`exigePagamentoInicial`), e só abre quando a
 * primeira mensalidade é confirmada pelo webhook do Asaas. O caminho da
 * pessoa é: cadastra → cai em Cobrança → escolhe PIX ou cartão → paga → usa.
 * Enquanto não paga, sobram Cobrança, Perfil e Suporte, que é o mínimo para
 * pagar e pedir ajuda.
 *
 * Por isso a rota recusa cadastro quando o Asaas não está configurado: sem
 * gateway, a conta nasceria trancada sem nenhuma forma de destravar, e a
 * pessoa ficaria com login, dados e nada para fazer.
 *
 * O plano escolhido aqui é o que ela ENXERGA; o valor que ela paga é o preço
 * de tabela desse plano, e as duas coisas seguem separadas no Medflow — o
 * admin pode negociar outro valor depois sem mexer no plano.
 */
export async function POST(req: NextRequest) {
  return rota(async () => {
    // A mensagem muda conforme exista canal de contato: mandar falar no
    // WhatsApp sem número configurado é beco sem saída para quem está do
    // outro lado tentando virar cliente.
    if (!asaasConfigurado()) {
      throw new ErroDeNegocio(
        temWhatsApp()
          ? `O cadastro online está temporariamente indisponível. Fale com a gente no WhatsApp ${WHATSAPP_CONTATO} e abrimos sua conta.`
          : 'O cadastro online está temporariamente indisponível. Tente novamente mais tarde.'
      )
    }

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
      // Paga para entrar.
      exigePagamentoInicial: true,
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
