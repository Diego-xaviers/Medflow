import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Uso — Medflow',
  description: 'Termos e condições de uso da plataforma Medflow.',
}

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-neutro-50 dark:bg-neutro-950 py-12 px-4">
      <article className="max-w-2xl mx-auto prose prose-neutro dark:prose-invert prose-sm sm:prose-base">

        <div className="not-prose mb-8">
          <Link href="/" className="text-brand-600 text-sm hover:underline">← Voltar</Link>
        </div>

        <h1>Termos de Uso</h1>
        <p className="lead">
          Ao usar o Medflow, o contratante concorda com estes termos. Leia com atenção antes de
          utilizar a plataforma.
        </p>
        <p className="text-neutro-500 text-sm">Última atualização: 31 de agosto de 2026.</p>

        <h2>1. Serviço</h2>
        <p>
          O Medflow é uma plataforma SaaS de gestão clínica para clínicas e consultórios de
          optometria e oftalmologia, desenvolvida por <strong>DX Creative</strong>. O serviço
          inclui agendamento, prontuário eletrônico, emissão de receitas e gestão financeira.
        </p>

        <h2>2. Conta e acesso</h2>
        <ul>
          <li>
            Cada consultório contratante é responsável pela criação e gestão das contas de sua
            equipe.
          </li>
          <li>
            As credenciais de acesso são pessoais e intransferíveis. O contratante responde por
            qualquer uso não autorizado.
          </li>
          <li>
            O Medflow pode suspender acessos que apresentem comportamento abusivo ou violação
            destes termos, sem aviso prévio em casos de segurança.
          </li>
        </ul>

        <h2>3. Dados e responsabilidades</h2>
        <p>
          O consultório contratante é o <strong>controlador de dados</strong> nos termos da
          LGPD e é responsável por:
        </p>
        <ul>
          <li>Obter o consentimento adequado dos pacientes para o tratamento de seus dados.</li>
          <li>Garantir a exatidão dos dados inseridos na plataforma.</li>
          <li>
            Manter sigilo sobre as informações de pacientes conforme o Código de Ética das
            profissões de saúde e a LGPD.
          </li>
          <li>
            Informar imediatamente o Medflow sobre qualquer incidente de segurança que tome
            conhecimento.
          </li>
        </ul>

        <h2>4. Uso adequado</h2>
        <p>É vedado usar o Medflow para:</p>
        <ul>
          <li>Qualquer atividade ilegal ou contrária à ética profissional.</li>
          <li>Inserção de dados falsos ou fraudulentos.</li>
          <li>Tentativas de acesso não autorizado a dados de outros consultórios.</li>
          <li>Engenharia reversa, cópia ou redistribuição do software.</li>
          <li>Ações que comprometam a disponibilidade ou a integridade da plataforma.</li>
        </ul>

        <h2>5. Pagamento e suspensão</h2>
        <ul>
          <li>O serviço é cobrado por assinatura mensal, com vencimento conforme a fatura emitida.</li>
          <li>
            Após o vencimento, há um período de carência definido pelo administrador. Decorrido
            esse prazo sem pagamento, o acesso é suspenso automaticamente.
          </li>
          <li>
            Durante a suspensão, os dados são preservados. O acesso é restaurado assim que o
            pagamento for confirmado.
          </li>
          <li>
            O cancelamento definitivo deve ser solicitado por e-mail. Após 30 dias do
            cancelamento, os dados podem ser eliminados.
          </li>
        </ul>

        <h2>6. Disponibilidade</h2>
        <p>
          O Medflow busca disponibilidade contínua, mas não garante a ausência de
          interrupções. Manutenções programadas serão comunicadas com antecedência sempre que
          possível. Não nos responsabilizamos por danos decorrentes de indisponibilidade da
          plataforma, da infraestrutura de hospedagem ou da conexão do contratante.
        </p>

        <h2>7. Limitação de responsabilidade</h2>
        <p>
          O Medflow é uma ferramenta de apoio à gestão. A responsabilidade clínica pelas
          prescrições, diagnósticos e condutas é exclusiva dos profissionais de saúde
          habilitados que utilizam a plataforma. Não nos responsabilizamos por decisões
          clínicas tomadas com base nos dados registrados.
        </p>

        <h2>8. Propriedade intelectual</h2>
        <p>
          O código, o design e as funcionalidades do Medflow são de propriedade da DX Creative.
          Os dados inseridos pelo contratante permanecem de sua propriedade. A contratação
          concede apenas o direito de uso da plataforma, não de cópia ou distribuição.
        </p>

        <h2>9. Alterações nos termos</h2>
        <p>
          Estes termos podem ser atualizados. Mudanças relevantes serão notificadas dentro da
          plataforma com pelo menos 15 dias de antecedência. O uso continuado após a vigência
          das alterações implica aceitação.
        </p>

        <h2>10. Foro e lei aplicável</h2>
        <p>
          Estes termos são regidos pelas leis brasileiras. Para qualquer controvérsia, fica
          eleito o foro da comarca do domicílio do contratante, com preferência para solução
          amigável prévia.
        </p>

        <div className="not-prose mt-12 pt-8 border-t border-neutro-200 dark:border-neutro-800 text-center">
          <p className="text-sm text-neutro-400">
            Dúvidas?{' '}
            <a href="mailto:contatodxcreative@gmail.com" className="text-brand-600 hover:underline">
              contatodxcreative@gmail.com
            </a>
          </p>
        </div>

      </article>
    </div>
  )
}
