import { useCallback, useEffect, useState } from "react"
import api from "@/lib/api"
import { AuthContext, type AuthUser } from "@/hooks/use-auth"
import { identify, reset } from "@/lib/analytics"

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
      // v1.2 M4 — identify in PostHog. No-op when VITE_POSTHOG_KEY unset.
      identify(res.data.id, { role: res.data.role, handle: res.data.handle })
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
    reset()
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
