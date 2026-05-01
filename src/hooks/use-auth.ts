import { createContext, useContext } from "react"
import type {
  ClipperPaymentMethod,
  ContactMethod,
} from "@/lib/payment-methods"

export interface AuthUser {
  id: string
  email?: string
  handle: string
  displayName: string
  avatarUrl: string | null
  fanvueHandle: string | null
  fanvueAvatarUrl: string | null
  isCreator: boolean
  role: string

  walletBalance: number
  contactMethod: ContactMethod | null
  contactHandle: string | null
  paymentMethods: ClipperPaymentMethod[]
  createdAt: string
}

export interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  logout: () => void
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>(null!)

export function useAuth() {
  return useContext(AuthContext)
}
