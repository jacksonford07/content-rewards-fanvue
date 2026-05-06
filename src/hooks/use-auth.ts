import { createContext, useContext } from "react"

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

  isAdmin?: boolean
  fanvueScopes?: string[]
  // v1.2 M2.5 — creator-self-reported Fanvue page subscription price.
  // null = not set; 0 = free page; >0 = monthly price in cents.
  fanvuePageSubPriceCents?: number | null

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
