import { useEffect } from "react"
import {
  FilmSlate,
  Sparkle,
  Lightning,
  CurrencyDollar,
  Users,
  ShieldCheck,
  ArrowSquareOut,
  Confetti,
} from "@phosphor-icons/react"
import { useLocation, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

const POST_LOGIN_REDIRECT_KEY = "cr_post_login_redirect"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const error = searchParams.get("error")

  useEffect(() => {
    // Capture where the user was headed before AuthGuard kicked them to /login,
    // so the auth callback can send them back after sign-in.
    const fromState = location.state as { from?: { pathname?: string; search?: string } } | null
    const fromPath = fromState?.from?.pathname
    if (fromPath && fromPath !== "/login") {
      const search = fromState?.from?.search ?? ""
      localStorage.setItem(POST_LOGIN_REDIRECT_KEY, fromPath + search)
    }
  }, [location.state])

  useEffect(() => {
    // `not_creator` is an onboarding state, not an error — handled inline.
    // `fanvue_rejected` covers transient OAuth hiccups (user cancelled, replayed callback,
    // scope misconfig) — noisy for users, we already log it server-side.
    // Only surface `auth_failed`, which means something unexpected broke on our side.
    if (error === "auth_failed") {
      toast.error("Couldn't sign in. Please try again.")
    }
    if (error && error !== "not_creator") {
      const next = new URLSearchParams(searchParams)
      next.delete("error")
      next.delete("reason")
      next.delete("desc")
      setSearchParams(next, { replace: true })
    }
  }, [error, searchParams, setSearchParams])

  const handleSignIn = () => {
    const apiUrl = import.meta.env.VITE_API_URL || ""
    window.location.href = `${apiUrl}/api/auth/fanvue`
  }

  return (
    <div className="relative flex min-h-svh">
      {/* ========== Left panel — branding ========== */}
      <div className="hidden w-[480px] shrink-0 flex-col justify-between overflow-hidden border-r border-border/40 bg-gradient-to-b from-primary/10 via-background to-background p-10 lg:flex xl:w-[520px]">
        <div className="flex items-center gap-3">
          <LogoMark size="lg" />
          <div>
            <span className="text-lg font-semibold">Content Rewards</span>
            <p className="text-xs text-muted-foreground">powered by Fanvue</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Turn your content into a{" "}
              <span className="text-gradient">clipping marketplace</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Fund campaigns, upload source videos, and let creators worldwide
              spread your content as short-form clips on TikTok, Instagram
              Reels, and YouTube.
            </p>
          </div>

          <div className="space-y-5">
            <FeatureRow
              icon={<CurrencyDollar className="size-5" weight="fill" />}
              title="Performance-based payouts"
              description="Pay per 1,000 verified views — budget stays in escrow until results land."
            />
            <FeatureRow
              icon={<Users className="size-5" weight="fill" />}
              title="Creator-to-creator"
              description="Both campaign owners and clippers are verified Fanvue creator accounts."
            />
            <FeatureRow
              icon={<ShieldCheck className="size-5" weight="fill" />}
              title="AI moderation + 48h review"
              description="Every submission is AI pre-screened. You get 48 hours to approve or reject."
            />
            <FeatureRow
              icon={<Lightning className="size-5" weight="fill" />}
              title="Multi-platform reach"
              description="Clips posted to TikTok, Instagram Reels, and YouTube."
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex -space-x-2">
              {["Alex", "Mia", "Zara", "Leo"].map((seed) => (
                <img
                  key={seed}
                  src={`https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`}
                  alt=""
                  className="size-8 rounded-full border-2 border-background bg-muted"
                />
              ))}
            </div>
            <span>
              Join <strong className="text-foreground">2,400+</strong> creators
              already earning
            </span>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Free to install. No platform fees in the app.
          </p>
        </div>
      </div>

      {/* ========== Right panel — auth ========== */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-12 sm:px-8">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <LogoMark size="sm" />
            <div>
              <span className="font-semibold">Content Rewards</span>
              <p className="text-[11px] text-muted-foreground">
                powered by Fanvue
              </p>
            </div>
          </div>

          {/* Auth card */}
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardContent className="p-6">
              {error === "not_creator" ? (
                <CreatorOnboardingView onRetry={handleSignIn} />
              ) : (
                <>
                  <div className="mb-6 text-center">
                    <div className="mb-4 flex justify-center lg:hidden">
                      <LogoMark size="lg" />
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight">
                      Sign in to Content Rewards
                    </h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Use your Fanvue account to get started.
                    </p>
                  </div>

                  <Button className="w-full" size="lg" onClick={handleSignIn}>
                    <ArrowSquareOut className="mr-2 size-4" />
                    Sign in with Fanvue
                  </Button>

                  {import.meta.env.DEV && (
                    <div className="mt-4 space-y-2 rounded-lg border border-dashed border-yellow-500/40 bg-yellow-500/5 p-3">
                      <p className="text-center text-xs font-medium text-yellow-600">
                        Dev Login
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            const apiUrl =
                              import.meta.env.VITE_API_URL || ""
                            window.location.href = `${apiUrl}/api/auth/dev-login?role=clipper`
                          }}
                        >
                          Clipper
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            const apiUrl =
                              import.meta.env.VITE_API_URL || ""
                            window.location.href = `${apiUrl}/api/auth/dev-login?role=creator`
                          }}
                        >
                          Creator
                        </Button>
                      </div>
                    </div>
                  )}

                  <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/60">
                    By continuing you agree to Fanvue's Terms of Service.
                    <br />
                    Content Rewards is a third-party app on the Fanvue
                    platform.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function LogoMark({ size }: { size: "sm" | "lg" }) {
  const s = size === "lg" ? "size-11" : "size-10"
  const icon = size === "lg" ? "size-6" : "size-5"
  const dot = size === "lg" ? "size-3.5" : "size-3"
  const dotIcon = size === "lg" ? "size-2.5" : "size-2"

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg",
        s,
      )}
    >
      <FilmSlate
        weight="fill"
        className={cn(icon, "text-primary-foreground")}
      />
      <span
        className={cn(
          "absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-background",
          dot,
        )}
      >
        <Sparkle weight="fill" className={cn(dotIcon, "text-primary")} />
      </span>
    </div>
  )
}

function CreatorOnboardingView({ onRetry }: { onRetry: () => void }) {
  // v1.1: KYC and the creator-only gate are gone, so this view is a fallback
  // that should not normally render. Backend will stop returning
  // `not_creator` once M1.2 lands; this stays as a generic retry surface in
  // case anything still bounces a sign-in.
  return (
    <div>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
          <Confetti weight="fill" className="size-7 text-primary" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          We couldn't sign you in
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Something went wrong with the Fanvue sign-in flow. Try again — if
          it keeps failing, refresh the page or sign back into Fanvue.
        </p>
      </div>

      <Button className="w-full" size="lg" onClick={onRetry}>
        <ArrowSquareOut className="mr-2 size-4" />
        Try signing in again
      </Button>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/60">
        Content Rewards is a third-party app on the Fanvue platform.
      </p>
    </div>
  )
}

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  )
}
