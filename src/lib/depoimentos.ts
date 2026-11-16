/**
 * Os depoimentos, num lugar só.
 *
 * Moraram dentro de `src/app/login/page.tsx` enquanto o login era a única
 * porta de entrada. Agora a apresentação também os mostra, e duas cópias da
 * mesma lista acabariam divergindo — alguém corrige um nome num arquivo e
 * esquece o outro, e o site passa a contar duas versões da mesma história.
 *
 * O tipo continua declarado em `components/ui/sign-in.tsx`, que é quem desenha
 * o cartão; aqui ficam só os dados.
 */

import type { Depoimento } from '@/components/ui/sign-in'

export const DEPOIMENTOS: Depoimento[] = [
  {
    avatarSrc: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=80&q=80',
    nome: 'Dra. Camila Ramos',
    cargo: 'Optometrista · SP',
    texto: 'Reduzi 80% do tempo em agendamentos. Indispensável.',
    stat: { numero: '98%', label: 'Satisfação' },
  },
  {
    avatarSrc: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=80&q=80',
    nome: 'Dr. André Ferreira',
    cargo: 'Oftalmologista · RJ',
    texto: 'Prontuários e agenda integrados. Ganho horas por semana.',
    stat: { numero: '+500', label: 'Clínicas' },
  },
  {
    avatarSrc: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=80&q=80',
    nome: 'Dra. Mariana Costa',
    cargo: 'Clínica Geral · MG',
    texto: 'O financeiro integrado mudou como eu gerencio a clínica.',
    stat: { numero: '4.9★', label: 'Avaliação' },
  },
  {
    avatarSrc: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80&q=80',
    nome: 'Dr. Rafael Souza',
    cargo: 'Ortopedista · RS',
    texto: 'Lembretes automáticos zeraram as faltas dos meus pacientes.',
    stat: { numero: '2M+', label: 'Consultas' },
  },
]
