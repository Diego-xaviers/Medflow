/**
 * O que cada plano libera.
 *
 * Esta é a QUARTA camada de permissão do sistema, e ela pergunta uma coisa
 * diferente das outras três:
 *
 *   papel      (permissoes.ts)  → quem você é
 *   teto       (TetoAcesso)     → até onde a rede deixa esse papel ir
 *   telas      (Usuario.telas)  → o que o dono ligou para essa pessoa
 *   PLANO      (este arquivo)   → o que o consultório comprou
 *
 * As três primeiras são sobre a PESSOA; esta é sobre o TENANT. Por isso mora
 * fora de `permissoes.ts`: misturar as duas perguntas num arquivo só faria o
 * "não pode" virar uma resposta sem causa — e a causa importa, porque uma se
 * resolve em Equipe e a outra se resolve pagando.
 *
 * Sem Prisma e sem nada de Node aqui, pela mesma razão que `permissoes.ts`:
 * o middleware roda no runtime edge e quebra se este módulo arrastar servidor.
 */

import { rotaBate } from './permissoes'

export type PlanoNome = 'BASICO' | 'PRO' | 'ULTRA'

/**
 * Do mais barato ao mais caro. É o que dá sentido a "plano mínimo".
 *
 * Exportado porque a vitrine e a tela de Cobrança precisam percorrer os
 * planos em ordem — e cada uma escrevendo a própria lista era como a ordem
 * saía errada num lugar só.
 */
export const ORDEM_PLANOS: PlanoNome[] = ['BASICO', 'PRO', 'ULTRA']

/**
 * Os planos que se vendem: vitrine, cadastro, admin e "subir de plano".
 * BASICO saiu da venda em 26/11/2026 e só existe para ranking e cliente legado.
 */
export const PLANOS_A_VENDA: PlanoNome[] = ['PRO', 'ULTRA']

/**
 * Telas que EXIGEM plano, e qual o mínimo.
 *
 * Lista de exceções, não de permissões: tela que não está aqui não depende de
 * plano nenhum. Foi escolhido assim porque o conjunto que não depende é muito
 * maior — e porque o default seguro é "continua funcionando". Um esquecimento
 * aqui libera uma tela que devia ser paga; o inverso (whitelist) derrubaria
 * Perfil, Cobrança e Suporte no primeiro deploy, trancando o cliente fora da
 * única tela que resolve o problema dele.
 */
const PLANO_MINIMO: Record<string, PlanoNome> = {
  '/encaminhamentos': 'PRO',
  '/financeiro': 'PRO',
  '/relatorios': 'PRO',
  // '/ia' fica de fora de propósito: o Assistente IA abre para todos os
  // planos, como vitrine do Ultra. Quem trava é o recurso `iaPosVenda`,
  // checado em toda rota /api/ia/*.
}

/** Recursos que não são tela — checados pelas rotas de API, não pelo menu. */
export interface Recursos {
  /** Link público `/agendar/{slug}`: paciente marca sozinho. */
  agendamentoPublico: boolean
  /** Motor de retorno pós-venda com IA. */
  iaPosVenda: boolean
  crm: boolean
  analiseCrescimento: boolean
}

export const RECURSOS: Record<PlanoNome, Recursos> = {
  BASICO: { agendamentoPublico: false, iaPosVenda: false, crm: false, analiseCrescimento: false },
  PRO:    { agendamentoPublico: true,  iaPosVenda: false, crm: false, analiseCrescimento: false },
  ULTRA:  { agendamentoPublico: true,  iaPosVenda: true,  crm: true,  analiseCrescimento: true  },
}

/**
 * Quantos usuários ativos cabem. `null` = sem limite.
 *
 * É a alavanca principal do PRO, e é continuidade do modelo antigo: o Medflow
 * sempre cobrou por acesso (R$100 cada). O plano só empacota isso melhor —
 * clínica com secretária não cabe no BASICO e sobe sozinha, sem venda.
 *
 * `null` em vez de Infinity porque este número atravessa JSON, e
 * `JSON.stringify(Infinity)` devolve `null` de qualquer forma — melhor ser
 * explícito do que depender desse acidente.
 */
export const TETO_USUARIOS: Record<PlanoNome, number | null> = {
  BASICO: 1,
  PRO: 5,
  ULTRA: null,
}

/**
 * Preço de tabela, só para EXIBIR.
 *
 * Não é o que o cliente paga: quem manda na cobrança é
 * `Consultorio.valorMensalidade`, que o administrador digita e vai para o
 * Asaas em `src/lib/asaas.ts`. Essa separação é de propósito — é ela que
 * permite preço negociado, desconto de rede e cliente fundador congelado sem
 * nenhuma regra de desconto no código.
 */
export const PRECO_TABELA: Record<PlanoNome, number> = {
  BASICO: 0, // legado, fora da venda
  PRO: 149,
  ULTRA: 697,
}

export const ROTULO: Record<PlanoNome, string> = {
  BASICO: 'Básico',
  PRO: 'Pro',
  ULTRA: 'Ultra',
}

/** Para a tela de Cobrança dizer o que o cliente tem e o que ganharia subindo. */
export const INCLUI: Record<PlanoNome, string[]> = {
  BASICO: ['Agenda', 'Pacientes', 'Prontuários', 'Receitas', '1 usuário'],
  PRO: [
    'Agenda, pacientes, prontuários e receitas',
    'Até 5 usuários',
    'Agendamento público (link e QR)',
    'Financeiro',
    'Relatórios',
    'Central de disparos',
    'Encaminhamentos',
  ],
  ULTRA: [
    'Tudo do Pro',
    'Usuários ilimitados',
    'Assistente IA no WhatsApp (ativo em até 24 h)',
    'CRM integrado',
    'Análise de crescimento',
  ],
}

/** O plano é igual ou melhor que o mínimo pedido? */
export function planoAtende(plano: PlanoNome, minimo: PlanoNome): boolean {
  return ORDEM_PLANOS.indexOf(plano) >= ORDEM_PLANOS.indexOf(minimo)
}

/**
 * O plano deste consultório abre esta tela?
 *
 * Mesma assinatura e mesma forma de `podeAbrir`, para o menu e o middleware
 * poderem chamar os dois lado a lado sem pensar.
 */
export function planoLibera(plano: PlanoNome | undefined, caminho: string): boolean {
  // Sem plano no token (sessão antiga, super admin, gestor) não é motivo para
  // barrar: quem barra por papel é `podeAbrir`. Aqui só o plano fala.
  if (!plano) return true

  const exigida = Object.keys(PLANO_MINIMO).find((rota) => rotaBate(rota, caminho))
  if (!exigida) return true

  return planoAtende(plano, PLANO_MINIMO[exigida])
}

/** O plano mínimo que abriria esta tela — para a mensagem dizer qual comprar. */
export function planoNecessario(caminho: string): PlanoNome | null {
  const exigida = Object.keys(PLANO_MINIMO).find((rota) => rotaBate(rota, caminho))
  return exigida ? PLANO_MINIMO[exigida] : null
}

/** Tem o recurso? Use nas rotas de API — recurso não é tela. */
export function temRecurso(plano: PlanoNome | undefined, recurso: keyof Recursos): boolean {
  if (!plano) return false
  return RECURSOS[plano][recurso]
}

/** Cabe mais um usuário ativo? */
export function cabeMaisUsuario(plano: PlanoNome, ativosHoje: number): boolean {
  const teto = TETO_USUARIOS[plano]
  return teto === null || ativosHoje < teto
}
