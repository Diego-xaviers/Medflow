/**
 * A base que o agente de suporte consulta — e a mesma que vira o FAQ da tela.
 *
 * Fica num arquivo só para as duas coisas nunca divergirem: seria péssimo o
 * agente responder uma coisa e a pergunta frequente logo abaixo dizer outra.
 * Cada item traz as palavras que costumam aparecer quando alguém pergunta
 * sobre aquilo — é por elas que o agente encontra a resposta.
 */

export interface ItemConhecimento {
  id: string
  pergunta: string
  resposta: string
  /** Sem acento e em minúsculas: é assim que a busca compara. */
  termos: string[]
}

export const BASE: ItemConhecimento[] = [
  {
    id: 'link-publico',
    pergunta: 'Como recebo agendamentos pelo link público?',
    resposta:
      'Em Configurações você encontra o link do seu consultório (algo como /agendar/sua-otica). Mande no WhatsApp ou coloque na bio do Instagram. Quem abrir escolhe o profissional, vê só os horários livres do seu expediente, escolhe um, e a consulta cai direto na Agenda marcada como "Online".',
    termos: ['link', 'publico', 'agendamento online', 'compartilhar', 'instagram', 'whatsapp', 'divulgar', 'calendly'],
  },
  {
    id: 'expediente',
    pergunta: 'Como mudo meu horário de atendimento?',
    resposta:
      'Configurações → Expediente. Você define a hora de abrir, a de fechar, quanto dura cada consulta e quais dias da semana atende. O link público passa a oferecer exatamente esses horários — não precisa avisar ninguém nem esperar atualização do sistema.',
    termos: ['horario', 'expediente', 'abrir', 'fechar', 'funcionamento', 'duracao', 'sabado', 'domingo', 'dias'],
  },
  {
    id: 'prontuario-receita',
    pergunta: 'Qual a diferença entre Prontuário e Receita?',
    resposta:
      'Prontuário é o exame: anamnese, acuidade visual, refração encontrada, tonometria, diagnóstico e conduta. Receita é a prescrição que o paciente leva para a ótica. Ao emitir uma receita você pode vinculá-la ao exame: o grau medido entra preenchido e você só ajusta o que for preciso — sem digitar duas vezes, e sem alterar o prontuário.',
    termos: ['prontuario', 'receita', 'diferenca', 'exame', 'prescricao', 'grau', 'refracao', 'herdar', 'vincular'],
  },
  {
    id: 'falta',
    pergunta: 'O paciente não apareceu. O que eu faço?',
    resposta:
      'Na Agenda, passe o mouse sobre o atendimento e clique no X para marcar como Falta. A partir daí ele entra automaticamente em Lembretes → Remarcar faltas, com a mensagem de WhatsApp já escrita. Se ele remarcar, some da lista sozinho.',
    termos: ['falta', 'faltou', 'nao apareceu', 'remarcar', 'ausencia', 'desmarcar', 'cancelar'],
  },
  {
    id: 'equipe',
    pergunta: 'Como dou acesso para a atendente ou para uma vendedora?',
    resposta:
      'Menu Equipe (visível só para o dono) → Novo usuário. Você define nome, e-mail e uma senha provisória, que a pessoa troca depois em Perfil. A vendedora enxerga apenas a Agenda; a atendente toca a operação inteira, menos a administração da equipe.',
    termos: ['equipe', 'acesso', 'usuario', 'vendedora', 'atendente', 'permissao', 'senha provisoria', 'cadastrar pessoa'],
  },
  {
    id: 'profissional',
    pergunta: 'Como coloco mais de um profissional na agenda?',
    resposta:
      'Em Equipe, marque a pessoa como "Atende". Ela passa a aparecer como profissional escolhível no link público e no agendamento interno, com agenda própria: dois profissionais podem atender no mesmo horário sem conflito.',
    termos: ['profissional', 'atende', 'optometrista', 'medico', 'doutor', 'varios', 'segundo', 'agenda separada'],
  },
  {
    id: 'isolamento',
    pergunta: 'Os dados do meu consultório aparecem para outro consultório?',
    resposta:
      'Não. Cada consultório é um espaço isolado: toda informação carrega a marca de quem é dona dela, e essa marca vem da sua sessão de login — nunca do que o navegador manda. Não existe consulta no sistema capaz de devolver dados de outro consultório.',
    termos: ['dados', 'outro consultorio', 'privacidade', 'seguranca', 'isolamento', 'vazamento', 'lgpd'],
  },
  {
    id: 'conflito',
    pergunta: 'Duas pessoas podem marcar o mesmo horário pelo link?',
    resposta:
      'Não. Além de a tela esconder horários ocupados, o próprio banco de dados recusa um segundo agendamento no mesmo horário com o mesmo profissional. Se duas pessoas clicarem no mesmo instante, uma confirma e a outra recebe o aviso de que o horário acabou de ser preenchido.',
    termos: ['mesmo horario', 'conflito', 'duplicado', 'duas pessoas', 'choque', 'sobreposicao'],
  },
  {
    id: 'financeiro',
    pergunta: 'O que entra nos números do Financeiro e dos Relatórios?',
    resposta:
      'Receitas e despesas contam apenas lançamentos marcados como PAGO. O que está PENDENTE aparece separado, como valor a receber — e quando passa da data, vira lembrete de cobrança. A taxa de comparecimento compara consultas concluídas com faltas, ignorando as canceladas.',
    termos: ['financeiro', 'relatorio', 'faturamento', 'numeros', 'pago', 'pendente', 'receita mensal', 'ticket'],
  },
  {
    id: 'senha',
    pergunta: 'Como troco minha senha?',
    resposta:
      'Menu do canto superior direito → Editar perfil, ou o item Perfil no menu lateral. Lá você troca a senha informando a atual, e também pode enviar sua foto.',
    termos: ['senha', 'trocar senha', 'esqueci', 'password', 'foto', 'perfil', 'avatar'],
  },
]

/** Remove acento e caixa para comparar o que a pessoa escreveu com os termos. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
