import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Medflow',
  description: 'Como o Medflow coleta, usa e protege seus dados pessoais.',
}

export default function PoliticaDePrivacidade() {
  return (
    <div className="min-h-screen bg-neutro-50 dark:bg-neutro-950 py-12 px-4">
      <article className="max-w-2xl mx-auto prose prose-neutro dark:prose-invert prose-sm sm:prose-base">

        <div className="not-prose mb-8">
          <Link href="/" className="text-brand-600 text-sm hover:underline">← Voltar</Link>
        </div>

        <h1>Política de Privacidade</h1>
        <p className="lead">
          Esta política descreve como a plataforma Medflow trata dados pessoais em conformidade
          com a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018).
        </p>
        <p className="text-neutro-500 text-sm">Última atualização: 31 de agosto de 2026.</p>

        <h2>1. Quem somos</h2>
        <p>
          O Medflow é uma plataforma SaaS de gestão clínica desenvolvida por{' '}
          <strong>DX Creative</strong> (contato: contatodxcreative@gmail.com). Na relação com
          seus dados, o Medflow atua como <strong>operador de dados</strong>: processa
          informações por conta e sob instrução das clínicas e consultórios (os{' '}
          <strong>controladores</strong>) que contratam a plataforma.
        </p>

        <h2>2. Dados coletados</h2>
        <h3>Dados dos profissionais e equipe (usuários do sistema)</h3>
        <ul>
          <li>Nome completo, endereço de e-mail e senha (armazenada exclusivamente em hash bcrypt).</li>
          <li>Foto de perfil (opcional), registro profissional (CRM/CBOO) e cargo.</li>
        </ul>

        <h3>Dados dos pacientes</h3>
        <ul>
          <li>Identificação: nome, CPF, RG, data de nascimento, sexo, e-mail, telefone.</li>
          <li>Endereço e convênio.</li>
          <li>
            <strong>Dados de saúde (categoria especial — art. 11 LGPD):</strong> prontuários
            clínicos, resultados de exames, diagnósticos, prescrições e receitas ópticas.
          </li>
          <li>Histórico de agendamentos.</li>
        </ul>

        <h3>Dados de acesso</h3>
        <ul>
          <li>Endereços IP registrados nas tentativas de login e nas ações de auditoria.</li>
          <li>Cookies de sessão necessários para autenticação (NextAuth JWT).</li>
        </ul>

        <h2>3. Finalidades e base legal</h2>
        <p>
          O tratamento de dados ocorre exclusivamente para as finalidades abaixo, com as
          respectivas bases legais da LGPD:
        </p>
        <ul>
          <li>
            <strong>Gestão do prontuário e da receita óptica:</strong> proteção da saúde e
            prestação de serviços médicos (art. 11, II, f).
          </li>
          <li>
            <strong>Agendamento de consultas:</strong> execução de contrato (art. 7º, V).
          </li>
          <li>
            <strong>Faturamento e gestão financeira:</strong> execução de contrato e cumprimento
            de obrigação legal (arts. 7º, V e VI).
          </li>
          <li>
            <strong>Segurança e prevenção a fraudes:</strong> legítimo interesse do controlador
            (art. 7º, IX).
          </li>
          <li>
            <strong>Auditoria e conformidade regulatória:</strong> cumprimento de obrigação
            legal (art. 7º, II).
          </li>
        </ul>
        <p>
          Nenhum dado pessoal é utilizado para publicidade, perfilamento ou compartilhado com
          terceiros para fins comerciais.
        </p>

        <h2>4. Cookies</h2>
        <p>
          O Medflow utiliza exclusivamente cookies essenciais para o funcionamento da sessão de
          autenticação (JWT assinado pelo servidor). Não são utilizados cookies de rastreamento,
          analytics de terceiros ou publicidade. O cookie de sessão é excluído automaticamente
          ao sair do sistema.
        </p>

        <h2>5. Compartilhamento de dados</h2>
        <p>
          Os dados não são vendidos nem cedidos a terceiros. Podem ser acessados por
          suboperadores técnicos estritamente necessários para a operação da plataforma:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> — hospedagem da aplicação (EUA; transferência internacional
            amparada em cláusulas contratuais padrão).
          </li>
          <li>
            <strong>Neon</strong> — banco de dados PostgreSQL com criptografia em repouso
            (AES-256).
          </li>
        </ul>

        <h2>6. Retenção dos dados</h2>
        <p>
          Os dados de pacientes são mantidos enquanto o consultório mantiver a assinatura ativa.
          Prontuários e receitas seguem o prazo mínimo estabelecido pelos conselhos
          profissionais (CFO e CFM: 20 e 5 anos respectivamente). Após cancelamento, os dados
          são anonimizados ou eliminados em até 30 dias, salvo obrigação legal em contrário.
        </p>

        <h2>7. Segurança</h2>
        <p>Medidas técnicas e organizacionais implementadas:</p>
        <ul>
          <li>Senhas armazenadas em hash bcrypt (fator de custo 12).</li>
          <li>Comunicação cifrada via TLS/HTTPS (HSTS habilitado).</li>
          <li>Banco de dados com criptografia em repouso (AES-256 via Neon).</li>
          <li>Controle de acesso baseado em papéis (RBAC) com isolamento por consultório.</li>
          <li>Limitação de tentativas de login (rate limiting) por e-mail e IP.</li>
          <li>Trilha de auditoria para ações críticas (criação de prontuários e receitas).</li>
          <li>Cabeçalhos de segurança HTTP (CSP, X-Frame-Options, X-Content-Type-Options).</li>
        </ul>

        <h2>8. Direitos dos titulares</h2>
        <p>
          Nos termos dos arts. 17-22 da LGPD, os titulares de dados têm direito a:
        </p>
        <ul>
          <li>Confirmação da existência de tratamento e acesso aos dados.</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.</li>
          <li>
            Portabilidade dos dados a outro fornecedor (sujeito a regulamentação da ANPD).
          </li>
          <li>
            Eliminação dos dados tratados com consentimento (ressalvadas obrigações legais de
            retenção de prontuários).
          </li>
          <li>Informação sobre compartilhamento com terceiros.</li>
          <li>Revogação do consentimento, quando for a base legal utilizada.</li>
        </ul>
        <p>
          Para exercer esses direitos, entre em contato com o consultório que detém seus dados
          ou diretamente com o Medflow pelo e-mail:{' '}
          <a href="mailto:contatodxcreative@gmail.com">contatodxcreative@gmail.com</a>.
        </p>

        <h2>9. Encarregado de proteção de dados (DPO)</h2>
        <p>
          A designação formal de DPO está em curso. Enquanto isso, questões sobre privacidade
          devem ser enviadas para{' '}
          <a href="mailto:contatodxcreative@gmail.com">contatodxcreative@gmail.com</a>{' '}
          com o assunto "LGPD".
        </p>

        <h2>10. Alterações</h2>
        <p>
          Esta política pode ser atualizada para refletir mudanças na lei ou na plataforma.
          Alterações relevantes serão comunicadas aos usuários dentro do sistema. A versão
          vigente é sempre acessível nesta página.
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
