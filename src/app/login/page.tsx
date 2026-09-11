import { SignInMedflow, type Depoimento } from '@/components/ui/sign-in'

const depoimentos: Depoimento[] = [
  {
    avatarSrc: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=80&q=80',
    nome: 'Dra. Camila Ramos',
    cargo: 'Optometrista · SP',
    texto: 'Reduzi 80% do tempo em agendamentos. O Medflow é indispensável.',
  },
  {
    avatarSrc: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=80&q=80',
    nome: 'Dr. André Ferreira',
    cargo: 'Oftalmologista · RJ',
    texto: 'Prontuários digitais e agenda integrada — tudo num só lugar.',
  },
]

export default function LoginPage() {
  return <SignInMedflow depoimentos={depoimentos} />
}
