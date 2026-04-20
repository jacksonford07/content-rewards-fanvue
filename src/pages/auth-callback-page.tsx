import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import api from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()

  useEffect(() => {
    const token = searchParams.get("accessToken")
    if (!token) {
      navigate("/login", { replace: true })
      return
    }
    localStorage.setItem("cr_token", token)

    // Peek at the user's role BEFORE committing to a destination.
    // Dev-login users already have a locked role (clipper/creator); skip role-select.
    // Fanvue OAuth users come back with role="both" (unchosen) → go to /select-role.
    api.get("/auth/me").then((res) => {
      const role = res.data?.role
      refresh().then(() => {
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
