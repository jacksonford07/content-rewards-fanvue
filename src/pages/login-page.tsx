import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  FilmSlate,
  Sparkle,
  Lightning,
  CurrencyDollar,
  Users,
  ShieldCheck,
  ArrowSquareOut,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleFanvueAuth = () => {
    setLoading(true)
    // In production: window.location.href = `${FANVUE_OAUTH_URL}?client_id=...&redirect_uri=...`
    setTimeout(() => {
      setLoading(false)
      toast.success("Welcome back!", {
        description: "Signed in via Fanvue successfully.",
      })
      navigate("/")
    }, 1500)
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
              Reels, and YouTube Shorts.
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
              description="Clips posted to TikTok, Instagram Reels, and YouTube Shorts."
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
              <div className="mb-6 text-center">
                {/* Desktop: hide logo since left panel has it */}
                <div className="mb-4 flex justify-center lg:hidden">
                  <LogoMark size="lg" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">
                  Sign in to Content Rewards
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Connect your Fanvue creator account to get started.
                </p>
              </div>

              {/* Primary CTA */}
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleFanvueAuth}
                disabled={loading}
              >
                <FanvueLogo />
                {loading ? "Connecting to Fanvue..." : "Continue with Fanvue"}
              </Button>

              {/* What happens next */}
              <div className="mt-6 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What happens next
                </p>
                <div className="space-y-2.5">
                  <StepRow
                    number="1"
                    text="You'll be redirected to Fanvue to sign in or create an account"
                  />
                  <StepRow
                    number="2"
                    text="Fanvue verifies your creator account status"
                  />
                  <StepRow
                    number="3"
                    text="You're brought back here — ready to browse or create campaigns"
                  />
                </div>
              </div>

              <Separator className="my-6" />

              {/* Don't have an account */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Don't have a Fanvue account?
                </p>
                <Button
                  variant="link"
                  className="mt-1 h-auto gap-1 p-0 text-primary"
                  onClick={handleFanvueAuth}
                  disabled={loading}
                >
                  Create one on Fanvue
                  <ArrowSquareOut className="size-3.5" />
                </Button>
              </div>

              {/* Footer */}
              <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/60">
                By continuing you agree to Fanvue's Terms of Service.
                <br />
                Content Rewards is a third-party app on the Fanvue platform.
              </p>
            </CardContent>
          </Card>

          {/* Fan account notice */}
          <Alert className="border-warning/30 bg-warning/5">
            <ShieldCheck className="size-4 text-warning" weight="fill" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong className="text-foreground">
                Have a fan account?
              </strong>{" "}
              Content Rewards requires a creator account. You'll be guided
              through KYC and account upgrade after signing in.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StepRow({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted text-xs font-semibold text-muted-foreground">
        {number}
      </span>
      <p className="text-sm text-muted-foreground pt-0.5">{text}</p>
    </div>
  )
}

function LogoMark({ size }: { size: "sm" | "lg" }) {
  const s = size === "lg" ? "size-11" : "size-10"
  const icon = size === "lg" ? "size-6" : "size-5"
  const dot = size === "lg" ? "size-3.5" : "size-3"
  const dotIcon = size === "lg" ? "size-2.5" : "size-2"

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg",
        s
      )}
    >
      <FilmSlate weight="fill" className={cn(icon, "text-primary-foreground")} />
      <span
        className={cn(
          "absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-background",
          dot
        )}
      >
        <Sparkle weight="fill" className={cn(dotIcon, "text-primary")} />
      </span>
    </div>
  )
}

function FanvueLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5v-7L7 14l4-9.5v7l4-3.5-4 9.5z"
        fill="currentColor"
      />
    </svg>
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
