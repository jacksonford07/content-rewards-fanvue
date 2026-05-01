import { useCallback, useEffect, useState } from "react"
import api from "@/lib/api"
import { AuthContext, type AuthUser } from "@/hooks/use-auth"
import { identify, resetIdentity } from "@/lib/analytics"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("cr_token")
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const res = await api.get("/auth/me")
      setUser(res.data)
      // M5.1 — re-identify on every auth resolve. Idempotent in PostHog.
      if (res.data?.id) identify(res.data.id)
    } catch {
      localStorage.removeItem("cr_token")
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = () => {
    localStorage.removeItem("cr_token")
    setUser(null)
    resetIdentity()
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
