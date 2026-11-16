import { SignInMedflow } from '@/components/ui/sign-in'
import { DEPOIMENTOS } from '@/lib/depoimentos'

export default function LoginPage() {
  return <SignInMedflow depoimentos={DEPOIMENTOS} />
}
