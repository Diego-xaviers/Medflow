import { createInterface } from 'readline'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

/**
 * Cria a conta de administração do SaaS num banco vazio.
 *
 * Existe separado do seed de propósito. O seed é para desenvolvimento: monta a
 * Ótica Exemplo, pacientes fictícios e senhas iguais para todo mundo, escritas
 * no README. Rodar aquilo em produção seria despejar dados falsos no ambiente
 * dos clientes e publicar credenciais conhecidas.
 *
 * Aqui é o mínimo: uma conta, com senha escolhida na hora e digitada no
 * terminal — nunca passada como argumento, que ficaria no histórico do shell.
 *
 *   npx tsx prisma/criarSuperAdmin.ts "Seu Nome" seu@email.com
 */

const prisma = new PrismaClient()

/** Lê a senha sem ecoar na tela. */
function perguntarSenha(rotulo: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  return new Promise((resolve) => {
    const saida = process.stdout as any
    const escrever = saida.write.bind(saida)
    let escondendo = false

    // Enquanto a pergunta está no ar, engolimos o eco dos caracteres.
    saida.write = (pedaco: any, ...resto: any[]) =>
      escondendo ? true : escrever(pedaco, ...resto)

    rl.question(rotulo, (resposta) => {
      escondendo = false
      saida.write = escrever
      saida.write('\n')
      rl.close()
      resolve(resposta)
    })
    escondendo = true
  })
}

async function main() {
  const [nome, email] = process.argv.slice(2)

  if (!nome || !email) {
    console.error('Uso: npx tsx prisma/criarSuperAdmin.ts "Seu Nome" seu@email.com')
    process.exitCode = 1
    return
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('E-mail inválido.')
    process.exitCode = 1
    return
  }

  const jaExisteAdmin = await prisma.usuario.findFirst({
    where: { papel: 'SUPER_ADMIN' },
    select: { email: true },
  })
  if (jaExisteAdmin) {
    console.error(
      `Já existe um super admin neste banco (${jaExisteAdmin.email}).\n` +
        'Se a intenção era outra conta, crie pelo banco ou remova a existente antes.'
    )
    process.exitCode = 1
    return
  }

  const emailNormalizado = email.toLowerCase().trim()
  const emUso = await prisma.usuario.findUnique({
    where: { email: emailNormalizado },
    select: { id: true },
  })
  if (emUso) {
    console.error('Já existe um usuário com esse e-mail.')
    process.exitCode = 1
    return
  }

  const senha = await perguntarSenha('Senha do super admin (mínimo 12 caracteres): ')
  if (senha.length < 12) {
    console.error('Senha curta demais. Esta conta enxerga os chamados de todos os consultórios.')
    process.exitCode = 1
    return
  }
  const confirmacao = await perguntarSenha('Confirme a senha: ')
  if (senha !== confirmacao) {
    console.error('As senhas não conferem.')
    process.exitCode = 1
    return
  }

  const usuario = await prisma.usuario.create({
    data: {
      nome: nome.trim(),
      email: emailNormalizado,
      senhaHash: await bcrypt.hash(senha, 12),
      papel: 'SUPER_ADMIN',
      // Sem consultorioId: o super admin está acima dos consultórios.
    },
    select: { nome: true, email: true },
  })

  console.log(`\nSuper admin criado: ${usuario.nome} <${usuario.email}>`)
  console.log('Entre em /login e cadastre os consultórios em /admin.')
}

main()
  .catch((e) => {
    console.error('Falhou:', e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
