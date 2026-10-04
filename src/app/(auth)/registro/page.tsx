import type { Metadata } from 'next'
import { SignUpForm } from './SignUpForm'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default function SignUpPage() {
  return <SignUpForm />
}
