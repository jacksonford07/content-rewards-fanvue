import { useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import api from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"
import { queryClient } from "@/lib/query-client"

const POST_LOGIN_REDIRECT_KEY = "cr_post_login_redirect"

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const ran = useRef(false)

  useEffect(() => {
    // refresh() updates AuthProvider state, which changes this hook's identity
    // and re-fires the effect. Guard with a ref so the callback runs once.
    if (ran.current) return
    ran.current = true

    const token = searchParams.get("accessToken")
    if (!token) {
      navigate("/login", { replace: true })
      return
    }
    localStorage.setItem("cr_token", token)
    // Drop any cached data from a previous session — protects against an
    // account A → account B switch where staleTime would otherwise keep
    // showing A's data until React Query refetches.
    queryClient.clear()

    // Peek at the user's role BEFORE committing to a destination.
    // Dev-login users already have a locked role (clipper/creator); skip role-select.
    // Fanvue OAuth users come back with role="both" (unchosen) → go to /select-role.
    api.get("/auth/me").then((res) => {
      const role = res.data?.role
      refresh().then(() => {
        // Send them back to the private link (or wherever they were heading)
        // if we saved one on the way to /login. Keep the redirect key until
        // role-select for users that still need to pick a role.
        const hasRole = role === "clipper" || role === "creator"
        const savedRedirect = localStorage.getItem(POST_LOGIN_REDIRECT_KEY)

        if (hasRole && savedRedirect) {
          localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
          navigate(savedRedirect, { replace: true })
          return
        }

        if (role === "clipper") navigate("/", { replace: true })
        else if (role === "creator")
          navigate("/creator/campaigns", { replace: true })
        else navigate("/select-role", { replace: true })
      })
    }).catch(() => {
      navigate("/login", { replace: true })
    })
  }, [searchParams, navigate, refresh])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}
