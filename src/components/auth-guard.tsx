import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // User hasn't picked clipper/creator yet — force them to /select-role
  if (user.role !== "clipper" && user.role !== "creator" && location.pathname !== "/select-role") {
    return <Navigate to="/select-role" replace />
  }

  return <>{children}</>
}
